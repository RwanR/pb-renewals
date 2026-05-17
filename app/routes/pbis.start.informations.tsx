import type { Route } from "./+types/pbis.start.informations";
import { Building2, Hash, MapPinned, Mailbox, CircleUser, Mail, Smartphone, Info, Check, type LucideIcon } from "lucide-react";
import { Fragment } from "react";
import { Link, useRouteLoaderData } from "react-router";
import type { loader as pbisLayoutLoader } from "./pbis";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Vos informations - PBIS Start" }];
}

function StepperWithCompleted({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex gap-1 items-center justify-center">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isActive = step === currentStep;
        const separatorBg = step <= currentStep ? "#00b44a" : "#d4d4d4";
        return (
          <Fragment key={step}>
            {i > 0 && <div className="w-2.5 h-px" style={{ background: separatorBg }} />}
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${isCompleted ? "bg-[#00b44a] text-white" : isActive ? "bg-[#171717] text-white" : "bg-[#d4d4d4] text-[#737373]"}`}>
              {isCompleted ? <Check className="w-3 h-3" strokeWidth={3} /> : step}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function Field({ label, icon: Icon, value, placeholder, disabled, type = "text" }: { label: string; icon: LucideIcon; value?: string; placeholder?: string; disabled?: boolean; type?: string }) {
  const bg = disabled ? "bg-neutral-100" : "bg-white";
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <label className="text-sm font-medium leading-5 text-neutral-950">{label}</label>
      <div className={`flex items-center gap-2 ${bg} border border-neutral-200 rounded-lg px-3 min-h-9 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]`}>
        <Icon className="w-4 h-4 shrink-0 text-neutral-500" strokeWidth={1.5} />
        <input type={type} defaultValue={value} placeholder={placeholder} disabled={disabled} className="flex-1 text-sm leading-5 text-neutral-950 placeholder:text-neutral-500 outline-none bg-transparent py-1.5 disabled:cursor-not-allowed" />
      </div>
    </div>
  );
}

export default function PbisStartInformations() {
  const layoutData = useRouteLoaderData<typeof pbisLayoutLoader>("routes/pbis");
  const client = layoutData?.client ?? null;

  // Parcours authentifié : champs entreprise verrouillés (données PB vérifiées).
  // Parcours anonyme : champs entreprise éditables (le prospect saisit tout).
  const isAuthenticated = client !== null;

  return (
    <div className="font-inter pb-16">
      <div className="flex flex-col gap-5 items-center justify-center pt-10 pb-2">
        <StepperWithCompleted currentStep={3} totalSteps={4} />
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
            value={client?.companyName}
            placeholder="Nom de votre entreprise"
            disabled={isAuthenticated}
          />
          <Field
            label="Numéro client"
            icon={Hash}
            value={client?.shipTo}
            placeholder="Non renseigné"
            disabled={isAuthenticated}
          />
          <div className="flex gap-4">
            <Field
              label="SIRET"
              icon={Hash}
              value={client?.siret}
              placeholder="14 chiffres"
              disabled={isAuthenticated}
            />
            <Field
              label="TVA"
              icon={Hash}
              value={client?.vatNumber ?? undefined}
              placeholder="N° TVA intracommunautaire"
            />
          </div>
          <Field
            label="Adresse de facturation"
            icon={MapPinned}
            value={client?.street}
            placeholder="Numéro et rue"
          />
          <div className="flex gap-3">
            <Field label="Code postal" icon={Mailbox} value={client?.postcode} placeholder="Code postal" />
            <Field label="Ville" icon={Building2} value={client?.city} placeholder="Ville" />
          </div>
        </div>

        {/* Contact principal */}
        <div className="w-[596px] bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex gap-3 items-center">
            <p className="font-semibold text-xs leading-4 text-neutral-950">CONTACT PRINCIPAL</p>
            <Info className="w-4 h-4 text-[#d7008f]" strokeWidth={1.5} />
          </div>
          <div className="flex gap-3">
            <Field label="Prénom" icon={CircleUser} value={client?.contactFirstName ?? undefined} placeholder="Prénom" />
            <Field label="Nom" icon={CircleUser} value={client?.contactLastName ?? undefined} placeholder="Nom" />
          </div>
          <div className="flex gap-3">
            <Field label="E-mail de contact" icon={Mail} value={client?.contactEmail ?? undefined} placeholder="email@entreprise.fr" type="email" />
            <Field label="Téléphone" icon={Smartphone} value={client?.contactPhone ?? undefined} placeholder="Téléphone" type="tel" />
          </div>
        </div>

        {/* E-mail de réception */}
        <div className="w-[596px] bg-white border border-[#9a44a1] rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex gap-1 items-center">
            <p className="text-sm font-medium leading-5 text-neutral-950">E-mail de réception de vos factures fournisseurs</p>
            <div className="relative group">
              <Info className="w-4 h-4 text-[#9a44a1] cursor-help" strokeWidth={1.5} />
              <div className="invisible group-hover:visible absolute left-6 top-0 z-10 w-[200px] bg-neutral-50 border border-neutral-200 rounded p-3 text-xs leading-4 text-neutral-950 shadow-lg">
                Ceci est la boite email à laquelle vous recevrez les factures de vos fournisseurs lors de votre utilisation de PBIS
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 min-h-9 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
            <Mail className="w-4 h-4 shrink-0 text-neutral-500" strokeWidth={1.5} />
            <input type="email" placeholder="email@entreprise.fr" defaultValue={client?.contactEmail ?? undefined} className="flex-1 text-sm leading-5 text-neutral-950 placeholder:text-neutral-500 outline-none bg-transparent py-1.5" />
          </div>
        </div>

        {/* CTA */}
        <div className="pt-4">
          <Link to="/pbis/start/recapitulatif" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d7008f] text-white px-8 py-3 font-medium text-base leading-6 hover:opacity-90 transition-opacity">
            Continuer vers le récapitulatif
          </Link>
        </div>
      </div>
    </div>
  );
}