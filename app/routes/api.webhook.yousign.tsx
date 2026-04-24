import type { ActionFunctionArgs } from "react-router";
import prisma from "~/db.server";
import { parseWebhookEvent, downloadSignedDocuments } from "~/lib/yousign.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.json();
  const event = parseWebhookEvent(body);

  console.log(`[YOUSIGN WEBHOOK] Event: ${event.eventName}, SR: ${event.signatureRequestId}`);

  switch (event.eventName) {
    case "signature_request.done": {
      const acceptance = await prisma.acceptance.findFirst({
        where: { adobeSignAgreementId: event.signatureRequestId },
        include: {
          client: {
            include: { offers: true },
          },
        },
      });

      if (!acceptance) {
        console.error(`[YOUSIGN WEBHOOK] No acceptance found for SR ${event.signatureRequestId}`);
        return Response.json({ ok: false, error: "Acceptance not found" });
      }

      // Update acceptance status
      await prisma.acceptance.update({
        where: { id: acceptance.id },
        data: {
          adobeSignStatus: "signed",
          signedAt: new Date(),
        },
      });

      console.log(`[YOUSIGN WEBHOOK] Acceptance ${acceptance.id} marked as signed`);

      // Download signed PDF, then send emails with attachment
      let signedPdfBuffer: Buffer | null = null;
      try {
        signedPdfBuffer = await downloadSignedDocuments(event.signatureRequestId);
        console.log(`[YOUSIGN WEBHOOK] Downloaded signed PDF (${signedPdfBuffer.length} bytes)`);
        await prisma.acceptance.update({
          where: { id: acceptance.id },
          data: { signedPdfUrl: `yousign://${event.signatureRequestId}` },
        });
      } catch (err) {
        console.error(`[YOUSIGN WEBHOOK] Failed to download signed PDF:`, err);
      }

      // Variables needed by Shopify below
      const client = acceptance.client;
      const offer = client.offers.find((o) => o.offerPosition === acceptance.offerPosition);
      const monthly = offer ? (offer.monthly60 ?? offer.monthly48 ?? offer.monthly36 ?? offer.billing60 ?? offer.billing48 ?? offer.billing36) : null;
      const billing = monthly ? monthly * 12 : null;
      const accountNumber = acceptance.clientAccountNumber;

      // Email notification au commercial
      if (client.ownerEmail) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);

          const term = (offer?.monthly60 ?? offer?.billing60) ? "60 mois" : (offer?.monthly48 ?? offer?.billing48) ? "48 mois" : "36 mois";
          const monthlyStr = monthly ? monthly.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) : "—";
          const installLabels: Record<string, string> = { auto: "Auto-installation", phone: "Assistée en ligne", onsite: "Sur site" };

          const attachments = signedPdfBuffer ? [{
            filename: `contrat-signe-${accountNumber}.pdf`,
            content: signedPdfBuffer.toString("base64"),
          }] : [];

          await resend.emails.send({
            from: process.env.EMAIL_FROM || "PB Renewals <onboarding@resend.dev>",
            to: "erwann.bocher@gmail.com", // TODO: remettre client.ownerEmail après recette
            subject: `[PB Renewals] Contrat signé – ${client.customerName} (${accountNumber})`,
            html: `
              <h2>Contrat signé</h2>
              <p><strong>Client :</strong> ${client.customerName} (${accountNumber})</p>
              <p><strong>Offre :</strong> ${offer?.modelName || "—"} — ${acceptance.offerPosition === 1 ? "Upgrade" : "Reconduction"}</p>
              <p><strong>Durée :</strong> ${term}</p>
              <p><strong>Loyer mensuel HT :</strong> ${monthlyStr} €</p>
              ${acceptance.installOptionSelected ? `<p><strong>Installation :</strong> ${installLabels[acceptance.installOptionSelected] || acceptance.installOptionSelected}</p>` : ""}
              <p><strong>Signataire :</strong> ${acceptance.signatoryFirstName} ${acceptance.signatoryLastName} (${acceptance.signatoryEmail})</p>
              ${acceptance.signatoryFunction ? `<p><strong>Fonction :</strong> ${acceptance.signatoryFunction}</p>` : ""}
              ${signedPdfBuffer ? "<p>Le contrat signé est en pièce jointe.</p>" : ""}
              <p style="color:#666;font-size:13px">Email envoyé automatiquement par la plateforme PB Renewals.</p>
            `,
            attachments,
          });

          console.log(`[YOUSIGN WEBHOOK] Email sent to commercial ${client.ownerEmail}`);
        } catch (err) {
          console.error(`[YOUSIGN WEBHOOK] Email to commercial failed:`, err);
        }
      } else {
        console.log(`[YOUSIGN WEBHOOK] No ownerEmail for ${accountNumber} — skipping notification`);
      }

      // Email au signataire avec le contrat signé
      if (acceptance.signatoryEmail && signedPdfBuffer) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);

          const term = (offer?.monthly60 ?? offer?.billing60) ? "60 mois" : (offer?.monthly48 ?? offer?.billing48) ? "48 mois" : "36 mois";
          const monthlyVal = offer ? (offer.monthly60 ?? offer.monthly48 ?? offer.monthly36 ?? offer.billing60 ?? offer.billing48 ?? offer.billing36) : null;
          const billingTax = offer ? (offer.billingTax60 ?? offer.billingTax48 ?? offer.billingTax36) : null;
          const billingTotal = monthlyVal && billingTax ? monthlyVal + billingTax : null;
          const fmt = (n: number | null) => n ? n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
          const isUpgrade = offer?.template === "1";
          const installLabels: Record<string, string> = { auto: "Auto-installation", phone: "Assistée en ligne (75 € HT)", onsite: "Sur site (198 € HT)" };

          const machineImages: Record<string, string> = {
            "SendPro C": "https://www.pitneybowes.com/content/dam/pitneybowes/germany/de/legacy/images/International/CE/Images/Produkte/Frankiermaschinen/DM300_G6SB0018_rgb_w350xh235pi--prodDetail_Large.jpg",
            "SendPro C Lite": "https://www.pitneybowes.com/content/dam/support/product-images/dm220-franking-machine.jpg",
            "DM300": "https://www.pitneybowes.com/content/dam/pitneybowes/germany/de/legacy/images/International/CE/Images/Produkte/Frankiermaschinen/DM300_G6SB0018_rgb_w350xh235pi--prodDetail_Large.jpg",
            "DM400": "https://www.pitneybowes.com/content/dam/pitneybowes/fr/fr/legacy/images/international/common/products/gms/digital-franking-machines/dm400c/dm400-box-left--proddetail_large.jpg",
            "DM220": "https://www.pitneybowes.com/content/dam/support/product-images/dm220-franking-machine.jpg",
          };
          const machineImg = Object.entries(machineImages).find(([k]) => offer?.modelName?.includes(k))?.[1] || "";

          await resend.emails.send({
            from: process.env.EMAIL_FROM || "PB Renewals <onboarding@resend.dev>",
            to: acceptance.signatoryEmail,
            subject: `Votre contrat Pitney Bowes a été signé — ${client.customerName}`,
            html: `
            <!DOCTYPE html>
            <html lang="fr">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="margin:0; padding:0; background:#f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa; padding: 32px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:white; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb;">

                    <!-- Header gradient -->
                    <tr><td style="height:4px; background: linear-gradient(90deg, #1D2C6B, #00A3E0, #7B2D8E);"></td></tr>

                    <!-- Logo -->
                    <tr><td align="center" style="padding: 32px 24px 16px;">
                      <img src="https://pb-renewals-production.up.railway.app/images/logo-pb.png" alt="Pitney Bowes" width="160" style="display:block;" />
                    </td></tr>

                    <!-- Title -->
                    <tr><td align="center" style="padding: 16px 24px;">
                      <h1 style="margin:0; font-size:24px; font-weight:500; color:#1a1a1a;">Confirmation</h1>
                      <p style="margin:8px 0 0; font-size:14px; color:#6b7280;">Votre contrat a été signé avec succès</p>
                    </td></tr>

                    <!-- Recap card -->
                    <tr><td style="padding: 16px 24px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
                        <tr>
                          ${machineImg ? `<td width="140" align="center" style="padding:16px;"><img src="${machineImg}" alt="${offer?.modelName || ''}" width="120" style="display:block;" /></td>` : ''}
                          <td style="padding:16px; vertical-align:top;">
                            <p style="margin:0 0 12px; font-size:18px; font-weight:600; color:#1a1a1a;">${offer?.modelName || '—'}</p>
                            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                              <tr><td style="color:#6b7280; padding:2px 0;">Durée</td><td align="right" style="font-weight:600; color:#1a1a1a; padding:2px 0;">${term}</td></tr>
                              <tr><td style="color:#6b7280; padding:2px 0;">Loyer mensuel HT</td><td align="right" style="font-weight:600; color:#1a1a1a; padding:2px 0;">${fmt(monthlyVal)} €</td></tr>
                              <tr><td style="color:#6b7280; padding:2px 0;">TVA 20%</td><td align="right" style="font-weight:600; color:#1a1a1a; padding:2px 0;">${fmt(billingTax)} €</td></tr>
                              <tr><td style="color:#6b7280; padding:2px 0;">Loyer mensuel TTC</td><td align="right" style="font-weight:600; color:#1a1a1a; padding:2px 0;">${fmt(billingTotal)} €</td></tr>
                              ${acceptance.installOptionSelected && acceptance.installOptionSelected !== "auto" ? `
                              <tr><td colspan="2" style="padding:8px 0 0;"><hr style="border:none; border-top:1px solid #e5e7eb;" /></td></tr>
                              <tr><td style="color:#6b7280; padding:2px 0;">Installation</td><td align="right" style="font-weight:600; color:#1a1a1a; padding:2px 0;">facturation séparée</td></tr>
                              ` : ''}
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td></tr>

                    <!-- CTA download -->
                    <tr><td align="center" style="padding: 16px 24px;">
                      <p style="margin:0 0 8px; font-size:13px; color:#6b7280;">Votre contrat signé est joint à cet email.</p>
                    </td></tr>

                    ${isUpgrade ? `
                    <!-- Livraison -->
                    <tr><td style="padding: 8px 24px 16px;">
                      <p style="margin:0 0 8px; font-size:16px; font-weight:600; color:#1a1a1a;">Livraison de votre équipement</p>
                      <p style="margin:0; font-size:14px; color:#1a1a1a; line-height:1.5;">
                        Votre nouvel équipement sera expédié à l'activation de votre nouveau contrat.<br/>
                        ${client.installStreet || ''}, ${client.installPostcode || ''} ${client.installCity || ''}
                      </p>
                    </td></tr>
                    ` : ''}

                    <!-- Contact commercial -->
                    ${client.ownerName ? `
                    <tr><td style="padding: 8px 24px 24px;">
                      <p style="margin:0 0 8px; font-size:16px; font-weight:600; color:#1a1a1a;">Votre contact commercial</p>
                      <p style="margin:0; font-size:14px; color:#1a1a1a;">${client.ownerName}${client.ownerEmail ? `<br/><a href="mailto:${client.ownerEmail}" style="color:#005cb1;">${client.ownerEmail}</a>` : ''}</p>
                    </td></tr>
                    ` : ''}

                    <!-- Footer -->
                    <tr><td style="padding: 16px 24px; background:#f8f9fa; border-top:1px solid #e5e7eb;">
                      <p style="margin:0; font-size:11px; color:#9ca3af; text-align:center;">
                        Pitney Bowes France SAS — 5 Rue Francis de Pressensé, 93456 La Plaine Saint-Denis<br/>
                        <a href="https://www.pitneybowes.com/fr" style="color:#9ca3af;">pitneybowes.com/fr</a>
                      </p>
                    </td></tr>

                  </table>
                </td></tr>
              </table>
            </body>
            </html>`,
            attachments: [{
              filename: `contrat-signe-${accountNumber}.pdf`,
              content: signedPdfBuffer.toString("base64"),
            }],
          });

          console.log(`[YOUSIGN WEBHOOK] Email sent to signer ${acceptance.signatoryEmail}`);
        } catch (err) {
          console.error(`[YOUSIGN WEBHOOK] Email to signer failed:`, err);
        }
      }

      // Create Shopify Draft Order (async, non-blocking)
      if (client.shopifyCustomerId) {
        try {
          const { createDraftOrder } = await import("~/lib/shopify-admin.server");
          const installPrices: Record<string, number> = { auto: 0, phone: 75, onsite: 198 };
          const draftOrderId = await createDraftOrder({
            accountNumber,
            shopifyCustomerId: client.shopifyCustomerId,
            modelName: offer?.modelName || "Unknown",
            term: (offer?.monthly60 ?? offer?.billing60) ? "60" : (offer?.monthly48 ?? offer?.billing48) ? "48" : "36",
            billingAnnualHT: billing || 0,
            installOption: acceptance.installOptionSelected,
            installPrice: installPrices[acceptance.installOptionSelected || ""] || 0,
            signatoryName: `${acceptance.signatoryFirstName} ${acceptance.signatoryLastName}`,
          });

          if (draftOrderId) {
            await prisma.acceptance.update({
              where: { id: acceptance.id },
              data: {
                shopifyDraftOrderId: draftOrderId,
                shopifyCustomerId: client.shopifyCustomerId,
                shopifySyncedAt: new Date(),
              },
            });
            console.log(`[YOUSIGN WEBHOOK] Draft order created: ${draftOrderId}`);
          }
        } catch (err) {
          console.error(`[YOUSIGN WEBHOOK] Draft order creation failed:`, err);
        }
      } else {
        console.log(`[YOUSIGN WEBHOOK] No Shopify Customer ID for ${accountNumber} — skipping draft order`);
      }

      // Update Customer metafields with signature data
      if (client.shopifyCustomerId) {
        try {
          const { updateCustomerAfterSignature, updateCustomerInfo } = await import("~/lib/shopify-admin.server");
          await updateCustomerAfterSignature({
            shopifyCustomerId: client.shopifyCustomerId,
            accountNumber,
            offerSelected: offer?.modelName || "—",
            termSelected: (offer?.monthly60 ?? offer?.billing60) ? "60 mois" : (offer?.monthly48 ?? offer?.billing48) ? "48 mois" : "36 mois",
            installOption: acceptance.installOptionSelected || "",
            signatoryName: `${acceptance.signatoryFirstName} ${acceptance.signatoryLastName}`,
            signedAt: new Date(),
          });

          // Sync modified contact info to Shopify
          if (acceptance.overrideEmail || acceptance.overridePhone) {
            await updateCustomerInfo({
              shopifyCustomerId: client.shopifyCustomerId,
              email: acceptance.overrideEmail || undefined,
              phone: acceptance.overridePhone || undefined,
            });
          }
        } catch (err) {
          console.error(`[YOUSIGN WEBHOOK] Metafields update failed:`, err);
        }
      }

      break;
    }

    case "signer.done": {
      console.log(`[YOUSIGN WEBHOOK] Signer completed`);
      break;
    }

    case "signature_request.expired": {
      const acceptance = await prisma.acceptance.findFirst({
        where: { adobeSignAgreementId: event.signatureRequestId },
      });

      if (acceptance) {
        await prisma.acceptance.update({
          where: { id: acceptance.id },
          data: { adobeSignStatus: "expired" },
        });
      }
      break;
    }

    case "signature_request.declined": {
      const acceptance = await prisma.acceptance.findFirst({
        where: { adobeSignAgreementId: event.signatureRequestId },
      });

      if (acceptance) {
        await prisma.acceptance.update({
          where: { id: acceptance.id },
          data: { adobeSignStatus: "cancelled" },
        });
      }
      break;
    }

    default:
      console.log(`[YOUSIGN WEBHOOK] Unhandled event: ${event.eventName}`);
  }

  return Response.json({ ok: true });
}