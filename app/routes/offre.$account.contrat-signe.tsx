import type { LoaderFunctionArgs } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import { downloadSignedDocuments } from "~/lib/yousign.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const client = await prisma.client.findUnique({
    where: { accountNumber },
    include: { acceptance: true },
  });

  if (!client?.acceptance?.adobeSignAgreementId) {
    throw new Response("Contrat non trouvé", { status: 404 });
  }

  try {
    const pdfBuffer = await downloadSignedDocuments(
      client.acceptance.adobeSignAgreementId
    );

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="contrat-signe-${accountNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error(`[DOWNLOAD] Failed to download signed PDF:`, err);
    throw new Response(
      "Le contrat signé n'est pas encore disponible. Réessayez dans quelques instants.",
      { status: 503 }
    );
  }
}