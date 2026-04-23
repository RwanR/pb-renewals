import type { ActionFunctionArgs } from "react-router";
import prisma from "~/db.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.json();
  const { parseWebhookEvent } = await import("~/lib/docusign.server");
  const event = parseWebhookEvent(body);

  console.log(`[DOCUSIGN WEBHOOK] Event: ${event.eventName}, Envelope: ${event.signatureRequestId}`);

  if (event.eventName === "signature_request.done") {
    const acceptance = await prisma.acceptance.findFirst({
      where: { adobeSignAgreementId: event.signatureRequestId },
      include: { client: { include: { offers: true } } },
    });

    if (!acceptance) {
      console.error(`[DOCUSIGN WEBHOOK] No acceptance found for ${event.signatureRequestId}`);
      return Response.json({ ok: false });
    }

    await prisma.acceptance.update({
      where: { id: acceptance.id },
      data: { adobeSignStatus: "signed", signedAt: new Date() },
    });

    // Download signed PDF
    let signedPdfBuffer: Buffer | null = null;
    try {
      const { downloadSignedDocuments } = await import("~/lib/docusign.server");
      signedPdfBuffer = await downloadSignedDocuments(event.signatureRequestId);
      await prisma.acceptance.update({
        where: { id: acceptance.id },
        data: { signedPdfUrl: `docusign://${event.signatureRequestId}` },
      });
      console.log(`[DOCUSIGN WEBHOOK] Downloaded signed PDF (${signedPdfBuffer.length} bytes)`);
    } catch (err) {
      console.error(`[DOCUSIGN WEBHOOK] Failed to download PDF:`, err);
    }

    // Email commercial (same logic as Yousign webhook)
    const client = acceptance.client;
    const offer = client.offers.find((o) => o.offerPosition === acceptance.offerPosition);
    const monthly = offer ? (offer.monthly60 ?? offer.monthly48 ?? offer.monthly36 ?? offer.billing60 ?? offer.billing48 ?? offer.billing36) : null;

    if (client.ownerEmail) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const term = (offer?.monthly60 ?? offer?.billing60) ? "60 mois" : (offer?.monthly48 ?? offer?.billing48) ? "48 mois" : "36 mois";
        const installLabels: Record<string, string> = { auto: "Auto-installation", phone: "Assistée en ligne", onsite: "Sur site" };

        await resend.emails.send({
          from: process.env.EMAIL_FROM || "PB Renewals <onboarding@resend.dev>",
          to: "erwann.bocher@gmail.com", // TODO: remettre client.ownerEmail
          subject: `[PB Renewals] Contrat signé – ${client.customerName} (${acceptance.clientAccountNumber})`,
          html: `
            <h2>Contrat signé</h2>
            <p><strong>Client :</strong> ${client.customerName} (${acceptance.clientAccountNumber})</p>
            <p><strong>Offre :</strong> ${offer?.modelName || "—"} — ${acceptance.offerPosition === 1 ? "Upgrade" : "Reconduction"}</p>
            <p><strong>Durée :</strong> ${term}</p>
            <p><strong>Loyer mensuel HT :</strong> ${monthly?.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
            ${acceptance.installOptionSelected ? `<p><strong>Installation :</strong> ${installLabels[acceptance.installOptionSelected] || acceptance.installOptionSelected}</p>` : ""}
            <p><strong>Signataire :</strong> ${acceptance.signatoryFirstName} ${acceptance.signatoryLastName}</p>
            ${signedPdfBuffer ? "<p>Le contrat signé est en pièce jointe.</p>" : ""}
            <p style="color:#666;font-size:13px">Email envoyé automatiquement par la plateforme PB Renewals.</p>
          `,
          attachments: signedPdfBuffer ? [{ filename: `contrat-signe-${acceptance.clientAccountNumber}.pdf`, content: signedPdfBuffer.toString("base64") }] : [],
        });
        console.log(`[DOCUSIGN WEBHOOK] Email sent to commercial`);
      } catch (err) {
        console.error(`[DOCUSIGN WEBHOOK] Email failed:`, err);
      }
    }

    // Shopify Draft Order (same logic)
    if (client.shopifyCustomerId) {
      try {
        const { createDraftOrder } = await import("~/lib/shopify-admin.server");
        const installPrices: Record<string, number> = { auto: 0, phone: 75, onsite: 198 };
        const billing = monthly ? monthly * 12 : 0;
        const draftOrderId = await createDraftOrder({
          accountNumber: acceptance.clientAccountNumber,
          shopifyCustomerId: client.shopifyCustomerId,
          modelName: offer?.modelName || "Unknown",
          term: (offer?.monthly60 ?? offer?.billing60) ? "60" : (offer?.monthly48 ?? offer?.billing48) ? "48" : "36",
          billingAnnualHT: billing,
          installOption: acceptance.installOptionSelected,
          installPrice: installPrices[acceptance.installOptionSelected || ""] || 0,
          signatoryName: `${acceptance.signatoryFirstName} ${acceptance.signatoryLastName}`,
        });
        if (draftOrderId) {
          await prisma.acceptance.update({
            where: { id: acceptance.id },
            data: { shopifyDraftOrderId: draftOrderId, shopifyCustomerId: client.shopifyCustomerId, shopifySyncedAt: new Date() },
          });
        }
      } catch (err) {
        console.error(`[DOCUSIGN WEBHOOK] Draft order failed:`, err);
      }
    }
  }

  return Response.json({ ok: true });
}