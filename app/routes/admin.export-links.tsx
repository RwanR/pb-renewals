import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/admin-auth.server";
import prisma from "~/db.server";

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

  const header = "N° Compte;Raison sociale;Email;Lien personnalisé";
  const rows = clients.map((c) => {
    const email = c.bestEmail || c.installEmail || c.billingEmail || "";
    const link = `${appUrl}/offre?token=${c.accessToken?.token}`;
    // Escape semicolons and quotes in CSV
    const name = c.customerName.replace(/"/g, '""');
    return `${c.accountNumber};"${name}";${email};${link}`;
  });

  const csv = [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="liens-pb-renewals-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}