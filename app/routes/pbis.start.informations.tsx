import type { Route } from "./+types/pbis.start.informations";
import { Building2, Hash, MapPinned, Mailbox, CircleUser, Mail, Smartphone, Info, Check, type LucideIcon } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router";

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
          <Field label="Raison sociale" icon={Building2} value="Commune de Montgailhard" disabled />
          <Field label="Numéro client" icon={Hash} value="666454-9" disabled />
          <div className="flex gap-4">
            <Field label="SIRET" icon={Hash} value="21090192100015" disabled />
            <Field label="TVA" icon={Hash} value="21090192100015" disabled />
          </div>
          <Field label="Adresse de facturation" icon={MapPinned} value="1 Place de la Mairie" />
          <div className="flex gap-3">
            <Field label="Code postal" icon={Mailbox} value="09330" />
            <Field label="Ville" icon={Building2} value="Montgailhard" />
          </div>
        </div>

        {/* Contact principal */}
        <div className="w-[596px] bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex gap-3 items-center">
            <p className="font-semibold text-xs leading-4 text-neutral-950">CONTACT PRINCIPAL</p>
            <Info className="w-4 h-4 text-[#d7008f]" strokeWidth={1.5} />
          </div>
          <div className="flex gap-3">
            <Field label="Prénom" icon={CircleUser} value="Jean" />
            <Field label="Nom" icon={CircleUser} value="Dupont" />
          </div>
          <div className="flex gap-3">
            <Field label="E-mail de contact" icon={Mail} value="mairemontgailhard@gmail.com" type="email" />
            <Field label="Téléphone" icon={Smartphone} value="05 61 03 80 04" type="tel" />
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
            <input type="email" defaultValue="comptagailhard@gmail.com" className="flex-1 text-sm leading-5 text-neutral-950 outline-none bg-transparent py-1.5" />
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