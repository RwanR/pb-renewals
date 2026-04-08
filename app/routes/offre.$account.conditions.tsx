import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const client = await prisma.client.findUnique({
    where: { accountNumber },
    select: { accountNumber: true, leaseNumber: true },
  });

  if (!client) throw new Response("Client non trouvé", { status: 404 });

  return { client };
}

export default function ConditionsGenerales() {
  const { client } = useLoaderData<typeof loader>();

  return (
    <div className="pb-main">
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "48px 0" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 500, color: "var(--pb-text)", textAlign: "center", marginBottom: "40px", letterSpacing: "0.1px" }}>
          Conditions générales de location
        </h1>

        <div style={{ fontSize: "14px", lineHeight: "22px", color: "var(--pb-text)", textAlign: "justify", display: "flex", flexDirection: "column", gap: "20px" }}>
          <p>
            Le présent Contrat est conclu pour la durée initiale indiquée ci-dessus. Il entrera en vigueur, en lieu et place de votre contrat en cours n° {client.leaseNumber || "—"} qui prendra fin par anticipation lors de la livraison des logiciels ou du Matériel (machines auto-installables) ou lors de l'installation du Matériel (autres machines) ci-dessus mentionnés. En cas de modernisation d'un logiciel ou d'ajout d'éléments complémentaires avec maintien de votre Matériel actuel, ce dernier sera désormais soumis au présent Contrat, celui-ci (le présent Contrat) prenant alors effet 3 mois calendaires à compter de la date de signature de ce présent Contrat. En cas de remplacement du Matériel, le Matériel existant devra être restitué conformément aux Conditions Générales lors de la livraison ou installation du nouveau Matériel. Sauf stipulation expresse contraire, les services complémentaires en cours seront maintenus et seront soumis au nouveau contrat.
          </p>

          <p>
            Le premier terme du loyer sera exigé conformément à l'article 8.4 des Conditions Générales relatives au Contrat de Location Maintenance.
          </p>

          <p>
            Dans le cadre du déploiement du logiciel OP@le, Pitney Bowes appliquera une facturation en année civile pour les collèges et lycées.
          </p>

          <p>
            La commande du Locataire vaut demande irrévocable de location. Le Locataire accepte de subordonner l'entrée en vigueur du contrat à l'acceptation par le service Crédit de Pitney Bowes, comme expliqué dans l'article 2 des Conditions Générales de location.
          </p>

          <p>
            En signant le présent contrat, le Locataire manifeste avoir pris connaissance des conditions du présent contrat de location et des Conditions Générales (version FR-Elease 04-26) disponibles à l'adresse (<a href="https://pb.com/fr/cc" target="_blank" rel="noopener" style={{ color: "var(--pb-cta)", textDecoration: "underline" }}>pb.com/fr/cc</a>) et les accepter, y compris la clause attributive de juridiction (l'article 25).
          </p>

          <p style={{ color: "var(--pb-cta)" }}>
            Si vous avez des questions sur le renouvellement de votre contrat, ou si vous souhaitez obtenir des informations sur d'autres produits ou services, vous pouvez nous contacter par e-mail à{" "}
            <a href="mailto:fr-elease@pb.com" style={{ color: "var(--pb-cta)", textDecoration: "underline", fontWeight: 500 }}>fr-elease@pb.com</a>.
          </p>

          <p>
            <a href="https://www.pitneybowes.com/fr/legal.html" target="_blank" rel="noopener" style={{ color: "var(--pb-text)", textDecoration: "underline" }}>
              Voir les conditions de location détaillées sur pitneybowes.com
            </a>
          </p>
        </div>

        {/* Retour → confirmer */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
          <button onClick={function() { window.history.back(); }} className="pb-btn pb-btn-secondary" style={{ padding: "12px 32px", fontSize: "16px" }}>
            Retour
          </button>
        </div>
      </div>
    </div>
  );
}