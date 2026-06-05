import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Form, Link } from "react-router";
import { useState } from "react";
import { requireClientAccess } from "~/lib/client-auth.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const url = new URL(request.url);
  const offerPosition = parseInt(url.searchParams.get("offre") || "1");
  const installOptionParam = url.searchParams.get("installOption") || "phone";

  // Params from informations / confirmer (when navigating back)
  const billingEmailParam = url.searchParams.get("billingEmail") ?? "";
  const billingDifferentParam = url.searchParams.get("billingDifferent") === "1";
  const billingAddress1Param = url.searchParams.get("billingAddress1") ?? "";
  const billingStreetParam = url.searchParams.get("billingStreet") ?? "";
  const billingPostcodeParam = url.searchParams.get("billingPostcode") ?? "";
  const billingCityParam = url.searchParams.get("billingCity") ?? "";
  const signatoryFirstNameParam = url.searchParams.get("signatoryFirstName") ?? "";
  const signatoryLastNameParam = url.searchParams.get("signatoryLastName") ?? "";
  const signatoryEmailParam = url.searchParams.get("signatoryEmail") ?? "";
  const orderRefParam = url.searchParams.get("orderRef") ?? "";

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

  return {
    client, offer: client.offers[0], offerPosition, accountNumber,
    installOptionParam,
    billingEmailParam, billingDifferentParam,
    billingAddress1Param, billingStreetParam, billingPostcodeParam, billingCityParam,
    signatoryFirstNameParam, signatoryLastNameParam, signatoryEmailParam, orderRefParam,
  };
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OffreOptions() {
  const {
    client, offer, offerPosition, accountNumber,
    installOptionParam,
    billingEmailParam, billingDifferentParam,
    billingAddress1Param, billingStreetParam, billingPostcodeParam, billingCityParam,
    signatoryFirstNameParam, signatoryLastNameParam, signatoryEmailParam, orderRefParam,
  } = useLoaderData<typeof loader>();

  const hasInstall = offer.installAvailable;

  if (!hasInstall) {
    return <meta httpEquiv="refresh" content={`0;url=/offre/${accountNumber}/informations?offre=${offerPosition}`} />;
  }

  const monthly = offer.monthly60 ?? offer.monthly48 ?? offer.monthly36 ?? offer.billing60 ?? offer.billing48 ?? offer.billing36;
  const term = (offer.monthly60 ?? offer.billing60) ? "60 mois" : (offer.monthly48 ?? offer.billing48) ? "48 mois" : "36 mois";
  const machineImg = offer.imageUrl;
  const [installOption, setInstallOption] = useState(installOptionParam);

  return (
    <div>
      {/* Header contrat */}
      <div style={{ borderBottom: "1px solid var(--pb-border)" }}>
        <div className="pb-info-header" style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "16px", padding: "16px 32px", background: "var(--pb-muted-bg)" }}>
          {machineImg && (
            <div style={{ width: "50px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src={machineImg} alt={offer.modelName || ""} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                onError={function(e) { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
          <span style={{ fontSize: "18px", fontWeight: 600, color: "var(--pb-text)", whiteSpace: "nowrap" }}>{offer.modelName}</span>
          <span className="pb-info-header-spacer" style={{ flex: 1 }} />
          <span style={{ fontSize: "18px", fontWeight: 600, color: "var(--pb-text)", textAlign: "right", whiteSpace: "nowrap" }}>
            {monthly ? formatCurrency(monthly) : "—"} € HT par mois sur {term}
          </span>
        </div>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "10px 32px", borderTop: "1px solid var(--pb-border)" }}>
         <p className="pb-discount-line" style={{ textAlign: "right" }}>{offer.discount || "50%"} de réduction la première année</p>
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
          {/* Forward billing params */}
          {billingEmailParam && <input type="hidden" name="billingEmail" value={billingEmailParam} />}
          {billingDifferentParam && <input type="hidden" name="billingDifferent" value="1" />}
          {billingAddress1Param && <input type="hidden" name="billingAddress1" value={billingAddress1Param} />}
          {billingStreetParam && <input type="hidden" name="billingStreet" value={billingStreetParam} />}
          {billingPostcodeParam && <input type="hidden" name="billingPostcode" value={billingPostcodeParam} />}
          {billingCityParam && <input type="hidden" name="billingCity" value={billingCityParam} />}
          {/* Forward signatory params */}
          {signatoryFirstNameParam && <input type="hidden" name="signatoryFirstName" value={signatoryFirstNameParam} />}
          {signatoryLastNameParam && <input type="hidden" name="signatoryLastName" value={signatoryLastNameParam} />}
          {signatoryEmailParam && <input type="hidden" name="signatoryEmail" value={signatoryEmailParam} />}
          {orderRefParam && <input type="hidden" name="orderRef" value={orderRefParam} />}

          <div style={{ maxWidth: "596px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Installation */}
            {hasInstall && (
              <div className="pb-options-card" style={{ border: "1px solid var(--pb-border)", borderRadius: "16px", padding: "24px", display: "flex", gap: "32px", alignItems: "flex-start" }}>
                <svg className="pb-options-icon" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <rect x="4" y="6" width="24" height="16" rx="2" stroke="#005cb1" strokeWidth="1.8" fill="none"/>
                  <path d="M10 26H22" stroke="#005cb1" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M12 15L15 18L21 12" stroke="#005cb1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="pb-options-content" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <p style={{ fontSize: "20px", fontWeight: 500, color: "var(--pb-text)", letterSpacing: "0.1px" }}>Installation (avec livraison offerte)</p>
                    <p style={{ fontSize: "14px", lineHeight: "20px", color: "var(--pb-text)" }}>
                      Besoin d'aide pour l'installation de votre équipement{"\u00a0"}? Pitney Bowes vous propose les options suivantes pour vous assister{"\u00a0"}:
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: installOption === "auto" ? "2px solid #171717" : "1px solid var(--pb-border)", borderRadius: "10px", cursor: "pointer", background: "white" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input type="radio" name="installOption" value="auto" checked={installOption === "auto"} onChange={() => setInstallOption("auto")} style={{ accentColor: "#171717" }} />
                        <span style={{ fontSize: "14px", color: "var(--pb-text)" }}>Auto-installation</span>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--pb-text)", minWidth: "max-content" }}>0 € HT</span>
                    </label>
                    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: installOption === "phone" ? "2px solid #171717" : "1px solid var(--pb-border)", borderRadius: "10px", cursor: "pointer", background: "white" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input type="radio" name="installOption" value="phone" checked={installOption === "phone"} onChange={() => setInstallOption("phone")} style={{ accentColor: "#171717" }} />
                        <span style={{ fontSize: "14px", color: "var(--pb-text)" }}>Installation assistée en ligne</span>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--pb-text)", minWidth: "max-content" }}>75 € HT*</span>
                    </label>
                    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: installOption === "onsite" ? "2px solid #171717" : "1px solid var(--pb-border)", borderRadius: "10px", cursor: "pointer", background: "white" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <input type="radio" name="installOption" value="onsite" checked={installOption === "onsite"} onChange={() => setInstallOption("onsite")} style={{ accentColor: "#171717" }} />
                        <span style={{ fontSize: "14px", color: "var(--pb-text)" }}>Installation sur site par un technicien</span>
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--pb-text)", minWidth: "max-content" }}>198 € HT*</span>
                    </label>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--pb-text-muted)" }}>*Facturation unique et séparée</p>
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