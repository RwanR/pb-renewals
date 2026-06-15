import type { Route } from "./+types/pbis.offres.start";
import { AtSign, Inbox, FileText, Archive, ListChecks, ClipboardCheck, FileQuestion, Check, ArrowLeft } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router";
import { PBIS_OFFER_COLORS } from "~/lib/pbis-brand";
import { getSessionShipTo } from "~/lib/pbis-session.server";
import { trackStep } from "~/lib/pbis-funnel.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "PBIS Start - Détail de l'offre" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const shipTo = await getSessionShipTo(request);
  if (shipTo) await trackStep(shipTo, "detail");
  return null;
}

const features = [
  { Icon: AtSign, title: "Inscription à l'Annuaire", description: "Inscrire votre société dans l'Annuaire de l'Administration fiscale pour recevoir vos factures et éviter les sanctions de non-inscription." },
  { Icon: Inbox, title: "Récupérer vos factures", description: "Récupérer les factures reçues, non seulement sur le portail PBIS mais également sur la boite e-mail de votre choix." },
  { Icon: FileText, title: "Visualiser en PDF", description: "Visualiser une version lisible (PDF) de toutes les factures, en plus du format dans lequel elles arrivent initialement. Aucune disruption de vos processus : vous continuez à recevoir vos factures dans un format lisible sur votre e-mail habituel, tout en vous mettant en conformité avec la nouvelle loi." },
  { Icon: Archive, title: "Archivage légal 10 ans", description: "Archiver légalement pendant 10 ans les factures et pièces jointes reçues." },
  { Icon: ListChecks, title: "Gestion des statuts", description: "Gérer la mise à jour des statuts de facture exigés par la réforme." },
];

const includedItems = [
  { Icon: ClipboardCheck, title: "Mise en conformité", sub: "des factures fournisseurs" },
  { Icon: FileText, title: "Réception en PDF", sub: "sur votre boite e-mail" },
  { Icon: Archive, title: "Archivage légal", sub: "10 ans" },
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

export default function PbisOffresStart() {
  const startColor = PBIS_OFFER_COLORS.start;
  const essentielColor = PBIS_OFFER_COLORS.essentiel;
  const flexColor = PBIS_OFFER_COLORS.flex;

  return (
    <div className="font-inter">
      <div className="flex flex-col gap-5 items-center justify-center pt-10 pb-2">
        <StepperWithCompleted currentStep={2} totalSteps={4} routes={["/pbis/offres"]} />
        <h1 className="font-precision text-xl leading-6 tracking-[-0.3px] text-center text-neutral-950">
          Détail de l'offre
        </h1>
      </div>

      <div className="max-w-7xl mx-auto px-[72px] pt-6">
        <Link to="/pbis/offres" className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Retour aux offres
        </Link>
      </div>

      <div className="flex gap-6 items-start px-[72px] pb-16 pt-10 max-w-7xl mx-auto">
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <h2 className="font-precision text-3xl leading-9 tracking-[-0.5px] text-neutral-950">
            Recevez vos factures fournisseurs par <span className="whitespace-nowrap">e-mail</span> après le 1er Septembre
          </h2>

          <p className="text-lg leading-[27px] text-neutral-950">
            PBIS Start vous permet de vous mettre en conformité vis-à-vis de l'obligation de réception des factures fournisseurs du 1er Septembre 2026, et notamment de :
          </p>

          <div className="flex flex-col">
            {features.map(({ Icon, title, description }) => (
              <div key={title} className="flex gap-4 items-start pr-4 py-4 border-b border-neutral-200">
                <div className="shrink-0 size-8 flex items-center justify-center">
                  <Icon className="w-7 h-7" style={{ color: startColor }} strokeWidth={1.5} />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <p className="text-sm font-semibold leading-5 text-neutral-950">{title}</p>
                  <p className="text-sm leading-5 text-neutral-950">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md p-6 text-white" style={{ background: "linear-gradient(170deg, rgb(108,39,139) 0%, rgb(169,2,107) 50%, rgb(163,89,11) 100%)" }}>
            <p className="font-precision text-xl leading-6 tracking-[-0.3px]">
              Mettez-vous en conformité en 2 clics tout en continuant à traiter vos factures fournisseurs comme aujourd'hui !
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm leading-5 text-neutral-950">
              PBIS Start a pour vocation de gérer la facturation fournisseur - nous pouvons toutefois vous accompagner dès aujourd'hui également sur la facturation client avec{" "}
              <Link to="/pbis/offres/essentiel" className="font-medium hover:underline" style={{ color: essentielColor }}>PBIS Essentiel →</Link>
            </p>
            <p className="text-sm leading-5 text-neutral-950">
              Si votre entreprise a plus de 250 salariés et/ou génère plus de 50M€ de CA annuel, l'offre PBIS Start ne sera pas suffisante car l'obligation d'émission de factures s'applique dès Septembre 2026, nous vous recommandons dans ce cas une offre{" "}
              <Link to="/pbis/offres/flex" className="font-medium hover:underline" style={{ color: flexColor }}>PBIS Flex →</Link>
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex justify-end">
          <div className="w-[363px] flex flex-col gap-8 sticky top-4">
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
                <p className="text-xs leading-4 text-[#737373]">1000 factures fournisseurs/an incluses</p>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 flex flex-col gap-3">
                <h3 className="font-precision text-xl leading-6 tracking-[-0.3px] text-neutral-950 pb-2">Ce qui est inclus</h3>
                {includedItems.map(({ Icon, title, sub }) => (
                <div key={title} className="flex gap-3 items-center">
                    <Icon className="w-5 h-5 shrink-0" style={{ color: startColor }} strokeWidth={1.5} />
                    <div className="flex-1 flex flex-col gap-0.5">
                    <p className="text-sm font-medium leading-5 text-neutral-950">{title}</p>
                    <p className="text-xs leading-4 text-[#737373]">{sub}</p>
                    </div>
                </div>
                ))}
            </div>

            <Link to="/pbis/start/informations" className="w-full inline-flex items-center justify-center gap-2 rounded-full text-white px-8 py-3 font-medium text-base leading-6 hover:opacity-90 transition-opacity" style={{ backgroundColor: startColor }}>
                Souscrire en ligne
            </Link>

            <div
                role="button"
                tabIndex={0}
                onClick={() => window.SnapEngage?.startLink()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.SnapEngage?.startLink(); } }}
                className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 flex gap-3 items-center cursor-pointer hover:border-neutral-300 transition-colors"
            >
                <FileQuestion className="w-5 h-5 shrink-0" style={{ color: startColor }} strokeWidth={1.5} />
                <div className="flex-1 flex flex-col gap-0.5">
                <p className="text-sm font-medium leading-5 text-neutral-950">Besoin d'aide ?</p>
                <p className="text-xs leading-4 text-[#737373]">Nous contacter</p>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}