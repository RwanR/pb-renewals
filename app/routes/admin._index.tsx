import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAdmin } from "~/lib/admin-auth.server";
import prisma from "~/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const [
    clientCount,
    clientsWithEmail,
    clientsWithoutEmail,
    offerCount,
    acceptanceCount,
    signedCount,
    pendingCount,
    refusalCount,
    acceptancesByOffer,
    acceptancesByModel,
    recentAcceptances,
    recentRefusals,
    lastImport,
  ] = await Promise.all([
    prisma.client.count({ where: { archived: false } }),
    prisma.client.count({ where: { archived: false, NOT: { bestEmail: null } } }),
    prisma.client.count({ where: { archived: false, bestEmail: null, installEmail: null, billingEmail: null } }),
    prisma.offer.count(),
    prisma.acceptance.count(),
    prisma.acceptance.count({ where: { adobeSignStatus: "signed" } }),
    prisma.acceptance.count({ where: { OR: [{ adobeSignStatus: "sent" }, { adobeSignStatus: null }] } }),
    prisma.refusal.count(),
    prisma.acceptance.groupBy({
      by: ["offerPosition"],
      _count: true,
      where: { adobeSignStatus: "signed" },
    }),
    prisma.acceptance.findMany({
      where: { adobeSignStatus: "signed" },
      select: {
        client: { select: { currentModel: true } },
      },
    }),
    prisma.acceptance.findMany({
      where: { adobeSignStatus: "signed" },
      orderBy: { acceptedAt: "desc" },
      take: 10,
      select: {
        clientAccountNumber: true,
        signatoryFirstName: true,
        signatoryLastName: true,
        offerPosition: true,
        acceptedAt: true,
        signedAt: true,
        client: { select: { customerName: true, currentModel: true } },
      },
    }),
    prisma.refusal.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        clientAccountNumber: true,
        reason: true,
        comment: true,
        createdAt: true,
        client: { select: { customerName: true } },
      },
    }),
    prisma.importRun.findFirst({ orderBy: { importedAt: "desc" } }),
  ]);

  // Model breakdown
  const modelCounts: Record<string, number> = {};
  acceptancesByModel.forEach((a) => {
    const model = a.client.currentModel || "Inconnu";
    modelCounts[model] = (modelCounts[model] || 0) + 1;
  });

  // Offer 1 vs 2
  const offer1Signed = acceptancesByOffer.find((a) => a.offerPosition === 1)?._count || 0;
  const offer2Signed = acceptancesByOffer.find((a) => a.offerPosition === 2)?._count || 0;

  // Conversion rate
  const conversionRate = clientCount > 0 ? ((signedCount / clientCount) * 100).toFixed(1) : "0";
  const refusalRate = clientCount > 0 ? ((refusalCount / clientCount) * 100).toFixed(1) : "0";

  return {
    clientCount,
    clientsWithEmail,
    clientsWithoutEmail,
    offerCount,
    acceptanceCount,
    signedCount,
    pendingCount,
    refusalCount,
    offer1Signed,
    offer2Signed,
    modelCounts,
    conversionRate,
    refusalRate,
    recentAcceptances,
    recentRefusals,
    lastImport,
  };
}

const reasonLabels: Record<string, string> = {
  economies: "Économies courrier",
  simplifier: "Simplifier envois",
  temps: "Gagner du temps",
  facturation: "Facturation électronique",
  digitaliser: "Digitaliser documents",
  trop_cher: "Tarif trop élevé",
  plus_besoin: "Plus besoin",
  concurrent: "Autre prestataire",
  contact: "Souhaite être contacté",
  autre: "Autre",
};

