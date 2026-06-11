import type { Route } from "./+types/pbis._index";
import { FileText, ShieldCheck, Zap, BarChart3, Minus, Plus } from "lucide-react";
import { Fragment, useState } from "react";
import { Link, redirect } from "react-router";
import pbisDb from "~/db.pbis.server";
import { getPbisSession, commitPbisSession } from "~/lib/pbis-session.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "PBIS — Pitney Bowes Invoicing Solutions" }];
}

const features = [
  { Icon: FileText, title: "Plateforme Agréée", sub: "certifiée par la DGFiP, dans le cadre de la réglementation sur la facturation électronique" },
  { Icon: ShieldCheck, title: "Archivage probant", sub: "pendant 10 ans, conforme à la réglementation" },
  { Icon: Zap, title: "Économies", sub: "Jusqu'à 50% d'économie sur le traitement de vos factures" },
  { Icon: BarChart3, title: "Conformité", sub: "sans disruption de vos process" },
];

const ABOUT_TEXT = [
  "Pitney Bowes est une entreprise technologique internationale et un acteur historique du traitement documentaire, qui accompagne les entreprises dans l'optimisation de leurs communications et de leurs flux documentaires depuis plus de 100 ans.",
  "Concepteur, éditeur et intégrateur de solutions, Pitney Bowes répond à l'ensemble des enjeux liés à la gestion documentaire : simplification des processus métiers, réduction des coûts, conformité réglementaire, optimisation de la production, du traitement et de la distribution des courriers et documents, qu'ils soient physiques, numériques ou hybrides.",
  "Partenaire de confiance des entreprises dans leur transformation numérique, Pitney Bowes les accompagne à chaque étape de leurs projets grâce à des solutions adaptées à leurs enjeux opérationnels et réglementaires.",
  "À ce titre, sa solution Pitney Bowes Invoice Services est une Plateforme Agréée de facturation électronique clients et fournisseurs, offrant aux entreprises maîtrise, sécurité et flexibilité pour réussir leur transition à leur propre rythme.",
];

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return null;
  }

  const accessToken = await pbisDb.pbisAccessToken.findUnique({
    where: { token },
    select: { clientId: true, expiresAt: true },
  });

  if (!accessToken || accessToken.expiresAt < new Date()) {
    // Token invalide ou expiré : on nettoie l'URL, parcours anonyme
    return redirect("/pbis");
  }

  // Token valide : on pose la session et on nettoie l'URL
  const session = await getPbisSession(request);
  session.set("shipTo", accessToken.clientId);

  return redirect("/pbis", {
    headers: { "Set-Cookie": await commitPbisSession(session) },
  });
}

export default function PbisIndex() {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <div className="relative">
        <section className="relative bg-[#6297d9] h-[600px] overflow-hidden font-inter">
          <img src="/images/pbis-hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/55" />
          <div className="relative h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#d7008f] text-white text-xs font-semibold">
              Loi de finances
            </span>

            <h1 className="font-precision text-[40px] leading-[46px] tracking-[-0.5px] text-white max-w-[640px]">
              La facture électronique simplement.<br />Sans attendre.
            </h1>

            <p className="text-base leading-6 text-white max-w-[618px]">
              Avec Pitney Bowes, digitalisez vos factures clients et fournisseurs pour une mise en conformité simple et économique, grâce à des offres adaptées.
            </p>

            <Link to="/pbis/offres" className="inline-flex items-center gap-4 bg-white border border-neutral-200 rounded-md px-6 py-2 shadow-xl hover:shadow-2xl transition-shadow">
              <img src="/images/pbis-cta-laptop.jpg" alt="" className="w-24 h-[54px] object-cover" />
              <span className="text-[#d7008f] font-medium">Découvrir nos offres →</span>
            </Link>
          </div>
        </section>

        {/* Bandeau features : centré sur la frontière hero/contenu, hauteur indifférente */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[600px] -translate-y-1/2 z-10 w-[calc(100%-2rem)] max-w-5xl rounded-md p-6 flex items-start justify-center gap-6 text-white font-inter" style={{ backgroundImage: "linear-gradient(96.74deg, rgb(108, 39, 139) 0%, rgb(169, 2, 107) 50%, rgb(163, 89, 11) 100%)" }}>
          {features.map(({ Icon, title, sub }, i) => (
            <Fragment key={title}>
              {i > 0 && <div className="w-px h-[71px] bg-white/20 shrink-0" />}
              <div className="flex gap-4 items-start">
                <Icon className="w-8 h-8 shrink-0" strokeWidth={1.5} />
                <div className="flex flex-col gap-2 max-w-[160px]">
                  <p className="text-sm font-medium leading-5">{title}</p>
                  <p className="text-xs leading-4">{sub}</p>
                </div>
              </div>
            </Fragment>
          ))}
        </div>

        <div id="offres" className="flex flex-col items-center gap-8 pt-44 pb-12 px-4 font-inter">
          <div className="w-full max-w-[600px] aspect-[600/337] rounded-md overflow-hidden bg-black">
            <iframe
              src="https://www.youtube-nocookie.com/embed/ZxKKoByNQIE"
              title="Pitney Bowes Invoice Services"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>

          <div className="w-full max-w-[600px] border border-neutral-300 rounded-lg px-5 py-6 flex flex-col items-center gap-3">
            <p className="text-sm font-medium leading-5 text-center text-neutral-950">
              Réception obligatoire des e-factures<br />dès septembre 2026
            </p>
            <Link to="/pbis/offres" className="inline-flex items-center gap-2 bg-[#d7008f] text-white rounded-full px-8 py-3 font-medium hover:opacity-90 transition-opacity">
              Voir les offres →
            </Link>
          </div>

          <div className="flex flex-col items-center mt-4 w-full">
            <button type="button" onClick={() => setAboutOpen(!aboutOpen)} className="flex items-center gap-2 text-[#005cb1] cursor-pointer mb-8">
              <span className="font-precision text-xl leading-6 tracking-[-0.3px]">À propos de Pitney Bowes</span>
              {aboutOpen ? <Minus className="w-6 h-6" strokeWidth={1.5} /> : <Plus className="w-6 h-6" strokeWidth={1.5} />}
            </button>

            <div className={`grid w-full max-w-[600px] transition-all duration-300 ease-in-out ${aboutOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden flex flex-col gap-3">
                {ABOUT_TEXT.map((para, i) => (
                  <p key={i} className="text-sm leading-5 text-neutral-950 text-center">{para}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}