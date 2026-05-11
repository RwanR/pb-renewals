import type { Route } from "./+types/pbis._index";
import { FileText, ShieldCheck, Zap, BarChart3 } from "lucide-react";
import { Fragment } from "react";

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

          <a href="#offres" className="inline-flex items-center gap-4 bg-white border border-neutral-200 rounded-md px-6 py-2 shadow-xl hover:shadow-2xl transition-shadow">
            <img src="/images/pbis-cta-laptop.jpg" alt="" className="w-24 h-[54px] object-cover" />
            <span className="text-[#d7008f] font-medium">Découvrir nos offres →</span>
          </a>
        </div>
      </section>

      <div className="relative px-4">
        <div className="-mt-14 mx-auto max-w-5xl rounded-md p-6 flex items-start justify-center gap-6 text-white font-inter" style={{ backgroundImage: "linear-gradient(96.74deg, rgb(108, 39, 139) 0%, rgb(169, 2, 107) 50%, rgb(163, 89, 11) 100%)" }}>
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
    </>
  );
}