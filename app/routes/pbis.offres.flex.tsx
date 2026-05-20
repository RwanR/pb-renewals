import type { Route } from "./+types/pbis.offres.flex";
import { ShieldUser, ClipboardCheck, ArrowBigUp, Unplug, MailCheck, FileText, ShieldCheck, Archive, ListChecks, Scale, TrendingUp, Globe, CircleUser, Mail, Smartphone, Check } from "lucide-react";
import { Fragment } from "react";
import { PBIS_OFFER_COLORS } from "~/lib/pbis-brand";

export function meta({}: Route.MetaArgs) {
  return [{ title: "PBIS Flex - Détail de l'offre" }];
}

const features = [
  { Icon: ShieldUser, text: "Accompagnement dédié" },
  { Icon: ClipboardCheck, text: "Gestion de tous les formats de factures clients et fournisseurs" },
  { Icon: ArrowBigUp, text: "Multiples modes de dépôt de factures" },
  { Icon: Unplug, text: "Connexions ERP" },
  { Icon: MailCheck, text: "Envoi multi-canal" },
  { Icon: FileText, text: "OCR et mapping de données" },
  { Icon: ShieldCheck, text: "Contrôles légaux et métiers" },
  { Icon: Archive, text: "Archivage légal pendant 10 ans" },
  { Icon: ListChecks, text: "Rapprochements factures / bons de commande / bons de réception" },
  { Icon: Scale, text: "Gestion des litiges" },
  { Icon: TrendingUp, text: "Imputation comptable" },
  { Icon: ListChecks, text: "Workflows de validation" },
  { Icon: TrendingUp, text: "Diagnostic de vos processus" },
  { Icon: ClipboardCheck, text: "Personnalisation des fonctionnalités au plus près de vos besoins" },
  { Icon: Globe, text: "Conformité internationale" },
];

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

export default function PbisOffresFlex() {
  const flexColor = PBIS_OFFER_COLORS.flex;

  return (
    <div className="font-inter">
      <div className="flex flex-col gap-5 items-center justify-center pt-10 pb-2">
        <StepperWithCompleted currentStep={2} totalSteps={4} />
        <h1 className="font-precision text-xl leading-6 tracking-[-0.3px] text-center text-neutral-950">
          Détail de l'offre
        </h1>
      </div>

      <div className="flex gap-6 items-start px-[72px] pb-16 pt-10 max-w-7xl mx-auto">
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <h2 className="font-precision text-3xl leading-9 tracking-[-0.5px] text-neutral-950">
            PBIS Flex permet d'adresser vos besoins métier et de conformité de manière personnalisée pour les factures clients et fournisseurs :
          </h2>

          <p className="text-lg leading-[27px] text-neutral-950">
            PBIS Flex vous propose une solution entièrement personnalisée, adaptée à vos processus métier et à vos obligations de conformité, notamment :
          </p>

          <div className="flex flex-col">
            {features.map(({ Icon, text }, i) => (
              <div key={`${text}-${i}`} className="flex gap-4 items-center py-3 border-b border-neutral-200">
                <div className="shrink-0 size-8 flex items-center justify-center">
                  <Icon className="w-7 h-7" style={{ color: flexColor }} strokeWidth={1.5} />
                </div>
                <p className="flex-1 text-sm leading-5 text-neutral-950">{text}</p>
              </div>
            ))}
          </div>

          <div className="rounded-md p-6 text-white mt-2" style={{ background: "linear-gradient(172deg, rgb(108,39,139) 0%, rgb(169,2,107) 50%, rgb(163,89,11) 100%)" }}>
            <p className="font-precision text-xl leading-6 tracking-[-0.3px]">
              Echangez avec notre équipe pour démarrer votre transition sans tarder.
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex justify-end">
          <div className="w-[363px] flex flex-col gap-8 sticky top-4">
            <div className="bg-neutral-50 border-2 rounded-xl p-4 flex flex-col gap-3" style={{ borderColor: flexColor }}>
              <img src="/images/pbis-cta-laptop.jpg" alt="" className="w-[162px] h-[90px] object-cover mix-blend-multiply" />
              <p className="font-precision text-2xl leading-[28.8px] tracking-[-0.3px] text-neutral-950">PBIS Flex</p>
              <p className="font-medium text-sm leading-5 text-neutral-950">Sur devis</p>
              <div className="h-px bg-neutral-200" />
              <p className="text-xs leading-4 text-[#737373]">Personnalisations métier - Accompagnement dédié</p>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="font-precision text-xl leading-6 tracking-[-0.3px] text-neutral-950">Être contacté par un conseiller</h3>
                <p className="text-xs leading-4 text-[#737373]">Nos équipes vous recontacteront sous 24h ouvrables</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium leading-5 text-neutral-950">Nom complet *</label>
                <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 min-h-9 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                  <CircleUser className="w-4 h-4 shrink-0 text-neutral-500" strokeWidth={1.5} />
                  <input type="text" placeholder="Jean Dupont" className="flex-1 text-sm leading-5 text-neutral-950 placeholder:text-neutral-500 outline-none bg-transparent py-1.5" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium leading-5 text-neutral-950">E-mail *</label>
                <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 min-h-9 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                  <Mail className="w-4 h-4 shrink-0 text-neutral-500" strokeWidth={1.5} />
                  <input type="email" placeholder="email@exemple.fr" className="flex-1 text-sm leading-5 text-neutral-950 placeholder:text-neutral-500 outline-none bg-transparent py-1.5" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium leading-5 text-neutral-950">Téléphone *</label>
                <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 min-h-9 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                  <Smartphone className="w-4 h-4 shrink-0 text-neutral-500" strokeWidth={1.5} />
                  <input type="tel" placeholder="05 61 03 80 04" className="flex-1 text-sm leading-5 text-neutral-950 placeholder:text-neutral-500 outline-none bg-transparent py-1.5" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium leading-5 text-neutral-950">Message</label>
                <textarea placeholder="Votre message" className="w-full text-sm leading-5 text-neutral-950 placeholder:text-neutral-500 outline-none bg-white border border-neutral-200 rounded-lg px-3 py-2 h-[76px] resize-y shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" />
              </div>

              <p className="text-xs leading-4 text-[#737373]">* champs obligatoires</p>

              <button type="button" className="w-full inline-flex items-center justify-center gap-2 rounded-full text-white px-8 py-3 font-medium text-base leading-6 hover:opacity-90 transition-opacity" style={{ backgroundColor: flexColor }}>
                Demander à être contacté
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}