export default function AdminDashboard() {
  const data = useLoaderData<typeof loader>();

  return (
    <div>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "24px" }}>Dashboard</h1>

      {/* Last import */}
      {data.lastImport && (
        <div style={{ fontSize: "13px", color: "#6B7280", marginBottom: "20px" }}>
          Dernier import : <strong>{data.lastImport.filename}</strong> — {new Date(data.lastImport.importedAt).toLocaleString("fr-FR")} — {data.lastImport.rowCount} clients
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        <KpiCard label="Clients importés" value={data.clientCount} />
        <KpiCard label="Contrats signés" value={data.signedCount} sub={`${data.conversionRate}%`} color="#059669" />
        <KpiCard label="En attente" value={data.pendingCount} color="#D97706" />
        <KpiCard label="Refus" value={data.refusalCount} sub={`${data.refusalRate}%`} color="#DC2626" />
      </div>

      {/* Second row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        <KpiCard label="Avec email" value={data.clientsWithEmail} />
        <KpiCard label="Sans email" value={data.clientsWithoutEmail} color="#D97706" />
        <KpiCard label="Offre 1 (upgrade)" value={data.offer1Signed} sub="signés" />
        <KpiCard label="Offre 2 (reconduction)" value={data.offer2Signed} sub="signés" />
      </div>

      {/* Model breakdown + Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px" }}>
        {/* By model */}
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Signatures par modèle</h2>
          {Object.keys(data.modelCounts).length === 0 ? (
            <p style={{ color: "#9CA3AF", fontSize: "14px" }}>Aucune signature pour l'instant</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {Object.entries(data.modelCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([model, count]) => (
                  <div key={model} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "14px" }}>{model}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{
                        height: "8px",
                        width: `${Math.max(20, (count / data.signedCount) * 200)}px`,
                        background: "#1D2C6B",
                        borderRadius: "4px",
                      }} />
                      <span style={{ fontSize: "14px", fontWeight: 600, minWidth: "30px", textAlign: "right" }}>{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Actions rapides</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link to="/admin/import" className="admin-btn admin-btn-outline" style={{ textAlign: "center" }}>
              📥 Importer un fichier Excel
            </Link>
            <a href="/admin/export-links" className="admin-btn admin-btn-outline" style={{ textAlign: "center" }} download>
              🔗 Exporter les liens d'accès
            </a>
          </div>
        </div>
      </div>

      {/* Recent acceptances */}
      <div style={{ background: "white", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Dernières signatures</h2>
        {data.recentAcceptances.length === 0 ? (
          <p style={{ color: "#9CA3AF", fontSize: "14px" }}>Aucune signature pour l'instant</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E5E7EB", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>N° Compte</th>
                <th style={{ padding: "8px 12px" }}>Client</th>
                <th style={{ padding: "8px 12px" }}>Signataire</th>
                <th style={{ padding: "8px 12px" }}>Offre</th>
                <th style={{ padding: "8px 12px" }}>Machine</th>
                <th style={{ padding: "8px 12px" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.recentAcceptances.map((a: any) => (
                <tr key={a.clientAccountNumber} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{a.clientAccountNumber}</td>
                  <td style={{ padding: "8px 12px" }}>{a.client.customerName}</td>
                  <td style={{ padding: "8px 12px" }}>{a.signatoryFirstName} {a.signatoryLastName}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: "4px", fontSize: "12px",
                      background: a.offerPosition === 1 ? "#EEF2FF" : "#F3F4F6",
                      color: a.offerPosition === 1 ? "#1D2C6B" : "#6B7280",
                    }}>
                      {a.offerPosition === 1 ? "Upgrade" : "Reconduction"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>{a.client.currentModel}</td>
                  <td style={{ padding: "8px 12px" }}>{new Date(a.acceptedAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent refusals */}
      <div style={{ background: "white", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Derniers refus</h2>
        {data.recentRefusals.length === 0 ? (
          <p style={{ color: "#9CA3AF", fontSize: "14px" }}>Aucun refus pour l'instant</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E5E7EB", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>N° Compte</th>
                <th style={{ padding: "8px 12px" }}>Client</th>
                <th style={{ padding: "8px 12px" }}>Raison</th>
                <th style={{ padding: "8px 12px" }}>Commentaire</th>
                <th style={{ padding: "8px 12px" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.recentRefusals.map((r: any) => (
                <tr key={r.clientAccountNumber} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{r.clientAccountNumber}</td>
                  <td style={{ padding: "8px 12px" }}>{r.client.customerName}</td>
                  <td style={{ padding: "8px 12px" }}>{reasonLabels[r.reason] || r.reason}</td>
                  <td style={{ padding: "8px 12px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.comment || "—"}
                  </td>
                  <td style={{ padding: "8px 12px" }}>{new Date(r.createdAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: "white",
      borderRadius: "8px",
      border: "1px solid #E5E7EB",
      padding: "20px",
    }}>
      <div style={{ fontSize: "13px", color: "#6B7280", marginBottom: "8px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span style={{ fontSize: "28px", fontWeight: 700, color: color || "#1a1a1a" }}>
          {value.toLocaleString("fr-FR")}
        </span>
        {sub && <span style={{ fontSize: "14px", color: color || "#6B7280" }}>{sub}</span>}
      </div>
    </div>
  );
}