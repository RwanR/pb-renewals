import { useEffect } from "react";
import type { Route } from "./+types/pbis.start.signer";
import { redirect, useLoaderData, data } from "react-router";
import pbisDb from "~/db.pbis.server";
import { getSessionShipTo } from "~/lib/pbis-session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const shipTo = await getSessionShipTo(request);
  if (!shipTo) {
    return redirect("/pbis");
  }

  const acceptance = await pbisDb.pbisAcceptance.findUnique({
    where: { clientId: shipTo },
  });

  if (!acceptance?.yousignProcedureId) {
    return redirect("/pbis/start/recapitulatif");
  }

  if (acceptance.yousignStatus === "signed") {
    return redirect("/pbis/start/confirmation");
  }

  // Récupère le signerUrl : DB d'abord, puis fallback API Yousign avec retry
  let signerUrl: string | null = null;

  if (acceptance.signedPdfUrl && acceptance.signedPdfUrl.startsWith("https://")) {
    signerUrl = acceptance.signedPdfUrl;
    console.log(`[PBIS SIGN] Using signer URL from DB for ${shipTo}`);
  }

  if (!signerUrl) {
    console.log(`[PBIS SIGN] Fetching from Yousign API for ${shipTo}`);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        const { getSignatureRequestStatus } = await import("~/lib/yousign.server");
        const sr = await getSignatureRequestStatus(acceptance.yousignProcedureId);
        signerUrl = sr.signers?.[0]?.signature_link || null;

        if (!signerUrl) {
          const signerId = sr.signers?.[0]?.id;
          if (signerId) {
            const YOUSIGN_API_URL = process.env.YOUSIGN_API_URL || "https://api-sandbox.yousign.app/v3";
            const YOUSIGN_API_KEY = process.env.YOUSIGN_API_KEY || "";
            const signerRes = await fetch(
              `${YOUSIGN_API_URL}/signature_requests/${acceptance.yousignProcedureId}/signers/${signerId}`,
              { headers: { Authorization: `Bearer ${YOUSIGN_API_KEY}` } }
            );
            const signerData = await signerRes.json();
            signerUrl = signerData.signature_link;
          }
        }
        if (signerUrl) break;
      } catch (err) {
        console.error(`[PBIS SIGN] Attempt ${attempt + 1} failed:`, err);
      }
    }
  }

  if (!signerUrl) {
    throw new Response("Lien de signature indisponible. Veuillez réessayer.", { status: 500 });
  }

    return data(
    { signerUrl },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } }
    );
}

export default function PbisStartSigner() {
  const { signerUrl } = useLoaderData<typeof loader>();

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      console.log("[PBIS SIGN IFRAME] message:", event.origin, event.data);

      if (!event.origin.includes("yousign")) return;

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (
          data.type === "signature_done" ||
          data.type === "success" ||
          data.event === "success" ||
          data.event_name === "signature_request.done"
        ) {
          window.location.href = `/pbis/start/confirmation`;
        }
      } catch (e) {
        if (typeof event.data === "string" && event.data.includes("done")) {
          window.location.href = `/pbis/start/confirmation`;
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: "white" }}>
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid #E5E7EB",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        background: "white",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: "13px", color: "#6B7280", minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Signature du contrat <strong>PBIS Start</strong>
        </div>
        <div style={{ fontSize: "12px", color: "#9CA3AF", textAlign: "right", flexShrink: 0 }}>
          Signature électronique sécurisée
        </div>
      </div>

      <iframe
        referrerPolicy="strict-origin-when-cross-origin"
        src={`${signerUrl}${signerUrl.includes("?") ? "&" : "?"}nocache=${Date.now()}`}
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          minHeight: 0,
        }}
        allow="camera"
        title="Signature du contrat PBIS Start"
      />
    </div>
  );
}