import type { LoaderFunctionArgs } from "react-router";
import ExcelJS from "exceljs";
import { requireAdmin } from "~/lib/pbis-admin-auth.server";
import pbisDb from "../db.pbis.server";

const HEADERS = [
  "Raison sociale",
  "Numéro client",
  "SIRET",
  "TVA",
  "Adresse de facturation",
  "Code postal",
  "Ville",
  "Contact - Prénom",
  "Contact - Nom",
  "Contact - E-mail",
  "Contact - Fonction",
  "Contact - Rôle",
  "E-mail de réception factures",
  "Signataire - Prénom",
  "Signataire - Nom",
  "Signataire - Fonction",
  "Signataire - Téléphone",
  "Signataire - E-mail",
  "Référence de commande",
  "Date de signature",
  "Référence Yousign",
];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const rows = await pbisDb.pbisAcceptance.findMany({
    where: { signedAt: { not: null } },
    orderBy: { signedAt: "desc" },
    include: {
      client: {
        select: {
          compteClientBillTo: true,
          companyName: true,
          siret: true,
          vatNumber: true,
          street: true,
          postcode: true,
          city: true,
          contactFirstName: true,
          contactLastName: true,
          contactEmail: true,
          contactPhone: true,
        },
      },
    },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Souscriptions");

  ws.addRow(HEADERS);
  ws.getRow(1).font = { bold: true };

  const fmtDate = (d: Date | null) =>
    d ? new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "";

  for (const a of rows) {
    ws.addRow([
      a.companyName ?? a.client?.companyName ?? "",
      a.client?.compteClientBillTo ?? "",
      a.siret ?? a.client?.siret ?? "",
      a.vatNumber ?? a.client?.vatNumber ?? "",
      a.billingStreet ?? a.client?.street ?? "",
      a.billingPostcode ?? a.client?.postcode ?? "",
      a.billingCity ?? a.client?.city ?? "",
      a.contactFirstName ?? a.client?.contactFirstName ?? "",
      a.contactLastName ?? a.client?.contactLastName ?? "",
      a.contactEmail ?? a.client?.contactEmail ?? "",
      a.contactFunction ?? "",
      a.contactRole ?? "",
      a.receptionEmail ?? "",
      a.signatoryFirstName ?? "",
      a.signatoryLastName ?? "",
      a.signatoryFunction ?? "",
      a.signatoryPhone ?? "",
      a.signatoryEmail ?? "",
      a.orderReference ?? "",
      fmtDate(a.signedAt),
      a.yousignProcedureId ?? "",
    ]);
  }

  // Format texte sur toutes les cellules : empêche Excel de reformater SIRET, TVA, téléphones.
  ws.columns.forEach((col) => {
    col.width = 24;
    col.eachCell?.((cell) => {
      cell.numFmt = "@";
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `souscriptions-pbis-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}