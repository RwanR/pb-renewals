import type { Route } from "./+types/pbis._index";

export function meta({}: Route.MetaArgs) {
  return [{ title: "PBIS — Pitney Bowes Invoicing Solutions" }];
}

export default function PbisIndex() {
  return (
    <section
      className="relative text-white bg-cover bg-center"
      style={{
        backgroundImage: "linear-gradient(rgba(98,151,217,0.75), rgba(98,151,217,0.75)), url('/images/pbis-hero.jpg')"
      }}
    >
      <div className="container mx-auto px-6 py-24 flex flex-col items-center text-center max-w-3xl">
        <span className="inline-block px-4 py-1 rounded-full bg-[#d7008f] text-white text-sm font-medium mb-6">
          Loi de finances
        </span>

        <h1 className="text-4xl md:text-5xl font-semibold leading-tight mb-4">
          La facture électronique simplement.<br />Sans attendre.
        </h1>

        <p className="text-base md:text-lg text-white/90 mb-10 max-w-xl">
          Avec Pitney Bowes, digitalisez vos factures clients et fournisseurs pour une mise en conformité simple et économique, grâce à des offres adaptées.
        </p>

        <a href="#offres" className="inline-flex items-center gap-3 bg-white text-[#d7008f] px-6 py-4 rounded-xl font-medium shadow-md hover:shadow-lg transition-shadow">
          Découvrir nos offres →
        </a>
      </div>
    </section>
  );
}