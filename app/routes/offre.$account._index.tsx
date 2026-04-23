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

  if (client.archived) {
    throw new Response("Cette offre n'est plus disponible.", { status: 410 });
  }

  return { client };
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    var signedOffer = client.offers.find(function(o: any) { return o.offerPosition === client.acceptance?.offerPosition; });
// NOUVEAU
    var signedMonthly = signedOffer?.monthly60 ?? signedOffer?.monthly48 ?? signedOffer?.monthly36 ?? signedOffer?.billing60 ?? signedOffer?.billing48 ?? signedOffer?.billing36;
    var signedTerm = (signedOffer?.billing60 ?? signedOffer?.monthly60) ? "60 mois" : (signedOffer?.billing48 ?? signedOffer?.monthly48) ? "48 mois" : "36 mois";

    return (
      <div style={{ padding: "48px 24px" }}>
        <div className="pb-card" style={{ maxWidth: "520px", margin: "0 auto", padding: "48px 32px" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#2e7d32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h1 className="pb-heading" style={{ marginBottom: "8px" }}>Contrat signé</h1>
            <p className="pb-text-sm" style={{ color: "var(--pb-text-muted)" }}>
              Votre contrat de renouvellement a été signé avec succès.
            </p>
          </div>

          <div style={{ background: "var(--pb-muted-bg)", borderRadius: "8px", padding: "20px", marginBottom: "24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--pb-text-muted)" }}>Offre</span>
                <span style={{ fontWeight: 500 }}>{signedOffer?.modelName || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--pb-text-muted)" }}>Durée</span>
                <span style={{ fontWeight: 500 }}>{signedTerm}</span>
              </div>
              {signedMonthly ? (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--pb-text-muted)" }}>Loyer mensuel HT</span>
                  <span style={{ fontWeight: 500 }}>{formatCurrency(signedMonthly)} €</span>
                </div>
              ) : null}
              {client.acceptance.installOptionSelected ? (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--pb-text-muted)" }}>Installation</span>
                  <span style={{ fontWeight: 500 }}>
                    {client.acceptance.installOptionSelected === "auto" ? "Auto-installation" :
                     client.acceptance.installOptionSelected === "phone" ? "Assistée en ligne" : "Sur site"}
                  </span>
                </div>
              ) : null}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--pb-text-muted)" }}>Signataire</span>
                <span style={{ fontWeight: 500 }}>{client.acceptance.signatoryFirstName} {client.acceptance.signatoryLastName}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Link to={"/offre/" + client.accountNumber + "/merci"} className="pb-btn pb-btn-full pb-btn-primary">
              Voir la confirmation
            </Link>
            {client.acceptance.adobeSignAgreementId ? (
              <Link to={"/offre/" + client.accountNumber + "/contrat-signe"} className="pb-btn pb-btn-full pb-btn-secondary" reloadDocument>
                Télécharger le contrat signé
              </Link>
            ) : null}
          </div>

          <p style={{ fontSize: "12px", color: "var(--pb-text-muted)", textAlign: "center", marginTop: "24px" }}>
            {"Des questions ? Contactez-nous à "}
            <a href="mailto:fr-elease@pb.com" style={{ color: "var(--pb-cta)", textDecoration: "underline" }}>fr-elease@pb.com</a>
          </p>
        </div>
      </div>
    );
  }

  var currentImage = getMachineImage(client.currentModel);
  var currentMonthly = client.currentEquipmentPayment ? client.currentEquipmentPayment / 12 : null;

  return (
    <div>
      {/* Banner */}
      <div className="pb-banner">
        <p>Bénéficiez de <span style={{ fontWeight: 600 }}>{offer1?.discount || "50%"}</span> de réduction sur les 12 premiers mois</p>
      </div>

      <div className="pb-main">
        {/* Situation actuelle */}
        <div className="pb-card pb-situation-card" style={{ display: "flex", alignItems: "center", gap: "24px", maxWidth: "596px", margin: "0 auto 32px", padding: "24px" }}>
          {currentImage ? (
            <div className="pb-situation-img" style={{ width: "262px", height: "120px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src={currentImage} alt={client.currentModel || "Machine"} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                onError={function(e) { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          ) : null}
          <div className="pb-situation-info" style={{ flex: 1, width: "254px" }}>
            <p style={{ fontSize: "18px", fontWeight: 600, lineHeight: "27px", color: "var(--pb-text)", marginBottom: "16px" }}>Situation actuelle</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", lineHeight: "20px" }}>
                <div>
                  <p className="pb-situation-label">Machine</p>
                  <p className="pb-situation-label">Loyer mensuel HT</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p className="pb-situation-value">{client.currentModel || "—"}</p>
                  <p className="pb-situation-value">{currentMonthly ? formatCurrency(currentMonthly) + " €" : "—"}</p>
                </div>
              </div>
              <div style={{ height: "1px", background: "#e5e5e5" }} />
              <div style={{ display: "flex", justifyContent: "space-between", lineHeight: "20px" }}>
                <div>
                  <p className="pb-situation-label">N° de contrat</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p className="pb-situation-value">{client.leaseNumber || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "48px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div className="pb-step pb-step-active">1</div>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-inactive">2</div>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-inactive">3</div>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-inactive">4</div>
          </div>
          <p className="pb-heading" style={{ textAlign: "center" }}>{offer2 ? "Choisissez une des offres ci-dessous" : "Votre offre de renouvellement"}</p>
        </div>

        {/* Offers */}
        <div className="pb-offers-grid" style={offer2 ? { marginBottom: "32px" } : { marginBottom: "32px", gridTemplateColumns: "1fr", maxWidth: "493px", margin: "0 auto 32px" }}>
          {offer1 ? <OfferCard offer={offer1} isRecommended={true} /> : null}
          {offer2 ? <OfferCard offer={offer2} isRecommended={false} /> : null}
        </div>

        {/* Footnote */}
      <div style={offer2 ? {} : { maxWidth: "493px", margin: "0 auto" }}>
        <p style={{ fontSize: "12px", color: "var(--pb-text-muted)", marginBottom: "32px" }}>
          {"*Correspond à -" + (offer1?.discount || "50%") + " de remise sur le 1er loyer annuel de " + formatCurrency(((offer1?.monthly60 ?? offer1?.monthly48 ?? offer1?.monthly36 ?? offer1?.billing60 ?? offer1?.billing48 ?? offer1?.billing36) ?? 0) * 12) + " € HT, hors majoration annuelle de l'article 9 des conditions générales."}
        </p>

        {/* Pas intéressé */}
        <div style={{ maxWidth: "493px", marginBottom: "32px" }}>
          <p className="pb-heading" style={{ marginBottom: "16px" }}>Vous souhaitez gérer vos envois différemment ?</p>
          <div style={{ background: "var(--pb-muted-bg)", border: "1px solid var(--pb-border)", borderRadius: "8px", display: "flex", alignItems: "center", gap: "16px", padding: "16px" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="10" cy="10" r="8" stroke="#737373" strokeWidth="1.5" fill="none"/>
              <text x="10" y="14" textAnchor="middle" fontSize="11" fill="#737373">?</text>
            </svg>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "14px", fontWeight: 500, lineHeight: "20px", color: "var(--pb-foreground)" }}>Aucune offre ne vous convient ?</p>
              <p style={{ fontSize: "14px", fontWeight: 500, lineHeight: "20px", color: "var(--pb-text-muted)" }}>Faites-nous part de vos attentes et objectifs.</p>
            </div>
            <Link to={"/offre/" + client.accountNumber + "/refus"} style={{
              padding: "6px 12px", borderRadius: "8px", fontSize: "14px", fontWeight: 500,
              color: "var(--pb-foreground)", background: "rgba(255,255,255,0.1)",
              border: "1px solid var(--pb-border-dark)", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
              textDecoration: "none", flexShrink: 0, display: "inline-flex", alignItems: "center", minHeight: "32px",
            }}>
              Continuer
            </Link>
          </div>
        </div>

        {/* Contact */}
        <p style={{ fontSize: "12px", color: "var(--pb-text-muted)", marginBottom: "48px" }}>
          {"Des questions ? Contactez-nous par e-mail à "}
          <a href="mailto:fr-elease@pb.com" style={{ color: "var(--pb-cta)", textDecoration: "underline" }}>fr-elease@pb.com</a>
        </p>
        </div>
      </div>
    </div>
  );
}

function OfferCard({ offer, isRecommended }: { offer: any; isRecommended: boolean }) {
  // Les colonnes BILLING contiennent des montants MENSUELS dans le nouveau fichier
  var monthly = offer.monthly60 ?? offer.monthly48 ?? offer.monthly36 ?? offer.billing60 ?? offer.billing48 ?? offer.billing36;
  var discountPct = offer.discount ? parseFloat(offer.discount) / 100 : 0;
  var discountedMonthly = monthly && discountPct ? monthly * (1 - discountPct) : null;
  var term = (offer.billing60 ?? offer.monthly60) ? "60 mois" : (offer.billing48 ?? offer.monthly48) ? "48 mois" : "36 mois";
  var optionsUrl = "/offre/" + offer.clientAccountNumber + "/options?offre=" + offer.offerPosition;

  var cardStyle: React.CSSProperties = isRecommended
    ? { border: "2px solid #404040", borderRadius: "16px", padding: "32px", background: "white", display: "flex", flexDirection: "column", gap: "20px" }
    : { border: "1px solid #e5e5e5", borderRadius: "16px", padding: "32px", background: "white", display: "flex", flexDirection: "column", gap: "20px" };

  return (
    <div style={cardStyle}>
      {isRecommended ? (
        <span className="pb-badge pb-badge-recommended">Recommandé pour vous</span>
      ) : (
        <span className="pb-badge pb-badge-current">Machine actuelle</span>
      )}

      <p className="pb-heading">{offer.modelName || "—"}</p>

      {/* Headline — override */}
      {offer.headline ? (
        <p className="pb-text-sm">{offer.headline.replace(/\u00a0/g, " ")}</p>
      ) : null}

      {/* Price — monthly with strikethrough */}
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
        {monthly ? (
          <span style={{ fontSize: "18px", color: "var(--pb-text-muted)", textDecoration: "line-through" }}>
            {formatCurrency(monthly)} €HT
          </span>
        ) : null}
        <span className="pb-price">{discountedMonthly ? formatCurrency(discountedMonthly) : "—"}</span>
        <span className="pb-price-unit">€ HT par mois*</span>
      </div>

      {/* Term — static badge, no select */}
      <span style={{
        display: "inline-flex", alignItems: "center", padding: "5.5px 16px",
        border: "1px solid #171717", borderRadius: "8px", fontSize: "14px", fontWeight: 500,
        color: "var(--pb-foreground)", background: "white", width: "fit-content",
        boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
      }}>
        {term}
      </span>

      {/* Machine image */}
      {offer.imageUrl ? (
        <div style={{ position: "relative", height: "140px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={offer.imageUrl} alt={offer.modelName} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            onError={function(e) { (e.target as HTMLImageElement).style.display = "none"; }} />
          {offer.brochureUrl ? (
            <a href={offer.brochureUrl} target="_blank" rel="noopener" style={{
              position: "absolute", bottom: 0, right: 0, padding: "3px 8px",
              background: "rgba(255,255,255,0.1)", border: "1px solid #d4d4d4", borderRadius: "8px",
              fontSize: "12px", fontWeight: 500, color: "var(--pb-foreground)", textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: "6px",
              boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)", minHeight: "24px",
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v6M3 6l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              PDF
            </a>
          ) : null}
        </div>
      ) : null}

      {/* Value props — filter out AutoInk */}
      {(offer.valueProp1 || offer.valueProp2 || offer.valueProp3) ? (
        <div className="pb-props">
          {offer.valueProp1 && !offer.valueProp1.includes("AutoInk") ? <div className="pb-prop"><svg className="pb-check-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#005cb1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{offer.valueProp1.replace(/\u00a0/g, " ")}</span></div> : null}
          {offer.valueProp2 && !offer.valueProp2.includes("AutoInk") ? <div className="pb-prop"><svg className="pb-check-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#005cb1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{offer.valueProp2.replace(/\u00a0/g, " ")}</span></div> : null}
          {offer.valueProp3 && !offer.valueProp3.includes("AutoInk") ? <div className="pb-prop"><svg className="pb-check-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#005cb1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{offer.valueProp3.replace(/\u00a0/g, " ")}</span></div> : null}
          {offer.starterKitDescription ? <div className="pb-prop"><svg className="pb-check-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#005cb1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{offer.starterKitDescription.replace(/\u00a0/g, " ")}</span></div> : null}
        </div>
      ) : null}

      {/* Promo block */}
      <div className={isRecommended ? "pb-promo pb-promo-recommended" : "pb-promo pb-promo-default"}>
        <p className="pb-promo-title">{"Contrat de " + term + ". Paiement annuel."}</p>
        <p className="pb-promo-sub">-{offer.discount || "50%"} sur les 12 premiers mois</p>
      </div>

      <Link to={optionsUrl} className={isRecommended ? "pb-btn pb-btn-full pb-btn-primary" : "pb-btn pb-btn-full pb-btn-secondary"}>
        {isRecommended ? "Choisir cette offre" : "Reconduire cette offre"}
      </Link>
    </div>
  );
}