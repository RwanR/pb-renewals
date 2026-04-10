import type { LoaderFunctionArgs } from "react-router";
import { useState } from "react";
import { useLoaderData, Form, Link } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const url = new URL(request.url);
  const offerPosition = parseInt(url.searchParams.get("offre") || "1");
  const installOption = url.searchParams.get("installOption") || "phone";

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

  return { client, offer: client.offers[0], offerPosition, installOption, accountNumber };
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

function FieldReadonly({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={{ fontSize: "14px", fontWeight: 500, color: "var(--pb-foreground)" }}>{label}</label>
      <div style={{
        background: "#fafafa",
        border: "1px solid var(--pb-border)",
        borderRadius: "8px",
        padding: "9.5px 16px",
        fontSize: "14px",
        color: "var(--pb-foreground)",
        minHeight: "40px",
        display: "flex",
        alignItems: "center",
        boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
      }}>
        {value || "—"}
      </div>
    </div>
  );
}

function FieldEditable({ label, name, value, icon, type = "text" }: { label: string; name: string; value: string; icon: React.ReactNode; type?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={{ fontSize: "14px", fontWeight: 500, color: "var(--pb-foreground)" }}>{label}</label>
      <div style={{
        background: "white",
        border: "1px solid var(--pb-border)",
        borderRadius: "8px",
        padding: "9.5px 16px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        minHeight: "40px",
        boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
      }}>
        <div style={{ flexShrink: 0, width: "20px", display: "flex", alignItems: "center", justifyContent: "center", color: "#737373" }}>
          {icon}
        </div>
        <input
          name={name}
          type={type}
          defaultValue={value || ""}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "inherit",
            fontSize: "14px",
            color: "var(--pb-foreground)",
          }}
        />
      </div>
    </div>
  );
}

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="#737373" strokeWidth="1.2"/><path d="M1 4.5L8 9L15 4.5" stroke="#737373" strokeWidth="1.2"/></svg>
);
const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="4" y="1" width="8" height="14" rx="1.5" stroke="#737373" strokeWidth="1.2"/><path d="M7 12.5H9" stroke="#737373" strokeWidth="1.2" strokeLinecap="round"/></svg>
);
const MapPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6C3.5 9.5 8 14.5 8 14.5S12.5 9.5 12.5 6C12.5 3.5 10.5 1.5 8 1.5Z" stroke="#737373" strokeWidth="1.2"/><circle cx="8" cy="6" r="1.5" stroke="#737373" strokeWidth="1.2"/></svg>
);
const MailboxIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="5" width="14" height="8" rx="1.5" stroke="#737373" strokeWidth="1.2"/><path d="M5.5 5V3.5C5.5 2.4 6.4 1.5 7.5 1.5H8.5C9.6 1.5 10.5 2.4 10.5 3.5V5" stroke="#737373" strokeWidth="1.2"/></svg>
);
const BuildingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="8" height="12" rx="1" stroke="#737373" strokeWidth="1.2"/><rect x="10" y="6" width="4" height="8" rx="1" stroke="#737373" strokeWidth="1.2"/><path d="M4.5 5H7.5M4.5 7.5H7.5M4.5 10H7.5" stroke="#737373" strokeWidth="1.2" strokeLinecap="round"/></svg>
);

