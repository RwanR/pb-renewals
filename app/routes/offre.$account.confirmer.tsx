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

  // Already signed → redirect to merci
  if (client.acceptance?.adobeSignStatus === "signed") {
    return new Response(null, {
      status: 302,
      headers: { Location: `/offre/${accountNumber}/merci` },
    });
  }

  return { client, offer: client.offers[0], offerPosition, signatureError, autoInk, installOption };
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
  const offerPosition = parseInt(formData.get("offerPosition") as string || "1");
  const installOption = (formData.get("installOption") as string)?.trim();
  const autoInk = formData.get("autoInk") === "true";

  // Validation
  const errors: Record<string, string> = {};
  if (!signatoryFirstName) errors.signatoryFirstName = "Obligatoire";
  if (!signatoryLastName) errors.signatoryLastName = "Obligatoire";
  if (!signatoryEmail) errors.signatoryEmail = "Obligatoire";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signatoryEmail)) errors.signatoryEmail = "Email invalide";

  if (Object.keys(errors).length > 0) {
    return { errors, values: Object.fromEntries(formData) };
  }

  // Load client + offer
  const client = await prisma.client.findUnique({
    where: { accountNumber },
    include: { offers: { where: { offerPosition } } },
  });

  if (!client || client.offers.length === 0) {
    return { errors: { _form: "Client ou offre introuvable" }, values: Object.fromEntries(formData) };
  }

  const offer = client.offers[0];

  // Create or update acceptance
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
      ipAddress: request.headers.get("x-forwarded-for") || null,
      userAgent: request.headers.get("user-agent") || null,
    },
  });

  console.log(`[SIGN] Acceptance created for ${accountNumber}, generating PDF...`);

  // Generate contract PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateContractPDF({ client, offer, acceptance });
    console.log(`[SIGN] PDF generated (${pdfBuffer.length} bytes)`);
  } catch (err) {
    console.error(`[SIGN] PDF generation failed:`, err);
    return {
      errors: { _form: "Erreur lors de la génération du contrat. Veuillez réessayer." },
      values: Object.fromEntries(formData),
    };
  }

  // Create Yousign signature request
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

    // Store Yousign signature request ID
    await prisma.acceptance.update({
      where: { id: acceptance.id },
      data: {
        adobeSignAgreementId: signatureRequestId, // reusing the field for Yousign
        adobeSignStatus: "sent",
      },
    });

    console.log(`[SIGN] Redirecting to Yousign: ${signerUrl}`);


  // Redirect to our embedded signing page
    return new Response(null, {
      status: 302,
      headers: { Location: `/offre/${accountNumber}/signer` },
    });
  } catch (err) {
    console.error(`[SIGN] Yousign API failed:`, err);
    return {
      errors: { _form: "Erreur lors de la création de la signature. Veuillez réessayer." },
      values: Object.fromEntries(formData),
    };
  }
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OffreConfirmer() {
  const { client, offer, offerPosition, signatureError, autoInk, installOption } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ errors?: Record<string, string>; values?: Record<string, string> }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const primaryBilling = offer.billing60 ?? offer.billing36;
  const primaryTotal = offer.billingTotal60 ?? offer.billingTotal36;
  const primaryTerm = offer.billing60 ? "60 mois" : "36 mois";
  const email = client.bestEmail || client.installEmail || client.billingEmail || "";
  const phone = client.installPhone || client.billingPhone || "";

  return (
    <div className="pb-space-lg">
      <Link to={`/offre/${client.accountNumber}`} className="pb-link" style={{ fontSize: "14px" }}>
        ← Retour aux offres
      </Link>

      <h1 className="pb-title">Confirmation de votre choix</h1>

      {signatureError && (
        <div className="pb-error">
          La signature a échoué. Veuillez réessayer.
        </div>
      )}

      {actionData?.errors?._form && (
        <div className="pb-error">{actionData.errors._form}</div>
      )}

      {/* Recap */}
      <div className="pb-card pb-space-sm">
        <div className="pb-subtitle" style={{ fontSize: "16px" }}>Récapitulatif</div>
        <div className="pb-situation">
          <div className="pb-situation-item">
            <div className="pb-situation-label">Offre choisie</div>
            <div className="pb-situation-value">{offer.modelName}</div>
          </div>
          <div className="pb-situation-item">
            <div className="pb-situation-label">Durée</div>
            <div className="pb-situation-value">{primaryTerm}</div>
          </div>
          <div className="pb-situation-item">
            <div className="pb-situation-label">Loyer annuel HT</div>
            <div className="pb-situation-value">{formatCurrency(primaryBilling)} €</div>
          </div>
          <div className="pb-situation-item">
            <div className="pb-situation-label">Loyer annuel TTC</div>
            <div className="pb-situation-value">{formatCurrency(primaryTotal)} €</div>
          </div>
        </div>
      </div>

      {/* Form */}
      <Form method="post">
        <input type="hidden" name="offerPosition" value={offerPosition} />
        <input type="hidden" name="autoInk" value={autoInk ? "true" : "false"} />
        <input type="hidden" name="installOption" value={installOption} />

        <div className="pb-space">
          {/* Client info */}
          <div className="pb-card pb-space-sm">
            <div className="pb-subtitle" style={{ fontSize: "16px" }}>Vos informations</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <div className="pb-label">Raison sociale</div>
                <div className="pb-text" style={{ fontWeight: 500 }}>{client.customerName}</div>
              </div>
              <div>
                <div className="pb-label">SIRET</div>
                <div className="pb-text" style={{ fontWeight: 500 }}>{client.siret || "—"}</div>
              </div>
            </div>

            <div>
              <div className="pb-label">Adresse d'installation</div>
              <div className="pb-text" style={{ fontWeight: 500 }}>
                {[client.installAddress1, client.installStreet, client.installPostcode, client.installCity]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label htmlFor="overrideEmail" className="pb-label">Email</label>
                <input
                  id="overrideEmail"
                  name="overrideEmail"
                  type="email"
                  defaultValue={actionData?.values?.overrideEmail ?? email}
                  className="pb-input"
                />
              </div>
              <div>
                <label htmlFor="overridePhone" className="pb-label">Téléphone</label>
                <input
                  id="overridePhone"
                  name="overridePhone"
                  type="tel"
                  defaultValue={actionData?.values?.overridePhone ?? phone}
                  className="pb-input"
                />
              </div>
            </div>
          </div>

          {/* Signatory */}
          <div className="pb-card pb-space-sm">
            <div className="pb-subtitle" style={{ fontSize: "16px" }}>Signataire</div>
            <p className="pb-text-sm" style={{ marginBottom: "8px" }}>
              Personne habilitée à signer le contrat au nom de l'entreprise.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label htmlFor="signatoryFirstName" className="pb-label">Prénom *</label>
                <input
                  id="signatoryFirstName"
                  name="signatoryFirstName"
                  type="text"
                  required
                  defaultValue={actionData?.values?.signatoryFirstName ?? client.contactFirstName ?? ""}
                  className="pb-input"
                  style={actionData?.errors?.signatoryFirstName ? { borderColor: "#DC2626" } : {}}
                />
                {actionData?.errors?.signatoryFirstName && (
                  <span style={{ color: "#DC2626", fontSize: "12px" }}>{actionData.errors.signatoryFirstName}</span>
                )}
              </div>
              <div>
                <label htmlFor="signatoryLastName" className="pb-label">Nom *</label>
                <input
                  id="signatoryLastName"
                  name="signatoryLastName"
                  type="text"
                  required
                  defaultValue={actionData?.values?.signatoryLastName ?? client.contactLastName ?? ""}
                  className="pb-input"
                  style={actionData?.errors?.signatoryLastName ? { borderColor: "#DC2626" } : {}}
                />
                {actionData?.errors?.signatoryLastName && (
                  <span style={{ color: "#DC2626", fontSize: "12px" }}>{actionData.errors.signatoryLastName}</span>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="signatoryEmail" className="pb-label">Email du signataire *</label>
              <input
                id="signatoryEmail"
                name="signatoryEmail"
                type="email"
                required
                defaultValue={actionData?.values?.signatoryEmail ?? ""}
                placeholder="C'est ici que Yousign enverra le contrat"
                className="pb-input"
                style={actionData?.errors?.signatoryEmail ? { borderColor: "#DC2626" } : {}}
              />
              {actionData?.errors?.signatoryEmail && (
                <span style={{ color: "#DC2626", fontSize: "12px" }}>{actionData.errors.signatoryEmail}</span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label htmlFor="signatoryFunction" className="pb-label">Fonction</label>
                <input
                  id="signatoryFunction"
                  name="signatoryFunction"
                  type="text"
                  placeholder="Ex : Comptable, Directeur"
                  defaultValue={actionData?.values?.signatoryFunction ?? client.contactPosition ?? ""}
                  className="pb-input"
                />
              </div>
              <div>
                <label htmlFor="signatoryPhone" className="pb-label">Téléphone</label>
                <input
                  id="signatoryPhone"
                  name="signatoryPhone"
                  type="tel"
                  defaultValue={actionData?.values?.signatoryPhone ?? ""}
                  className="pb-input"
                />
              </div>
            </div>
          </div>

          {/* Legal */}
          <div className="pb-card pb-space-sm">
            <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" name="acceptCGV" required style={{ marginTop: "4px" }} />
              <span className="pb-text-sm">
                J'accepte les <a href="https://pb.com/fr/cc" target="_blank" rel="noopener" className="pb-link">conditions générales de location</a> Pitney Bowes.
              </span>
            </label>
            <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" name="acceptRGPD" required style={{ marginTop: "4px" }} />
              <span className="pb-text-sm">
                J'autorise Pitney Bowes à traiter mes données personnelles conformément à sa <a href="https://www.pitneybowes.com/fr/legal/politique-de-confidentialite.html" target="_blank" rel="noopener" className="pb-link">politique de confidentialité</a>.
              </span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="pb-btn pb-btn-primary pb-btn-full"
            style={{ padding: "14px 28px", fontSize: "16px" }}
          >
            {isSubmitting ? (
              <><span className="pb-spinner" /> Préparation du contrat...</>
            ) : (
              "Signer mon contrat"
            )}
          </button>
        </div>
      </Form>
    </div>
  );
}