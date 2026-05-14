import type { Route } from "./+types/pbis._index";
import { FileText, ShieldCheck, Zap, BarChart3, Calendar, Minus, Plus } from "lucide-react";
import { Fragment, useState } from "react";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [{ title: "PBIS — Pitney Bowes Invoicing Solutions" }];
}

const features = [
  { Icon: FileText, title: "Plateforme Agréée", sub: "Certifiée par la DGFiP" },
  { Icon: ShieldCheck, title: "Archivage probant", sub: "10 ans" },
  { Icon: Zap, title: "Économies", sub: "Jusqu'à 50% d'économie sur le traitement de vos factures" },
  { Icon: BarChart3, title: "Conformité", sub: "sans disruption de vos process" },
];

export default function PbisIndex() {
  const [aboutOpen, setAboutOpen] = useState(true);

  return (
    <>
      <section className="relative bg-[#6297d9] h-[600px] overflow-hidden font-inter">
        <img src="/images/pbis-hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="relative h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#d7008f] text-white text-xs font-semibold">
            Loi de finances
          </span>

          <h1 className="font-precision text-[40px] leading-[46px] tracking-[-0.5px] text-white max-w-[640px]">
            La facture électronique simplement. Sans attendre.
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

      <div className="relative px-4">
        <div className="-mt-16 mx-auto max-w-5xl rounded-md p-6 flex items-start justify-center gap-6 text-white font-inter" style={{ backgroundImage: "linear-gradient(96.74deg, rgb(108, 39, 139) 0%, rgb(169, 2, 107) 50%, rgb(163, 89, 11) 100%)" }}>
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
      </div>

      <div id="offres" className="flex flex-col items-center gap-8 pt-28 pb-12 px-4 font-inter">
        <div className="w-full max-w-[600px] aspect-[600/337] rounded-md bg-[#6297d9] flex flex-col items-center justify-center gap-6 text-white">
          <Calendar className="w-16 h-16" strokeWidth={1.5} />
          <p className="text-lg">Facturation électronique</p>
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
            <p className="overflow-hidden text-sm leading-5 text-neutral-950 text-center">
            Visualiser une version lisible (PDF) pour toutes les factures, en plus du format dans lequel elles arrivent initialement. Aucune disruption de vos processus : vous continuez à recevoir vos factures dans un format lisible sur votre e-mail habituel, tout en vous mettant en conformité avec la nouvelle loi.
            </p>
        </div>
        </div>
      </div>
    </>
  );
}