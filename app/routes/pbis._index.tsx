import type { Route } from "./+types/pbis._index";

export function meta({}: Route.MetaArgs) {
  return [{ title: "PBIS — Pitney Bowes Invoicing Solutions" }];
}

export default function PbisIndex() {
  return (
    <section className="relative bg-[#6297d9] h-[600px] overflow-hidden">
      <img
        src="/images/pbis-hero.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="relative h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#d7008f] text-white text-xs font-semibold">
          Loi de finances
        </span>

        <h1 className="text-[40px] leading-[46px] tracking-[-0.5px] text-white max-w-[640px]">
          La facture électronique simplement. Sans attendre.
        </h1>

        <p className="text-base leading-6 text-white max-w-[618px]">
          Avec Pitney Bowes, digitalisez vos factures clients et fournisseurs pour une mise en conformité simple et économique, grâce à des offres adaptées.
        </p>

        <a
          href="#offres"
          className="inline-flex items-center gap-4 bg-white border border-neutral-200 rounded-md px-6 py-2 shadow-xl hover:shadow-2xl transition-shadow"
        >
          <span className="text-[#d7008f] font-medium">Découvrir nos offres →</span>
        </a>
      </div>
    </section>
  );
}