import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/admin-auth.server";
import prisma from "~/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const acceptances = await prisma.acceptance.findMany({
    orderBy: { acceptedAt: "desc" },
    include: {
      client: {
        select: {
          customerName: true,
          currentModel: true,
          bestEmail: true,
          installPhone: true,
          contactPhone: true,
          installAddress1: true,
          installStreet: true,
          installCity: true,
          installPostcode: true,
          billingCustomerName: true,
          billingAddress1: true,
          billingStreet: true,
          billingCity: true,
          billingPostcode: true,
          soldToCustomerName: true,
          soldToCompanyRegistrationNumber: true,
          siret: true,
          leaseNumber: true,
          ownerName: true,
          ownerEmail: true,
          activationDate: true,
          paymentTerms: true,
          offers: true,
        },
      },
    },
  });

  const header = [
    "N° Compte",
    "Raison sociale",
    "SIRET donneur d'ordre",
    "Machine actuelle",
    "N° contrat",
    "Offre choisie",
    "Modèle",
    "Durée (mois)",
    "Loyer mensuel HT",
    "Loyer annuel HT",
    "Installation",
    "Prix installation HT",
    "Date activation",
    "Prénom signataire",
    "Nom signataire",
    "Email signataire",
    "Fonction",
    "Réf commande interne",
    "Email contact",
    "Téléphone",
    "Adresse installation",
    "Adresse facturation",
    "Commercial",
    "Email commercial",
    "Délai paiement",
    "Statut signature",
    "Date acceptation",
    "Date signature",
  ].join(";");

  const rows = acceptances.map((a) => {
    const offer = a.client.offers.find((o) => o.offerPosition === a.offerPosition);
    const monthly = offer?.monthly60 ?? offer?.monthly48 ?? offer?.monthly36 ?? offer?.billing60 ?? offer?.billing48 ?? offer?.billing36 ?? null;
    const term = (offer?.monthly60 ?? offer?.billing60) ? "60" : (offer?.monthly48 ?? offer?.billing48) ? "48" : "36";
    const annualHT = monthly ? (monthly * 12).toFixed(2) : "";
    const monthlyStr = monthly ? monthly.toFixed(2).replace(".", ",") : "";
    const annualStr = monthly ? (monthly * 12).toFixed(2).replace(".", ",") : "";

    const installLabels: Record<string, string> = { auto: "Auto-installation", phone: "Assistée en ligne", onsite: "Sur site" };
    const installPrices: Record<string, string> = { auto: "0,00", phone: "75,00", onsite: "198,00" };

    const installAddr = [a.client.installAddress1, a.client.installStreet, a.client.installPostcode, a.client.installCity].filter(Boolean).join(", ");
    const billingAddr = [a.client.billingAddress1, a.client.billingStreet, a.client.billingPostcode, a.client.billingCity].filter(Boolean).join(", ");

    const orderRef = a.notes?.replace("Réf commande: ", "") || "";

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

    return [
      a.clientAccountNumber,
      esc(a.client.soldToCustomerName || a.client.customerName),
      a.client.soldToCompanyRegistrationNumber || a.client.siret || "",
      a.client.currentModel || "",
      a.client.leaseNumber || "",
      a.offerPosition === 1 ? "Upgrade" : "Reconduction",
      offer?.modelName || "",
      term,
      monthlyStr,
      annualStr,
      installLabels[a.installOptionSelected || ""] || "",
      installPrices[a.installOptionSelected || ""] || "",
      a.client.activationDate ? new Date(a.client.activationDate).toLocaleDateString("fr-FR") : "",
      a.signatoryFirstName,
      a.signatoryLastName,
      a.signatoryEmail,
      a.signatoryFunction || "",
      orderRef,
      a.overrideEmail || a.client.bestEmail || "",
      a.overridePhone || a.client.contactPhone || a.client.installPhone || "",
      esc(installAddr),
      esc(billingAddr),
      a.client.ownerName || "",
      a.client.ownerEmail || "",
      a.client.paymentTerms || "",
      a.adobeSignStatus || "pending",
      new Date(a.acceptedAt).toLocaleDateString("fr-FR"),
      a.signedAt ? new Date(a.signedAt).toLocaleDateString("fr-FR") : "",
    ].join(";");
  });

  const bom = "\uFEFF";
  const csv = bom + [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="acceptances-pb-renewals-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}