import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const [clientCount, offerCount, acceptanceCount, refusalCount, lastImport] = await Promise.all([
    prisma.client.count(),
    prisma.offer.count(),
    prisma.acceptance.count(),
    prisma.refusal.count(),
    prisma.importRun.findFirst({ orderBy: { importedAt: "desc" }, select: { importedAt: true, rowCount: true, status: true } }),
  ]);

  const clientsWithEmail = await prisma.client.count({ where: { bestEmail: { not: null } } });
  const signedCount = await prisma.acceptance.count({ where: { signedAt: { not: null } } });
  const conversionRate = clientCount > 0 ? ((acceptanceCount / clientCount) * 100).toFixed(1) : "0";

  const recentAcceptances = await prisma.acceptance.findMany({
    take: 5,
    orderBy: { acceptedAt: "desc" },
    select: {
      clientAccountNumber: true,
      offerPosition: true,
      termSelected: true,
      acceptedAt: true,
      signedAt: true,
      client: { select: { customerName: true } },
    },
  });

  const appUrl = process.env.SHOPIFY_APP_URL || process.env.APP_URL || "";

  return {
    clientCount,
    offerCount,
    acceptanceCount,
    refusalCount,
    signedCount,
    clientsWithEmail,
    conversionRate,
    lastImport,
    recentAcceptances,
    adminUrl: `${appUrl}/admin`,
  };
};

export default function Index() {
  const {
    clientCount,
    acceptanceCount,
    refusalCount,
    signedCount,
    conversionRate,
    lastImport,
    recentAcceptances,
    adminUrl,
  } = useLoaderData<typeof loader>();

  return (
    <s-page heading="PB Renewals">
      <s-button slot="primary-action" onClick={() => window.open(adminUrl, '_blank')}>
        Ouvrir le dashboard
      </s-button>

      <s-section heading="Vue d'ensemble">
        <s-stack direction="inline" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <div style={{ textAlign: "center", minWidth: "120px" }}>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>{clientCount}</div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>Clients importés</div>
            </div>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <div style={{ textAlign: "center", minWidth: "120px" }}>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>{acceptanceCount}</div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>Contrats acceptés</div>
            </div>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <div style={{ textAlign: "center", minWidth: "120px" }}>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>{signedCount}</div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>Contrats signés</div>
            </div>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <div style={{ textAlign: "center", minWidth: "120px" }}>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>{conversionRate}%</div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>Taux de conversion</div>
            </div>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <div style={{ textAlign: "center", minWidth: "120px" }}>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>{refusalCount}</div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>Refus</div>
            </div>
          </s-box>
        </s-stack>
      </s-section>

      {recentAcceptances.length > 0 && (
        <s-section heading="Derniers contrats">
          {recentAcceptances.map((a: any) => (
            <s-box key={a.clientAccountNumber} padding="base" borderWidth="base" borderRadius="base" style={{ marginBottom: "8px" }}>
              <s-stack direction="inline" gap="base">
                <span style={{ fontWeight: 600 }}>{a.client?.customerName || a.clientAccountNumber}</span>
                <span style={{ color: "#6b7280", fontSize: "13px" }}>Compte {a.clientAccountNumber}</span>
                <span style={{ color: "#6b7280", fontSize: "13px" }}>Offre {a.offerPosition} — {a.termSelected} mois</span>
                <span style={{ color: a.signedAt ? "#059669" : "#d97706", fontSize: "13px" }}>
                  {a.signedAt ? "Signé" : "En attente de signature"}
                </span>
              </s-stack>
            </s-box>
          ))}
        </s-section>
      )}

      <s-section slot="aside" heading="Dernier import">
        {lastImport ? (
          <>
            <s-paragraph>{lastImport.rowCount} clients importés</s-paragraph>
            <s-paragraph>
              <span style={{ color: "#6b7280" }}>
                {new Date(lastImport.importedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </s-paragraph>
            <s-paragraph>
              <span style={{ color: lastImport.status === "success" ? "#059669" : "#dc2626" }}>
                {lastImport.status === "success" ? "✓ Succès" : "⚠ Erreurs"}
              </span>
            </s-paragraph>
          </>
        ) : (
          <s-paragraph>
            <span style={{ color: "#6b7280" }}>Aucun import réalisé</span>
          </s-paragraph>
        )}
      </s-section>

      <s-section slot="aside" heading="Administration">
        <s-paragraph>
          Accédez au dashboard complet pour gérer les imports, consulter les détails clients et exporter les données.
        </s-paragraph>
        <s-button href={adminUrl} target="_blank">
          Dashboard admin
        </s-button>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};