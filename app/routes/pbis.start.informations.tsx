import type { Route } from "./+types/pbis.start.informations";
import { Building2, Hash, MapPinned, Mailbox, CircleUser, Mail, Smartphone, Briefcase, Info, Check, ArrowLeft, type LucideIcon } from "lucide-react";
import { Fragment, type ChangeEvent } from "react";
import { Form, redirect, useRouteLoaderData, Link } from "react-router";
import { randomUUID } from "node:crypto";
import pbisDb from "~/db.pbis.server";
import { getPbisSession, commitPbisSession, getSessionShipTo } from "~/lib/pbis-session.server";
import { PBIS_OFFER_COLORS, CONTACT_FUNCTIONS } from "~/lib/pbis-brand";
import { useSessionState } from "~/lib/use-session-state";
import type { loader as pbisLayoutLoader } from "./pbis";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Vos informations - PBIS Start" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const shipTo = await getSessionShipTo(request);

  if (shipTo) {
    const acceptance = await pbisDb.pbisAcceptance.findUnique({
      where: { clientId: shipTo },
      select: { signedAt: true },
    });

    if (acceptance?.signedAt) {
      return redirect("/pbis/start/confirmation");
    }
  }

  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const f = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };

  const companyName = f("companyName");
  const siret = f("siret");
  const vatNumber = f("vatNumber");
  const billingStreet = f("billingStreet");
  const billingPostcode = f("billingPostcode");
  const billingCity = f("billingCity");
  const contactFirstName = f("contactFirstName");
  const contactLastName = f("contactLastName");
  const contactEmail = f("contactEmail");
  const contactPhone = f("contactPhone");
  const contactFunction = f("contactFunction");
  const receptionEmail = f("receptionEmail");

  // Résolution du client : session existante ou création à la volée (prospect anonyme)
  let shipTo = await getSessionShipTo(request);

  if (!shipTo) {
    // Prospect sans lien : on matérialise un PbisClient avec une PK PROSPECT-<uuid>
    shipTo = `PROSPECT-${randomUUID()}`;
    await pbisDb.pbisClient.create({
      data: {
        shipTo,
        compteClientBillTo: shipTo,
        soldTo: shipTo,
        companyName: companyName ?? "",
        street: billingStreet ?? "",
        postcode: billingPostcode ?? "",
        city: billingCity ?? "",
        siren: "",
        siret: siret ?? "",
        vatNumber,
        contactFirstName,
        contactLastName,
        contactEmail,
        contactPhone,
      },
    });
  }

  // Upsert du draft d'acceptance (clientId @unique : upsert, jamais create)
  await pbisDb.pbisAcceptance.upsert({
    where: { clientId: shipTo },
    create: {
      clientId: shipTo,
      offerCode: "START",
      status: "draft",
      companyName,
      siret,
      vatNumber,
      billingStreet,
      billingPostcode,
      billingCity,
      contactFirstName,
      contactLastName,
      contactEmail,
      contactPhone,
      contactFunction,
      receptionEmail,
    },
    update: {
      offerCode: "START",
      companyName,
      siret,
      vatNumber,
      billingStreet,
      billingPostcode,
      billingCity,
      contactFirstName,
      contactLastName,
      contactEmail,
      contactPhone,
      contactFunction,
      receptionEmail,
    },
  });

  // Persiste le shipTo en session (utile surtout pour le prospect créé à la volée)
  const session = await getPbisSession(request);
  session.set("shipTo", shipTo);

  return redirect("/pbis/start/recapitulatif", {
    headers: { "Set-Cookie": await commitPbisSession(session) },
  });
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

