import type { Route } from "./+types/pbis.start.recapitulatif";
import { Check, CircleUser, Smartphone, Mail, Briefcase, Loader2, ArrowLeft, Info } from "lucide-react";
import { Fragment, type ChangeEvent } from "react";
import { Form, redirect, useNavigation, Link } from "react-router";
import pbisDb from "~/db.pbis.server";
import { getSessionShipTo } from "~/lib/pbis-session.server";
import { PBIS_OFFER_COLORS } from "~/lib/pbis-brand";
import { useSessionState } from "~/lib/use-session-state";
import { trackStep } from "~/lib/pbis-funnel.server";

function normalizePhoneFR(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const cleaned = phone.replace(/[\s.\-()]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  if (cleaned.startsWith("0")) return "+33" + cleaned.slice(1);
  return "+33" + cleaned;
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Signez votre contrat - PBIS Start" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const shipTo = await getSessionShipTo(request);

  if (!shipTo) {
    return redirect("/pbis");
  }

  const acceptance = await pbisDb.pbisAcceptance.findUnique({
    where: { clientId: shipTo },
  });

  if (!acceptance) {
    return redirect("/pbis/start/informations");
  }

  if (acceptance.signedAt) {
    return redirect("/pbis/start/confirmation");
  }

  const client = await pbisDb.pbisClient.findUnique({
    where: { shipTo },
    select: {
      companyName: true,
      siret: true,
      vatNumber: true,
      street: true,
      postcode: true,
      city: true,
      contactFirstName: true,
      contactLastName: true,
      contactEmail: true,
      contactPhone: true,
    },
  });

  const recap = {
    companyName: acceptance.companyName ?? client?.companyName ?? "",
    siret: acceptance.siret ?? client?.siret ?? "",
    vatNumber: acceptance.vatNumber ?? client?.vatNumber ?? "",
    billingStreet: acceptance.billingStreet ?? client?.street ?? "",
    billingPostcode: acceptance.billingPostcode ?? client?.postcode ?? "",
    billingCity: acceptance.billingCity ?? client?.city ?? "",
    contactFirstName: acceptance.contactFirstName ?? client?.contactFirstName ?? "",
    contactLastName: acceptance.contactLastName ?? client?.contactLastName ?? "",
    contactEmail: acceptance.contactEmail ?? client?.contactEmail ?? "",
    contactPhone: acceptance.contactPhone ?? client?.contactPhone ?? "",
    contactFunction: acceptance.contactFunction ?? "",
    contactRole: acceptance.contactRole ?? "",
    receptionEmail: acceptance.receptionEmail ?? "",
  };

  await trackStep(shipTo, "recapitulatif");
  return { recap, shipTo };
}

export async function action({ request }: Route.ActionArgs) {
  const shipTo = await getSessionShipTo(request);
  if (!shipTo) {
    return redirect("/pbis");
  }

  const formData = await request.formData();
  const f = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };

  const signatoryFirstName = f("signatoryFirstName");
  const signatoryLastName = f("signatoryLastName");
  const signatoryFunction = f("signatoryFunction");
  const signatoryPhone = f("signatoryPhone");
  const signatoryEmail = f("signatoryEmail");
  const orderReference = f("orderReference");
  const cgvAccepted = formData.get("cgvAccepted") === "on";
  const privacyAccepted = formData.get("privacyAccepted") === "on";

  const now = new Date();

  // 1. Update acceptance avec données signataire + status "signing"
  const acceptance = await pbisDb.pbisAcceptance.update({
    where: { clientId: shipTo },
    data: {
      signatoryFirstName,
      signatoryLastName,
      signatoryFunction,
      signatoryPhone,
      signatoryEmail,
      orderReference,
      cgvAcceptedAt: cgvAccepted ? now : null,
      privacyAcceptedAt: privacyAccepted ? now : null,
      status: "signing",
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("cf-connecting-ip") || null,
      userAgent: request.headers.get("user-agent") || null,
    },
  });

  // Garde-fou : si déjà signé, redirect direct
  if (acceptance.signedAt) {
    return redirect("/pbis/start/confirmation");
  }

  // 2. Fetch client pour génération PDF
  const client = await pbisDb.pbisClient.findUnique({ where: { shipTo } });
  if (!client) {
    return redirect("/pbis");
  }

  // 3. Génère le PDF du contrat
  console.log(`[PBIS SIGN] Generating PDF for ${shipTo}`);
  let pdfBuffer: Buffer;
  try {
    const { generateContractPDFPbis } = await import("~/lib/contract-pdf-pbis.server");
    pdfBuffer = await generateContractPDFPbis({ client, acceptance });
    console.log(`[PBIS SIGN] PDF generated (${pdfBuffer.length} bytes)`);
  } catch (err) {
    console.error(`[PBIS SIGN] PDF generation failed:`, err);
    return { error: "La génération de votre contrat a échoué. Réessayez dans un instant." };
  }

  // 4. Crée la procédure Yousign + redirige vers la page d'iframe
  try {
    const { createSignatureRequest } = await import("~/lib/yousign.server");
    const { signatureRequestId, signerUrl } = await createSignatureRequest({
      pdfBuffer,
      pdfFilename: `contrat-pbis-start-${shipTo}.pdf`,
      signerFirstName: signatoryFirstName || "",
      signerLastName: signatoryLastName || "",
      signerEmail: signatoryEmail || "",
      signerPhone: normalizePhoneFR(signatoryPhone),
      accountNumber: shipTo,
      contractLabel: "PBIS Start",
    });

    await pbisDb.pbisAcceptance.update({
      where: { id: acceptance.id },
      data: {
        yousignProcedureId: signatureRequestId,
        yousignStatus: "sent",
        signedPdfUrl: signerUrl, // stockage temporaire du signerUrl, remplacé par yousign:// après webhook
      },
    });

    await trackStep(shipTo, "signer");
    console.log(`[PBIS SIGN] Yousign procedure created: ${signatureRequestId}`);
    return redirect("/pbis/start/signer");
  } catch (err) {
    console.error(`[PBIS SIGN] Yousign API failed:`, err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("phone_number")) {
      return { error: "Le numéro de téléphone du signataire n'est pas reconnu comme un numéro français valide. Corrigez-le et réessayez." };
    }
    if (msg.includes("email")) {
      return { error: "L'adresse e-mail du signataire est invalide. Corrigez-la et réessayez." };
    }
    return { error: "La demande de signature n'a pas pu être créée. Vérifiez les informations du signataire et réessayez." };
  }
}

