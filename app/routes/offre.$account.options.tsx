import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Form, Link } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const url = new URL(request.url);
  const offerPosition = parseInt(url.searchParams.get("offre") || "1");

  const client = await prisma.client.findUnique({
    where: { accountNumber },
    include: {
      offers: { where: { offerPosition } },
      acceptance: true,
    },
  });

  if (!client || client.offers.length === 0) {
    throw new Response("Offre non trouvée", { status: 404 });
  }

  if (client.acceptance?.adobeSignStatus === "signed") {
    return new Response(null, {
      status: 302,
      headers: { Location: `/offre/${accountNumber}/merci` },
    });
  }

  return { client, offer: client.offers[0], offerPosition, accountNumber };
}

export default function OffreOptions() {
  const { client, offer, offerPosition, accountNumber } = useLoaderData<typeof loader>();

  const hasAutoInk = offer.autoInk;
  const hasInstall = offer.installAvailable;

  // If no options available, skip directly to confirmer
  if (!hasAutoInk && !hasInstall) {
    return (
      <meta
        httpEquiv="refresh"
        content={`0;url=/offre/${accountNumber}/confirmer?offre=${offerPosition}`}
      />
    );
  }

  return (
    <div className="pb-space-lg">
      <Link to={`/offre/${accountNumber}`} className="pb-link" style={{ fontSize: "14px" }}>
        ← Retour aux offres
      </Link>

      <h1 className="pb-title">Choisir les options</h1>

      <Form method="get" action={`/offre/${accountNumber}/confirmer`}>
        <input type="hidden" name="offre" value={offerPosition} />

        <div className="pb-space">
          {/* AutoInk */}
          {hasAutoInk && (
            <div className="pb-card pb-space-sm">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                <span style={{
                  width: "40px", height: "40px", borderRadius: "8px",
                  background: "#EEF2FF", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "20px",
                }}>🖨️</span>
                <div>
                  <div className="pb-subtitle" style={{ fontSize: "16px", marginBottom: "0" }}>
                    AutoInk <span style={{ color: "#059669", fontSize: "13px", fontWeight: 400 }}>(inclus)</span>
                  </div>
                </div>
              </div>

              <p className="pb-text-sm" style={{ color: "var(--pb-text-light)", marginBottom: "12px" }}>
                {offer.autoInkDescription || "Recevez automatiquement votre encre, à vos conditions tarifaires habituelles, avant d'en manquer. Résiliez à tout moment sans frais."}
              </p>

              <div style={{ fontWeight: 500, fontSize: "14px", marginBottom: "8px" }}>
                Je souscris à l'option AutoInk
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <label style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 20px", border: "2px solid #1D2C6B", borderRadius: "8px",
                  cursor: "pointer", fontSize: "14px", fontWeight: 500,
                }}>
                  <input type="radio" name="autoInk" value="true" defaultChecked />
                  Oui
                </label>
                <label style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 20px", border: "1px solid #D1D5DB", borderRadius: "8px",
                  cursor: "pointer", fontSize: "14px",
                }}>
                  <input type="radio" name="autoInk" value="false" />
                  Non
                </label>
              </div>
            </div>
          )}

          {/* Installation */}
          {hasInstall && (
            <div className="pb-card pb-space-sm">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                <span style={{
                  width: "40px", height: "40px", borderRadius: "8px",
                  background: "#EEF2FF", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "20px",
                }}>✅</span>
                <div>
                  <div className="pb-subtitle" style={{ fontSize: "16px", marginBottom: "0" }}>
                    Installation
                  </div>
                </div>
              </div>

              <p className="pb-text-sm" style={{ color: "var(--pb-text-light)", marginBottom: "12px" }}>
                Besoin d'aide pour l'installation de votre équipement ? Pitney Bowes vous propose les options suivantes pour vous assister :
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 16px", border: "2px solid #1D2C6B", borderRadius: "8px",
                  cursor: "pointer",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="radio" name="installOption" value="auto" defaultChecked />
                    <span style={{ fontSize: "14px" }}>Auto-installation</span>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>0 € HT</span>
                </label>

                <label style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 16px", border: "1px solid #D1D5DB", borderRadius: "8px",
                  cursor: "pointer",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="radio" name="installOption" value="phone" />
                    <span style={{ fontSize: "14px" }}>Installation assistée en ligne</span>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>63 € HT</span>
                </label>

                <label style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 16px", border: "1px solid #D1D5DB", borderRadius: "8px",
                  cursor: "pointer",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="radio" name="installOption" value="onsite" />
                    <span style={{ fontSize: "14px" }}>Installation sur site par un technicien</span>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>155 € HT</span>
                </label>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <Link to={`/offre/${accountNumber}`} className="pb-btn pb-btn-outline" style={{ padding: "12px 24px" }}>
              ←
            </Link>
            <button
              type="submit"
              className="pb-btn pb-btn-primary"
              style={{ padding: "12px 28px", fontSize: "16px", flex: 1 }}
            >
              Étape suivante
            </button>
          </div>
        </div>
      </Form>
    </div>
  );
}