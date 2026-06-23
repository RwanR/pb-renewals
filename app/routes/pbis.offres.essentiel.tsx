import type { Route } from "./+types/pbis.offres.essentiel";
import { AtSign, Inbox, FileText, ClipboardCheck, ArrowBigUp, MailCheck, Archive, ShieldCheck, ListChecks, Mail, TrendingUp, Check, ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Fragment } from "react";
import { PBIS_OFFER_COLORS } from "~/lib/pbis-brand";
import { submitPbisLead } from "~/lib/pbis-lead.server";
import { LeadForm } from "~/components/pbis-lead-form";

export function meta({}: Route.MetaArgs) {
  return [{ title: "PBIS Essentiel - Détail de l'offre" }];
}

export async function action({ request }: Route.ActionArgs) {
  const fd = await request.formData();
  const g = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  return submitPbisLead({
    offer: "Essentiel",
    fullName: g("fullName"),
    email: g("email"),
    phone: g("phone"),
    message: g("message"),
  });
}

const features = [
  { Icon: AtSign, text: "Inscription à l'Annuaire de l'Administration fiscale" },
  { Icon: Inbox, text: "Réception de toutes les factures tous formats confondus, sur le portail PBIS et sur la boite e-mail de votre choix" },
  { Icon: FileText, text: "OCR pour extraction des données des factures en PDF" },
  { Icon: ClipboardCheck, text: "Création et envoi de factures clients dans divers formats: PDF, CSV, formats de la réforme" },
  { Icon: ArrowBigUp, text: "Chargement via interface PBIS ou sFTP" },
  { Icon: MailCheck, text: "Envoi multi-canal : Plateforme Agréée, e-mail certifié, Chorus Pro, courrier papier" },
  { Icon: Mail, text: "Mise à jour des statuts de factures" },
  { Icon: Archive, text: "Archivage légal pendant 10 ans" },
  { Icon: ShieldCheck, text: "Protection contre la fraude" },
  { Icon: ListChecks, text: "Circuit de validation des factures fournisseurs" },
  { Icon: TrendingUp, text: "Indicateurs financiers" },
];

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

export default function PbisOffresEssentiel({ actionData }: Route.ComponentProps) {
  const essentielColor = PBIS_OFFER_COLORS.essentiel;

  return (
    <div className="font-inter">
      <div className="flex flex-col gap-5 items-center justify-center pt-10 pb-2">
       <StepperWithCompleted currentStep={2} totalSteps={4} routes={["/pbis/offres"]} />
        <h1 className="font-precision text-xl leading-6 tracking-[-0.3px] text-center text-neutral-950">
          Détail de l'offre
        </h1>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-[72px] pt-6">
        <Link to="/pbis/offres" className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Retour aux offres
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:items-start px-4 sm:px-8 lg:px-[72px] pb-16 pt-10 max-w-7xl mx-auto">
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
                  <Icon className="w-7 h-7" style={{ color: essentielColor }} strokeWidth={1.5} />
                </div>
                <p className="flex-1 text-sm leading-5 text-neutral-950">{text}</p>
              </div>
            ))}
          </div>

          <div className="rounded-md p-6 text-white mt-2" style={{ background: "linear-gradient(173deg, rgb(108,39,139) 0%, rgb(169,2,107) 50%, rgb(163,89,11) 100%)" }}>
            <p className="font-precision text-xl leading-6 tracking-[-0.3px]">
              Echangez avec notre équipe pour démarrer votre transition sans tarder.
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex justify-center lg:justify-end">
          <div className="w-full max-w-[363px] flex flex-col gap-8 lg:sticky lg:top-4">
            <div className="bg-neutral-50 border-2 rounded-xl p-4 flex flex-col gap-3" style={{ borderColor: essentielColor }}>
              <img src="/images/pbis-cta-laptop.jpg" alt="" className="w-[162px] h-[90px] object-cover mix-blend-multiply" />
              <p className="font-precision text-2xl leading-[28.8px] tracking-[-0.3px] text-neutral-950">PBIS Essentiel</p>
              <div className="flex gap-1 items-baseline">
                <span className="font-medium text-sm leading-5 text-neutral-950">à partir de 40,00</span>
                <span className="text-xs leading-4 text-[#737373]">€ HT / mois</span>
              </div>
              <div className="h-px bg-neutral-200" />
              <p className="text-xs leading-4 text-[#737373]">Facturation clients et fournisseurs - Optimisations métier</p>
            </div>

            <LeadForm color={essentielColor} actionData={actionData} />
          </div>
        </div>
      </div>
    </div>
  );
}