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

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return amount.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getMachineImage(model: string | null): string | null {
  if (!model) return null;
  var images: Record<string, string> = {
    "SendPro C Lite": "https://www.pitneybowes.com/content/dam/support/product-images/dm220-franking-machine.jpg",
    "SendPro C": "https://www.pitneybowes.com/content/dam/pitneybowes/germany/de/legacy/images/International/CE/Images/Produkte/Frankiermaschinen/DM300_G6SB0018_rgb_w350xh235pi--prodDetail_Large.jpg",
    "DM400": "https://www.pitneybowes.com/content/dam/pitneybowes/fr/fr/legacy/images/international/common/products/gms/digital-franking-machines/dm400c/dm400-box-left--proddetail_large.jpg",
    "DM50/55": "https://www.pitneybowes.com/content/dam/pitneybowes/Support/dm55_s1.jpg",
    "DM300": "https://www.pitneybowes.com/content/dam/pitneybowes/germany/de/legacy/images/International/CE/Images/Produkte/Frankiermaschinen/DM300_G6SB0018_rgb_w350xh235pi--prodDetail_Large.jpg",
    "DM220": "https://www.pitneybowes.com/content/dam/support/product-images/dm220-franking-machine.jpg",
  };
  for (var key of Object.keys(images)) {
    if (model.includes(key)) return images[key];
  }
  return null;
}

