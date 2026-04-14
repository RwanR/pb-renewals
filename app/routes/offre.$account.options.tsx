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
    return new Response(null, { status: 302, headers: { Location: `/offre/${accountNumber}/merci` } });
  }

  return { client, offer: client.offers[0], offerPosition, accountNumber };
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMachineImage(model: string | null): string | null {
  if (!model) return null;
  const images: Record<string, string> = {
    "SendPro C Lite": "https://www.pitneybowes.com/content/dam/support/product-images/dm220-franking-machine.jpg",
    "SendPro C": "https://www.pitneybowes.com/content/dam/pitneybowes/germany/de/legacy/images/International/CE/Images/Produkte/Frankiermaschinen/DM300_G6SB0018_rgb_w350xh235pi--prodDetail_Large.jpg",
    "DM400": "https://www.pitneybowes.com/content/dam/pitneybowes/fr/fr/legacy/images/international/common/products/gms/digital-franking-machines/dm400c/dm400-box-left--proddetail_large.jpg",
    "DM50/55": "https://www.pitneybowes.com/content/dam/pitneybowes/Support/dm55_s1.jpg",
    "DM300": "https://www.pitneybowes.com/content/dam/pitneybowes/germany/de/legacy/images/International/CE/Images/Produkte/Frankiermaschinen/DM300_G6SB0018_rgb_w350xh235pi--prodDetail_Large.jpg",
    "DM220": "https://www.pitneybowes.com/content/dam/support/product-images/dm220-franking-machine.jpg",
  };
  for (const key of Object.keys(images)) {
    if (model.includes(key)) return images[key];
  }
  return null;
}

export default function OffreOptions() {
  const { client, offer, offerPosition, accountNumber } = useLoaderData<typeof loader>();

  const hasInstall = offer.installAvailable;

  if (!hasInstall) {
    return <meta httpEquiv="refresh" content={`0;url=/offre/${accountNumber}/informations?offre=${offerPosition}`} />;
  }

  const billing = offer.billing60 ?? offer.billing36;
  const monthly = billing ? billing / 12 : null;
  const term = offer.billing60 ? "60 mois" : "48 mois";
  const machineImg = getMachineImage(offer.modelName);

  return (
    <div>
      {/* Header contrat */}
      <div style={{ borderBottom: "1px solid var(--pb-border)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "16px", padding: "16px 32px", background: "var(--pb-muted-bg)" }}>
          {machineImg && (
            <div style={{ width: "50px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src={machineImg} alt={offer.modelName || ""} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                onError={function(e) { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
          <span style={{ fontSize: "18px", fontWeight: 600, color: "var(--pb-text)", whiteSpace: "nowrap" }}>{offer.modelName}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: "18px", fontWeight: 600, color: "var(--pb-text)", textAlign: "right", whiteSpace: "nowrap" }}>
            {monthly ? formatCurrency(monthly) : "—"} € HT par mois sur {term}
          </span>
        </div>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "10px 32px", borderTop: "1px solid var(--pb-border)" }}>
         <p style={{ fontSize: "14px", color: "var(--pb-text)", textAlign: "right" }}>{offer.discount || "50%"} de réduction la première année</p>
        </div>
      </div>

      <div className="pb-main">
        {/* Stepper */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "40px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Link to={`/offre/${accountNumber}`} className="pb-step" style={{ background: "#00b44a", color: "white", textDecoration: "none", cursor: "pointer" }}>✓</Link>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-active">2</div>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-inactive">3</div>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-inactive">4</div>
          </div>
          <p style={{ fontSize: "20px", fontWeight: 600, color: "var(--pb-text)", textAlign: "center" }}>Choisir les options</p>
        </div>

        <Form method="get" action={`/offre/${accountNumber}/informations`}>
          <input type="hidden" name="offre" value={offerPosition} />

          <div style={{ maxWidth: "596px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Installation */}
            {hasInstall && (
              <div style={{ border: "1px solid var(--pb-border)", borderRadius: "16px", padding: "24px", display: "flex", gap: "32px", alignItems: "flex-start" }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <rect x="4" y="6" width="24" height="16" rx="2" stroke="#005cb1" strokeWidth="1.8" fill="none"/>
                  <path d="M10 26H22" stroke="#005cb1" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M12 15L15 18L21 12" stroke="#005cb1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <p style={{ fontSize: "20px", fontWeight: 500, color: "var(--pb-text)", letterSpacing: "0.1px" }}>Installation</p>
                    <p style={{ fontSize: "14px", lineHeight: "20px", color: "var(--pb-text)" }}>
                      Besoin d'aide pour l'installation de votre équipement? Pitney Bowes vous propose les options suivantes pour vous assister:
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid var(--pb-border)", borderRadius: "10px", cursor: "pointer", background: "white" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input type="radio" name="installOption" value="auto" style={{ accentColor: "#171717" }} />
                        <span style={{ fontSize: "14px", color: "var(--pb-text)" }}>Auto-installation (avec livraison offerte)</span>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--pb-text)" }}>0 € HT</span>
                    </label>
                    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "2px solid #171717", borderRadius: "10px", cursor: "pointer", background: "white" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input type="radio" name="installOption" value="phone" defaultChecked style={{ accentColor: "#171717" }} />
                        <span style={{ fontSize: "14px", color: "var(--pb-text)" }}>Installation assistée en ligne</span>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--pb-text)" }}>75 € HT</span>
                    </label>
                    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid var(--pb-border)", borderRadius: "10px", cursor: "pointer", background: "white" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input type="radio" name="installOption" value="onsite" style={{ accentColor: "#171717" }} />
                        <span style={{ fontSize: "14px", color: "var(--pb-text)" }}>Installation sur site par un technicien</span>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--pb-text)" }}>198 € HT</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* CTA */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "48px", paddingTop: "24px" }}>
              <Link to={`/offre/${accountNumber}`} style={{ color: "var(--pb-text)", display: "flex", alignItems: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <button type="submit" className="pb-btn pb-btn-primary" style={{ padding: "12px 32px", fontSize: "16px" }}>Étape suivante</button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}