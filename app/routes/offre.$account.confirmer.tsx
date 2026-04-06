import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, Form, Link } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import { generateContractPDF } from "~/lib/contract-pdf.server";
import { createSignatureRequest } from "~/lib/yousign.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const url = new URL(request.url);
  const offerPosition = parseInt(url.searchParams.get("offre") || "1");
  const signatureError = url.searchParams.get("error") === "signature";
  const autoInk = url.searchParams.get("autoInk") === "true";
  const installOption = url.searchParams.get("installOption") || "";

  // Info from step 3
  const overrideEmail = url.searchParams.get("email") || "";
  const overridePhone = url.searchParams.get("phone") || "";

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

  return { client, offer: client.offers[0], offerPosition, signatureError, autoInk, installOption, overrideEmail, overridePhone };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const formData = await request.formData();

  const signatoryFirstName = (formData.get("signatoryFirstName") as string)?.trim();
  const signatoryLastName = (formData.get("signatoryLastName") as string)?.trim();
  const signatoryEmail = (formData.get("signatoryEmail") as string)?.trim();
  const signatoryFunction = (formData.get("signatoryFunction") as string)?.trim();
  const signatoryPhone = (formData.get("signatoryPhone") as string)?.trim();
  const overrideEmail = (formData.get("overrideEmail") as string)?.trim();
  const overridePhone = (formData.get("overridePhone") as string)?.trim();
  const orderRef = (formData.get("orderRef") as string)?.trim();
  const offerPosition = parseInt(formData.get("offerPosition") as string || "1");
  const installOption = (formData.get("installOption") as string)?.trim();
  const autoInk = formData.get("autoInk") === "true";

  const errors: Record<string, string> = {};
  if (!signatoryFirstName) errors.signatoryFirstName = "Obligatoire";
  if (!signatoryLastName) errors.signatoryLastName = "Obligatoire";
  if (!signatoryEmail) errors.signatoryEmail = "Obligatoire";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signatoryEmail)) errors.signatoryEmail = "Email invalide";

  if (Object.keys(errors).length > 0) {
    return { errors, values: Object.fromEntries(formData) };
  }

  const client = await prisma.client.findUnique({
    where: { accountNumber },
    include: { offers: { where: { offerPosition } } },
  });

  if (!client || client.offers.length === 0) {
    return { errors: { _form: "Client ou offre introuvable" }, values: Object.fromEntries(formData) };
  }

  const offer = client.offers[0];

  const acceptance = await prisma.acceptance.upsert({
    where: { clientAccountNumber: accountNumber },
    create: {
      clientAccountNumber: accountNumber,
      offerPosition,
      installOptionSelected: installOption || null,
      autoInkSelected: autoInk,
      signatoryFirstName,
      signatoryLastName,
      signatoryEmail,
      signatoryFunction: signatoryFunction || null,
      signatoryPhone: signatoryPhone || null,
      overrideEmail: overrideEmail || null,
      overridePhone: overridePhone || null,
      notes: orderRef ? `Réf commande: ${orderRef}` : null,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("cf-connecting-ip") || null,
      userAgent: request.headers.get("user-agent") || null,
    },
    update: {
      offerPosition,
      installOptionSelected: installOption || null,
      autoInkSelected: autoInk,
      signatoryFirstName,
      signatoryLastName,
      signatoryEmail,
      signatoryFunction: signatoryFunction || null,
      signatoryPhone: signatoryPhone || null,
      overrideEmail: overrideEmail || null,
      overridePhone: overridePhone || null,
      notes: orderRef ? `Réf commande: ${orderRef}` : null,
      ipAddress: request.headers.get("x-forwarded-for") || null,
      userAgent: request.headers.get("user-agent") || null,
    },
  });

  console.log(`[SIGN] Acceptance created for ${accountNumber}, generating PDF...`);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateContractPDF({ client, offer, acceptance });
    console.log(`[SIGN] PDF generated (${pdfBuffer.length} bytes)`);
  } catch (err) {
    console.error(`[SIGN] PDF generation failed:`, err);
    return { errors: { _form: "Erreur lors de la génération du contrat. Veuillez réessayer." }, values: Object.fromEntries(formData) };
  }

  try {
    const { signatureRequestId, signerUrl } = await createSignatureRequest({
      pdfBuffer,
      pdfFilename: `contrat-pb-${accountNumber}.pdf`,
      signerFirstName: signatoryFirstName,
      signerLastName: signatoryLastName,
      signerEmail: signatoryEmail,
      signerPhone: signatoryPhone || undefined,
      accountNumber,
    });

    await prisma.acceptance.update({
      where: { id: acceptance.id },
      data: { adobeSignAgreementId: signatureRequestId, adobeSignStatus: "sent" },
    });

    console.log(`[SIGN] Redirecting to Yousign signer page`);

    return new Response(null, {
      status: 302,
      headers: { Location: `/offre/${accountNumber}/signer` },
    });
  } catch (err) {
    console.error(`[SIGN] Yousign API failed:`, err);
    return { errors: { _form: "Erreur lors de la création de la signature. Veuillez réessayer." }, values: Object.fromEntries(formData) };
  }
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

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.5" stroke="#737373" strokeWidth="1.2"/><path d="M3 14C3 11.5 5 10 8 10s5 1.5 5 4" stroke="#737373" strokeWidth="1.2" strokeLinecap="round"/></svg>
);
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="#737373" strokeWidth="1.2"/><path d="M1 4.5L8 9L15 4.5" stroke="#737373" strokeWidth="1.2"/></svg>
);
const DocIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="1" width="10" height="14" rx="1.5" stroke="#737373" strokeWidth="1.2"/><path d="M6 5H10M6 8H10M6 11H8" stroke="#737373" strokeWidth="1.2" strokeLinecap="round"/></svg>
);

