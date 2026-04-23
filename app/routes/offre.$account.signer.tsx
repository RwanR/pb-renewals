import { useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const client = await prisma.client.findUnique({
    where: { accountNumber },
    include: { acceptance: true },
  });

  if (!client?.acceptance?.adobeSignAgreementId) {
    return new Response(null, {
      status: 302,
      headers: { Location: `/offre/${accountNumber}` },
    });
  }

  if (client.acceptance.adobeSignStatus === "signed") {
    return new Response(null, {
      status: 302,
      headers: { Location: `/offre/${accountNumber}/merci` },
    });
  }

// NOUVEAU
  const esignProvider = process.env.ESIGN_PROVIDER || "yousign";
  let signerUrl: string | null = null;

  if (esignProvider === "docusign") {
    // DocuSign: always generate fresh URL via createRecipientView
    console.log(`[SIGN] Fetching fresh DocuSign signer URL for ${accountNumber}`);
    const { getSignerUrl } = await import("~/lib/docusign.server");
    signerUrl = await getSignerUrl(
      client.acceptance.adobeSignAgreementId,
      accountNumber,
      client.acceptance.signatoryEmail,
      `${client.acceptance.signatoryFirstName} ${client.acceptance.signatoryLastName}`,
    );
  } else {
    // Yousign: try DB first, then API fallback with retry
    if (client.acceptance.signedPdfUrl && client.acceptance.signedPdfUrl.startsWith("https://")) {
      signerUrl = client.acceptance.signedPdfUrl;
      console.log(`[SIGN] Using Yousign signer URL from DB for ${accountNumber}`);
    }

    if (!signerUrl) {
      console.log(`[SIGN] Fetching from Yousign API for ${accountNumber}`);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) await new Promise(r => setTimeout(r, 2000));
          const { getSignatureRequestStatus } = await import("~/lib/yousign.server");
          const sr = await getSignatureRequestStatus(client.acceptance.adobeSignAgreementId);
          signerUrl = sr.signers?.[0]?.signature_link || null;

          if (!signerUrl) {
            const signerId = sr.signers?.[0]?.id;
            if (signerId) {
              const YOUSIGN_API_URL = process.env.YOUSIGN_API_URL || "https://api-sandbox.yousign.app/v3";
              const YOUSIGN_API_KEY = process.env.YOUSIGN_API_KEY || "";
              const signerRes = await fetch(
                `${YOUSIGN_API_URL}/signature_requests/${client.acceptance.adobeSignAgreementId}/signers/${signerId}`,
                { headers: { Authorization: `Bearer ${YOUSIGN_API_KEY}` } }
              );
              const signerData = await signerRes.json();
              signerUrl = signerData.signature_link;
            }
          }
          if (signerUrl) break;
        } catch (err) {
          console.error(`[SIGN] Attempt ${attempt + 1} failed:`, err);
        }
      }
    }
  }

  if (!signerUrl) {
    throw new Response("Lien de signature indisponible. Veuillez réessayer.", { status: 500 });
  }

  return Response.json(
    { client, signerUrl, accountNumber },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } }
  );
}

export default function OffreSigner() {
  const { client, signerUrl, accountNumber } = useLoaderData<any>();

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      console.log("[ESIGN IFRAME] message:", event.origin, event.data);

      // Yousign events
      if (event.origin.includes("yousign")) {
        try {
          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (
            data.type === "signature_done" ||
            data.type === "success" ||
            data.event === "success" ||
            data.event_name === "signature_request.done"
          ) {
            window.location.href = `/offre/${accountNumber}/merci`;
          }
        } catch (e) {
          if (typeof event.data === "string" && event.data.includes("done")) {
            window.location.href = `/offre/${accountNumber}/merci`;
          }
        }
      }

      // DocuSign events
      if (event.origin.includes("docusign")) {
        try {
          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (data.event === "signing_complete" || data.type === "signing_complete") {
            window.location.href = `/offre/${accountNumber}/merci`;
          }
        } catch (e) {
          if (typeof event.data === "string" && event.data.includes("signing_complete")) {
            window.location.href = `/offre/${accountNumber}/merci`;
          }
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [accountNumber]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{
        padding: "12px 24px",
        borderBottom: "1px solid #E5E7EB",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "white",
      }}>
        <div style={{ fontSize: "14px", color: "#6B7280" }}>
          Signature du contrat — <strong>{client.customerName}</strong>
        </div>
        <div style={{ fontSize: "13px", color: "#9CA3AF" }}>
          Signature électronique sécurisée
        </div>
      </div>

      <div style={{
        padding: "10px 24px",
        background: "#e8f4fd",
        borderBottom: "1px solid #cce5f6",
        textAlign: "center",
        fontSize: "14px",
        color: "#404040",
      }}>
        Cliquez sur le bouton <strong>SIGNER</strong> en bas à droite du document pour apposer votre signature
      </div>

      <iframe
        src={`${signerUrl}${(signerUrl as string).includes('?') ? '&' : '?'}nocache=${Date.now()}`}
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          minHeight: "calc(100vh - 100px)",
        }}
        allow="camera"
        title="Signature du contrat"
      />
    </div>
  );
}