import type { Client, Offer, Acceptance } from "@prisma/client";

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
  if (offer.template === "1" && offer.discount) {
    equipmentLines.push({
      code: "REMISE_" + offer.discount.replace("%", ""),
      description: "Remise " + offer.discount + " les 12 premiers mois",
      monthly: "",
    });
  }

  // Date d'effet
  equipmentLines.push({
    code: "DATE_D_EFFET",
    description: "Date d'effet préétablie",
    monthly: "",
  });

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
  @page { size: A4; margin: 20mm 15mm 20mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9pt; color: #1a1a1a; line-height: 1.4; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 3px solid #1D2C6B; }
  .header-left { font-weight: 700; font-size: 14pt; color: #1D2C6B; }
  .header-left small { display: block; font-size: 7pt; font-weight: 400; color: #666; margin-top: 2px; }
  .header-right { text-align: right; font-size: 7.5pt; color: #666; }
  .header-right .version { font-weight: 600; color: #1D2C6B; font-size: 8pt; }

  h1 { font-size: 12pt; color: #1D2C6B; text-align: center; margin: 10px 0; }

  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .info-box { border: 1px solid #ddd; border-radius: 4px; padding: 8px 10px; }
  .info-box h3 { font-size: 8pt; text-transform: uppercase; color: #1D2C6B; margin-bottom: 6px; letter-spacing: 0.5px; }
  .info-row { display: flex; justify-content: space-between; font-size: 8pt; margin-bottom: 2px; }
  .info-label { color: #666; }
  .info-value { font-weight: 500; text-align: right; max-width: 60%; }

  .conditions { background: #f8f9fc; border: 1px solid #ddd; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; }
  .conditions h3 { font-size: 8pt; text-transform: uppercase; color: #1D2C6B; margin-bottom: 6px; }
  .conditions-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .condition-item .label { font-size: 7pt; color: #666; }
  .condition-item .value { font-size: 9pt; font-weight: 600; }

  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  table th { background: #1D2C6B; color: white; font-size: 7pt; padding: 4px 6px; text-align: left; text-transform: uppercase; }
  table th:last-child { text-align: right; }
  table td { font-size: 8pt; padding: 3px 6px; border-bottom: 1px solid #eee; }
  table td:last-child { text-align: right; font-weight: 500; }
  .total-row td { border-top: 2px solid #1D2C6B; font-weight: 700; font-size: 9pt; }

  .legal { margin-top: 10px; font-size: 6.5pt; color: #666; line-height: 1.3; }
  .legal p { margin-bottom: 4px; }
  .legal a { color: #1D2C6B; }

  .signature-block { margin-top: 12px; border: 1px solid #ddd; border-radius: 4px; padding: 10px; }
  .signature-block h3 { font-size: 8pt; text-transform: uppercase; color: #1D2C6B; margin-bottom: 8px; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .sig-field { font-size: 8pt; }
  .sig-field .label { font-size: 7pt; color: #666; }
  .sig-field .value { font-weight: 500; }
  .sig-area { margin-top: 10px; height: 40px; border: 1px dashed #ccc; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 7pt; }

  .footer { margin-top: 10px; padding-top: 6px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 6.5pt; color: #999; }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    pitney bowes
    <small>5 Rue Francis de Pressensé, Immeuble VOX, CS20012, 93456 La Plaine Saint-Denis Cedex</small>
  </div>
  <div class="header-right">
    <div class="version">${CONTRACT_VERSION}</div>
    Date : ${today}<br>
    Proposition valable 90 jours
  </div>
</div>

<h1>Contrat de Location Maintenance</h1>

<div style="text-align:center; font-size:7pt; color:#666; margin-bottom:10px;">
  Entre Pitney Bowes, SAS au capital de 11 789 424,25 €, RCS Bobigny 562 046 235, NAF 7733Z, TVA FR36562046235
</div>

<div class="info-grid">
  <div class="info-box">
    <h3>Locataire / Installation</h3>
    <div class="info-row"><span class="info-label">Compte</span><span class="info-value">${client.accountNumber}</span></div>
    <div class="info-row"><span class="info-label">Raison sociale</span><span class="info-value">${client.customerName}</span></div>
    <div class="info-row"><span class="info-label">Adresse</span><span class="info-value">${installAddress}</span></div>
    <div class="info-row"><span class="info-label">SIRET</span><span class="info-value">${client.siret || "—"}</span></div>
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
    <div class="info-row"><span class="info-label">Délai paiement</span><span class="info-value">Prélèvement</span></div>
    ${client.leaseNumber ? `<div class="info-row"><span class="info-label">Ancien contrat</span><span class="info-value">${client.leaseNumber}</span></div>` : ""}
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
      <div class="value">${today}</div>
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