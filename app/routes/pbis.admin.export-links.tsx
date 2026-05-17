import type { LoaderFunctionArgs } from "react-router";
import pbisDb from "~/db.pbis.server";
import ExcelJS from "exceljs";

export async function loader({ request }: LoaderFunctionArgs) {
  void request;

  const clients = await pbisDb.pbisClient.findMany({
    where: {
      accessToken: { isNot: null },
    },
    select: {
      shipTo: true,
      companyName: true,
      siret: true,
      contactEmail: true,
      accessToken: { select: { token: true } },
    },
    orderBy: { shipTo: "asc" },
  });

  const appUrl = process.env.APP_URL || "https://pbis-production.up.railway.app";

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Liens");

  sheet.columns = [
    { header: "N° Client (SHIP_TO)", key: "shipTo", width: 18 },
    { header: "Raison sociale", key: "name", width: 40 },
    { header: "SIRET", key: "siret", width: 20 },
    { header: "Email contact", key: "email", width: 35 },
    { header: "Lien personnalisé", key: "link", width: 70 },
  ];

  sheet.getColumn("shipTo").numFmt = "@";
  sheet.getColumn("siret").numFmt = "@";

  for (const c of clients) {
    const link = `${appUrl}/pbis?token=${c.accessToken?.token}`;
    sheet.addRow({
      shipTo: c.shipTo,
      name: c.companyName,
      siret: c.siret,
      email: c.contactEmail || "",
      link,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="liens-pbis-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}