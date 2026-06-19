import type { PbisClient, PbisAcceptance } from "@prisma-pbis/client";
import { PB_LOGO, PLATEFORME_AGREEE, ISO_27001 } from "./contract-logos.server";

const CONTRACT_VERSION = "PBIS START 2026-1";

// Date de mise à disposition fixée au 01/09/2026 (entrée en vigueur de l'obligation
// de réception). Confirmée fixe par PB.
const MISE_A_DISPO = "01/09/2026";

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

  // Données partagées par les trois blocs (Abonné = Utilisation = Facturation
  // pour un abonnement PBIS Start mono-entité, comme sur les contrats de location PB).
// Trois blocs distincts du contrat PBIS : Vos informations, Contact principal,
  // Signataire autorisé. Fallback acceptance -> client pour les champs verrouillés.
  const v = {
    raison: acceptance.companyName || client.companyName || "-",
    compte: client.compteClientBillTo || "-",
    siret: acceptance.siret || client.siret || "-",
    tva: acceptance.vatNumber || client.vatNumber || "-",
    adresse: [
      acceptance.billingStreet || client.street || "",
      `${acceptance.billingPostcode || client.postcode || ""} ${acceptance.billingCity || client.city || ""}`.trim(),
    ].filter(Boolean).join(", ") || "-",
    contactPrenom: acceptance.contactFirstName || client.contactFirstName || "-",
    contactNom: acceptance.contactLastName || client.contactLastName || "-",
    contactEmail: acceptance.contactEmail || client.contactEmail || "-",
    contactTel: acceptance.contactPhone || client.contactPhone || "-",
    reception: acceptance.receptionEmail || "-",
    sigNomPrenom: [acceptance.signatoryFirstName, acceptance.signatoryLastName].filter(Boolean).join(" ") || "-",
    sigFonction: acceptance.signatoryFunction || "-",
    sigEmail: acceptance.signatoryEmail || "-",
    sigTel: acceptance.signatoryPhone || "-",
    sigRef: acceptance.orderReference || "-",
    modePaiement: "Prélèvement à l'activation du service",
  };

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

  h1 { font-size: 13pt; font-weight: 700; color: #1a1a1a; text-align: center; margin: 8px 0 2px; }
  .tagline { text-align: center; font-size: 7.5pt; color: #1D2C6B; font-weight: 600; margin-bottom: 3px; }
  .subtitle { text-align: center; font-size: 6.5pt; color: #666; margin-bottom: 8px; }

  .blocks { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 8px; }
  .block { border: 1px solid #cfcfcf; border-radius: 2px; overflow: hidden; }
  .block-head { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; padding: 3px 6px; text-align: center; background: #dbe9ff; color: #1D2C6B; }
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
  .incl { margin: 0; padding-left: 14px; font-size: 7.5pt; line-height: 1.3; }
  .incl li { margin-bottom: 1px; }
  .incl-total { margin-top: 4px; font-size: 7.5pt; font-weight: 700; }

  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table th { background: #1D2C6B; color: white; font-size: 6.5pt; padding: 3px 5px; text-align: left; text-transform: uppercase; letter-spacing: 0.3px; }
  table th:last-child { text-align: right; }
  table td { font-size: 7.5pt; padding: 2.5px 5px; border-bottom: 1px solid #eee; }
  table td:last-child { text-align: right; font-weight: 600; }
  .total-row td { border-top: 1.5px solid #1D2C6B; font-weight: 700; font-size: 8.5pt; padding-top: 4px; }

  .legal { margin-top: 6px; font-size: 6pt; color: #555; line-height: 1.25; }
  .legal p { margin-bottom: 3px; }
  .legal .sub { font-weight: 700; color: #1a1a1a; font-size: 6.5pt; margin-top: 4px; }
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
      <div class="version">Version ${CONTRACT_VERSION}</div>
      Date : ${today}
    </div>
    <img src="${PLATEFORME_AGREEE}" alt="Plateforme Agréée" style="height:44px; width:auto;" />
    <img src="${ISO_27001}" alt="ISO 27001" style="height:44px; width:auto;" />
  </div>
</div>

<h1>Abonnement Solution Pitney Bowes Invoice Services Start</h1>

<div class="tagline">Solution de mise en conformité de vos factures fournisseurs dans le cadre de la Loi de finances</div>

<div class="subtitle">
  Entre Pitney Bowes, SAS au capital de 11 789 424,25 €, RCS Bobigny 562 046 235, NAF 7733Z, TVA FR36562046235
</div>

<div class="blocks">
  <div class="block">
    <div class="block-head">Vos informations</div>
    <div class="block-body">
      <div class="frow"><div class="flabel">Raison sociale</div><div class="fvalue">${v.raison}</div></div>
      <div class="frow"><div class="flabel">Numéro client</div><div class="fvalue">${v.compte}</div></div>
      <div class="frow"><div class="flabel">SIRET</div><div class="fvalue">${v.siret}</div></div>
      <div class="frow"><div class="flabel">N° de TVA</div><div class="fvalue">${v.tva}</div></div>
      <div class="frow"><div class="flabel">Adresse de facturation</div><div class="fvalue">${v.adresse}</div></div>
    </div>
  </div>
  <div class="block">
    <div class="block-head">Contact principal</div>
    <div class="block-body">
      <div class="frow"><div class="flabel">Prénom</div><div class="fvalue">${v.contactPrenom}</div></div>
      <div class="frow"><div class="flabel">Nom</div><div class="fvalue">${v.contactNom}</div></div>
      <div class="frow"><div class="flabel">Adresse email</div><div class="fvalue">${v.contactEmail}</div></div>
      <div class="frow"><div class="flabel">Téléphone</div><div class="fvalue">${v.contactTel}</div></div>
      <div class="frow"><div class="flabel">Email de réception des factures fournisseurs</div><div class="fvalue">${v.reception}</div></div>
    </div>
  </div>
  <div class="block">
    <div class="block-head">Signataire autorisé</div>
    <div class="block-body">
      <div class="frow"><div class="flabel">Nom et prénom</div><div class="fvalue">${v.sigNomPrenom}</div></div>
      <div class="frow"><div class="flabel">Fonction</div><div class="fvalue">${v.sigFonction}</div></div>
      <div class="frow"><div class="flabel">Adresse email</div><div class="fvalue">${v.sigEmail}</div></div>
      <div class="frow"><div class="flabel">Téléphone</div><div class="fvalue">${v.sigTel}</div></div>
      <div class="frow"><div class="flabel">Votre référence</div><div class="fvalue">${v.sigRef}</div></div>
      <div class="frow"><div class="flabel">Mode de paiement</div><div class="fvalue">${v.modePaiement}</div></div>
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
      <div class="value">${MISE_A_DISPO}</div>
    </div>
    <div class="condition-item">
      <div class="label">Mode de paiement</div>
      <div class="value" style="font-size:7.5pt">Prélèvement à l'activation du service</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Code</th>
        <th>Désignation</th>
        <th>Loyer annuel HT *</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>ABON_SOLUTIONS</td><td>Abonnement solution</td><td></td></tr>
      <tr><td>PBIS_START</td><td>Abonnement licence PBIS Start</td><td>180,00 €</td></tr>
      <tr><td>OD_DOC</td><td>Facturation à l'usage, coût unitaire par facture : 0,50 €HT (au-delà de 1000 factures par an) **</td><td></td></tr>
      <tr class="total-row">
        <td colspan="2" style="text-align:right">Total annuel HT</td>
        <td>180,00 €</td>
      </tr>
    </tbody>
  </table>

  <h3 style="margin-top:6px;">Mise en service / Prestations incluses</h3>
  <ul class="incl" style="list-style:none; padding-left:0;">
    <li>&gt; Inscription de votre entreprise sur l'Annuaire de l'État</li>
    <li>&gt; Mise en place d'un portail collaboratif en ligne</li>
    <li>&gt; Réception de vos factures fournisseurs lisibles sur la boîte email de votre choix</li>
    <li>&gt; Mise en place de l'archivage à valeur probante 10 ans</li>
    <li>&gt; Gestion des statuts obligatoires</li>
  </ul>
  <div class="incl-total">Total paramétrages : Inclus</div>
</div>

<div class="legal">
  <p>Le présent contrat est conclu pour une durée de 12 mois.</p>
  <p>Cette date de mise à disposition convenue avec l'Abonné est conditionnée à la bonne réception par Pitney Bowes de l'ensemble des documents contractuels et du N° de référence interne Abonné éventuellement exigé par celui-ci, signés et datés par l'Abonné dans un délai de 5 jours ouvrés à compter de la réception de l'offre commerciale correspondante. Passé ce délai, Pitney Bowes se réserve le droit de réajuster la date de mise à disposition de la (des) prestation(s) convenue(s).</p>
  <p>L'Abonné s'engage à régler selon les modalités de paiement convenues : 100% à l'activation du service.</p>
  <p class="sub">Retour du contrat et conditions de mise en production</p>
  <p>L'Abonné s'engage à retourner le présent Contrat dûment signé et complété de l'ensemble des documents et informations requis, notamment son n° de référence interne de commande le cas échéant, dans un délai maximum de 5 jours calendaires à compter de la date de signature du Contrat, et en tout état de cause au moins 14 jours calendaires avant la date de mise en production convenue entre les parties. À défaut de réception par Pitney Bowes du Contrat signé et des informations requises dans ces délais, Pitney Bowes se réserve le droit d'ajuster la date de mise en production en conséquence. Cet ajustement sera sans incidence sur la date de prise d'effet du Contrat et sur les conditions de facturation convenues, qui demeureront inchangées. Les prestations et abonnements sont facturés aux dates et conditions prévues au Contrat, y compris en cas de retard de mise en production imputable au non-respect par l'Abonné des délais ci-dessus. L'Abonné reconnaît avoir validé l'ensemble des prérequis techniques, fonctionnels et organisationnels nécessaires à la bonne exécution des prestations et s'engage à en assurer le maintien pendant toute la durée du Contrat. Pitney Bowes ne saurait être tenu responsable des conséquences directes ou indirectes d'un manquement de l'Abonné à ces obligations.</p>
</div>

<div class="legal">
  <p>* Tous les montants indiqués sur ce document s'entendent hors TVA légale.</p>
  <p>** Tout dépassement fera l'objet d'une facturation unique et séparée de l'abonnement, en fin de période.</p>
  <p>L'Abonné accepte que le mandat SEPA récurrent actuellement utilisé dans le cadre de ses règlements Pitney Bowes soit utilisé pour le bon règlement des factures liées au présent Contrat d'Abonnement. En cas de changement de coordonnées bancaires, l'Abonné s'engage à compléter et signer un nouveau mandat SEPA, disponible sur son espace client.</p>
  <p>En signant le présent Contrat d'Abonnement, l'Abonné manifeste avoir pris connaissance de l'ensemble des conditions particulières indiquées ci-dessus et des Conditions Générales en vigueur le jour de la signature de ce Contrat d'Abonnement, disponibles à l'adresse <a href="https://www.pitneybowes.com/fr/conditionsgenerales/servicessolutions.html" target="_blank" rel="noopener noreferrer">www.pitneybowes.com/fr/conditionsgenerales/servicessolutions.html</a> et les accepter, y compris la clause attributive de juridiction.</p>
</div>

<div class="signature-block">
  <h3>Pour l'Abonné (signataire habilité à ratifier le Contrat d'Abonnement au nom et pour le compte de l'Abonné)</h3>
  <div class="sig-grid">
    <div class="sig-field"><span class="label">Prénom</span><div class="value">${acceptance.signatoryFirstName || "-"}</div></div>
    <div class="sig-field"><span class="label">Nom</span><div class="value">${acceptance.signatoryLastName || "-"}</div></div>
    <div class="sig-field"><span class="label">Fonction</span><div class="value">${acceptance.signatoryFunction || "-"}</div></div>
    <div class="sig-field"><span class="label">E-mail</span><div class="value">${acceptance.signatoryEmail || "-"}</div></div>
  </div>
  <div class="sig-area">Signature électronique via Yousign</div>
</div>

<div class="footer">
  Pitney Bowes SAS - RCS Bobigny 562 046 235 - Version ${CONTRACT_VERSION}
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