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

      // TODO: Resend emails désactivés temporairement (domaine non vérifié, 403)
      console.log(`[YOUSIGN WEBHOOK] Email notification skipped (Resend disabled)`);

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