import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const client = await prisma.client.findUnique({
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

function formatMonthly(annual: number | null): string {
  if (annual === null || annual === undefined) return "—";
  return formatCurrency(annual / 12);
}

function parseInstallOptions(description: string | null) {
  if (!description) return [];
  return description.split("|").map((s) => {
    const trimmed = s.trim();
    const match = trimmed.match(/^(.+?):\s*(.+)$/);
    if (match) return { label: match[1].trim(), detail: match[2].trim() };
    return { label: trimmed, detail: "" };
  });
}

export default function OffreClient() {
  const { client } = useLoaderData<typeof loader>();

  const offer1 = client.offers.find((o: any) => o.offerPosition === 1);
  const offer2 = client.offers.find((o: any) => o.offerPosition === 2);

  // Already signed?
if (client.acceptance?.adobeSignStatus === "signed") {
    return (
      <div className="pb-space">
        <div className="pb-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>✓</div>
          <h1 className="pb-title" style={{ marginBottom: "12px" }}>
            Contrat déjà signé
          </h1>
          <p className="pb-text" style={{ color: "var(--pb-text-light)" }}>
            Vous avez déjà signé votre contrat de renouvellement.
            Un email de confirmation vous a été envoyé.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-space-lg">
      {/* Greeting */}
      <div>
        <p className="pb-greeting">
          Bonjour, <strong>{client.customerName}</strong>
        </p>
        <h1 className="pb-title">Votre offre de renouvellement</h1>
      </div>

      {/* Current situation */}
      <div className="pb-card pb-space-sm">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <span className="pb-badge pb-badge-current">Votre situation actuelle</span>
        </div>
        <div className="pb-situation">
          <div className="pb-situation-item">
            <div className="pb-situation-label">Machine actuelle</div>
            <div className="pb-situation-value">{client.currentModel || "—"}</div>
          </div>
          <div className="pb-situation-item">
            <div className="pb-situation-label">N° de contrat</div>
            <div className="pb-situation-value">{client.leaseNumber || "—"}</div>
          </div>
          <div className="pb-situation-item">
            <div className="pb-situation-label">Loyer actuel</div>
            <div className="pb-situation-value">
              {client.currentEquipmentPayment
                ? `${formatCurrency(client.currentEquipmentPayment)} € HT/an`
                : "—"}
            </div>
          </div>
          <div className="pb-situation-item">
            <div className="pb-situation-label">Fin de contrat</div>
            <div className="pb-situation-value">
              {client.leaseExpiryDate
                ? new Date(client.leaseExpiryDate).toLocaleDateString("fr-FR")
                : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Offers */}
      <div className="pb-offers-grid">
        {/* Offer 1 — Recommended */}
        {offer1 && (
          <div className="pb-offer-main">
            <OfferCard offer={offer1} recommended />
          </div>
        )}

        {/* Offer 2 — Alternative */}
        {offer2 && (
          <div className="pb-offer-alt">
            <OfferCard offer={offer2} />
          </div>
        )}
      </div>

      {/* Not interested */}
      <div style={{ textAlign: "center", paddingTop: "8px" }}>
        <Link
          to={`/offre/${client.accountNumber}/refus`}
          className="pb-link"
          style={{ fontSize: "14px" }}
        >
          Aucune offre ne me convient →
        </Link>
      </div>
    </div>
  );
}

function OfferCard({ offer, recommended = false }: { offer: any; recommended?: boolean }) {
  // Determine which pricing is available
  const has60 = offer.billing60 !== null;
  const has36 = offer.billing36 !== null;

  // Primary price (the main one to display)
  const primaryBilling = has60 ? offer.billing60 : offer.billing36;
  const primaryTerm = has60 ? "60 mois" : "36 mois";
  const primaryTotal = has60 ? offer.billingTotal60 : offer.billingTotal36;

  const isUpgrade = offer.template === "1";
  const installOptions = isUpgrade ? parseInstallOptions(offer.installDescription) : [];

  return (
    <div className={`pb-card pb-space-sm ${recommended ? "pb-card-highlight" : "pb-card-secondary"}`}>
      {/* Badge */}
      {recommended && (
        <span className="pb-badge pb-badge-recommended">★ Recommandé pour vous</span>
      )}

      {/* Headline */}
      <h2 className="pb-subtitle" style={{ marginTop: recommended ? "12px" : "0" }}>
        {offer.headline || offer.modelName}
      </h2>

      {/* Machine info */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {offer.imageUrl && (
          <img
            src={offer.imageUrl}
            alt={offer.modelName}
            className="pb-machine-img"
            style={{ maxWidth: "120px" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div>
          <p className="pb-text" style={{ fontWeight: 500 }}>{offer.modelDescription}</p>
          <p className="pb-text-sm">{offer.contractTerm}</p>
        </div>
      </div>

      {/* Promo */}
      {offer.marketingMessage && (
        <div className="pb-promo">
          <span>🎁</span>
          <span>{offer.marketingMessage}</span>
        </div>
      )}

      {/* Price */}
      <div>
        <div className="pb-price">
          {formatCurrency(primaryBilling)} €
          <span className="pb-price-period"> HT / an</span>
        </div>
        <div className="pb-price-monthly">
          soit {formatMonthly(primaryBilling)} € HT / mois · {primaryTerm}
        </div>
        {primaryTotal && (
          <div className="pb-text-xs" style={{ marginTop: "4px" }}>
            TTC : {formatCurrency(primaryTotal)} € / an
          </div>
        )}
      </div>

      {/* Payment message */}
      {offer.paymentMessage && (
        <p className="pb-text-sm" style={{ fontStyle: "italic", color: "var(--pb-success)" }}>
          {offer.paymentMessage}
        </p>
      )}

      {/* Value props */}
      {(offer.valueProp1 || offer.valueProp2 || offer.valueProp3) && (
        <div className="pb-props">
          {offer.valueProp1 && (
            <div className="pb-prop">
              <span className="pb-prop-icon">✓</span>
              <span>{offer.valueProp1}</span>
            </div>
          )}
          {offer.valueProp2 && (
            <div className="pb-prop">
              <span className="pb-prop-icon">✓</span>
              <span>{offer.valueProp2}</span>
            </div>
          )}
          {offer.valueProp3 && (
            <div className="pb-prop">
              <span className="pb-prop-icon">✓</span>
              <span>{offer.valueProp3}</span>
            </div>
          )}
        </div>
      )}

      {/* Included equipment */}
      {(offer.description2 || offer.description3 || offer.description4) && (
        <div>
          <div className="pb-text-xs" style={{ fontWeight: 600, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Inclus
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {offer.description2 && <div className="pb-text-sm">• {offer.description2}</div>}
            {offer.description3 && <div className="pb-text-sm">• {offer.description3}</div>}
            {offer.description4 && <div className="pb-text-sm">• {offer.description4}</div>}
          </div>
        </div>
      )}

      {/* AutoInk */}
      {offer.autoInk && offer.autoInkDescription && (
        <div style={{ padding: "10px 14px", background: "#F0F9FF", borderRadius: "8px", fontSize: "13px" }}>
          <strong>🖋 {offer.autoInkDescription}</strong>
          <span style={{ color: "var(--pb-text-light)" }}> — Ne tombez jamais à court d'encre</span>
        </div>
      )}

      {/* Brochure */}
      {offer.brochureUrl && (
        <a href={offer.brochureUrl} target="_blank" rel="noopener" className="pb-link" style={{ fontSize: "13px" }}>
          📄 Télécharger la brochure PDF
        </a>
      )}

      <div className="pb-divider" />

      {/* CTA */}
      <Link
        to={`/offre/${offer.clientAccountNumber}/options?offre=${offer.offerPosition}`}
        className={`pb-btn pb-btn-full ${recommended ? "pb-btn-primary" : "pb-btn-secondary"}`}
      >
        {recommended ? "Choisir cette offre" : "Reconduire mon contrat"}
      </Link>
    </div>
  );
}