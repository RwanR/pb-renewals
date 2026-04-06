import type { LoaderFunctionArgs } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import { generateContractPDF } from "~/lib/contract-pdf.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const url = new URL(request.url);
  const offerPosition = parseInt(url.searchParams.get("offre") || "1");
  const autoInk = url.searchParams.get("autoInk") === "true";
  const installOption = url.searchParams.get("installOption") || "";

  const client = await prisma.client.findUnique({
    where: { accountNumber },
    include: { offers: { where: { offerPosition } } },
  });

  if (!client || client.offers.length === 0) {
    throw new Response("Offre non trouvée", { status: 404 });
  }

  const offer = client.offers[0];

  // Build a temporary acceptance object for PDF generation
  const tempAcceptance = {
    id: "preview",
    clientAccountNumber: accountNumber,
    offerPosition,
    termSelected: offer.billing60 ? "60" : "36",
    installOptionSelected: installOption || null,
    autoInkSelected: autoInk,
    signatoryFirstName: "(prénom)",
    signatoryLastName: "(nom)",
    signatoryEmail: client.bestEmail || client.installEmail || "",
    signatoryFunction: null,
    signatoryPhone: null,
    overrideEmail: null,
    overridePhone: null,
    overrideAddress: null,
    notes: null,
    ipAddress: null,
    userAgent: null,
    adobeSignAgreementId: null,
    adobeSignStatus: null,
    signedPdfUrl: null,
    shopifyCustomerId: null,
    shopifyDraftOrderId: null,
    acceptedAt: new Date(),
    signedAt: null,
    emailSentAt: null,
    shopifySyncedAt: null,
  };

  console.log(`[PDF] Generating recap PDF for ${accountNumber}`);

  const pdfBuffer = await generateContractPDF({
    client,
    offer,
    acceptance: tempAcceptance as any,
  });

  console.log(`[PDF] Recap PDF generated (${pdfBuffer.length} bytes)`);

  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recapitulatif-${accountNumber}.pdf"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
}