function Field({ label, icon: Icon, name, value, onChange, placeholder, disabled, required, type = "text" }: { label: string; icon: LucideIcon; name: string; value?: string; onChange?: (e: ChangeEvent<HTMLInputElement>) => void; placeholder?: string; disabled?: boolean; required?: boolean; type?: string }) {
  const bg = disabled ? "bg-neutral-100" : "bg-white";
  const controlled = onChange !== undefined;
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <label className="text-sm font-medium leading-5 text-neutral-950">{label}</label>
      <div className={`flex items-center gap-2 ${bg} border border-neutral-200 rounded-lg px-3 min-h-9 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]`}>
        <Icon className="w-4 h-4 shrink-0 text-neutral-500" strokeWidth={1.5} />
        <input
          name={name}
          type={type}
          {...(controlled ? { value: value ?? "", onChange } : { defaultValue: value })}
          placeholder={placeholder}
          disabled={disabled}
          required={required && !disabled}
          className="flex-1 text-sm leading-5 text-neutral-950 placeholder:text-neutral-500 outline-none bg-transparent py-1.5 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

function FunctionSelect({ value, onChange }: { value: string; onChange: (e: ChangeEvent<HTMLSelectElement>) => void }) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-sm font-medium leading-5 text-neutral-950">Fonction</label>
      <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 min-h-9 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
        <Briefcase className="w-4 h-4 shrink-0 text-neutral-500" strokeWidth={1.5} />
        <select
          name="contactFunction"
          value={value}
          onChange={onChange}
          className="flex-1 text-sm leading-5 text-neutral-950 outline-none bg-transparent py-1.5 cursor-pointer"
        >
          <option value="" disabled>Sélectionner une fonction</option>
          {CONTACT_FUNCTIONS.map((label) => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function PbisStartInformations() {
  const layoutData = useRouteLoaderData<typeof pbisLayoutLoader>("routes/pbis");
  const client = layoutData?.client ?? null;
  const startColor = PBIS_OFFER_COLORS.start;

  // Parcours authentifié : champs entreprise verrouillés (données PB vérifiées).
  // Parcours anonyme : champs entreprise éditables (le prospect saisit tout).
  const isAuthenticated = client !== null;

  // Persistance par onglet des champs éditables, scopée sur le client.
  // Les champs verrouillés (raison sociale, n° client, SIRET, TVA) ne sont pas
  // persistés : ils ne changent pas et se re-pré-remplissent depuis le loader.
  const [form, setForm] = useSessionState(`pbis-start-infos-${client?.compteClientBillTo ?? "anon"}`, {
    billingStreet: client?.street ?? "",
    billingPostcode: client?.postcode ?? "",
    billingCity: client?.city ?? "",
    contactFirstName: client?.contactFirstName ?? "",
    contactLastName: client?.contactLastName ?? "",
    contactEmail: client?.contactEmail ?? "",
    contactPhone: client?.contactPhone ?? "",
    contactFunction: "",
    receptionEmail: client?.contactEmail ?? "",
  });
  const set = (key: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <Form method="post" className="font-inter pb-16">
      <div className="flex flex-col gap-5 items-center justify-center pt-10 pb-2">
        <StepperWithCompleted currentStep={3} totalSteps={4} routes={["/pbis/offres", "/pbis/offres/start"]} />
        <h1 className="font-precision text-xl leading-6 tracking-[-0.3px] text-center text-neutral-950">
          Vos informations
        </h1>
      </div>

      <div className="flex flex-col gap-6 items-center pt-10 px-8">
        {/* Entreprise */}
        <div className="w-[596px] bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-4">
          <p className="font-semibold text-xs leading-4 text-neutral-950">ENTREPRISE</p>
          <Field
            label="Raison sociale"
            icon={Building2}
            name="companyName"
            value={client?.companyName}
            placeholder="Nom de votre entreprise"
            disabled={isAuthenticated}
            required
          />
          <Field
            label="Numéro client"
            icon={Hash}
            name="shipTo"
            value={client?.compteClientBillTo}
            placeholder="Non renseigné"
            disabled={isAuthenticated}
          />
          <Field
            label="SIRET"
            icon={Hash}
            name="siret"
            value={client?.siret}
            placeholder="14 chiffres"
            disabled={isAuthenticated}
            required
          />
          <Field
            label="Numéro de TVA"
            icon={Hash}
            name="vatNumber"
            value={client?.vatNumber ?? undefined}
            placeholder="FR + 11 chiffres"
            disabled={isAuthenticated}
          />
          <Field
            label="Adresse de facturation"
            icon={MapPinned}
            name="billingStreet"
            value={form.billingStreet}
            onChange={set("billingStreet")}
            placeholder="Numéro et rue"
            required
          />
          <div className="flex gap-3">
            <Field label="Code postal" icon={Mailbox} name="billingPostcode" value={form.billingPostcode} onChange={set("billingPostcode")} placeholder="Code postal" required />
            <Field label="Ville" icon={Building2} name="billingCity" value={form.billingCity} onChange={set("billingCity")} placeholder="Ville" required />
          </div>
        </div>

        {/* Contact principal */}
        <div className="w-[596px] bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex gap-1 items-center">
            <p className="font-semibold text-xs leading-4 text-neutral-950">CONTACT PRINCIPAL</p>
            <div className="relative group">
              <Info className="w-4 h-4 cursor-help" style={{ color: startColor }} strokeWidth={1.5} />
              <div className="invisible group-hover:visible absolute left-6 top-0 z-10 w-[280px] bg-neutral-50 border border-neutral-200 rounded p-3 text-xs leading-4 text-neutral-950 shadow-lg">
                Indiquez les coordonnées de l'utilisateur principal envisagé ou de l'administrateur de la solution. C'est l'email de ce contact qui sera utilisé pour la création de votre accès sur PBIS.
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Field label="Prénom" icon={CircleUser} name="contactFirstName" value={form.contactFirstName} onChange={set("contactFirstName")} placeholder="Prénom" required />
            <Field label="Nom" icon={CircleUser} name="contactLastName" value={form.contactLastName} onChange={set("contactLastName")} placeholder="Nom" required />
          </div>
          <div className="flex gap-3">
            <Field label="E-mail de contact" icon={Mail} name="contactEmail" value={form.contactEmail} onChange={set("contactEmail")} placeholder="email@entreprise.fr" type="email" required />
            <Field label="Téléphone" icon={Smartphone} name="contactPhone" value={form.contactPhone} onChange={set("contactPhone")} placeholder="Téléphone" type="tel" />
          </div>
          <FunctionSelect value={form.contactFunction} onChange={set("contactFunction")} />
        </div>

        {/* E-mail de réception */}
        <div className="w-[596px] bg-white border-2 rounded-2xl p-5 flex flex-col gap-3" style={{ borderColor: startColor }}>
          <div className="flex gap-1 items-center">
            <p className="text-sm font-medium leading-5 text-neutral-950">E-mail de réception de vos factures fournisseurs</p>
            <div className="relative group">
              <Info className="w-4 h-4 cursor-help" style={{ color: startColor }} strokeWidth={1.5} />
              <div className="invisible group-hover:visible absolute left-6 top-0 z-10 w-[200px] bg-neutral-50 border border-neutral-200 rounded p-3 text-xs leading-4 text-neutral-950 shadow-lg">
                Ceci est la boite email à laquelle vous recevrez les factures de vos fournisseurs lors de votre utilisation de PBIS.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 min-h-9 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
            <Mail className="w-4 h-4 shrink-0 text-neutral-500" strokeWidth={1.5} />
            <input name="receptionEmail" type="email" required placeholder="comptafournisseur@entreprise.com" value={form.receptionEmail} onChange={set("receptionEmail")} className="flex-1 text-sm leading-5 text-neutral-950 placeholder:text-neutral-500 outline-none bg-transparent py-1.5" />
          </div>
        </div>

        {/* CTA */}
        <div className="pt-4 flex items-center gap-3">
          <Link to="/pbis/offres/start" className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 text-neutral-700 px-6 py-3 font-medium text-base leading-6 hover:bg-neutral-50 transition-colors">
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            Retour
          </Link>
          <button type="submit" className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-full text-white px-8 py-3 font-medium text-base leading-6 hover:opacity-90 transition-opacity" style={{ backgroundColor: startColor }}>
            Continuer vers le récapitulatif
          </button>
        </div>
      </div>
    </Form>
  );
}