import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/admin-auth.server";
import prisma from "~/db.server";
import ExcelJS from "exceljs";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const clients = await prisma.client.findMany({
    where: {
      accessToken: { isNot: null },
      archived: false,
    },
    select: {
      accountNumber: true,
      customerName: true,
      bestEmail: true,
      installEmail: true,
      billingEmail: true,
      accessToken: { select: { token: true, createdAt: true } },
      acceptance: { select: { adobeSignStatus: true } },
      refusal: { select: { id: true } },
    },
    orderBy: { accountNumber: "asc" },
  });

  const appUrl = process.env.APP_URL || "https://monrenouvellement.pb.com";

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Liens");

  sheet.columns = [
    { header: "N° Compte", key: "account", width: 16 },
    { header: "Raison sociale", key: "name", width: 40 },
    { header: "Email", key: "email", width: 35 },
    { header: "Statut", key: "status", width: 14 },
    { header: "Date du lien", key: "linkDate", width: 14 },
    { header: "Lien personnalisé", key: "link", width: 60 },
  ];

  // Force text format on account number column, date format on link date
  sheet.getColumn("account").numFmt = "@";
  sheet.getColumn("linkDate").numFmt = "dd/mm/yyyy";

  for (const c of clients) {
    const email = c.bestEmail || c.installEmail || c.billingEmail || "";
    const link = `${appUrl}/offre?token=${c.accessToken?.token}`;
    const status =
      c.acceptance?.adobeSignStatus === "signed"
        ? "Signé"
        : c.refusal
        ? "Refusé"
        : "En attente";
    const linkDate = c.accessToken?.createdAt ?? null;
    sheet.addRow({ account: c.accountNumber, name: c.customerName, email, status, linkDate, link });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="liens-pb-renewals-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}