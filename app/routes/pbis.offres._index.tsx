import type { Route } from "./+types/pbis.offres._index";
import { Check, X } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router";
import { PBIS_OFFER_COLORS } from "~/lib/pbis-brand";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Nos offres — PBIS" }];
}

type OfferSlug = keyof typeof PBIS_OFFER_COLORS;

type Offer = {
  badge: string;
  slug: OfferSlug;
  title: string;
  description: string;
  features: { included: boolean; text: string }[];
  slot?: string;
  price: string;
  priceSuffix: string;
  ctaLabel: string;
};

const offers: Offer[] = [
  {
    badge: "Factures fournisseurs",
    slug: "start",
    title: "PBIS Start",
    description: "L'offre idéale pour vous conformer rapidement aux obligations de la facturation fournisseurs",
    features: [
      { included: true, text: "Inscription à l'Annuaire de l'État" },
      { included: true, text: "Réception des factures en pdf par e-mail" },
      { included: true, text: "Conformité en 2 clics" },
      { included: false, text: "N'inclut pas vos factures client" },
    ],
    slot: "1000 factures fournisseurs par an incluses\nEngagement 12 mois",
    price: "15,00",
    priceSuffix: "€ HT / mois",
    ctaLabel: "Souscrire en ligne",
  },
  {
    badge: "Factures clients et fournisseurs",
    slug: "essentiel",
    title: "PBIS Essentiel",
    description: "L'offre complète pour digitaliser vos factures clients et fournisseurs",
    features: [
      { included: true, text: "Toutes les fonctionnalités PBIS Start" },
      { included: true, text: "Facturation clients conforme" },
      { included: true, text: "Optimisation de vos processus métiers" },
      { included: true, text: "Accompagnement de démarrage" },
      { included: false, text: "Pas de personnalisations métier" },
    ],
    price: "à partir de 40,00",
    priceSuffix: "€ HT / mois",
    ctaLabel: "Nous contacter",
  },
  {
    badge: "Sur mesure",
    slug: "flex",
    title: "PBIS Flex",
    description: "L'offre sur mesure pour répondre à vos besoins métier, avec un accompagnement dédié",
    features: [
      { included: true, text: "Toutes les fonctionnalités PBIS Essentiel" },
      { included: true, text: "Personnalisations métier" },
      { included: true, text: "Connexion ERP" },
      { included: true, text: "100% des cas d'usage" },
      { included: true, text: "Conformité internationale" },
      { included: true, text: "Chef de projet dédié" },
    ],
    price: "Sur devis",
    priceSuffix: "",
    ctaLabel: "Nous contacter",
  },
];

function Stepper({ activeStep, totalSteps }: { activeStep: number; totalSteps: number }) {
  return (
    <div className="flex gap-1 items-center justify-center">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const step = i + 1;
        const isActive = step === activeStep;
        return (
          <Fragment key={step}>
            {i > 0 && <div className="w-2.5 h-px bg-[#d4d4d4]" />}
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${isActive ? 'bg-[#171717] text-white' : 'bg-[#d4d4d4] text-[#737373]'}`}>
              {step}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function OfferCard({ offer }: { offer: Offer }) {
  const color = PBIS_OFFER_COLORS[offer.slug];
  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl p-6 gap-4 h-[453px] border border-[#d4d4d4] transition-all duration-200 cursor-pointer hover:border-[var(--accent)] hover:shadow-[inset_0_0_0_1px_var(--accent)]" style={{ "--accent": color } as React.CSSProperties}>
      <div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-white text-xs font-semibold" style={{ backgroundColor: color }}>
          {offer.badge}
        </span>
      </div>

      <h2 className="font-precision text-3xl leading-9 tracking-[-0.5px] text-neutral-950">
        {offer.title}
      </h2>

      <p className="text-sm leading-5 text-neutral-950">{offer.description}</p>

      <div className="flex flex-col gap-1">
        {offer.features.map((feature, i) => (
          <div key={i} className="flex gap-2 items-center">
            {feature.included ? (
              <Check className="w-5 h-5 shrink-0 text-green-600" strokeWidth={2} />
            ) : (
              <X className="w-5 h-5 shrink-0 text-neutral-400" strokeWidth={2} />
            )}
            <p className="flex-1 text-sm leading-5 text-neutral-950">{feature.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        {offer.slot && (
          <p className="text-xs leading-4 text-[#737373] whitespace-pre-line">{offer.slot}</p>
        )}
        <div className="flex gap-1 items-baseline">
          <span className="font-medium text-lg leading-[27px] text-neutral-950">{offer.price}</span>
          {offer.priceSuffix && (
            <span className="text-sm leading-5 text-[#737373]">{offer.priceSuffix}</span>
          )}
        </div>
        <Link to={`/pbis/offres/${offer.slug}`} className="w-full inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-white font-medium text-base leading-6 hover:opacity-90 transition-opacity" style={{ backgroundColor: color }}>
          {offer.ctaLabel}
        </Link>
      </div>
    </div>
  );
}

export default function PbisOffres() {
  return (
    <div className="font-inter">
      <div className="flex flex-col gap-5 items-center justify-center pt-10 pb-2">
        <Stepper activeStep={1} totalSteps={4} />
        <h1 className="font-precision text-2xl leading-[28.8px] tracking-[-0.3px] text-center text-neutral-950">
          Nos offres facturation électronique
        </h1>
      </div>

      <div className="text-center pb-10 px-4">
        <p className="text-sm leading-5 text-[#737373]">
          Choisissez votre abonnement parmi nos 3 offres Pitney Bowes Invoice Services (PBIS)
        </p>
      </div>

      <div className="flex gap-6 items-start px-8 pb-16 max-w-7xl mx-auto">
        {offers.map((offer) => (
          <OfferCard key={offer.title} offer={offer} />
        ))}
      </div>
    </div>
  );
}