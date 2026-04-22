import type { Client, Offer, Acceptance } from "@prisma/client";
import { PB_LOGO, PLATEFORME_AGREEE, ISO_27001 } from "./contract-logos.server";

const CONTRACT_VERSION = process.env.CONTRACT_VERSION || "Elease - 04 26";

interface ContractData {
  client: Client;
  offer: Offer;
  acceptance: Acceptance;
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return amount.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR");
}

function generateContractHTML(data: ContractData): string {
  const { client, offer, acceptance } = data;
  const today = formatDate(new Date());
// NOUVEAU
  const monthlyVal = offer.monthly60 ?? offer.monthly48 ?? offer.monthly36 ?? offer.billing60 ?? offer.billing48 ?? offer.billing36;
  const billingTax = offer.billingTax60 ?? offer.billingTax48 ?? offer.billingTax36;
  const billingTotal = offer.billingTotal60 ?? offer.billingTotal48 ?? offer.billingTotal36;
  const term = (offer.monthly60 ?? offer.billing60) ? "60" : (offer.monthly48 ?? offer.billing48) ? "48" : "36";
  const monthly = monthlyVal ? formatCurrency(monthlyVal) : "—";
  const annualHT = monthlyVal ? monthlyVal * 12 : null;
  const annualTax = billingTax ? billingTax * 12 : null;
  const annualTTC = billingTotal ? billingTotal * 12 : null;

  const installAddress = [
    client.installAddress1,
    client.installStreet,
    client.installPostcode,
    client.installCity,
  ]
    .filter(Boolean)
    .join(", ");

  const billingAddress = [
    client.billingAddress1 || client.installAddress1,
    client.billingStreet || client.installStreet,
    client.billingPostcode || client.installPostcode,
    client.billingCity || client.installCity,
  ]
    .filter(Boolean)
    .join(", ");

  const contactEmail =
    acceptance.overrideEmail ||
    client.bestEmail ||
    client.installEmail ||
    client.billingEmail ||
    "";

  const contactPhone =
    acceptance.overridePhone || client.installPhone || client.billingPhone || "";

  // Equipment lines
  const equipmentLines: { code: string; description: string; monthly: string }[] = [];
  equipmentLines.push({
    code: offer.modelPcn || "—",
    description: offer.modelDescription || offer.modelName || "—",
    monthly: monthly + " €",
  });
  if (offer.pcn2 && offer.description2) {
    equipmentLines.push({ code: offer.pcn2, description: offer.description2, monthly: "" });
  }
  if (offer.pcn3 && offer.description3) {
    equipmentLines.push({ code: offer.pcn3, description: offer.description3, monthly: "" });
  }
  if (offer.pcn4 && offer.description4) {
    equipmentLines.push({ code: offer.pcn4, description: offer.description4, monthly: "" });
  }
  const existingCodes = new Set(equipmentLines.map(l => l.code));

  if (offer.template === "1" && offer.discount && !existingCodes.has("REMISE_" + offer.discount.replace("%", ""))) {
    equipmentLines.push({
      code: "REMISE_" + offer.discount.replace("%", ""),
      description: "Remise " + offer.discount + " les 12 premiers mois",
      monthly: "",
    });
  }

  if (!existingCodes.has("DATE_D_EFFET")) {
    equipmentLines.push({
      code: "DATE_D_EFFET",
      description: "Date d'effet préétablie",
      monthly: "",
    });
  }

  if (acceptance.autoInkSelected && offer.autoInkPcn) {
    equipmentLines.push({
      code: offer.autoInkPcn,
      description: offer.autoInkDescription || "AutoInk",
      monthly: "Inclus",
    });
  }

  if (acceptance.installOptionSelected && acceptance.installOptionSelected !== "auto") {
    const installLabels: Record<string, { desc: string; price: string }> = {
      phone: { desc: "Installation assistée en ligne", price: "75,00 €" },
      onsite: { desc: "Installation sur site par un technicien", price: "198,00 €" },
    };
    const install = installLabels[acceptance.installOptionSelected];
    if (install) {
      equipmentLines.push({
        code: "INSTALL",
        description: install.desc,
        monthly: install.price,
      });
    }
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
/* NOUVEAU — remplacer TOUT le contenu <style> */
  @page { size: A4; margin: 12mm 15mm 12mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #1a1a1a; line-height: 1.35; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #009999; }
  .header-left { display: flex; flex-direction: column; gap: 2px; }
  .header-left small { font-size: 6.5pt; color: #666; }
  .header-right { display: flex; align-items: flex-start; gap: 8px; text-align: right; font-size: 7pt; color: #666; }
  .header-right .version { font-weight: 600; color: #009999; font-size: 7.5pt; }

  h1 { font-size: 13pt; font-weight: 700; color: #1a1a1a; text-align: center; margin: 8px 0 4px; }
  .subtitle { text-align: center; font-size: 6.5pt; color: #666; margin-bottom: 8px; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .info-box { border: 1.5px solid #009999; border-radius: 3px; padding: 6px 8px; }
  .info-box h3 { font-size: 7.5pt; font-weight: 700; color: #009999; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.3px; border-bottom: 1px solid #e0e0e0; padding-bottom: 3px; }
  .info-row { display: flex; justify-content: space-between; font-size: 7.5pt; margin-bottom: 1.5px; }
  .info-label { color: #555; }
  .info-value { font-weight: 600; text-align: right; max-width: 55%; word-break: break-word; }

  .conditions { border: 1.5px solid #009999; border-radius: 3px; padding: 6px 8px; margin-bottom: 6px; }
  .conditions h3 { font-size: 7.5pt; font-weight: 700; color: #009999; text-transform: uppercase; margin-bottom: 4px; border-bottom: 1px solid #e0e0e0; padding-bottom: 3px; }
  .conditions-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 6px; }
  .condition-item .label { font-size: 6.5pt; color: #555; }
  .condition-item .value { font-size: 9pt; font-weight: 700; }

  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table th { background: #009999; color: white; font-size: 6.5pt; padding: 3px 5px; text-align: left; text-transform: uppercase; letter-spacing: 0.3px; }
  table th:last-child { text-align: right; }
  table td { font-size: 7.5pt; padding: 2.5px 5px; border-bottom: 1px solid #eee; }
  table td:last-child { text-align: right; font-weight: 600; }
  .total-row td { border-top: 1.5px solid #009999; font-weight: 700; font-size: 8.5pt; padding-top: 4px; }

  .legal { margin-top: 6px; font-size: 6pt; color: #555; line-height: 1.25; }
  .legal p { margin-bottom: 3px; }
  .legal a { color: #009999; }

  .signature-block { margin-top: 6px; border: 1.5px solid #009999; border-radius: 3px; padding: 6px 8px; }
  .signature-block h3 { font-size: 7.5pt; font-weight: 700; color: #009999; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e0e0e0; padding-bottom: 3px; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .sig-field { font-size: 7.5pt; }
  .sig-field .label { font-size: 6.5pt; color: #555; }
  .sig-field .value { font-weight: 600; }
  .sig-area { margin-top: 6px; height: 32px; border: 1px dashed #ccc; border-radius: 3px; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 6.5pt; }

  .footer { margin-top: 6px; padding-top: 4px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 6pt; color: #999; }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <img src="${PB_LOGO}" alt="Pitney Bowes" style="height:70px; width:auto; margin-bottom:3px;" />
    <small>5 Rue Francis de Pressensé, Immeuble VOX, CS20012, 93456 La Plaine Saint-Denis Cedex</small>
  </div>
  <div class="header-right" style="display:flex; align-items:flex-start; gap:8px;">
    <div>
      <div class="version">${CONTRACT_VERSION}</div>
      Date : ${today}<br>
      Proposition valable 90 jours
    </div>
    <img src="${PLATEFORME_AGREEE}" alt="Plateforme Agréée" style="height:44px; width:auto;" />
    <img src="${ISO_27001}" alt="ISO 27001" style="height:44px; width:auto;" />
  </div>
</div>

<h1>Contrat de Location Maintenance</h1>

<div class="subtitle">
  Entre Pitney Bowes, SAS au capital de 11 789 424,25 €, RCS Bobigny 562 046 235, NAF 7733Z, TVA FR36562046235
</div>

<div class="info-grid">
  <div class="info-box">
    <h3>Locataire / Installation</h3>
    <div class="info-row"><span class="info-label">Compte</span><span class="info-value">${client.accountNumber}</span></div>
    <div class="info-row"><span class="info-label">Raison sociale</span><span class="info-value">${client.soldToCustomerName || client.customerName}</span></div>
    <div class="info-row"><span class="info-label">Adresse</span><span class="info-value">${installAddress}</span></div>
    <div class="info-row"><span class="info-label">SIRET</span><span class="info-value">${client.soldToCompanyRegistrationNumber || client.siret || "—"}</span></div>
    <div class="info-row"><span class="info-label">TVA</span><span class="info-value">${client.vatNumber || "—"}</span></div>
    <div class="info-row"><span class="info-label">Contact</span><span class="info-value">${contactEmail}</span></div>
    <div class="info-row"><span class="info-label">Téléphone</span><span class="info-value">${contactPhone}</span></div>
  </div>
  <div class="info-box">
    <h3>Facturation</h3>
    <div class="info-row"><span class="info-label">Compte</span><span class="info-value">${client.accountNumber}</span></div>
    <div class="info-row"><span class="info-label">Raison sociale</span><span class="info-value">${client.billingCustomerName || client.customerName}</span></div>
    <div class="info-row"><span class="info-label">Adresse</span><span class="info-value">${billingAddress}</span></div>
    <div class="info-row"><span class="info-label">SIRET</span><span class="info-value">${client.siret || "—"}</span></div>
    <div class="info-row"><span class="info-label">Délai paiement</span><span class="info-value">${client.paymentTerms || "Prélèvement"}</span></div>
    ${client.leaseNumber ? `<div class="info-row"><span class="info-label">Ancien contrat</span><span class="info-value">${client.leaseNumber}</span></div>` : ""}
    <div class="info-row"><span class="info-label">Mode paiement</span><span class="info-value">Prélèvement</span></div>
  </div>
</div>

<div class="conditions">
  <h3>Conditions particulières</h3>
  <div class="conditions-grid">
    <div class="condition-item">
      <div class="label">Durée irrévocable</div>
      <div class="value">${term} mois</div>
    </div>
    <div class="condition-item">
      <div class="label">Date d'activation</div>
      <div class="value">${client.activationDate ? formatDate(client.activationDate) : today}</div>
    </div>
    <div class="condition-item">
      <div class="label">Fréquence facturation</div>
      <div class="value">Annuel</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Code</th>
        <th>Désignation</th>
        <th>Loyer mensuel HT</th>
      </tr>
    </thead>
    <tbody>
      ${equipmentLines
        .map(
          (line) =>
            `<tr><td>${line.code}</td><td>${line.description}</td><td>${line.monthly}</td></tr>`
        )
        .join("")}
      <tr class="total-row">
        <td colspan="2" style="text-align:right">Loyer annuel HT (hors remise 1ère année)</td>
        <td>${formatCurrency(annualHT)} €</td>
      </tr>
      <tr>
        <td colspan="2" style="text-align:right; font-size:7.5pt; color:#666">TVA 20%</td>
        <td style="font-size:7.5pt; color:#666">${formatCurrency(annualTax)} €</td>
      </tr>
      <tr>
        <td colspan="2" style="text-align:right; font-size:7.5pt; color:#666">Loyer annuel TTC</td>
        <td style="font-size:7.5pt; color:#666">${formatCurrency(annualTTC)} €</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="legal">
  <p>Tous les montants s'entendent hors TVA légale. Le loyer initial est un loyer mensuel. En signant ce contrat, le Locataire reconnait avoir pris connaissance de l'article 9 des conditions générales. Ainsi, les factures suivantes seront établies sur la base du loyer annuel initial et de la fréquence de facturation, majorés de cet article.</p>
  <p>La commande du Locataire vaut demande irrévocable de location. Le Locataire accepte de subordonner l'entrée en vigueur du contrat à l'acceptation par le service Crédit de Pitney Bowes (article 2 des CGL), selon le mode et délai de paiement habituels.</p>
  <p>Les Conditions Générales de Location (version ${CONTRACT_VERSION}) sont consultables à l'adresse <a href="https://pb.com/fr/cc">pb.com/fr/cc</a> et acceptées par le Locataire, y compris la clause attributive de juridiction (article 25).</p>
  <p>Contact : <a href="mailto:fr-elease@pb.com">fr-elease@pb.com</a></p>
</div>

<div class="signature-block">
  <h3>Signataire (habilité à ratifier le contrat)</h3>
  <div class="sig-grid">
    <div class="sig-field"><span class="label">Prénom</span><div class="value">${acceptance.signatoryFirstName}</div></div>
    <div class="sig-field"><span class="label">Nom</span><div class="value">${acceptance.signatoryLastName}</div></div>
    <div class="sig-field"><span class="label">Email</span><div class="value">${acceptance.signatoryEmail}</div></div>
    <div class="sig-field"><span class="label">Fonction</span><div class="value">${acceptance.signatoryFunction || "—"}</div></div>
    <div class="sig-field"><span class="label">Bon de commande interne</span><div class="value">${acceptance.notes?.replace("Réf commande: ", "") || "—"}</div></div>
  </div>
  <div class="sig-area">Signature électronique via Yousign</div>
</div>

<div class="footer">
  <span>Pitney Bowes SAS – RCS Bobigny 562 046 235 – ${CONTRACT_VERSION}</span>
  <span>Page 1/1</span>
</div>

</body>
</html>`;
}

/**
 * Generate a contract PDF buffer from client/offer/acceptance data.
 * Uses Puppeteer to render HTML to PDF.
 */
export async function generateContractPDF(data: ContractData): Promise<Buffer> {
  const html = generateContractHTML(data);

  // Dynamic import to avoid loading Puppeteer at startup
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Generate the HTML for preview (useful for debugging without Puppeteer)
 */
export function generateContractHTMLPreview(data: ContractData): string {
  return generateContractHTML(data);
}