function StepperWithCompleted({ currentStep, totalSteps, routes = [] }: { currentStep: number; totalSteps: number; routes?: (string | null | undefined)[] }) {
  return (
    <div className="flex gap-1 items-center justify-center">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isActive = step === currentStep;
        const separatorBg = step <= currentStep ? "#00b44a" : "#d4d4d4";
        const cls = isCompleted ? "bg-[#00b44a] text-white" : isActive ? "bg-[#171717] text-white" : "bg-[#d4d4d4] text-[#737373]";
        const base = "w-5 h-5 rounded-full flex items-center justify-center text-xs";
        const inner = isCompleted ? <Check className="w-3 h-3" strokeWidth={3} /> : step;
        const to = isCompleted ? routes[i] : null;
        return (
          <Fragment key={step}>
            {i > 0 && <div className="w-2.5 h-px" style={{ background: separatorBg }} />}
            {to ? (
              <Link to={to} className={`${base} ${cls} no-underline`} aria-label={`Étape ${step}`}>{inner}</Link>
            ) : (
              <div className={`${base} ${cls}`}>{inner}</div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 items-center w-full">
      <p className="text-xs leading-4 text-[#737373] whitespace-nowrap">{label}</p>
      <p className="flex-1 min-w-0 text-sm leading-5 font-medium text-neutral-950 text-right">{value || "-"}</p>
    </div>
  );
}

function InfoTip({ text, color, width = "w-[280px]" }: { text: string; color: string; width?: string }) {
  return (
    <div className="relative group">
      <Info className="w-4 h-4 cursor-help" style={{ color }} strokeWidth={1.5} />
      <div className={`invisible group-hover:visible absolute left-6 top-0 z-10 ${width} max-w-[calc(100vw-2rem)] bg-neutral-50 border border-neutral-200 rounded p-3 text-xs leading-4 text-neutral-950 shadow-lg`}>
        {text}
      </div>
    </div>
  );
}

function SignField({ label, name, icon: Icon, type = "text", value, onChange, defaultValue, required, pattern, title }: { label: string; name: string; icon?: typeof CircleUser; type?: string; value?: string; onChange?: (e: ChangeEvent<HTMLInputElement>) => void; defaultValue?: string; required?: boolean; pattern?: string; title?: string }) {
  const controlled = onChange !== undefined;
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <label className="text-sm font-medium leading-5 text-neutral-950">{label}</label>
      <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 min-h-9 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        {Icon && <Icon className="w-4 h-4 shrink-0 text-neutral-500" strokeWidth={1.5} />}
        <input name={name} type={type} {...(controlled ? { value: value ?? "", onChange } : { defaultValue })} required={required} pattern={pattern} title={title} className="flex-1 text-sm leading-5 text-neutral-950 placeholder:text-neutral-500 outline-none bg-transparent py-1.5" />
      </div>
    </div>
  );
}

export default function PbisStartRecapitulatif({ loaderData, actionData }: Route.ComponentProps) {
  const { recap, shipTo } = loaderData;
  const startColor = PBIS_OFFER_COLORS.start;

  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";

  const contactFullName = `${recap.contactFirstName} ${recap.contactLastName}`.trim();

  // Persistance par onglet des champs signataire, scopée sur le client.
  const [sig, setSig] = useSessionState(`pbis-start-sig-${shipTo}`, {
    signatoryFirstName: "",
    signatoryLastName: "",
    signatoryFunction: "",
    signatoryPhone: "",
    signatoryEmail: "",
    orderReference: "",
  });
  const setSigField = (key: string) => (e: ChangeEvent<HTMLInputElement>) => setSig({ ...sig, [key]: e.target.value });

  return (
    <Form method="post" className="font-inter pb-16">
      <div className="flex flex-col gap-5 items-center justify-center pt-10 pb-2">
        <StepperWithCompleted currentStep={4} totalSteps={4} routes={["/pbis/offres", "/pbis/offres/start", "/pbis/start/informations"]} />
        <h1 className="font-precision text-xl leading-6 tracking-[-0.3px] text-center text-neutral-950">
          Signez votre contrat
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:items-start px-4 sm:px-8 pt-10 max-w-5xl mx-auto">
        {/* Colonne gauche : offre + récap */}
        <div className="w-full lg:flex-1 min-w-0 flex flex-col gap-4">
          {/* Carte offre */}
          <div className="bg-neutral-50 border-2 rounded-xl p-4 flex flex-col gap-3" style={{ borderColor: startColor }}>
            <img src="/images/pbis-cta-laptop.jpg" alt="" className="w-[162px] h-[90px] object-cover mix-blend-multiply" />
            <div className="flex gap-3 items-center">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-white text-xs font-semibold" style={{ backgroundColor: startColor }}>Votre choix</span>
              <span className="flex-1 font-precision text-2xl leading-[28.8px] tracking-[-0.3px] text-neutral-950">PBIS Start</span>
            </div>
            <div className="flex gap-1 items-baseline">
              <span className="font-medium text-sm leading-5 text-neutral-950">15,00</span>
              <span className="text-xs leading-4 text-[#737373]">€ HT / mois</span>
              <div className="flex-1" />
              <span className="text-xs leading-4 text-[#737373]">12 mois</span>
            </div>
            <div className="h-px bg-neutral-200" />
            <p className="text-xs leading-4 text-[#737373]">
              1000 factures fournisseurs par an incluses. +0,5€/facture supplémentaire<br />
              Engagement 12 mois. Facturation en une fois.
            </p>
          </div>

          <p className="font-precision text-xl leading-6 tracking-[-0.3px] text-center text-neutral-950">
            Récapitulatif
          </p>

          {/* Bloc récap */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-2">
            <p className="font-semibold text-xs leading-4 text-neutral-950 py-1">Entreprise</p>
            <RecapRow label="Raison sociale" value={recap.companyName} />
            <RecapRow label="SIRET" value={recap.siret} />
            <RecapRow label="N° TVA" value={recap.vatNumber} />
            <RecapRow label="Adresse" value={[recap.billingStreet, `${recap.billingPostcode} ${recap.billingCity}`.trim()].filter(Boolean).join(", ")} />

            <div className="h-2" />
            <div className="flex gap-1 items-center py-1">
              <p className="font-semibold text-xs leading-4 text-neutral-950">Contact principal</p>
              <InfoTip color={startColor} text="Indiquez les coordonnées de l'utilisateur principal envisagé ou de l'administrateur de la solution. C'est l'email de ce contact qui sera utilisé pour la création de votre accès sur PBIS." />
            </div>
            <RecapRow label="Nom" value={contactFullName} />
            <RecapRow label="E-mail" value={recap.contactEmail} />
            <RecapRow label="Téléphone" value={recap.contactPhone} />
            <RecapRow label="Fonction" value={recap.contactFunction} />
            <RecapRow label="Rôle" value={recap.contactRole} />

            <div className="h-2" />
            <div className="flex gap-1 items-center py-1">
              <p className="font-semibold text-xs leading-4 text-neutral-950">E-mail de réception des factures fournisseurs</p>
              <InfoTip color={startColor} width="w-[240px]" text="Ceci est la boite email à laquelle vous recevrez les factures de vos fournisseurs lors de votre utilisation de PBIS." />
            </div>
            <RecapRow label="E-mail" value={recap.receptionEmail} />
          </div>
        </div>

        {/* Colonne droite : signataire + CGV + CTA */}
        <div className="w-full lg:flex-1 min-w-0 flex flex-col gap-4">
          {/* Signataire autorisé */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-3">
            <p className="font-semibold text-xs leading-4 text-neutral-950 pb-2">SIGNATAIRE AUTORISÉ</p>

            <label className="flex gap-4 items-center py-1 cursor-not-allowed opacity-50">
            <input
              type="checkbox"
              checked={false}
              disabled
              className="w-4 h-4"
              style={{ accentColor: startColor }}
            />
            <span className="font-semibold text-xs leading-4 text-neutral-950">Le contact principal est également le signataire</span>
          </label>

            <div className="h-px bg-neutral-200" />

            <div className="flex flex-col sm:flex-row gap-3">
              <SignField
                label="Prénom *"
                name="signatoryFirstName"
                icon={CircleUser}
                required
                value={sig.signatoryFirstName}
                onChange={setSigField("signatoryFirstName")}
              />
              <SignField
                label="Nom *"
                name="signatoryLastName"
                icon={CircleUser}
                required
                value={sig.signatoryLastName}
                onChange={setSigField("signatoryLastName")}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <SignField
                label="Fonction *"
                name="signatoryFunction"
                icon={Briefcase}
                required
                value={sig.signatoryFunction}
                onChange={setSigField("signatoryFunction")}
              />
              <SignField
                label="Téléphone *"
                name="signatoryPhone"
                icon={Smartphone}
                type="tel"
                required
                pattern="(\+33|0)\s?[1-9](\s?\d{2}){4}"
                title="Format attendu : 0612345678 ou +33 6 12 34 56 78"
                value={sig.signatoryPhone}
                onChange={setSigField("signatoryPhone")}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <SignField
                label="E-mail *"
                name="signatoryEmail"
                icon={Mail}
                type="email"
                required
                value={sig.signatoryEmail}
                onChange={setSigField("signatoryEmail")}
              />
              <SignField
                label="Référence de commande"
                name="orderReference"
                value={sig.orderReference}
                onChange={setSigField("orderReference")}
              />
            </div>

            <p className="text-xs leading-4 text-[#737373]">* champs obligatoires</p>
          </div>

          {/* Cases légales */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col gap-2">
            <label className="flex gap-4 items-center py-1 cursor-pointer">
              <input type="checkbox" name="habilitationAccepted" required className="w-4 h-4 shrink-0" style={{ accentColor: startColor }} />
              <span className="font-semibold text-xs leading-4 text-neutral-950">
                Le signataire reconnait être habilité à ratifier le contrat au nom et pour le compte de l'Abonné.
              </span>
            </label>
            <label className="flex gap-4 items-center py-1 cursor-pointer">
              <input type="checkbox" name="cgvAccepted" required className="w-4 h-4 shrink-0" style={{ accentColor: startColor }} />
              <span className="text-xs leading-4 text-neutral-950">
                J'accepte les <a href="https://www.pb.com/fr/servicessolutions" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold underline">CGV et Conditions Particulières</a> du contrat PBIS Start.
              </span>
            </label>
            <label className="flex gap-4 items-center py-1 cursor-pointer">
              <input type="checkbox" name="privacyAccepted" required className="w-4 h-4 shrink-0" style={{ accentColor: startColor }} />
              <span className="text-xs leading-4 text-neutral-950">
                J'accepte le traitement de mes données (<a href="https://www.pitneybowes.com/fr/mentionslegales/donneespersonnelles.html" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold underline">Politique de confidentialité</a>).
              </span>
            </label>
          </div>

          <p className="text-xs leading-4 text-[#404040]">
            En signant le présent contrat, l'Abonné manifeste avoir pris connaissance des conditions du présent contrat d'abonnement et des Conditions Générales (version FR - PBIS 05 2026) disponibles à l'adresse (<a href="https://www.pb.com/fr/servicessolutions" target="_blank" rel="noopener noreferrer" className="underline">pb.com/fr/servicessolutions</a>) et les accepter, y compris la clause attributive de juridiction.
          </p>

          {actionData?.error && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">
              {actionData.error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full cursor-pointer inline-flex items-center justify-center gap-2 rounded-full text-white px-8 py-3 font-medium text-base leading-6 hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-80"
              style={{ backgroundColor: startColor }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2.5} />
                  Préparation de votre contrat...
                </>
              ) : (
                "Signer le contrat"
              )}
            </button>
            <Link
              to="/pbis/start/informations"
              className={`inline-flex items-center justify-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors ${isSubmitting ? "pointer-events-none opacity-50" : ""}`}
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              Retour
            </Link>
          </div>
        </div>
      </div>
    </Form>
  );
}