import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/admin-auth.server";
import prisma from "~/db.server";

const reasonLabels: Record<string, string> = {
  economies: "Économies courrier",
  simplifier: "Simplifier envois",
  temps: "Gagner du temps",
  facturation: "Facturation électronique",
  digitaliser: "Digitaliser documents",
  trop_cher: "Tarif trop élevé",
  plus_besoin: "Plus besoin",
  concurrent: "Autre prestataire",
  contact: "Souhaite être contacté",
  too_expensive: "Tarif trop élevé",
  no_need: "Plus besoin",
  contact_me: "Souhaite être contacté",
  autre: "Autre",
  other: "Autre",
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const refusals = await prisma.refusal.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      client: {
        select: {
          customerName: true,
          currentModel: true,
          leaseNumber: true,
          bestEmail: true,
          contactPhone: true,
          installPhone: true,
          ownerName: true,
          ownerEmail: true,
        },
      },
    },
  });

  const header = [
    "N° Compte",
    "Raison sociale",
    "Machine actuelle",
    "N° contrat",
    "Email contact",
    "Téléphone",
    "Raison du refus",
    "Commentaire",
    "Commercial",
    "Email commercial",
    "Date refus",
  ].join(";");

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const rows = refusals.map((r) =>
    [
      `="${r.clientAccountNumber}"`,
      esc(r.client.customerName || ""),
      r.client.currentModel || "",
      r.client.leaseNumber || "",
      r.client.bestEmail || "",
      r.client.contactPhone || r.client.installPhone || "",
      reasonLabels[r.reason || ""] || r.reason || "",
      esc(r.comment || ""),
      r.client.ownerName || "",
      r.client.ownerEmail || "",
      new Date(r.createdAt).toLocaleDateString("fr-FR"),
    ].join(";")
  );

  const bom = "\uFEFF";
  const csv = bom + [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="refus-pb-renewals-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}