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
 * Headers du template C4C "New Elease" (45 colonnes — V3 du 22/05/2026).
 * V3 ajoute "Livré_S4" en position 9 (= INSTALLACCOUNTNUMBER brut, format 0031xxxxxxx).
 * À ne pas confondre avec "Livré (Quote C4C)" en position 5 (= INSTALLACCOUNTNUMBER_C4C, format 2xxxxxxx).
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
  "Livré_S4",
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

/** Format date YYYY-MM-DD en UTC pour éviter les décalages timezone serveur */
function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Mapping installation → code produit (INSTALL_P1 / INSTALL_P5 / blank).
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

/** Normalise pour comparaison case-insensitive et trim */
function norm(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase();
}

/**
 * Construit l'Index = "EL" + CURRENTEQUIPMENTMODEL + "_" + N°séquentiel (padding 5 zéros).
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
 * Construit une ligne du template C4C.
 *
 * Logique V3 :
 *   - Flag_UPDATECONTACT = Y si signataire ≠ contact d'origine (firstName/lastName/email)
 *     → NEW_CONTACT* remplis avec les valeurs signataire
 *   - Sinon Flag = N, NEW_CONTACT* vides
 *   - FLAG_UPDATE_EMAILFACTURATION = Y si client.billingEmail renseigné
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
const billingEmailOrig = client.emailReceptionFacture || "";
const billingEmailChanged = norm(billingEmailSaisi) !== norm(billingEmailOrig);
const flagUpdateEmailFact = billingEmailChanged ? "Y" : "N";

  // Flag_UPDATECONTACT : Y si signataire ≠ contact d'origine
  const contactChanged =
    norm(acc.signatoryFirstName) !== norm(client.contactFirstName) ||
    norm(acc.signatoryLastName) !== norm(client.contactLastName) ||
    norm(acc.signatoryEmail) !== norm(client.bestEmail);

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
    // 9. Livré_S4 (INSTALLACCOUNTNUMBER brut, format 0031xxxxxxx) — V3
    client.accountNumber,
    // 10. ContactFirstName
    client.contactFirstName || "",
    // 11. ContactLastName
    client.contactLastName || "",
    // 12. ContactPhone
    client.contactPhone || "",
    // 13. ContactEmail
    client.bestEmail || "",
    // 14. Payer Street4-Street5 = EMAIL_RECEPTION_FACTURE d'origine
    client.emailReceptionFacture || "",
    // 15. Agence commerciale
    client.salesOffice || "",
    // 16. Groupe de vendeurs
    client.salesGroup || "",
    // 17. Motif de la commande
    offer.orderReason || "",
    // 18. Date de signature
    formatDate(acc.signedAt),
    // 19. Responsable
    client.ownerName || "",
    // 20. Note interne (déjà pré-concaténée dans la base)
    client.noteContract || "",
    // 21. Durée en mois
    getDurationMonths(acc.termSelected),
    // 22. Fréquence de facturation (hard-coded : Yearly)
    "Yearly",
    // 23. terme echoir / echu
    client.echuEchoir || "",
    // 24. Purchase Order no.
    acc.purchaseOrderNumber || "",
    // 25. Date demandée
    formatDate(client.activationDate),
    // 26. Mode pmt
    client.paymentMethod || "",
    // 27. PCN (= PCN_FLAMMES, valeur brute)
    client.pcnFlammes || "",
    // 28. Code produit 1
    offer.modelPcn || "",
    // 29. Code produit 2
    offer.pcn2 || "",
    // 30. Code produit 3
    offer.pcn3 || "",
    // 31. Code produit 4
    offer.pcn4 || "",
    // 32. Code produit 5
    offer.pcn5 || "",
    // 33. Code produit 6 (INSTALL_P1 / INSTALL_P5 / blank)
    mapInstallCode(acc.installOptionSelected),
    // 34. Rent amount (ZPR0) / Monthly
    client.currentMonthlyPayment ?? "",
    // 35. Flag_UPDATECONTACT — Y si signataire ≠ contact d'origine
    contactChanged ? "Y" : "N",
    // 36. New _CONTACTEMAIL
    contactChanged ? acc.signatoryEmail : "",
    // 37. NEW_CONTACTFIRSTNAME
    contactChanged ? acc.signatoryFirstName : "",
    // 38. NEW_CONTACTLASTNAME
    contactChanged ? acc.signatoryLastName : "",
    // 39. Flag_Billing_address_different
    billingDifferent ? "Y" : "N",
    // 40. NEW_BILLINGADDRESS1
    billingDifferent ? client.billingAddress1 || "" : "",
    // 41. NEW BILLING_STREET
    billingDifferent ? client.billingStreet || "" : "",
    // 42. NEW_BILLINGPOSTALCODE
    billingDifferent ? client.billingPostcode || "" : "",
    // 43. NEW_BILLINGCITY
    billingDifferent ? client.billingCity || "" : "",
    // 44. FLAG_UPDATE_EMAILFACTURATION
    flagUpdateEmailFact,
    // 45. NEW_EMAILFACTURATION = saisie utilisateur
    billingEmailChanged ? billingEmailSaisi : "",
  ];
}

/**
 * Calcule le numéro séquentiel global pour une acceptance donnée.
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