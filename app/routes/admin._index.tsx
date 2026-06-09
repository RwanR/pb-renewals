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
    lastC4CExport,
    shopifySyncErrors,
    shopifySyncWarnings,
    shopifySyncedCount,
    shopifyTotalWithEmail,
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
        offerPosition: true,
        clientAccountNumber: true,
        client: {
          select: {
            offers: {
              select: {
                offerPosition: true,
                modelName: true,
              },
            },
          },
        },
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
    prisma.c4CExport.findFirst({
      orderBy: { exportDate: "desc" },
      select: { exportDate: true, acceptanceCount: true, generatedAt: true },
    }),
    prisma.client.findMany({
      where: { archived: false, shopifySyncError: { not: null } },
      select: { accountNumber: true, customerName: true, shopifySyncError: true },
      orderBy: { customerName: "asc" },
    }),
    prisma.client.findMany({
      where: { archived: false, shopifySyncWarning: { not: null } },
      select: { accountNumber: true, customerName: true, shopifySyncWarning: true },
      orderBy: { customerName: "asc" },
    }),
    prisma.client.count({
      where: { archived: false, shopifyCustomerId: { not: null }, bestEmail: { not: null } },
    }),
    prisma.client.count({
      where: { archived: false, bestEmail: { not: null } },
    }),
  ]);

  // Model breakdown
  const modelCounts: Record<string, number> = {};
  acceptancesByModel.forEach((a) => {
    const offer = a.client.offers.find((o) => o.offerPosition === a.offerPosition);
    let model = offer?.modelName || "Inconnu";
    if (a.offerPosition === 2) {
      model = `${model} (reconduit)`;
    }
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
    lastC4CExport,
    shopifySync: {
      syncErrors: shopifySyncErrors,
      syncWarnings: shopifySyncWarnings,
      syncedCount: shopifySyncedCount,
      totalWithEmail: shopifyTotalWithEmail,
    },
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

function formatSyncMessage(msg: string | null): string {
  if (!msg) return "—";
  if (/phone omitted/i.test(msg)) return "Client créé sans téléphone (doublon)";
  if (/phone.*already been taken/i.test(msg)) return "Téléphone déjà utilisé par un autre compte";
  if (/email.*already been taken/i.test(msg)) return "Email déjà utilisé par un autre compte";
  if (/no email/i.test(msg)) return "Pas d'email";
  return msg.slice(0, 100);
}

export default function AdminDashboard() {
  const data = useLoaderData<typeof loader>();

  const errorCount = data.shopifySync.syncErrors.length;
  const warningCount = data.shopifySync.syncWarnings.length;

  // Encart color: orange si erreur, jaune si warning seul, vert sinon
  const syncSeverity: "ok" | "warning" | "error" =
    errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "ok";

  const syncStyles = {
    ok: { bg: "#ECFDF5", border: "#A7F3D0", accent: "#059669", icon: "✓" },
    warning: { bg: "#FEFCE8", border: "#FDE68A", accent: "#CA8A04", icon: "⚠" },
    error: { bg: "#FEF3C7", border: "#FCD34D", accent: "#D97706", icon: "⚠" },
  }[syncSeverity];

  const syncSummary = (() => {
    const base = `${data.shopifySync.syncedCount} / ${data.shopifySync.totalWithEmail} clients synchronisés`;
    if (errorCount === 0 && warningCount === 0) return base;
    const parts: string[] = [];
    if (errorCount > 0) parts.push(`${errorCount} ${errorCount > 1 ? "erreurs" : "erreur"}`);
    if (warningCount > 0) parts.push(`${warningCount} ${warningCount > 1 ? "avertissements" : "avertissement"}`);
    return `${base} (${parts.join(", ")})`;
  })();

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

      {/* Shopify sync status */}
      <div style={{
        background: syncStyles.bg,
        border: `1px solid ${syncStyles.border}`,
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "32px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <span style={{ fontSize: "16px", fontWeight: 600 }}>Synchronisation Shopify</span>
          <span style={{ fontSize: "14px", color: syncStyles.accent, fontWeight: 500 }}>
            {syncStyles.icon} {syncSummary}
          </span>
        </div>

        {errorCount > 0 && (
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "#92400E" }}>
              {errorCount > 1 ? "Erreurs" : "Erreur"} :
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
              {data.shopifySync.syncErrors.map((e) => (
                <li key={e.accountNumber} style={{ fontSize: "13px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "monospace", color: "#6B7280" }}>{e.accountNumber}</span>
                  <span style={{ color: "#1a1a1a" }}>{e.customerName || "—"}</span>
                  <span style={{ color: "#B91C1C" }}>— {formatSyncMessage(e.shopifySyncError)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {warningCount > 0 && (
          <div style={{ marginTop: errorCount > 0 ? "16px" : "16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "#854D0E" }}>
              {warningCount > 1 ? "Avertissements" : "Avertissement"} :
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
              {data.shopifySync.syncWarnings.map((w) => (
                <li key={w.accountNumber} style={{ fontSize: "13px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "monospace", color: "#6B7280" }}>{w.accountNumber}</span>
                  <span style={{ color: "#1a1a1a" }}>{w.customerName || "—"}</span>
                  <span style={{ color: "#A16207" }}>— {formatSyncMessage(w.shopifySyncWarning)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
            <Link to="/admin/reporting" className="admin-btn admin-btn-outline" style={{ textAlign: "center" }}>
              📈 Reporting (filtres + export)
            </Link>
            <Link to="/admin/import" className="admin-btn admin-btn-outline" style={{ textAlign: "center" }}>
              📥 Importer un fichier Excel
            </Link>
            <a href="/admin/export-links" className="admin-btn admin-btn-outline" style={{ textAlign: "center" }}>
              🔗 Exporter les liens d'accès
            </a>
            <a href="/admin/export-acceptances" className="admin-btn admin-btn-outline" style={{ textAlign: "center" }} download>
              📊 Exporter les acceptations (Excel)
            </a>
            <Link to="/admin/exports-c4c" className="admin-btn admin-btn-outline" style={{ textAlign: "center" }}>
              📤 Exports C4C
            </Link>
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