import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  var accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  var client = await prisma.client.findUnique({
    where: { accountNumber },
    include: {
      offers: { orderBy: { offerPosition: "asc" } },
      acceptance: true,
    },
  });

  if (!client) {
    throw new Response("Client non trouvé", { status: 404 });
  }

  return { client };
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
    "DM300": "https://www.pitneybowes.com/content/dam/pitneybowes/germany/de/legacy/images/International/CE/Images/Produkte/Frankiermaschinen/DM300_G6SB0018_rgb_w350xh235pi--prodDetail_Large.jpg",
    "DM220": "https://www.pitneybowes.com/content/dam/support/product-images/dm220-franking-machine.jpg",
    "DM50/55": "https://www.pitneybowes.com/content/dam/pitneybowes/Support/dm55_s1.jpg",
    "DM400": "https://www.pitneybowes.com/content/dam/pitneybowes/fr/fr/legacy/images/international/common/products/gms/digital-franking-machines/dm400c/dm400-box-left--proddetail_large.jpg",
  };
  for (var key of Object.keys(images)) {
    if (model.includes(key)) return images[key];
  }
  return null;
}

export default function OffreClient() {
  var { client } = useLoaderData<typeof loader>();
  var offer1 = client.offers.find(function(o: any) { return o.offerPosition === 1; });
  var offer2 = client.offers.find(function(o: any) { return o.offerPosition === 2; });

  if (client.acceptance?.adobeSignStatus === "signed") {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <div className="pb-card" style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center", padding: "48px 32px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>✓</div>
          <h1 className="pb-heading" style={{ marginBottom: "12px" }}>Contrat déjà signé</h1>
          <p className="pb-text-sm" style={{ color: "var(--pb-text-muted)" }}>
            Vous avez déjà signé votre contrat de renouvellement. Un email de confirmation vous a été envoyé.
          </p>
          <Link to={"/offre/" + client.accountNumber + "/merci"} className="pb-btn pb-btn-primary" style={{ marginTop: "24px" }}>
            Voir la confirmation
          </Link>
        </div>
      </div>
    );
  }

  var currentImage = getMachineImage(client.currentModel);

  return (
    <div>
      {/* Banner */}
      <div className="pb-banner">
        Bénéficiez de <strong>25%</strong> à <strong>50%</strong> de réduction sur votre premier loyer annuel
      </div>

      <div className="pb-main">
        {/* Situation actuelle */}
        <div className="pb-card" style={{ display: "flex", alignItems: "center", gap: "24px", maxWidth: "596px", margin: "0 auto 32px", padding: "24px" }}>
          {currentImage ? (
            <div style={{ width: "262px", height: "120px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img
                src={currentImage}
                alt={client.currentModel || "Machine"}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                onError={function(e) { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          ) : null}
          <div style={{ flex: 1, width: "254px" }}>
            <p style={{ fontSize: "18px", fontWeight: 600, lineHeight: "27px", color: "var(--pb-text)", marginBottom: "16px" }}>Situation actuelle</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", lineHeight: "20px" }}>
                <div>
                  <p className="pb-situation-label">Machine</p>
                  <p className="pb-situation-label">Loyer annuel HT</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p className="pb-situation-value">{client.currentModel || "—"}</p>
                  <p className="pb-situation-value">{client.currentEquipmentPayment ? formatCurrency(client.currentEquipmentPayment) + " €" : "—"}</p>
                </div>
              </div>
              <div style={{ height: "1px", background: "#e5e5e5" }} />
              <div style={{ display: "flex", justifyContent: "space-between", lineHeight: "20px" }}>
                <div>
                  <p className="pb-situation-label">N° de contrat</p>
                  <p className="pb-situation-label">Fin de contrat</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p className="pb-situation-value">{client.leaseNumber || "—"}</p>
                  <p className="pb-situation-value">{client.leaseExpiryDate ? new Date(client.leaseExpiryDate).toLocaleDateString("fr-FR") : "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "48px 0", marginBottom: "0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div className="pb-step pb-step-active">1</div>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-inactive">2</div>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-inactive">3</div>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-inactive">4</div>
          </div>
          <p className="pb-heading" style={{ textAlign: "center" }}>
            Choisissez une des offres ci dessous
          </p>
        </div>

        {/* Offers */}
        <div className="pb-offers-grid" style={{ marginBottom: "48px" }}>
          {offer1 ? <OfferCard offer={offer1} isRecommended={true} /> : null}
          {offer2 ? <OfferCard offer={offer2} isRecommended={false} /> : null}
        </div>

        {/* Pas intéressé */}
        <div style={{ maxWidth: "493px", marginBottom: "48px" }}>
          <p className="pb-heading" style={{ marginBottom: "16px" }}>Pas intéressé?</p>
          <div style={{
            background: "var(--pb-muted-bg)",
            border: "1px solid var(--pb-border)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "16px",
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <circle cx="10" cy="10" r="8" stroke="#737373" strokeWidth="1.5" fill="none"/>
              <text x="10" y="14" textAnchor="middle" fontSize="11" fill="#737373">?</text>
            </svg>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "14px", fontWeight: 500, lineHeight: "20px", color: "var(--pb-foreground)" }}>Aucune offre ne vous convient ?</p>
              <p style={{ fontSize: "14px", fontWeight: 500, lineHeight: "20px", color: "var(--pb-text-muted)" }}>Pouvez-vous nous en exprimer les raison ?</p>
            </div>
            <Link
              to={"/offre/" + client.accountNumber + "/refus"}
              className="pb-btn-outline"
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--pb-foreground)",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid var(--pb-border-dark)",
                boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
                textDecoration: "none",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                minHeight: "32px",
                cursor: "pointer",
              }}
            >
              Continuer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function OfferCard({ offer, isRecommended }: { offer: any; isRecommended: boolean }) {
  var has60 = offer.billing60 !== null;
  var has36 = offer.billing36 !== null;
  var primaryBilling = has60 ? offer.billing60 : offer.billing36;
  var primaryTerm = has60 ? "60 mois" : "36 mois";
  var discount = isRecommended ? 0.5 : 0.25;
  var firstYearPrice = primaryBilling ? primaryBilling * (1 - discount) : null;
  var optionsUrl = "/offre/" + offer.clientAccountNumber + "/options?offre=" + offer.offerPosition;

  var cardStyle: React.CSSProperties = isRecommended
    ? { border: "2px solid #404040", borderRadius: "16px", padding: "32px", background: "white", display: "flex", flexDirection: "column", gap: "20px" }
    : { border: "1px solid #e5e5e5", borderRadius: "16px", padding: "32px", background: "white", display: "flex", flexDirection: "column", gap: "20px" };

  return (
    <div style={cardStyle}>
      {/* Badge */}
      {isRecommended ? (
        <span className="pb-badge pb-badge-recommended">Recommandé pour vous</span>
      ) : (
        <span className="pb-badge pb-badge-current">Machine actuelle</span>
      )}

      {/* Name */}
      <p className="pb-heading">{offer.modelName || "—"}</p>

      {/* Headline */}
      {offer.headline ? (
        <p className="pb-text-sm">{offer.headline}</p>
      ) : null}

      {/* Price + duration */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="pb-price">{formatCurrency(primaryBilling)}</span>
          <span className="pb-price-unit">€ HT / an</span>
        </div>
        <select className="pb-select" defaultValue={has60 ? "60" : "36"}>
          {has60 ? <option value="60">60 mois</option> : null}
          {has36 ? <option value="36">36 mois</option> : null}
        </select>
      </div>

      {/* Machine image */}
      {offer.imageUrl ? (
        <div style={{ position: "relative", height: "140px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img
            src={offer.imageUrl}
            alt={offer.modelName}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            onError={function(e) { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          {offer.brochureUrl ? (
            <a href={offer.brochureUrl} target="_blank" rel="noopener" style={{
              position: "absolute", bottom: 0, right: 0,
              padding: "3px 8px",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid #d4d4d4",
              borderRadius: "8px",
              fontSize: "12px", fontWeight: 500,
              color: "var(--pb-foreground)",
              textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: "6px",
              boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
              minHeight: "24px",
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v6M3 6l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              PDF
            </a>
          ) : null}
        </div>
      ) : null}

      {/* Value props (recommended only) */}
      {isRecommended && (offer.valueProp1 || offer.valueProp2 || offer.valueProp3) ? (
        <div className="pb-props">
          {offer.valueProp1 ? (
            <div className="pb-prop">
              <svg className="pb-check-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#005cb1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>{offer.valueProp1}</span>
            </div>
          ) : null}
          {offer.valueProp2 ? (
            <div className="pb-prop">
              <svg className="pb-check-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#005cb1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>{offer.valueProp2}</span>
            </div>
          ) : null}
          {offer.valueProp3 ? (
            <div className="pb-prop">
              <svg className="pb-check-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#005cb1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>{offer.valueProp3}</span>
            </div>
          ) : null}
          {offer.starterKit && offer.starterKitDescription ? (
            <div className="pb-prop">
              <svg className="pb-check-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#005cb1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span>{offer.starterKitDescription}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Promo block */}
      <div className={isRecommended ? "pb-promo pb-promo-recommended" : "pb-promo pb-promo-default"}>
        <p className="pb-promo-title">
          {"Contrat de " + primaryTerm + ". Paiement annuel."}
        </p>
        <p className="pb-promo-sub">
          {firstYearPrice !== null
            ? formatCurrency(firstYearPrice) + " € HT la première année, " + formatCurrency(primaryBilling) + " € HT les suivantes"
            : (isRecommended ? "-50%" : "-25%") + " sur le premier loyer annuel"
          }
        </p>
      </div>

      {/* CTA */}
      <Link
        to={optionsUrl}
        className={isRecommended ? "pb-btn pb-btn-full pb-btn-primary" : "pb-btn pb-btn-full pb-btn-secondary"}
      >
        {isRecommended ? "Choisir cette offre" : "Reconduire cette offre"}
      </Link>
    </div>
  );
}