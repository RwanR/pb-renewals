import type { PbisClient, PbisAcceptance } from "@prisma-pbis/client";
import { PB_LOGO, PLATEFORME_AGREEE, ISO_27001 } from "./contract-logos.server";

const CONTRACT_VERSION = "FR - PBIS 05 2026";

interface PbisContractData {
  client: PbisClient;
  acceptance: PbisAcceptance;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function generateContractHTML(data: PbisContractData): string {
  const { client, acceptance } = data;
  const today = formatDate(new Date());

  // Date de mise à disposition : aujourd'hui + 30 jours (proposition standard).
  // PB pourra ajuster si besoin une fois le wording stabilisé.
  const miseADispo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const miseADispoStr = formatDate(miseADispo);

  // Données partagées par les trois blocs (Abonné = Utilisation = Facturation
  // pour un abonnement PBIS Start mono-entité, comme sur les contrats de location PB).
  const v = {
    compte: client.compteClientBillTo || "-",
    raison: acceptance.companyName || client.companyName || "-",
    adresse: acceptance.billingStreet || client.street || "-",
    cpVille: `${acceptance.billingPostcode || client.postcode || ""} ${acceptance.billingCity || client.city || ""}`.trim() || "-",
    siret: acceptance.siret || client.siret || "-",
    tva: acceptance.vatNumber || client.vatNumber || "-",
    contact: [acceptance.contactFirstName, acceptance.contactLastName].filter(Boolean).join(" ") || "-",
    tel: acceptance.contactPhone || client.contactPhone || "-",
    email: acceptance.contactEmail || client.contactEmail || "-",
    reception: acceptance.receptionEmail || "-",
  };

  const blockRows = `
    <div class="frow"><div class="flabel">Compte Client</div><div class="fvalue">${v.compte}</div></div>
    <div class="frow"><div class="flabel">Raison Sociale</div><div class="fvalue">${v.raison}</div></div>
    <div class="frow"><div class="flabel">Adresse Postale</div><div class="fvalue">${v.adresse}</div></div>
    <div class="frow"><div class="flabel">Code Postal / Ville</div><div class="fvalue">${v.cpVille}</div></div>
    <div class="frow"><div class="flabel">SIRET</div><div class="fvalue">${v.siret}</div></div>
    <div class="frow"><div class="flabel">N° TVA</div><div class="fvalue">${v.tva}</div></div>
    <div class="frow"><div class="flabel">Contact</div><div class="fvalue">${v.contact}</div></div>
    <div class="frow"><div class="flabel">Téléphone</div><div class="fvalue">${v.tel}</div></div>
    <div class="frow"><div class="flabel">E-mail</div><div class="fvalue">${v.email}</div></div>
  `;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 12mm 15mm 12mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #1a1a1a; line-height: 1.35; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #1D2C6B; }
  .header-left { display: flex; flex-direction: column; gap: 2px; }
  .header-left small { font-size: 6.5pt; color: #666; }
  .header-right { display: flex; align-items: flex-start; gap: 8px; text-align: right; font-size: 7pt; color: #666; }
  .header-right .version { font-weight: 600; color: #1D2C6B; font-size: 7.5pt; }

  h1 { font-size: 13pt; font-weight: 700; color: #1a1a1a; text-align: center; margin: 8px 0 4px; }
  .subtitle { text-align: center; font-size: 6.5pt; color: #666; margin-bottom: 8px; }

  .blocks { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 8px; }
  .block { border: 1px solid #cfcfcf; border-radius: 2px; overflow: hidden; }
  .block-head { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; padding: 3px 6px; text-align: center; }
  .head-abonne { background: #dbe9ff; color: #1D2C6B; }
  .head-utilisation { background: #d9f2e3; color: #1a7a44; }
  .head-facturation { background: #ffe8d1; color: #b05a00; }
  .block-body { padding: 4px 6px; }
  .frow { display: flex; flex-direction: column; padding: 2px 0; border-bottom: 1px solid #eee; }
  .frow:last-child { border-bottom: none; }
  .flabel { font-size: 6pt; color: #777; }
  .fvalue { font-size: 7pt; font-weight: 600; color: #1a1a1a; word-break: break-word; }

  .conditions { border: 1px solid #cfcfcf; border-radius: 2px; padding: 6px 8px; margin-bottom: 6px; }
  .conditions h3 { font-size: 7.5pt; font-weight: 700; color: #1D2C6B; text-transform: uppercase; margin-bottom: 4px; border-bottom: 1px solid #e0e0e0; padding-bottom: 3px; }
  .conditions-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 6px; }
  .condition-item .label { font-size: 6.5pt; color: #555; }
  .condition-item .value { font-size: 9pt; font-weight: 700; }

  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table th { background: #1D2C6B; color: white; font-size: 6.5pt; padding: 3px 5px; text-align: left; text-transform: uppercase; letter-spacing: 0.3px; }
  table th:last-child { text-align: right; }
  table td { font-size: 7.5pt; padding: 2.5px 5px; border-bottom: 1px solid #eee; }
  table td:last-child { text-align: right; font-weight: 600; }
  .total-row td { border-top: 1.5px solid #1D2C6B; font-weight: 700; font-size: 8.5pt; padding-top: 4px; }

  .legal { margin-top: 6px; font-size: 6pt; color: #555; line-height: 1.25; }
  .legal p { margin-bottom: 3px; }
  .legal a { color: #1D2C6B; }

  .signature-block { margin-top: 6px; border: 1px solid #cfcfcf; border-radius: 2px; padding: 6px 8px; }
  .signature-block h3 { font-size: 7.5pt; font-weight: 700; color: #1D2C6B; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e0e0e0; padding-bottom: 3px; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .sig-field { font-size: 7.5pt; }
  .sig-field .label { font-size: 6.5pt; color: #555; }
  .sig-field .value { font-weight: 600; }
  .sig-area { margin-top: 6px; height: 32px; border: 1px dashed #ccc; border-radius: 3px; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 6.5pt; }

  .footer { margin-top: 6px; padding-top: 4px; border-top: 1px solid #ddd; text-align: center; font-size: 6pt; color: #999; }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <img src="${PB_LOGO}" alt="Pitney Bowes" style="width:160px; height:55px; display:block; margin-bottom:3px;" />
    <small>5 Rue Francis de Pressensé, Immeuble VOX, CS20012, 93456 La Plaine Saint-Denis Cedex</small>
  </div>
  <div class="header-right">
    <div>
      <div class="version">${CONTRACT_VERSION}</div>
      Date : ${today}
    </div>
    <img src="${PLATEFORME_AGREEE}" alt="Plateforme Agréée" style="height:44px; width:auto;" />
    <img src="${ISO_27001}" alt="ISO 27001" style="height:44px; width:auto;" />
  </div>
</div>

<h1>Contrat d'Abonnement Pitney Bowes Invoice Services Start</h1>

<div class="subtitle">
  Entre Pitney Bowes, SAS au capital de 11 789 424,25 €, RCS Bobigny 562 046 235, NAF 7733Z, TVA FR36562046235
</div>

<div class="blocks">
  <div class="block">
    <div class="block-head head-abonne">L'Abonné</div>
    <div class="block-body">${blockRows}</div>
  </div>
  <div class="block">
    <div class="block-head head-utilisation">Utilisation</div>
    <div class="block-body">${blockRows}</div>
  </div>
  <div class="block">
    <div class="block-head head-facturation">Facturation</div>
    <div class="block-body">${blockRows}
      <div class="frow"><div class="flabel">E-mail réception factures</div><div class="fvalue">${v.reception}</div></div>
    </div>
  </div>
</div>

<div class="conditions">
  <h3>Conditions particulières</h3>
  <div class="conditions-grid">
    <div class="condition-item">
      <div class="label">Durée</div>
      <div class="value">12 mois</div>
    </div>
    <div class="condition-item">
      <div class="label">Date de mise à disposition</div>
      <div class="value">${miseADispoStr}</div>
    </div>
    <div class="condition-item">
      <div class="label">Mode de paiement</div>
      <div class="value" style="font-size:8pt">Virement à la commande</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Code</th>
        <th>Désignation</th>
        <th>Loyer annuel HT</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>ABON_SOLUTIONS</td><td>Abonnement solution</td><td></td></tr>
      <tr><td>PBIS_START</td><td>Abonnement licence PBIS Start</td><td>180,00 €</td></tr>
      <tr><td>OD_DOC</td><td>Facturation à l'usage, coût unitaire par facture : 0,50 €HT</td><td></td></tr>
      <tr class="total-row">
        <td colspan="2" style="text-align:right">Total annuel HT</td>
        <td>180,00 €</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="legal">
  <p>Tous les montants s'entendent hors TVA légale. En signant ce contrat d'Abonnement, l'Abonné reconnait avoir pris connaissance de l'article 5 alinéa C des conditions générales. L'Abonné s'engage à régler selon les modalités de paiement convenues : 100% à la signature de ce contrat d'Abonnement.</p>
  <p>Le présent contrat d'Abonnement prend effet à compter de la date de signature des présentes par l'Abonné dans les conditions stipulées à l'article 9 alinéas C et D. L'Abonné est présumé avoir accepté l'émission et la transmission des factures à venir de Pitney Bowes par mise à disposition sur son espace client (pitneybowes.fr/espace-client).</p>
  <p>En signant le présent Contrat d'Abonnement, l'Abonné manifeste avoir pris connaissance des Conditions Générales (version ${CONTRACT_VERSION}) consultables à l'adresse <a href="https://pb.com/fr/servicessolutions">pb.com/fr/servicessolutions</a> et les accepter, y compris la clause attributive de juridiction.</p>
</div>

<div class="signature-block">
  <h3>Pour l'Abonné (signataire habilité à ratifier le Contrat d'Abonnement)</h3>
  <div class="sig-grid">
    <div class="sig-field"><span class="label">Prénom</span><div class="value">${acceptance.signatoryFirstName || "-"}</div></div>
    <div class="sig-field"><span class="label">Nom</span><div class="value">${acceptance.signatoryLastName || "-"}</div></div>
    <div class="sig-field"><span class="label">Fonction</span><div class="value">${acceptance.signatoryFunction || "-"}</div></div>
    <div class="sig-field"><span class="label">E-mail</span><div class="value">${acceptance.signatoryEmail || "-"}</div></div>
  </div>
  <div class="sig-area">Signature électronique via Yousign</div>
</div>

<div class="footer">
  Pitney Bowes SAS - RCS Bobigny 562 046 235 - ${CONTRACT_VERSION}
</div>

</body>
</html>`;
}

export async function generateContractPDFPbis(data: PbisContractData): Promise<Buffer> {
  const html = generateContractHTML(data);

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

export function generateContractHTMLPreviewPbis(data: PbisContractData): string {
  return generateContractHTML(data);
}