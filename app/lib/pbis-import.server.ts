import ExcelJS from "exceljs";
import { pbisDb } from "../db.pbis.server";

export type ImportResult = {
  status: "success" | "partial" | "error";
  rowsProcessed: number;
  uniqueClients: number;
  upserted: number;
  errors: string[];
  importRunId: string;
};

type AnyCell = { value: unknown };

function cellText(cell: AnyCell): string | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && v !== null && "text" in v) {
    const t = (v as { text?: unknown }).text;
    return t == null ? null : String(t).trim() || null;
  }
  if (typeof v === "object" && v !== null && "result" in v) {
    const r = (v as { result?: unknown }).result;
    return r == null ? null : String(r).trim() || null;
  }
  return String(v).trim() || null;
}

function cellNumber(cell: AnyCell): number | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "result" in v) {
    const r = (v as { result?: unknown }).result;
    if (typeof r === "number") return r;
  }
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : null;
}

function cellBool(cell: AnyCell): boolean {
  const v = cellText(cell);
  if (!v) return false;
  return ["oui", "yes", "true", "1", "x", "o"].includes(v.toLowerCase());
}

export async function importPbisExcel(data: ArrayBuffer, filename: string): Promise<ImportResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  const sheet = workbook.worksheets[0];

  // Map des headers
  const headerRow = sheet.getRow(1);
  const headers: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const v = cellText(cell as AnyCell);
    if (v) headers[v] = colNumber;
  });

  const required = ["SHIP_TO", "RAISON_SOCIALE_SOLDTO", "SIRET_SHIPTO"];
  const missing = required.filter((h) => !headers[h]);

  const importRun = await pbisDb.pbisImportRun.create({
    data: { filename, rowCount: 0, status: missing.length > 0 ? "error" : "processing" },
  });

  if (missing.length > 0) {
    await pbisDb.pbisImportRun.update({
      where: { id: importRun.id },
      data: { status: "error", errorLog: `Colonnes manquantes : ${missing.join(", ")}` },
    });
    return {
      status: "error",
      rowsProcessed: 0,
      uniqueClients: 0,
      upserted: 0,
      errors: [`Colonnes manquantes : ${missing.join(", ")}`],
      importRunId: importRun.id,
    };
  }

  const getCell = (row: ExcelJS.Row, header: string): AnyCell =>
    row.getCell(headers[header]) as unknown as AnyCell;

  const clientsMap = new Map<string, Record<string, unknown>>();
  let rowsProcessed = 0;
  const parseErrors: string[] = [];

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    if (!row.hasValues) continue;

    const shipTo = cellText(getCell(row, "SHIP_TO"));
    if (!shipTo) continue;

    rowsProcessed++;
    const loyer = cellNumber(getCell(row, "TOTAL_LOYER_ANNUAL")) ?? 0;

    if (clientsMap.has(shipTo)) {
      const c = clientsMap.get(shipTo)!;
      c.contractsCount = (c.contractsCount as number) + 1;
      c.totalLoyerAnnual = ((c.totalLoyerAnnual as number) ?? 0) + loyer;
    } else {
      clientsMap.set(shipTo, {
        shipTo,
        compteClientBillTo: cellText(getCell(row, "COMPTE_CLIENT_BILL_TO")) ?? "",
        soldTo: cellText(getCell(row, "SOLD_TO")) ?? "",
        companyName: cellText(getCell(row, "RAISON_SOCIALE_SOLDTO")) ?? "",
        customerNameShipTo: cellText(getCell(row, "CUSTOMER_NAME_SHIPTO")),
        street: cellText(getCell(row, "STREET_NAME_SOLDTO")) ?? "",
        postcode: cellText(getCell(row, "POSTCODE_SOLDTO")) ?? "",
        city: cellText(getCell(row, "CITY_SOLDTO")) ?? "",
        streetShipTo: cellText(getCell(row, "STREET_NAME_SHIPTO")),
        postcodeShipTo: cellText(getCell(row, "POSTCODE_SHIPTO")),
        cityShipTo: cellText(getCell(row, "CITY_SHIPTO")),
        siren: cellText(getCell(row, "SIREN_SHIPTO")) ?? "",
        siret: cellText(getCell(row, "SIRET_SHIPTO")) ?? "",
        vatNumber: cellText(getCell(row, "VAT_NUMBER")),
        contactFirstName: cellText(getCell(row, "FIRSTNAME_CONTACT_PRINCIPAL")),
        contactLastName: cellText(getCell(row, "LASTNAME_CONTACT_PRINCIPAL")),
        contactEmail: cellText(getCell(row, "EMAIL_CONTACT_PRINCIPAL")),
        contactPhone: cellText(getCell(row, "PHONE_CONTACT_PRINCIPAL")),
        vendeur: cellText(getCell(row, "VENDEUR")),
        employees: cellNumber(getCell(row, "EMPLOYEES")),
        codeNaf: cellText(getCell(row, "CODE_NAF")),
        nafDescription: cellText(getCell(row, "NAF Desc")),
        sectionDescription: cellText(getCell(row, "Section Desc")),
        plis2024: cellNumber(getCell(row, "PLIS_2024")),
        plis2025: cellNumber(getCell(row, "PLIS_2025")),
        flagPaperless: cellBool(getCell(row, "FLAG_PAPERLESS")),
        contractsCount: 1,
        totalLoyerAnnual: loyer,
        importRunId: importRun.id,
      });
    }
  }

  const clients = Array.from(clientsMap.values());
  let upserted = 0;
  const batchSize = 50;

  for (let i = 0; i < clients.length; i += batchSize) {
    const batch = clients.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((c) =>
        pbisDb.pbisClient.upsert({
          where: { shipTo: c.shipTo as string },
          create: c as never,
          update: c as never,
        })
      )
    );
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        upserted++;
      } else {
        parseErrors.push(`${batch[idx].shipTo}: ${(r.reason as Error)?.message ?? "unknown"}`);
      }
    });
  }

  const status = parseErrors.length === 0 ? "success" : "partial";
  await pbisDb.pbisImportRun.update({
    where: { id: importRun.id },
    data: {
      rowCount: clients.length,
      status,
      errorLog: parseErrors.length > 0 ? parseErrors.slice(0, 100).join("\n") : null,
    },
  });

  return {
    status,
    rowsProcessed,
    uniqueClients: clients.length,
    upserted,
    errors: parseErrors.slice(0, 20),
    importRunId: importRun.id,
  };
}