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

      // Send confirmation emails via Resend
      const client = acceptance.client;
      const offer = client.offers.find((o) => o.offerPosition === acceptance.offerPosition);
      const billing = offer ? (offer.billing60 ?? offer.billing36) : null;
      const monthly = billing ? (billing / 12) : null;
      const term = offer?.billing60 ? "60 mois" : "48 mois";
      const accountNumber = acceptance.clientAccountNumber;
      const pdfFilename = `contrat-signe-${accountNumber}.pdf`;

      const attachments = signedPdfBuffer
        ? [{ filename: pdfFilename, content: signedPdfBuffer }]
        : [];

      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.EMAIL_FROM || "PB Renewals <onboarding@resend.dev>";

        // Email au commercial PB avec PDF signé en PJ
        if (client.ownerEmail) {
          await resend.emails.send({
            from: fromEmail,
            to: client.ownerEmail,
            subject: `[PB Renewals] Contrat signé – ${client.customerName} (${accountNumber})`,
            attachments,
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
      }

      // Create Shopify Draft Order (async, non-blocking)
      if (client.shopifyCustomerId) {
        try {
          const { createDraftOrder } = await import("~/lib/shopify-admin.server");
          const installPrices: Record<string, number> = { auto: 0, phone: 63, onsite: 155 };
          const draftOrderId = await createDraftOrder({
            accountNumber,
            shopifyCustomerId: client.shopifyCustomerId,
            modelName: offer?.modelName || "Unknown",
            term: offer?.billing60 ? "60" : "48",
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