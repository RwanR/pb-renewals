import type { Route } from "./+types/pbis.start.contrat-signe";
import pbisDb from "~/db.pbis.server";
import { getSessionShipTo } from "~/lib/pbis-session.server";
import { downloadSignedDocuments } from "~/lib/yousign.server";

export async function loader({ request }: Route.LoaderArgs) {
  const shipTo = await getSessionShipTo(request);
  if (!shipTo) {
    throw new Response("Non authentifié", { status: 401 });
  }

  const acceptance = await pbisDb.pbisAcceptance.findUnique({
    where: { clientId: shipTo },
  });

  if (!acceptance?.yousignProcedureId) {
    throw new Response("Contrat non trouvé", { status: 404 });
  }

  try {
    const pdfBuffer = await downloadSignedDocuments(acceptance.yousignProcedureId);

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="contrat-pbis-start-signe-${shipTo}.pdf"`,
      },
    });
  } catch (err) {
    console.error(`[PBIS DOWNLOAD] Failed to download signed PDF:`, err);
    throw new Response(
      "Le contrat signé n'est pas encore disponible. Réessayez dans quelques instants.",
      { status: 503 }
    );
  }
}