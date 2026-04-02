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

  // Fetch the signature request to get the signer URL
  const { getSignatureRequestStatus } = await import("~/lib/yousign.server");
  const sr = await getSignatureRequestStatus(client.acceptance.adobeSignAgreementId);
  const signerUrl = sr.signers?.[0]?.signature_link;

  if (!signerUrl) {
    throw new Response("Lien de signature indisponible", { status: 500 });
  }

  return { client, signerUrl, accountNumber };
}

export default function OffreSigner() {
  const { client, signerUrl, accountNumber } = useLoaderData<typeof loader>();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header compact */}
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

      {/* Yousign iframe */}
      <iframe
        src={signerUrl}
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          minHeight: "calc(100vh - 50px)",
        }}
        allow="camera"
        title="Signature du contrat"
      />

      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener("message", function(event) {
              if (event.origin.includes("yousign")) {
                try {
                  var data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
                  if (data.type === "signature_done" || data.event === "success") {
                    window.location.href = "/offre/${accountNumber}/merci";
                  }
                } catch(e) {}
              }
            });
          `,
        }}
      />
    </div>
  );
}