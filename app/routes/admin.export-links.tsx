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
      accessToken: { select: { token: true } },
    },
    orderBy: { accountNumber: "asc" },
  });

  const appUrl = process.env.APP_URL || "https://pb-renewals.railway.app";

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Liens");

  sheet.columns = [
    { header: "N° Compte", key: "account", width: 16 },
    { header: "Raison sociale", key: "name", width: 40 },
    { header: "Email", key: "email", width: 35 },
    { header: "Lien personnalisé", key: "link", width: 60 },
  ];

  // Force text format on account number column
  sheet.getColumn("account").numFmt = "@";

  for (const c of clients) {
    const email = c.bestEmail || c.installEmail || c.billingEmail || "";
    const link = `${appUrl}/offre?token=${c.accessToken?.token}`;
    sheet.addRow({ account: c.accountNumber, name: c.customerName, email, link });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="liens-pb-renewals-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}