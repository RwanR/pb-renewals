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

      // Download signed PDF
      downloadSignedDocuments(event.signatureRequestId)
        .then(async (pdfBuffer) => {
          console.log(`[YOUSIGN WEBHOOK] Downloaded signed PDF (${pdfBuffer.length} bytes)`);
          await prisma.acceptance.update({
            where: { id: acceptance.id },
            data: { signedPdfUrl: `yousign://${event.signatureRequestId}` },
          });
        })
        .catch((err) => {
          console.error(`[YOUSIGN WEBHOOK] Failed to download signed PDF:`, err);
        });

      // Send confirmation emails via Resend
      const client = acceptance.client;
      const offer = client.offers.find((o) => o.offerPosition === acceptance.offerPosition);
      const billing = offer ? (offer.billing60 ?? offer.billing36) : null;
      const monthly = billing ? (billing / 12) : null;
      const term = offer?.billing60 ? "60 mois" : "48 mois";
      const recipientEmail = acceptance.signatoryEmail;
      const accountNumber = acceptance.clientAccountNumber;

      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.EMAIL_FROM || "PB Renewals <onboarding@resend.dev>";

        // 1. Email au client (signataire)
        if (recipientEmail) {
          await resend.emails.send({
            from: fromEmail,
            to: recipientEmail,
            subject: `Confirmation de signature – Contrat ${accountNumber}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #404040;">
                <div style="padding: 24px 0; text-align: center; border-bottom: 3px solid; border-image: linear-gradient(90deg, #1D2C6B, #00A3E0, #7B2D8E, #E91E8C) 1;">
                  <img src="https://www.pitneybowes.com/content/dam/pitneybowes/us/en/logos/pitney-bowes-logo.svg" alt="Pitney Bowes" height="32" />
                </div>
                <div style="padding: 32px 0;">
                  <h1 style="font-size: 20px; color: #1D2C6B; margin-bottom: 16px;">Votre contrat a été signé avec succès</h1>
                  <p>Bonjour ${acceptance.signatoryFirstName} ${acceptance.signatoryLastName},</p>
                  <p>Nous vous confirmons la signature de votre contrat de renouvellement :</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 8px 0; color: #737373;">Client</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${client.customerName}</td></tr>
                    <tr><td style="padding: 8px 0; color: #737373;">N° de compte</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${accountNumber}</td></tr>
                    <tr><td style="padding: 8px 0; color: #737373;">Machine</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${offer?.modelName || "—"}</td></tr>
                    <tr><td style="padding: 8px 0; color: #737373;">Durée</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${term}</td></tr>
                    <tr><td style="padding: 8px 0; color: #737373;">Loyer mensuel HT</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${monthly ? monthly.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €" : "—"}</td></tr>
                  </table>
                  <p>Vous recevrez une copie du contrat signé par email séparément.</p>
                  ${offer?.template === "1" ? "<p><strong>Prochaine étape :</strong> votre nouvel équipement sera expédié à l'activation de votre nouveau contrat.</p>" : "<p>Votre équipement est déjà en place. Continuez à l'utiliser comme auparavant.</p>"}
                  <p style="margin-top: 24px; font-size: 13px; color: #737373;">Pour toute question, contactez-nous à <a href="mailto:fr-elease@pb.com" style="color: #005cb1;">fr-elease@pb.com</a></p>
                </div>
                <div style="padding: 16px 0; border-top: 1px solid #e5e5e5; font-size: 12px; color: #737373; text-align: center;">
                  ©1996-2026 Pitney Bowes Inc. Tous droits réservés.
                </div>
              </div>
            `,
          });

          console.log(`[YOUSIGN WEBHOOK] Confirmation email sent to client: ${recipientEmail}`);

          await prisma.acceptance.update({
            where: { id: acceptance.id },
            data: { emailSentAt: new Date() },
          });
        }

        // 2. Email au commercial PB
        if (client.ownerEmail) {
          await resend.emails.send({
            from: fromEmail,
            to: client.ownerEmail,
            subject: `[PB Renewals] Contrat signé – ${client.customerName} (${accountNumber})`,
            html: `
              <h2>Contrat signé</h2>
              <p><strong>Client :</strong> ${client.customerName} (${accountNumber})</p>
              <p><strong>Machine :</strong> ${offer?.modelName || "—"}</p>
              <p><strong>Durée :</strong> ${term}</p>
              <p><strong>Loyer mensuel HT :</strong> ${monthly ? monthly.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €" : "—"}</p>
              <p><strong>Installation :</strong> ${acceptance.installOptionSelected || "non sélectionnée"}</p>
              <p><strong>Signataire :</strong> ${acceptance.signatoryFirstName} ${acceptance.signatoryLastName} (${acceptance.signatoryEmail})</p>
              <p><strong>Fonction :</strong> ${acceptance.signatoryFunction || "—"}</p>
              <p><strong>Signé le :</strong> ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}</p>
              <p style="color:#666;font-size:13px">Email envoyé automatiquement par la plateforme PB Renewals.</p>
            `,
          });

          console.log(`[YOUSIGN WEBHOOK] Notification email sent to PB: ${client.ownerEmail}`);
        }
      } catch (err) {
        console.error(`[YOUSIGN WEBHOOK] Email sending failed:`, err);
        // Don't block — the signature is already recorded
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