export default function OffreOptions() {
  const { client, offer, offerPosition, accountNumber } = useLoaderData<typeof loader>();

  const hasAutoInk = offer.autoInk;
  const hasInstall = offer.installAvailable;

  if (!hasAutoInk && !hasInstall) {
    return (
      <meta
        httpEquiv="refresh"
        content={`0;url=/offre/${accountNumber}/informations?offre=${offerPosition}`}
      />
    );
  }

  const billing = offer.billing60 ?? offer.billing36;
  const term = offer.billing60 ? "60 mois" : "36 mois";
  const discount = offer.recommended ? 50 : 25;
  const machineImg = getMachineImage(offer.modelName);

  return (
    <div>
      {/* Header contrat */}
      <div style={{ borderBottom: "1px solid var(--pb-border)" }}>
        <div style={{
          maxWidth: "1280px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          padding: "16px 32px",
          background: "var(--pb-muted-bg)",
        }}>
          {machineImg && (
            <div style={{ width: "50px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src={machineImg} alt={offer.modelName || ""} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                onError={function(e) { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
          <span style={{ fontSize: "18px", fontWeight: 600, color: "var(--pb-text)", whiteSpace: "nowrap" }}>
            {offer.modelName}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: "18px", fontWeight: 600, color: "var(--pb-text)", textAlign: "right", whiteSpace: "nowrap" }}>
            {formatCurrency(billing)} € HT par an sur {term}
          </span>
        </div>
        <div style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "10px 32px",
          borderTop: "1px solid var(--pb-border)",
        }}>
          <p style={{ fontSize: "14px", color: "var(--pb-text)", textAlign: "right" }}>
            {discount}% de réduction la première année
          </p>
        </div>
      </div>

      <div className="pb-main">
        {/* Stepper */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "40px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div className="pb-step" style={{ background: "#00b44a", color: "white", width: "28px", height: "28px", fontSize: "13px" }}>✓</div>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-active" style={{ width: "28px", height: "28px", fontSize: "13px" }}>2</div>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-inactive" style={{ width: "28px", height: "28px", fontSize: "13px" }}>3</div>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-inactive" style={{ width: "28px", height: "28px", fontSize: "13px" }}>4</div>
          </div>
          <p style={{ fontSize: "20px", fontWeight: 600, color: "var(--pb-text)", textAlign: "center" }}>
            Choisir les options
          </p>
        </div>

        <Form method="get" action={`/offre/${accountNumber}/informations`}>
          <input type="hidden" name="offre" value={offerPosition} />

          <div style={{ maxWidth: "596px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* AutoInk */}
            {hasAutoInk && (
              <div style={{
                border: "1px solid var(--pb-border)",
                borderRadius: "16px",
                padding: "24px",
                display: "flex",
                gap: "32px",
                alignItems: "flex-start",
              }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <path d="M14.0354 3.22396C14.4282 2.90366 15.0078 2.92688 15.3739 3.29297L26.0406 13.9596C26.431 14.3501 26.431 14.9832 26.0406 15.3737L14.5732 26.8398C13.116 28.297 10.8832 28.297 9.42603 26.8398L2.49243 19.9076L2.48592 19.8997C1.81416 19.2143 1.43774 18.293 1.43774 17.3333C1.43774 16.3736 1.81416 15.4523 2.48592 14.7669L2.49243 14.7591L13.9599 3.29297L14.0354 3.22396ZM3.43774 17.3333C3.43774 17.7696 3.60893 18.1885 3.91431 18.5L10.8401 25.4258C11.5162 26.1019 12.483 26.1019 13.1591 25.4258L23.9182 14.6654L14.6656 5.41277L3.913 16.1654L3.91431 16.1667C3.60893 16.4782 3.43774 16.8971 3.43774 17.3333Z" fill="#005CB1"/>
                  <path d="M5.95967 1.95964C6.35019 1.56912 6.9832 1.56912 7.37373 1.95964L14.0404 8.62631C14.4309 9.01683 14.4309 9.64985 14.0404 10.0404C13.6499 10.4309 13.0169 10.4309 12.6263 10.0404L5.95967 3.3737C5.56914 2.98318 5.56914 2.35017 5.95967 1.95964Z" fill="#005CB1"/>
                  <path d="M22.6667 16.3333C23.219 16.3333 23.6667 16.7811 23.6667 17.3333C23.6667 17.8856 23.219 18.3333 22.6667 18.3333H2.6667C2.11441 18.3333 1.6667 17.8856 1.6667 17.3333C1.6667 16.7811 2.11441 16.3333 2.6667 16.3333H22.6667Z" fill="#005CB1"/>
                  <path d="M28.3334 26.6667C28.3334 25.9763 27.9835 25.422 27.3581 24.6107C27.1506 24.3415 26.9063 24.037 26.6667 23.694C26.4271 24.037 26.1828 24.3415 25.9753 24.6107C25.3499 25.422 25 25.9763 25 26.6667C25 27.1087 25.1758 27.5325 25.4883 27.8451C25.8009 28.1576 26.2247 28.3333 26.6667 28.3333C27.1087 28.3333 27.5325 28.1576 27.8451 27.8451C28.1576 27.5325 28.3334 27.1087 28.3334 26.6667ZM30.3334 26.6667C30.3334 27.6391 29.9468 28.5715 29.2591 29.2591C28.5715 29.9468 27.6392 30.3333 26.6667 30.3333C25.6942 30.3333 24.7619 29.9468 24.0742 29.2591C23.3866 28.5715 23 27.6391 23 26.6667C23 25.2237 23.7841 24.1779 24.392 23.3893C25.0553 22.5287 25.5371 21.93 25.6836 21.1484L25.7318 20.9779C25.8769 20.5956 26.2457 20.3333 26.6667 20.3333C27.1477 20.3333 27.5609 20.6758 27.6498 21.1484C27.7963 21.93 28.2781 22.5287 28.9414 23.3893C29.5493 24.1779 30.3334 25.2237 30.3334 26.6667Z" fill="#005CB1"/>
                </svg>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <p style={{ fontSize: "20px", fontWeight: 500, color: "var(--pb-text)", letterSpacing: "0.1px", lineHeight: "24px" }}>
                      AutoInk <span style={{ color: "#a3a3a3" }}>(inclus)</span>
                    </p>
                    <p style={{ fontSize: "14px", lineHeight: "20px", color: "var(--pb-text)" }}>
                      {offer.autoInkDescription || "Recevez automatiquement votre encre, à vos conditions tarifaires habituelles, avant d'en manquer. Résiliez à tout moment sans frais."}
                    </p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--pb-text)" }}>
                      je souscris à l'option AutoInk
                    </p>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <label style={{
                        display: "flex", alignItems: "center", gap: "12px",
                        padding: "12px", border: "2px solid #171717", borderRadius: "10px",
                        cursor: "pointer", width: "100px", background: "white",
                      }}>
                        <input type="radio" name="autoInk" value="true" defaultChecked style={{ accentColor: "#171717" }} />
                        <span style={{ fontSize: "14px", color: "var(--pb-text)" }}>Oui</span>
                      </label>
                      <label style={{
                        display: "flex", alignItems: "center", gap: "12px",
                        padding: "12px", border: "1px solid var(--pb-border)", borderRadius: "10px",
                        cursor: "pointer", width: "100px", background: "white",
                      }}>
                        <input type="radio" name="autoInk" value="false" style={{ accentColor: "#171717" }} />
                        <span style={{ fontSize: "14px", color: "var(--pb-text)" }}>Non</span>
                      </label>
                    </div>
                  </div>

                  <a href="#" style={{ fontSize: "14px", color: "var(--pb-text)", textDecoration: "underline" }}
                    onClick={function(e) { e.preventDefault(); }}>
                    En savoir plus
                  </a>
                </div>
              </div>
            )}

            {/* Installation */}
            {hasInstall && (
              <div style={{
                border: "1px solid var(--pb-border)",
                borderRadius: "16px",
                padding: "24px",
                display: "flex",
                gap: "32px",
                alignItems: "flex-start",
              }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <rect x="4" y="6" width="24" height="16" rx="2" stroke="#005cb1" strokeWidth="1.8" fill="none"/>
                  <path d="M10 26H22" stroke="#005cb1" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M12 15L15 18L21 12" stroke="#005cb1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <p style={{ fontSize: "20px", fontWeight: 500, color: "var(--pb-text)", letterSpacing: "0.1px", lineHeight: "24px" }}>
                      Installation
                    </p>
                    <p style={{ fontSize: "14px", lineHeight: "20px", color: "var(--pb-text)" }}>
                      Besoin d'aide pour l'installation de votre équipement? Pitney Bowes vous propose les options suivantes pour vous assister:
                    </p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <label style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px", border: "2px solid #171717", borderRadius: "10px",
                      cursor: "pointer", background: "white",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input type="radio" name="installOption" value="auto" defaultChecked style={{ accentColor: "#171717" }} />
                        <span style={{ fontSize: "14px", color: "var(--pb-text)" }}>Auto-installation</span>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--pb-text)" }}>0 € HT</span>
                    </label>

                    <label style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px", border: "1px solid var(--pb-border)", borderRadius: "10px",
                      cursor: "pointer", background: "white",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input type="radio" name="installOption" value="phone" style={{ accentColor: "#171717" }} />
                        <span style={{ fontSize: "14px", color: "var(--pb-text)" }}>Installation assistée en ligne</span>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--pb-text)" }}>63 € HT</span>
                    </label>

                    <label style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "12px", border: "1px solid var(--pb-border)", borderRadius: "10px",
                      cursor: "pointer", background: "white",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input type="radio" name="installOption" value="onsite" style={{ accentColor: "#171717" }} />
                        <span style={{ fontSize: "14px", color: "var(--pb-text)" }}>Installation sur site par un technicien</span>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--pb-text)" }}>155 € HT</span>
                    </label>
                  </div>

                  <a href="#" style={{ fontSize: "14px", color: "var(--pb-text)", textDecoration: "underline" }}
                    onClick={function(e) { e.preventDefault(); }}>
                    En savoir plus
                  </a>
                </div>
              </div>
            )}

            {/* CTA */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "48px", paddingTop: "24px" }}>
              <Link to={`/offre/${accountNumber}`} style={{ color: "var(--pb-text)", display: "flex", alignItems: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <button
                type="submit"
                className="pb-btn pb-btn-primary"
                style={{ padding: "12px 32px", fontSize: "16px" }}
              >
                Étape suivante
              </button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}