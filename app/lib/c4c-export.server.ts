import ExcelJS from "exceljs";
import type { Acceptance, Client, Offer } from "@prisma/client";
import prisma from "~/db.server";

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
 * Headers du template C4C "New Elease" (44 colonnes).
 * Ordre EXACT du template Pitney Bowes 20260519.
 * Les libellés contiennent des \n et espaces spécifiques, à respecter strictement.
 */
const HEADERS = [
  "Index",
  "Type de document\n(Formulaire C4C)",
  "Description\n(Formulaire C4C)",
  "Donneur d'ordre\n(Formulaire C4C)",
  "Livré (Quote C4C)",
  "Facturé (Quote C4C)",
  "Payeur (Quote C4C)",
  "CONTACTID",
  "ContactFirstName",
  "ContactLastName",
  "ContactPhone (Formulaire C4C)",
  "ContactEmail (Formulaire C4C)",
  "Payer Street4-Street5",
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
  "Flag_UPDATECONTACT",
  "New _CONTACTEMAIL",
  "NEW_CONTACTFIRSTNAME",
  "NEW_CONTACTLASTNAME",
  "Flag_Billing_address_different",
  "NEW_BILLINGADDRESS1",
  "NEW BILLING_STREET",
  "NEW_BILLINGPOSTALCODE",
  "NEW_BILLINGCITY",
  "FLAG_UPDATE_EMAILFACTURATION",
  "NEW_EMAILFACTURATION(Payer stree4-Street5)",
];

/** Format date YYYY-MM-DD pour les colonnes datetime du template */
function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Mapping installation → code produit (INSTALL_P1 / INSTALL_P5 / blank).
 * À VALIDER AVEC BERNADETTE — actuellement aligné sur contract-pdf.server.ts :
 *   phone  = "Installation assistée en ligne" (75 €) → INSTALL_P5
 *   onsite = "Installation sur site"          (198 €) → INSTALL_P1
 *   auto / null → blank
 */
function mapInstallCode(installOption: string | null | undefined): string {
  if (installOption === "phone") return "INSTALL_P5";
  if (installOption === "onsite") return "INSTALL_P1";
  return "";
}

/** Durée en mois depuis termSelected ("60", "48", "36") */
function getDurationMonths(termSelected: string | null | undefined): string {
  if (!termSelected) return "";
  return `${termSelected} mois`;
}

/**
 * Construit l'Index = "EL" + CURRENTEQUIPMENTMODEL + "_" + N°séquentiel (padding 5 zéros).
 * Le N°séquentiel est basé sur l'ordre global de signature : compte le nombre
 * d'acceptances signées avant celle-ci, +1. Stable d'un export à l'autre.
 */
function buildIndex(
  acc: AcceptanceWithRelations,
  sequenceNumber: number
): string {
  const model = acc.client.currentModel || "UNKNOWN";
  const seq = String(sequenceNumber).padStart(5, "0");
  return `EL${model}_${seq}`;
}

/**
 * Construit une ligne du template C4C à partir d'une acceptance signée
 * et de son client + offre associés.
 *
 * Conventions V1 :
 *   - Flag_UPDATECONTACT = N en V1 (champs email/téléphone retirés de la page Vos informations)
 *   - NEW_CONTACT* = vides en V1
 *   - FLAG_UPDATE_EMAILFACTURATION = Y si client.billingEmail (ou acceptance.billingEmail) renseigné
 *   - Flag_Billing_address_different = Y/N selon acceptance.billingAddressDifferent
 */
