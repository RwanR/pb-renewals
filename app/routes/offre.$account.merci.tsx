import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const client = await prisma.client.findUnique({
    where: { accountNumber },
    include: {
      acceptance: true,
      offers: true,
    },
  });

  if (!client || !client.acceptance) {
    throw new Response("Aucune acceptation trouvée", { status: 404 });
  }

  const offer = client.offers.find(
    (o: any) => o.offerPosition === client.acceptance!.offerPosition
  );

  return { client, acceptance: client.acceptance, offer };
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OffreMerci() {
  const { client, acceptance, offer } = useLoaderData<typeof loader>();

  const isUpgrade = offer?.template === "1";
  const whatsNext = offer?.confirmationWhatsNext?.split("|").map((s: string) => s.trim()).filter(Boolean) || [];

  return (
    <div className="pb-space-lg" style={{ maxWidth: "600px", margin: "0 auto" }}>
      {/* Success */}
      <div className="pb-card" style={{ textAlign: "center", padding: "40px 24px", background: "#F0FDF4", borderColor: "#86EFAC" }}>
        <div style={{
          width: "64px", height: "64px", borderRadius: "50%",
          background: "#DCFCE7", color: "#059669",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "28px", margin: "0 auto 16px",
        }}>✓</div>
        <h1 className="pb-title" style={{ fontSize: "24px", marginBottom: "8px" }}>
          Votre contrat a été validé
        </h1>
        <p className="pb-text" style={{ color: "var(--pb-text-light)" }}>
          Merci, {acceptance.signatoryFirstName}. Votre demande de renouvellement a bien été enregistrée.
        </p>
      </div>

      {/* Recap */}
      <div className="pb-card pb-space-sm">
        <div className="pb-subtitle" style={{ fontSize: "16px" }}>Récapitulatif</div>
        <div className="pb-situation">
          <div className="pb-situation-item">
            <div className="pb-situation-label">Offre</div>
            <div className="pb-situation-value">{offer?.modelName || "—"}</div>
          </div>
          <div className="pb-situation-item">
            <div className="pb-situation-label">Durée</div>
            <div className="pb-situation-value">{offer?.contractTerm || "—"}</div>
          </div>
          <div className="pb-situation-item">
            <div className="pb-situation-label">Loyer annuel HT</div>
            <div className="pb-situation-value">
              {formatCurrency(offer?.billing60 ?? offer?.billing36)} €
            </div>
          </div>
          <div className="pb-situation-item">
            <div className="pb-situation-label">Signataire</div>
            <div className="pb-situation-value">
              {acceptance.signatoryFirstName} {acceptance.signatoryLastName}
            </div>
          </div>
        </div>
      </div>

      <a href={`/offre/${client.accountNumber}/contrat-signe`}
        className="pb-btn pb-btn-primary pb-btn-full"
        style={{ padding: "14px 28px", fontSize: "16px", textAlign: "center", display: "block", textDecoration: "none" }}
        download
      >
        📄 Télécharger mon contrat signé
      </a>

      {/* What's next */}
      {whatsNext.length > 0 && (
        <div className="pb-card pb-space-sm">
          <div className="pb-subtitle" style={{ fontSize: "16px" }}>Et maintenant ?</div>
          <div className="pb-props">
            {whatsNext.map((step: string, i: number) => (
              <div key={i} className="pb-prop">
                <span className="pb-prop-icon" style={{ background: "#EEF2FF", color: "var(--pb-navy)", fontWeight: 700 }}>
                  {i + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commercial contact */}
      {client.ownerName && (
        <div className="pb-card">
          <div className="pb-text-sm">Votre interlocuteur Pitney Bowes :</div>
          <div className="pb-text" style={{ fontWeight: 600, marginTop: "4px" }}>
            {client.ownerName}
          </div>
          {client.ownerEmail && (
            <a href={`mailto:${client.ownerEmail}`} className="pb-link" style={{ fontSize: "14px" }}>
              {client.ownerEmail}
            </a>
          )}
        </div>
      )}
    </div>
  );
}