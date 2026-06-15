import { Outlet } from "react-router";
import { SnapEngage } from "~/components/snap-engage";
import type { Route } from "./+types/pbis";
import { getSessionShipTo } from "~/lib/pbis-session.server";
import pbisDb from "~/db.pbis.server";

export async function loader({ request }: Route.LoaderArgs) {
  const shipTo = await getSessionShipTo(request);

  if (!shipTo) {
    return { client: null };
  }

  const client = await pbisDb.pbisClient.findUnique({
    where: { shipTo },
    select: {
      shipTo: true,
      compteClientBillTo: true,
      companyName: true,
      siret: true,
      vatNumber: true,
      street: true,
      postcode: true,
      city: true,
      contactFirstName: true,
      contactLastName: true,
      contactEmail: true,
      contactPhone: true,
    },
  });

  return { client };
}

const footerLinks = [
  { href: "https://www.pitneybowes.com/fr/mentionslegales.html", label: "Mentions légales" },
  { href: "https://www.pitneybowes.com/fr/mentionslegales/donneespersonnelles.html", label: "Protection des données" },
  { href: "https://www.pitneybowes.com/content/dam/pitneybowes/fr/fr/homepage/iso-9001-certificate-europe-en.pdf", label: "ISO9001" },
  { href: "https://www.pitneybowes.com/content/dam/pitneybowes/fr/fr/homepage/iso-27001-certificate-france.pdf", label: "ISO27001" },
  { href: "https://www.pitneybowes.com/fr/mentionslegales/donneespersonnelles/cookie-policy.html", label: "Cookies" },
];

export default function PbisLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-white font-inter">
      <header className="border-b border-neutral-200 h-20 flex items-center justify-center bg-white">
        <img src="/images/pb-logo.png" alt="Pitney Bowes" className="h-10 w-auto" />
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="px-4 pt-12 pb-12 text-center text-xs text-neutral-500">
        <p>©1996-{new Date().getFullYear()} Pitney Bowes Inc. Tous droits réservés.</p>
        <div className="mt-1 flex flex-wrap justify-center gap-3">
          {footerLinks.map(link => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener" className="underline">{link.label}</a>
          ))}
        </div>
      </footer>
      <SnapEngage visibleOn={["/pbis/offres/start"]} />
    </div>
  );
}