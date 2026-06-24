import type { Route } from "./+types/pbis.start.confirmation";
import { CircleCheckBig, Download } from "lucide-react";
import { redirect, Link } from "react-router";
import pbisDb from "~/db.pbis.server";
import { getSessionShipTo } from "~/lib/pbis-session.server";
import { PBIS_OFFER_COLORS } from "~/lib/pbis-brand";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Félicitations - PBIS Start" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const shipTo = await getSessionShipTo(request);
  if (!shipTo) return redirect("/pbis");

  const acceptance = await pbisDb.pbisAcceptance.findUnique({
    where: { clientId: shipTo },
  });

  if (!acceptance) return redirect("/pbis");

  // Garde-fou : accès uniquement si la signature a été initiée.
  // signedAt peut être null si le webhook Yousign n'a pas encore tapé — on affiche la page sans bloquer.
  if (!acceptance.yousignProcedureId) {
    return redirect("/pbis/start/recapitulatif");
  }

  return { reference: shipTo };
}

export default function PbisStartConfirmation({ loaderData }: Route.ComponentProps) {
  const { reference } = loaderData;
  const startColor = PBIS_OFFER_COLORS.start;

  return (
    <div className="font-inter pb-16 flex flex-col items-center gap-6 pt-12 px-4 sm:px-8">
      <CircleCheckBig className="w-8 h-8" style={{ color: "#009DBF" }} strokeWidth={1.5} />

      <h1 className="font-precision text-2xl leading-[28.8px] font-semibold text-center text-neutral-950">
        Félicitations !
      </h1>

      <p className="text-sm leading-5 text-center text-neutral-950">
        Votre contrat PBIS Start a été signé avec succès.
      </p>

      <p className="text-sm leading-5 text-center text-neutral-950 max-w-[596px]">
        Nous allons maintenant créer votre interface et revenir prochainement vers vous pour vous communiquer vos accès.
      </p>

      {/* Carte récap offre */}
      <div className="bg-neutral-50 border-2 rounded-xl p-4 flex flex-col gap-3 w-full max-w-[596px]" style={{ borderColor: startColor }}>
        <div className="flex items-start gap-3 w-full">
          <img src="/images/pbis-cta-laptop.jpg" alt="" className="w-[162px] h-[90px] object-cover mix-blend-multiply" />
          <div className="flex-1" />
          <div className="flex flex-col text-right">
            <span className="text-sm leading-5 text-[#737373]">Référence</span>
            <span className="text-sm leading-5 font-medium text-neutral-950">{reference}</span>
          </div>
        </div>

        <span className="font-precision text-2xl leading-[28.8px] tracking-[-0.3px] text-neutral-950">PBIS Start</span>

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

      {/* CTA téléchargement */}
      <a
        href="/pbis/start/contrat-signe"
        className="inline-flex items-center justify-center gap-2 rounded-full text-white px-8 py-3 font-medium text-base leading-6 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: startColor }}
      >
        <Download className="w-4 h-4" strokeWidth={2} />
        Télécharger le contrat
      </a>

      {/* Lien retour accueil */}
      <Link to="/pbis" className="text-sm leading-5 text-neutral-950 underline">
        Retour à l'accueil
      </Link>
    </div>
  );
}