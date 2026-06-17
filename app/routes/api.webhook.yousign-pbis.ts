import type { Route } from "./+types/api.webhook.yousign-pbis";
import pbisDb from "~/db.pbis.server";
import { parseWebhookEvent, downloadSignedDocuments } from "~/lib/yousign.server";
import { markSigned } from "~/lib/pbis-funnel.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.json();
  const event = parseWebhookEvent(body);

  console.log(`[PBIS YOUSIGN WEBHOOK] Event: ${event.eventName}, SR: ${event.signatureRequestId}`);

  switch (event.eventName) {
    case "signature_request.done": {
      const acceptance = await pbisDb.pbisAcceptance.findFirst({
        where: { yousignProcedureId: event.signatureRequestId },
        include: { client: true },
      });

      if (!acceptance) {
        console.error(`[PBIS YOUSIGN WEBHOOK] No acceptance found for SR ${event.signatureRequestId}`);
        return Response.json({ ok: false, error: "Acceptance not found" });
      }

      // Guard doublon webhook
      if (acceptance.signedAt) {
        console.log(`[PBIS YOUSIGN WEBHOOK] Already processed for ${acceptance.clientId}, skipping`);
        return Response.json({ ok: true, skipped: true });
      }

      // Update status
      await pbisDb.pbisAcceptance.update({
        where: { id: acceptance.id },
        data: {
          yousignStatus: "signed",
          status: "signed",
          signedAt: new Date(),
        },
      });

      console.log(`[PBIS YOUSIGN WEBHOOK] Acceptance ${acceptance.id} marked as signed`);

      // Tracking funnel : étape finale atteinte
      await markSigned(acceptance.clientId);

      // Download signed PDF
      let signedPdfBuffer: Buffer | null = null;
      try {
        signedPdfBuffer = await downloadSignedDocuments(event.signatureRequestId);
        console.log(`[PBIS YOUSIGN WEBHOOK] Downloaded signed PDF (${signedPdfBuffer.length} bytes)`);
        await pbisDb.pbisAcceptance.update({
          where: { id: acceptance.id },
          data: { signedPdfUrl: `yousign://${event.signatureRequestId}` },
        });
      } catch (err) {
        console.error(`[PBIS YOUSIGN WEBHOOK] Failed to download signed PDF:`, err);
      }

      // Email signataire avec contrat signé en PJ
      if (acceptance.signatoryEmail && signedPdfBuffer) {
        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          const logoUrl = `${process.env.APP_URL || "https://pbis-production.up.railway.app"}/images/pb-logo.png`;

          const override = process.env.EMAIL_OVERRIDE;
          const cc =
            !override && acceptance.contactEmail && acceptance.contactEmail !== acceptance.signatoryEmail
              ? acceptance.contactEmail
              : undefined;

          await resend.emails.send({
            from: process.env.EMAIL_FROM || "PBIS <noreply@nemet.tech>",
            to: override || acceptance.signatoryEmail,
            cc,
            subject: `Votre contrat Pitney Bowes Invoice Services Start a été signé`,
            html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa; padding: 32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb;">
        <tr><td style="height:4px; background: linear-gradient(90deg, #CF0989, #009DBF, #00B140);"></td></tr>
        <tr><td align="center" style="padding: 32px 24px 16px;">
          <img src="${logoUrl}" alt="Pitney Bowes" width="160" style="display:block;" />
        </td></tr>
        <tr><td align="center" style="padding: 16px 24px;">
          <h1 style="margin:0; font-size:24px; font-weight:500; color:#1a1a1a;">Confirmation</h1>
          <p style="margin:8px 0 0; font-size:14px; color:#6b7280;">Votre contrat PBIS Start a été signé avec succès</p>
        </td></tr>
        <tr><td style="padding: 16px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb; border-radius:12px; padding:16px;">
            <tr><td style="padding:8px;">
              <p style="margin:0 0 12px; font-size:18px; font-weight:600; color:#1a1a1a;">PBIS Start</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                <tr><td style="color:#6b7280; padding:2px 0;">Durée</td><td align="right" style="font-weight:600; color:#1a1a1a; padding:2px 0;">12 mois</td></tr>
                <tr><td style="color:#6b7280; padding:2px 0;">Abonnement annuel HT</td><td align="right" style="font-weight:600; color:#1a1a1a; padding:2px 0;">180,00 €</td></tr>
                <tr><td style="color:#6b7280; padding:2px 0;">Coût par facture supplémentaire</td><td align="right" style="font-weight:600; color:#1a1a1a; padding:2px 0;">0,50 € HT</td></tr>
                <tr><td style="color:#6b7280; padding:2px 0;">Factures incluses</td><td align="right" style="font-weight:600; color:#1a1a1a; padding:2px 0;">1000 / an</td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding: 16px 24px;">
          <p style="margin:0 0 8px; font-size:13px; color:#6b7280;">Votre contrat signé est joint à cet email.</p>
        </td></tr>
        <tr><td style="padding: 8px 24px 16px;">
          <p style="margin:0 0 8px; font-size:16px; font-weight:600; color:#1a1a1a;">Prochaines étapes</p>
          <p style="margin:0; font-size:14px; color:#1a1a1a; line-height:1.5;">
            L'équipe Pitney Bowes vous contactera prochainement pour finaliser l'accord formel auprès de la DGFiP et l'inscription à l'Annuaire de l'État.
          </p>
        </td></tr>
        <tr><td style="padding: 16px 24px; background:#f8f9fa; border-top:1px solid #e5e7eb;">
          <p style="margin:0; font-size:11px; color:#9ca3af; text-align:center;">
            Pitney Bowes France SAS - 5 Rue Francis de Pressensé, 93456 La Plaine Saint-Denis<br/>
            <a href="https://www.pitneybowes.com/fr" style="color:#9ca3af;">pitneybowes.com/fr</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
            attachments: [{
              filename: `contrat-pbis-start-signe-${acceptance.clientId}.pdf`,
              content: signedPdfBuffer.toString("base64"),
            }],
          });

          console.log(`[PBIS YOUSIGN WEBHOOK] Email sent to signer ${acceptance.signatoryEmail}`);
        } catch (err) {
          console.error(`[PBIS YOUSIGN WEBHOOK] Email to signer failed:`, err);
        }
      }

      break;
    }

    case "signer.done": {
      console.log(`[PBIS YOUSIGN WEBHOOK] Signer completed`);
      break;
    }

    case "signature_request.expired": {
      const acceptance = await pbisDb.pbisAcceptance.findFirst({
        where: { yousignProcedureId: event.signatureRequestId },
      });

      if (acceptance) {
        await pbisDb.pbisAcceptance.update({
          where: { id: acceptance.id },
          data: { yousignStatus: "expired", status: "expired" },
        });
      }
      break;
    }

    case "signature_request.declined": {
      const acceptance = await pbisDb.pbisAcceptance.findFirst({
        where: { yousignProcedureId: event.signatureRequestId },
      });

      if (acceptance) {
        await pbisDb.pbisAcceptance.update({
          where: { id: acceptance.id },
          data: { yousignStatus: "cancelled", status: "cancelled" },
        });
      }
      break;
    }

    default:
      console.log(`[PBIS YOUSIGN WEBHOOK] Unhandled event: ${event.eventName}`);
  }

  return Response.json({ ok: true });
}