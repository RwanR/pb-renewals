import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const client = await prisma.client.findUnique({
    where: { accountNumber },
    include: { acceptance: true, offers: true },
  });

  if (!client || !client.acceptance) throw new Response("Aucune acceptation trouvée", { status: 404 });

  const offer = client.offers.find((o: any) => o.offerPosition === client.acceptance!.offerPosition);
  return { client, acceptance: client.acceptance, offer };
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
  for (const key of Object.keys(images)) { if (model.includes(key)) return images[key]; }
  return null;
}

export default function OffreMerci() {
  const { client, acceptance, offer } = useLoaderData<typeof loader>();

  const isUpgrade = offer?.template === "1";
  const monthly = offer?.monthly60 ?? offer?.monthly48 ?? offer?.monthly36 ?? offer?.billing60 ?? offer?.billing48 ?? offer?.billing36 ?? null;
  const billingTax = offer?.billingTax60 ?? offer?.billingTax48 ?? offer?.billingTax36 ?? null;
  const billingTotal = offer?.billingTotal60 ?? offer?.billingTotal48 ?? offer?.billingTotal36 ?? null;
  const term = (offer?.monthly60 ?? offer?.billing60) ? "60 mois" : (offer?.monthly48 ?? offer?.billing48) ? "48 mois" : "36 mois";
  const machineImg = offer ? getMachineImage(offer.modelName) : null;

  return (
    <div className="pb-main">
      <div style={{ maxWidth: "597px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center" }}>

        {/* Success header */}
        <div style={{ paddingTop: "48px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="#00b44a" strokeWidth="2.5" fill="none"/>
            <path d="M15 24L21 30L33 18" stroke="#00b44a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p style={{ fontSize: "24px", fontWeight: 500, color: "var(--pb-text)", textAlign: "center", letterSpacing: "0.1px" }}>Confirmation</p>
          <p style={{ fontSize: "14px", color: "var(--pb-text-muted)", textAlign: "center" }}>Votre contrat a été signé avec succès</p>
        </div>

        {/* Recap card */}
        {offer && (
          <div style={{ border: "1px solid var(--pb-border)", borderRadius: "16px", padding: "24px", display: "flex", gap: "24px", alignItems: "center", width: "100%" }}>
            {machineImg && (
              <div style={{ width: "262px", height: "120px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <img src={machineImg} alt={offer.modelName || ""} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  onError={function(e) { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ fontSize: "18px", fontWeight: 600, color: "var(--pb-text)" }}>{offer.modelName}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", lineHeight: "20px" }}>
                  <div style={{ display: "flex", flexDirection: "column", color: "var(--pb-text-muted)", fontSize: "12px" }}>
                    <span>Durée</span>
                    <span>Loyer mensuel HT</span>
                    <span>TVA 20%</span>
                    <span>Loyer mensuel TTC</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", textAlign: "right", fontWeight: 600, color: "var(--pb-text)", fontSize: "14px" }}>
                    <span>{term}</span>
                    <span>{formatCurrency(monthly)} €</span>
                    <span>{formatCurrency(billingTax)} €</span>
                    <span>{formatCurrency(billingTotal)} €</span>
                  </div>
                </div>
                {acceptance.installOptionSelected && acceptance.installOptionSelected !== "auto" && (
                  <>
                    <div style={{ height: "1px", background: "var(--pb-border)" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", lineHeight: "20px" }}>
                      <span style={{ color: "var(--pb-text-muted)", fontSize: "12px" }}>Installation HT</span>
                      <span style={{ fontWeight: 600, color: "var(--pb-text)" }}>facturation séparée</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Download signed contract */}
        <a href={`/offre/${client.accountNumber}/contrat-signe`} className="pb-btn pb-btn-primary" download
          style={{ padding: "12px 32px", fontSize: "16px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px", height: "48px" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2.5v7M5 7.5l3 3 3-3M2.5 12.5h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Télécharger mon contrat signé
        </a>

        {/* Livraison */}
        {isUpgrade && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ fontSize: "20px", fontWeight: 500, color: "var(--pb-text)", letterSpacing: "0.1px" }}>Livraison de votre équipement</p>
            <div style={{ border: "1px solid var(--pb-border)", borderRadius: "8px", padding: "12px 16px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: "2px" }}>
                <rect x="1" y="3" width="10" height="8" rx="1" stroke="#737373" strokeWidth="1.2"/>
                <path d="M11 6H13.5L15 8.5V11H11V6Z" stroke="#737373" strokeWidth="1.2"/>
                <circle cx="4.5" cy="12" r="1.5" stroke="#737373" strokeWidth="1.2"/>
                <circle cx="12.5" cy="12" r="1.5" stroke="#737373" strokeWidth="1.2"/>
              </svg>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", fontSize: "14px", color: "var(--pb-text)" }}>
                <p style={{ fontWeight: 600 }}>Votre nouvel équipement sera expédié à l'activation de votre nouveau contrat</p>
                <p>
                  {client.installAddress1 || client.customerName}<br />
                  {client.installStreet && <>{client.installStreet}<br /></>}
                  {client.installPostcode}<br />
                  {client.installCity}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contact commercial */}
        {client.ownerName && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "48px" }}>
            <p style={{ fontSize: "20px", fontWeight: 500, color: "var(--pb-text)", letterSpacing: "0.1px" }}>Votre contact commercial</p>
            <div style={{ border: "1px solid var(--pb-border)", borderRadius: "8px", padding: "12px 16px", display: "flex", gap: "12px", alignItems: "center", position: "relative" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="5.5" r="2.5" stroke="#737373" strokeWidth="1.2"/>
                <path d="M3 14C3 11.5 5 10 8 10s5 1.5 5 4" stroke="#737373" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", fontSize: "14px", color: "var(--pb-text)" }}>
                <p style={{ fontWeight: 600 }}>{client.ownerName}</p>
                {client.ownerEmail && <p>{client.ownerEmail}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}