export default function OffreInformations() {
  const { client, offer, offerPosition, installOption, accountNumber } = useLoaderData<typeof loader>();

  const billing = offer.billing60 ?? offer.billing36;
  const term = offer.billing60 ? "60 mois" : "36 mois";
  const discount = offer.recommended ? 50 : 25;
  const machineImg = getMachineImage(offer.modelName);

  const bestEmail = client.billingEmail || client.bestEmail || client.installEmail || "";
  const bestPhone = client.installPhone || client.billingPhone || "";
  const [showBilling, setShowBilling] = useState(false);

  return (
    <div>
      {/* Header contrat */}
      <div style={{ borderBottom: "1px solid var(--pb-border)" }}>
        <div style={{
          maxWidth: "1280px", margin: "0 auto",
          display: "flex", alignItems: "center", flexWrap: "wrap", gap: "16px",
          padding: "16px 32px", background: "var(--pb-muted-bg)",
        }}>
          {machineImg && (
            <div style={{ width: "50px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src={machineImg} alt={offer.modelName || ""} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                onError={function(e) { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
          <span style={{ fontSize: "18px", fontWeight: 600, color: "var(--pb-text)", whiteSpace: "nowrap" }}>{offer.modelName}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: "18px", fontWeight: 600, color: "var(--pb-text)", textAlign: "right", whiteSpace: "nowrap" }}>
            {formatCurrency(billing)} € HT par an sur {term}
          </span>
        </div>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "10px 32px", borderTop: "1px solid var(--pb-border)" }}>
          <p style={{ fontSize: "14px", color: "var(--pb-text)", textAlign: "right" }}>
            {discount}% de réduction la première année
          </p>
        </div>
      </div>

      <div className="pb-main">
        {/* Stepper */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "32px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Link to={`/offre/${accountNumber}`} className="pb-step" style={{ background: "#00b44a", color: "white", textDecoration: "none", cursor: "pointer" }}>✓</Link>
            <div className="pb-step-line" />
            <Link to={`/offre/${accountNumber}/options?offre=${offerPosition}`} className="pb-step" style={{ background: "#00b44a", color: "white", textDecoration: "none", cursor: "pointer" }}>✓</Link>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-active">3</div>
            <div className="pb-step-line" />
            <div className="pb-step pb-step-inactive">4</div>
          </div>
          <p style={{ fontSize: "20px", fontWeight: 600, color: "var(--pb-text)", textAlign: "center" }}>
            Vos informations
          </p>
        </div>

        <Form method="get" action={`/offre/${accountNumber}/confirmer`}>
          <input type="hidden" name="offre" value={offerPosition} />
          <input type="hidden" name="installOption" value={installOption} />

          <div style={{ maxWidth: "596px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "40px", paddingBottom: "40px" }}>
            {/* Infos client */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <FieldReadonly label="Raison sociale" value={client.customerName} />
              <FieldReadonly label="SIRET" value={client.siret || ""} />
              <FieldEditable label="Email" name="email" value={bestEmail} icon={<MailIcon />} type="email" />
              <FieldEditable label="Téléphone" name="phone" value={bestPhone} icon={<PhoneIcon />} type="tel" />
            </div>

            {/* Adresse d'installation */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <p style={{ fontSize: "20px", fontWeight: 500, color: "var(--pb-text)", letterSpacing: "0.1px" }}>
                Adresse d'installation
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <FieldEditable label="Adresse 1" name="installAddress1" value={client.installAddress1 || client.customerName} icon={<MapPinIcon />} />
                <FieldEditable label="Adresse 2" name="installStreet" value={client.installStreet || ""} icon={<MapPinIcon />} />
                <FieldEditable label="Code postal" name="installPostcode" value={client.installPostcode || ""} icon={<MailboxIcon />} />
                <FieldEditable label="Ville" name="installCity" value={client.installCity || ""} icon={<BuildingIcon />} />
              </div>
            </div>

            {/* Adresse facturation différente */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ fontSize: "20px", fontWeight: 500, color: "var(--pb-text)", letterSpacing: "0.1px" }}>
                Adresse de facturation différente
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
                <input type="checkbox" checked={showBilling} onChange={function(e) { setShowBilling(e.target.checked); }} style={{
                  width: "20px", height: "20px", accentColor: "#005cb1", cursor: "pointer",
                }} />
              </label>
              {showBilling ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <FieldEditable label="Adresse 1" name="billingAddress1" value={client.billingAddress1 || ""} icon={<MapPinIcon />} />
                  <FieldEditable label="Adresse 2" name="billingStreet" value={client.billingStreet || ""} icon={<MapPinIcon />} />
                  <FieldEditable label="Code postal" name="billingPostcode" value={client.billingPostcode || ""} icon={<MailboxIcon />} />
                  <FieldEditable label="Ville" name="billingCity" value={client.billingCity || ""} icon={<BuildingIcon />} />
                </div>
              ) : null}
            </div>

            {/* CTA */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "48px" }}>
              <Link to={`/offre/${accountNumber}/options?offre=${offerPosition}`} style={{ color: "var(--pb-text)", display: "flex", alignItems: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <button type="submit" className="pb-btn pb-btn-primary" style={{ padding: "12px 32px", fontSize: "16px" }}>
                Étape suivante
              </button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}