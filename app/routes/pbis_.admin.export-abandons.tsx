import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/pbis-admin-auth.server";
import pbisDb from "~/db.pbis.server";
import ExcelJS from "exceljs";

const STEP_FR: Record<string, string> = {
  Offres: "Offres",
  "Détail offre": "Détail offre",
  Informations: "Informations",
  Récapitulatif: "Récapitulatif",
  Signature: "Signature",
};

function fmt(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  // Abandons = clients entrés dans le parcours Start mais non signés.
  const rows = await pbisDb.pbisFunnelProgress.findMany({
    where: { status: { not: "signed" } },
    select: {
      lastStepName: true,
      firstSeenAt: true,
      lastSeenAt: true,
      client: {
        select: {
          shipTo: true,
          companyName: true,
          contactEmail: true,
          contactPhone: true,
        },
      },
    },
    orderBy: { lastSeenAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Abandons");

  sheet.columns = [
    { header: "N° Client (SHIP_TO)", key: "shipTo", width: 18 },
    { header: "Raison sociale", key: "name", width: 40 },
    { header: "Email contact", key: "email", width: 35 },
    { header: "Téléphone", key: "phone", width: 18 },
    { header: "Dernière étape atteinte", key: "step", width: 22 },
    { header: "Première visite", key: "first", width: 20 },
    { header: "Dernière activité", key: "last", width: 20 },
  ];

  sheet.getColumn("shipTo").numFmt = "@";
  sheet.getColumn("phone").numFmt = "@";

  for (const r of rows) {
    sheet.addRow({
      shipTo: r.client.shipTo,
      name: r.client.companyName,
      email: r.client.contactEmail || "",
      phone: r.client.contactPhone || "",
      step: r.lastStepName ? (STEP_FR[r.lastStepName] ?? r.lastStepName) : "",
      first: fmt(r.firstSeenAt),
      last: fmt(r.lastSeenAt),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="abandons-pbis-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}