function buildRow(
  acc: AcceptanceWithRelations,
  sequenceNumber: number
): (string | number)[] {
  const { client } = acc;
  const offer = client.offers.find((o) => o.offerPosition === acc.offerPosition);

  if (!offer) {
    throw new Error(
      `[C4C] Offer position ${acc.offerPosition} not found for client ${client.accountNumber}`
    );
  }

  const billingDifferent = acc.billingAddressDifferent;

  // FLAG_UPDATE_EMAILFACTURATION : Y si l'email facturation a été saisi/modifié
  const billingEmailSaisi = client.billingEmail || "";
  const flagUpdateEmailFact = billingEmailSaisi ? "Y" : "N";

  return [
    // 1. Index = EL + model + _ + sequence
    buildIndex(acc, sequenceNumber),
    // 2. Type de document (hard-coded)
    "Lease Quote",
    // 3. Description
    offer.descriptionContract || "",
    // 4. Donneur d'ordre
    client.soldToAccountNumberC4C || "",
    // 5. Livré
    client.installAccountNumberC4C || "",
    // 6. Facturé
    client.billingAccountNumberC4C || "",
    // 7. Payeur
    client.payerAccountNumberC4C || "",
    // 8. CONTACTID
    client.contactId || "",
    // 9. ContactFirstName
    client.contactFirstName || "",
    // 10. ContactLastName
    client.contactLastName || "",
    // 11. ContactPhone
    client.contactPhone || "",
    // 12. ContactEmail
    client.bestEmail || "",
    // 13. Payer Street4-Street5 = EMAIL_RECEPTION_FACTURE d'origine
    client.emailReceptionFacture || "",
    // 14. Agence commerciale
    client.salesOffice || "",
    // 15. Groupe de vendeurs
    client.salesGroup || "",
    // 16. Motif de la commande
    offer.orderReason || "",
    // 17. Date de signature
    formatDate(acc.signedAt),
    // 18. Responsable
    client.ownerName || "",
    // 19. Note interne (déjà pré-concaténée dans la base)
    client.noteContract || "",
    // 20. Durée en mois
    getDurationMonths(acc.termSelected),
    // 21. Fréquence de facturation (hard-coded selon Jemina : Yearly)
    "Yearly",
    // 22. terme echoir / echu
    client.echuEchoir || "",
    // 23. Purchase Order no.
    acc.purchaseOrderNumber || "",
    // 24. Date demandée
    formatDate(client.activationDate),
    // 25. Mode pmt
    client.paymentMethod || "",
    // 26. PCN (= PCN_FLAMMES, valeur brute)
    client.pcnFlammes || "",
    // 27. Code produit 1
    offer.modelPcn || "",
    // 28. Code produit 2
    offer.pcn2 || "",
    // 29. Code produit 3
    offer.pcn3 || "",
    // 30. Code produit 4
    offer.pcn4 || "",
    // 31. Code produit 5
    offer.pcn5 || "",
    // 32. Code produit 6 (INSTALL_P1 / INSTALL_P5 / blank)
    mapInstallCode(acc.installOptionSelected),
    // 33. Rent amount (ZPR0) / Monthly
    client.currentMonthlyPayment ?? "",
    // 34. Flag_UPDATECONTACT : N en V1 (champs email/tel retirés de la page Vos informations)
    "N",
    // 35. New _CONTACTEMAIL : vide en V1
    "",
    // 36. NEW_CONTACTFIRSTNAME : vide en V1
    "",
    // 37. NEW_CONTACTLASTNAME : vide en V1
    "",
    // 38. Flag_Billing_address_different
    billingDifferent ? "Y" : "N",
    // 39. NEW_BILLINGADDRESS1
    billingDifferent ? client.billingAddress1 || "" : "",
    // 40. NEW BILLING_STREET
    billingDifferent ? client.billingStreet || "" : "",
    // 41. NEW_BILLINGPOSTALCODE
    billingDifferent ? client.billingPostcode || "" : "",
    // 42. NEW_BILLINGCITY
    billingDifferent ? client.billingCity || "" : "",
    // 43. FLAG_UPDATE_EMAILFACTURATION
    flagUpdateEmailFact,
    // 44. NEW_EMAILFACTURATION = saisie utilisateur (si différente de l'origine)
    billingEmailSaisi,
  ];
}

/**
 * Calcule le numéro séquentiel global pour une acceptance donnée.
 * Compte le nombre d'acceptances signées AVANT (ou en même temps) celle-ci.
 * Stable d'un export à l'autre tant qu'on ne supprime pas d'acceptances.
 */
async function getSequenceNumber(acc: AcceptanceWithRelations): Promise<number> {
  if (!acc.signedAt) return 0;
  const count = await prisma.acceptance.count({
    where: {
      adobeSignStatus: "signed",
      signedAt: { lte: acc.signedAt },
    },
  });
  return count;
}

/**
 * Génère le fichier xlsx C4C à partir d'une liste d'acceptances signées.
 * Le sequence number est calculé via prisma.count() (ordre global de signature).
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

  // Pré-calcul des numéros de séquence en parallèle
  const sequences = await Promise.all(
    acceptances.map((acc) => getSequenceNumber(acc))
  );

  for (let i = 0; i < acceptances.length; i++) {
    const acc = acceptances[i];
    try {
      sheet.addRow(buildRow(acc, sequences[i]));
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