function FieldWithIcon({ label, name, defaultValue, icon, type = "text", required = false, error, placeholder }: {
  label: string; name: string; defaultValue: string; icon: React.ReactNode; type?: string; required?: boolean; error?: string; placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={{ fontSize: "14px", fontWeight: 500, color: "var(--pb-foreground)" }}>{label}</label>
      <div style={{
        background: "white", border: error ? "1px solid #DC2626" : "1px solid var(--pb-border)",
        borderRadius: "8px", padding: "9.5px 16px", display: "flex", alignItems: "center", gap: "12px",
        minHeight: "40px", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
      }}>
        <div style={{ flexShrink: 0, width: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <input name={name} type={type} defaultValue={defaultValue} required={required} placeholder={placeholder}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: "14px", color: "var(--pb-foreground)" }}
        />
      </div>
      {error && <span style={{ color: "#DC2626", fontSize: "12px" }}>{error}</span>}
    </div>
  );
}

export default function OffreConfirmer() {
  const { client, offer, offerPosition, signatureError, autoInk, installOption, overrideEmail, overridePhone } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ errors?: Record<string, string>; values?: Record<string, string> }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const billing = offer.billing60 ?? offer.billing36;
  const billingTax = offer.billingTax60 ?? offer.billingTax36;
  const billingTotal = offer.billingTotal60 ?? offer.billingTotal36;
  const term = offer.billing60 ? "60 mois" : "36 mois";
  const machineImg = getMachineImage(offer.modelName);

  const installPrices: Record<string, number> = { auto: 0, phone: 63, onsite: 155 };
  const installPrice = installPrices[installOption] ?? 0;

  const email = overrideEmail || client.bestEmail || client.installEmail || client.billingEmail || "";

  return (
    <div className="pb-main">
      {/* Stepper */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "32px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <div className="pb-step" style={{ background: "#00b44a", color: "white" }}>✓</div>
          <div className="pb-step-line" />
          <div className="pb-step" style={{ background: "#00b44a", color: "white" }}>✓</div>
          <div className="pb-step-line" />
          <div className="pb-step" style={{ background: "#00b44a", color: "white" }}>✓</div>
          <div className="pb-step-line" />
          <div className="pb-step pb-step-active">4</div>
        </div>
        <p style={{ fontSize: "20px", fontWeight: 600, color: "var(--pb-text)", textAlign: "center" }}>
          Signer le contrat
        </p>
      </div>

      {signatureError && (
        <div className="pb-error" style={{ maxWidth: "596px", margin: "0 auto 24px" }}>
          Erreur lors de la signature. Veuillez réessayer.
        </div>
      )}
      {actionData?.errors?._form && (
        <div className="pb-error" style={{ maxWidth: "596px", margin: "0 auto 24px" }}>
          {actionData.errors._form}
        </div>
      )}

      <div style={{ maxWidth: "596px", margin: "0 auto" }}>
        {/* Recap card */}
        <div style={{
          border: "1px solid var(--pb-border)", borderRadius: "16px", padding: "24px",
          display: "flex", flexDirection: "column", gap: "16px", marginBottom: "40px",
        }}>
          <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
            {/* Machine image + PDF */}
            <div style={{ position: "relative", width: "180px", flexShrink: 0 }}>
              {machineImg && (
                <img src={machineImg} alt={offer.modelName || ""} style={{ width: "100%", objectFit: "contain" }}
                  onError={function(e) { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <a href={`/offre/${client.accountNumber}/recap-pdf?offre=${offerPosition}&autoInk=${autoInk}&installOption=${installOption}`}
                target="_blank" rel="noopener"
                style={{
                position: "absolute", bottom: 0, left: 0,
                padding: "3px 8px", background: "white", border: "1px solid var(--pb-border-dark)",
                borderRadius: "8px", fontSize: "12px", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px",
                cursor: "pointer", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)", textDecoration: "none", color: "inherit",
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v6M3 6l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                PDF
              </a>
            </div>
            {/* Details */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
              <p style={{ fontSize: "18px", fontWeight: 600, color: "var(--pb-text)" }}>{offer.modelName}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--pb-text-muted)" }}>Durée</span>
                  <span style={{ fontWeight: 600, color: "var(--pb-text)" }}>{term}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--pb-text-muted)" }}>Loyer annuel HT</span>
                  <span style={{ fontWeight: 600, color: "var(--pb-text)" }}>{formatCurrency(billing)} €</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--pb-text-muted)" }}>TVA 20%</span>
                  <span style={{ fontWeight: 600, color: "var(--pb-text)" }}>{formatCurrency(billingTax)} €</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--pb-text-muted)" }}>Loyer annuel TTC</span>
                  <span style={{ fontWeight: 600, color: "var(--pb-text)" }}>{formatCurrency(billingTotal)} €</span>
                </div>
              </div>
              <div style={{ height: "1px", background: "var(--pb-border)", margin: "4px 0" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "14px" }}>
                {autoInk && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--pb-text-muted)" }}>Option</span>
                    <span style={{ fontWeight: 600, color: "var(--pb-text)" }}>AutoInk</span>
                  </div>
                )}
                {installOption && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--pb-text-muted)" }}>Installation HT</span>
                    <span style={{ fontWeight: 600, color: "var(--pb-text)" }}>{formatCurrency(installPrice)} €</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Signatory form */}
        <Form method="post">
          <input type="hidden" name="offerPosition" value={offerPosition} />
          <input type="hidden" name="autoInk" value={autoInk ? "true" : "false"} />
          <input type="hidden" name="installOption" value={installOption} />
          <input type="hidden" name="overrideEmail" value={overrideEmail} />
          <input type="hidden" name="overridePhone" value={overridePhone} />

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <FieldWithIcon label="Prénom" name="signatoryFirstName" icon={<UserIcon />} required
              defaultValue={actionData?.values?.signatoryFirstName ?? client.contactFirstName ?? ""}
              error={actionData?.errors?.signatoryFirstName} />

            <FieldWithIcon label="Nom" name="signatoryLastName" icon={<UserIcon />} required
              defaultValue={actionData?.values?.signatoryLastName ?? client.contactLastName ?? ""}
              error={actionData?.errors?.signatoryLastName} />

            <FieldWithIcon label="Email" name="signatoryEmail" icon={<MailIcon />} type="email" required
              defaultValue={actionData?.values?.signatoryEmail ?? email}
              error={actionData?.errors?.signatoryEmail} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: 500, color: "var(--pb-foreground)" }}>Titre</label>
                <select name="signatoryFunction"
                  defaultValue={actionData?.values?.signatoryFunction ?? client.contactPosition ?? ""}
                  style={{
                    width: "100%", minHeight: "40px", padding: "9.5px 16px",
                    border: "1px solid var(--pb-border)", borderRadius: "8px",
                    fontFamily: "inherit", fontSize: "14px", color: "var(--pb-foreground)",
                    background: "white", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)", cursor: "pointer",
                  }}>
                  <option value="">Sélectionner</option>
                  <option value="Directeur">Directeur</option>
                  <option value="Directeur des achats">Directeur des achats</option>
                  <option value="Comptable">Comptable</option>
                  <option value="Responsable administratif">Responsable administratif</option>
                  <option value="Gérant">Gérant</option>
                  <option value="Secrétaire général">Secrétaire général</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <FieldWithIcon label="Votre référence de commande" name="orderRef" icon={<DocIcon />}
                defaultValue={actionData?.values?.orderRef ?? ""} />
            </div>
          </div>

          {/* Conditions */}
          <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ fontSize: "20px", fontWeight: 500, color: "var(--pb-text)", letterSpacing: "0.1px" }}>
              Conditions générale de location
            </p>
            <label style={{
              display: "flex", gap: "12px", alignItems: "center", cursor: "pointer",
              padding: "12px 16px", border: "1px solid var(--pb-border)", borderRadius: "8px",
            }}>
              <input type="checkbox" name="acceptCGV" required style={{ accentColor: "#171717", width: "16px", height: "16px" }} />
              <span style={{ fontSize: "14px", color: "var(--pb-text)" }}>
                En cochant cette case, j'accepte les <a href="https://pb.com/fr/cc" target="_blank" rel="noopener" style={{ color: "var(--pb-text)", textDecoration: "underline" }}>conditions générales de location</a>
              </span>
            </label>
            <label style={{
              display: "flex", gap: "12px", alignItems: "center", cursor: "pointer",
              padding: "12px 16px", border: "1px solid var(--pb-border)", borderRadius: "8px",
            }}>
              <input type="checkbox" name="acceptRGPD" required style={{ accentColor: "#171717", width: "16px", height: "16px" }} />
              <span style={{ fontSize: "14px", color: "var(--pb-text)" }}>
                Consentement <a href="https://www.pitneybowes.com/fr/legal/politique-de-confidentialite.html" target="_blank" rel="noopener" style={{ color: "var(--pb-text)", textDecoration: "underline" }}>RGPD</a>
              </span>
            </label>
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", gap: "16px", marginTop: "40px", paddingBottom: "40px" }}>
            <a
              href={`/offre/${client.accountNumber}/recap-pdf?offre=${offerPosition}&autoInk=${autoInk}&installOption=${installOption}`}
              className="pb-btn pb-btn-secondary"
              style={{ flex: 1, padding: "12px 24px", fontSize: "16px", textDecoration: "none" }}
              target="_blank"
              rel="noopener"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginRight: "8px" }}><path d="M8 2.5v7M5 7.5l3 3 3-3M2.5 12.5h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Récapitulatif en PDF
            </a>
            <button type="submit" disabled={isSubmitting} className="pb-btn pb-btn-primary" style={{ flex: 1, padding: "12px 24px", fontSize: "16px" }}>
              {isSubmitting ? (
                <><span className="pb-spinner" /> Préparation...</>
              ) : (
                "Signer mon contrat"
              )}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}