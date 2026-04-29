import ExcelJS from "exceljs";
import type { Acceptance, Client, Offer } from "@prisma/client";

/**
 * Acceptance avec ses relations chargées, telle que retournée par
 * prisma.acceptance.findMany({ include: { client: { include: { offers: true } } } })
 */
export type AcceptanceWithRelations = Acceptance & {
  client: Client & {
    offers: Offer[];
  };
};

/**
 * Headers du template C4C (sheet "New Elease ").
 * 41 colonnes dans l'ordre exact attendu par PB.
 */
const HEADERS = [
  "Type de document\n(Formulaire C4C)",
  "Description\n(Formulaire C4C)",
  "Donneur d'ordre\n(Formulaire C4C)",
  "Livré (Quote C4C)",
  "Facturé (Quote C4C)",
  "Payeur (Quote C4C)",
  "ContactFirstName",
  "ContactLastName",
  "InstallPhone (Formulaire C4C)",
  "InstallEmail (Formulaire C4C)",
  "Agence commerciale\n(Formulaire C4C)",
  "Groupe de vendeurs\n(Formulaire C4C)",
  "Motif de la commande\n(Formulaire C4C)",
  "Date de signature\n(Formulaire C4C)",
  "Responsable\n(Formulaire C4C)",
  "Note interne\n(Formulaire C4C)",
  "Durée ( Mois )\n(Formulaire C4C)",
  "Fréquence de facturation\n(Formulaire C4C)",
  "terme echoir / echu",
  "Purchase Order no.\n(Quote C4C)",
  "Date demandée (Date de livraison)\n(Quote C4C)",
  "Mode pmt\n(Quote C4C)",
  "PCN",
  "Code produit 1",
  "Code produit 2",
  "Code produit 3",
  "Code produit 4",
  "Code produit 5",
  "Code produit 6",
  "Rent amount  (ZPR0) / Monthly",
  "Flag UPDATE",
  "New  CONTACTEMAIL",
  "New CONTACTPHONE",
  "NEW FIRSTNAME",
  "NEW LASTNAME",
  "Flag  Billing address different",
  "NEW BILLINGCUSTOMERNAME2",
  "NEW BILLINGADDRESS1",
  "NEW BILLINGSTREET",
  "NEW BILLINGPOSTALCODE",
  "NEW BILLINGCITY",
];

/** Format date YYYY-MM-DD pour les colonnes datetime du template */
function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Mapping installation : "auto" / "phone" / "onsite" → code produit */
function mapInstallCode(installOption: string | null | undefined): string {
  if (installOption === "phone") return "INSTALL_P1";
  if (installOption === "onsite") return "INSTALL_P5";
  return "";
}

/** Durée en mois depuis termSelected ("60", "48", "36") */
function getDurationMonths(termSelected: string | null | undefined): string {
  if (!termSelected) return "";
  return `${termSelected} mois`;
}

/**
 * Construit une ligne du template C4C à partir d'une acceptance signée
 * et de son client + offre associés.
 */
function buildRow(acc: AcceptanceWithRelations): (string | number)[] {
  const { client } = acc;
  const offer = client.offers.find((o) => o.offerPosition === acc.offerPosition);

  if (!offer) {
    throw new Error(
      `[C4C] Offer position ${acc.offerPosition} not found for client ${client.accountNumber}`
    );
  }

  const billingDifferent = acc.billingAddressDifferent;
  const flagUpdate = "Y"; // EN ATTENTE VALIDATION JEMINA

  return [
    // 1. Type de document
    "Lease Quote",
    // 2. Description
    offer.descriptionContract || "",
    // 3. Donneur d'ordre
    client.soldToAccountNumberC4C || "",
    // 4. Livré
    client.installAccountNumberC4C || "",
    // 5. Facturé
    client.billingAccountNumberC4C || "",
    // 6. Payeur
    client.payerAccountNumberC4C || "",
    // 7. ContactFirstName
    client.contactFirstName || "",
    // 8. ContactLastName
    client.contactLastName || "",
    // 9. InstallPhone
    client.contactPhone || "",
    // 10. InstallEmail
    client.bestEmail || "",
    // 11. Agence commerciale
    client.salesOffice || "",
    // 12. Groupe de vendeurs
    client.salesGroup || "",
    // 13. Motif de la commande
    offer.orderReason || "",
    // 14. Date de signature
    formatDate(acc.signedAt),
    // 15. Responsable
    client.ownerName || "",
    // 16. Note interne
    client.noteContract || "",
    // 17. Durée en mois
    getDurationMonths(acc.termSelected),
    // 18. Fréquence de facturation (valeur brute du fichier source : Yearly / Quarterly / Yearly Calendar)
    client.currentPaymentFrequency || "",
    // 19. terme echu / echoir
    client.echuEchoir || "",
    // 20. Purchase Order no.
    acc.purchaseOrderNumber || "",
    // 21. Date demandée
    formatDate(client.activationDate),
    // 22. Mode pmt (valeur brute du fichier source, ex "E")
    client.paymentMethod || "",
    // 23. PCN_FLAMMES (valeur brute, déjà au format "RG97L+ 0 FLAMMES")
    client.pcnFlammes || "",
    // 24. Code produit 1
    offer.modelPcn || "",
    // 25. Code produit 2
    offer.pcn2 || "",
    // 26. Code produit 3
    offer.pcn3 || "",
    // 27. Code produit 4
    offer.pcn4 || "",
    // 28. Code produit 5
    offer.pcn5 || "",
    // 29. Code produit 6
    mapInstallCode(acc.installOptionSelected),
    // 30. Rent amount monthly
    client.currentMonthlyPayment ?? "",
    // 31. Flag UPDATE
    flagUpdate,
    // 32. New CONTACTEMAIL
    acc.signatoryEmail || "",
    // 33. New CONTACTPHONE
    acc.signatoryPhone || "",
    // 34. NEW FIRSTNAME
    acc.signatoryFirstName || "",
    // 35. NEW LASTNAME
    acc.signatoryLastName || "",
    // 36. Flag Billing address different
    billingDifferent ? "Y" : "N",
    // 37. NEW BILLINGCUSTOMERNAME2
    billingDifferent ? client.billingCustomerName || "" : "",
    // 38. NEW BILLINGADDRESS1
    billingDifferent ? client.billingAddress1 || "" : "",
    // 39. NEW BILLINGSTREET
    billingDifferent ? client.billingStreet || "" : "",
    // 40. NEW BILLINGPOSTALCODE
    billingDifferent ? client.billingPostcode || "" : "",
    // 41. NEW BILLINGCITY
    billingDifferent ? client.billingCity || "" : "",
  ];
}

/**
 * Génère le fichier xlsx C4C à partir d'une liste d'acceptances signées.
 */
export async function generateC4CExport(
  acceptances: AcceptanceWithRelations[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PB Renewals";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("New Elease");

  sheet.addRow(HEADERS);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { wrapText: true, vertical: "middle" };
  headerRow.height = 40;

  for (const acc of acceptances) {
    try {
      sheet.addRow(buildRow(acc));
    } catch (err) {
      console.error(`[C4C] Failed to build row for acceptance ${acc.id}:`, err);
    }
  }

  sheet.columns.forEach((col) => {
    col.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Calcule la fenêtre J-1 : hier 00:00 → aujourd'hui 00:00.
 */
export function getYesterdayWindow(): { from: Date; to: Date; refDate: Date } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const from = new Date(to);
  from.setDate(from.getDate() - 1);
  return { from, to, refDate: from };
}