import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const client = await prisma.client.findUnique({
    where: { accountNumber },
    select: {
      customerName: true,
      ownerName: true,
      ownerEmail: true,
      accessToken: { select: { expiresAt: true } },
    },
  });

  if (!client) {
    throw new Response("Client non trouvé", { status: 404 });
  }

  return {
    customerName: client.customerName,
    ownerName: client.ownerName,
    ownerEmail: client.ownerEmail,
    expiresAt: client.accessToken?.expiresAt ?? null,
  };
}

function formatDate(d: Date | string | null): string | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function OffreExpiree() {
  const { ownerName, ownerEmail, expiresAt } = useLoaderData<typeof loader>();
  const expirationDate = formatDate(expiresAt);
  const contactEmail = ownerEmail || "fr-elease@pb.com";

  return (
    <div style={{ padding: "48px 24px" }}>
      <div className="pb-card" style={{ maxWidth: "520px", margin: "0 auto", padding: "48px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#d97706" strokeWidth="2" />
              <path d="M12 7v6" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="17" r="1" fill="#d97706" />
            </svg>
          </div>
          <h1 className="pb-heading" style={{ marginBottom: "8px" }}>Offre expirée</h1>
          <p className="pb-text-sm" style={{ color: "var(--pb-text-muted)" }}>
            La validité de votre offre de renouvellement est dépassée.
          </p>
        </div>

        {expirationDate ? (
          <div style={{ background: "var(--pb-muted-bg)", borderRadius: "8px", padding: "20px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
              <span style={{ color: "var(--pb-text-muted)" }}>Date d'expiration</span>
              <span style={{ fontWeight: 500 }}>{expirationDate}</span>
            </div>
          </div>
        ) : null}

        <div style={{ fontSize: "14px", color: "var(--pb-text)", lineHeight: 1.6 }}>
          <p style={{ marginBottom: "16px" }}>
            Pour relancer votre renouvellement ou obtenir une nouvelle proposition, contactez
            {ownerName ? <> votre interlocuteur <strong>{ownerName}</strong></> : <> notre équipe</>}
            {" "}à l'adresse{" "}
            <a href={`mailto:${contactEmail}`} style={{ color: "var(--pb-cta)", textDecoration: "underline" }}>
              {contactEmail}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}