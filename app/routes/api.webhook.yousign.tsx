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
      // All signers have signed
      const acceptance = await prisma.acceptance.findFirst({
        where: { adobeSignAgreementId: event.signatureRequestId },
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

      // Download signed PDF (async, don't block the webhook response)
      downloadSignedDocuments(event.signatureRequestId)
        .then(async (pdfBuffer) => {
          // Store the signed PDF URL or buffer
          // For now, we log it. In production, upload to S3/Railway storage
          console.log(`[YOUSIGN WEBHOOK] Downloaded signed PDF (${pdfBuffer.length} bytes)`);
          
          await prisma.acceptance.update({
            where: { id: acceptance.id },
            data: {
              signedPdfUrl: `yousign://${event.signatureRequestId}`,
            },
          });
        })
        .catch((err) => {
          console.error(`[YOUSIGN WEBHOOK] Failed to download signed PDF:`, err);
        });

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