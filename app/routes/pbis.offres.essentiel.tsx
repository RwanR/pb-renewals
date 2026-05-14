import type { Route } from "./+types/pbis.offres.essentiel";
import { AtSign, Inbox, FileText, ClipboardCheck, ArrowBigUp, MailCheck, Archive, ShieldCheck, ListChecks, Mail, TrendingUp, CircleUser, Smartphone, Check } from "lucide-react";
import { Fragment } from "react";

export function meta({}: Route.MetaArgs) {
  return [{ title: "PBIS Essentiel - Détail de l'offre" }];
}

const features = [
  { Icon: AtSign, text: "Inscription à l'Annuaire de l'Administration fiscale" },
  { Icon: Inbox, text: "Réception de toutes les factures tous formats confondus, sur le portail PBIS et sur la boite e-mail de votre choix" },
  { Icon: FileText, text: "OCR pour extraction des données des factures en PDF" },
  { Icon: ClipboardCheck, text: "Création et envoi de factures clients dans divers formats: PDF, CSV, aux formats de la réforme" },
  { Icon: ArrowBigUp, text: "Chargement via interface PBIS ou sFTP" },
  { Icon: MailCheck, text: "Envoi multi-canal : Plateforme Agréée, e-mail certifié, Chorus Pro, courrier papier" },
  { Icon: Archive, text: "Archivage légal pendant 10 ans" },
  { Icon: ShieldCheck, text: "Protection contre la fraude" },
  { Icon: ListChecks, text: "Circuit de validation des factures fournisseurs" },
  { Icon: Mail, text: "Mise à jour des statuts de factures" },
  { Icon: TrendingUp, text: "Indicateurs financiers" },
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

export default function PbisOffresEssentiel() {
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
            PBIS Essentiel permet d'adresser vos besoins métier et de mise en conformité des factures clients et fournisseurs :
          </h2>

          <p className="text-lg leading-[27px] text-neutral-950">
            PBIS Essentiel vous permet d'adresser vos besoins de conformité et d'optimiser vos processus de facturation clients et fournisseurs, notamment :
          </p>

          <div className="flex flex-col">
            {features.map(({ Icon, text }) => (
              <div key={text} className="flex gap-4 items-center py-3 border-b border-neutral-200">
                <div className="shrink-0 size-8 flex items-center justify-center">
                  <Icon className="w-7 h-7 text-[#0092db]" strokeWidth={1.5} />
                </div>
                <p className="flex-1 text-sm leading-5 text-neutral-950">{text}</p>
              </div>
            ))}
          </div>

          <div className="rounded-md p-6 text-white mt-2" style={{ background: "linear-gradient(173deg, rgb(108,39,139) 0%, rgb(169,2,107) 50%, rgb(163,89,11) 100%)" }}>
            <p className="font-precision text-xl leading-6 tracking-[-0.3px]">
              Lorem texte chapo
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex justify-end">
          <div className="w-[363px] flex flex-col gap-8 sticky top-4">
            <div className="bg-neutral-50 border-2 border-[#6c278b] rounded-xl p-4 flex flex-col gap-3">
              <img src="/images/pbis-cta-laptop.jpg" alt="" className="w-[162px] h-[90px] object-cover mix-blend-multiply" />
              <p className="font-precision text-2xl leading-[28.8px] tracking-[-0.3px] text-neutral-950">PBIS Essentiel</p>
              <div className="flex gap-1 items-baseline">
                <span className="font-medium text-sm leading-5 text-neutral-950">à partir de 40,00</span>
                <span className="text-xs leading-4 text-[#737373]">€ HT / mois</span>
              </div>
              <div className="h-px bg-neutral-200" />
              <p className="text-xs leading-4 text-[#737373]">Facturation clients et fournisseurs - Optimisations métier</p>
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

              <button type="button" className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#0092db] text-white px-8 py-3 font-medium text-base leading-6 hover:opacity-90 transition-opacity">
                Demander à être contacté
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}