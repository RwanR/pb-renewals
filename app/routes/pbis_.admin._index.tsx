import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAdmin } from "~/lib/pbis-admin-auth.server";
import pbisDb from "../db.pbis.server";

const STEP_ORDER = ["Offres", "Détail offre", "Informations", "Récapitulatif", "Signature"];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const [clients, tokens, started, signed, leads, lastImport, byStepRaw] = await Promise.all([
    pbisDb.pbisClient.count(),
    pbisDb.pbisAccessToken.count(),
    pbisDb.pbisFunnelProgress.count(),
    pbisDb.pbisFunnelProgress.count({ where: { status: "signed" } }),
    pbisDb.pbisLead.count(),
    pbisDb.pbisImportRun.findFirst({ orderBy: { importedAt: "desc" } }),
    pbisDb.pbisFunnelProgress.groupBy({
      by: ["lastStepName"],
      where: { status: { not: "signed" } },
      _count: true,
    }),
  ]);

  const abandons = started - signed;
  const signatureRate = started > 0 ? ((signed / started) * 100).toFixed(1) : "0";

  const byStepMap: Record<string, number> = {};
  byStepRaw.forEach((g: any) => {
    if (g.lastStepName) byStepMap[g.lastStepName] = g._count;
  });
  const byStep = STEP_ORDER.map((name) => ({ name, count: byStepMap[name] ?? 0 }));

  return {
    clients,
    tokens,
    started,
    signed,
    signatureRate,
    abandons,
    leads,
    byStep,
    lastImport,
  };
}

export default function PbisAdminDashboard() {
  const data = useLoaderData<typeof loader>();
  const maxStep = Math.max(1, ...data.byStep.map((s) => s.count));

  return (
    <div>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "24px" }}>Dashboard PBIS</h1>

      {data.lastImport && (
        <div style={{ fontSize: "13px", color: "#6B7280", marginBottom: "20px" }}>
          Dernier import : <strong>{data.lastImport.filename}</strong> — {new Date(data.lastImport.importedAt).toLocaleString("fr-FR")} — {data.lastImport.rowCount} clients
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        <KpiCard label="Clients importés" value={data.clients} />
        <KpiCard label="Liens générés" value={data.tokens} />
        <KpiCard label="Parcours démarrés" value={data.started} />
        <KpiCard label="Signés" value={data.signed} sub={`${data.signatureRate}%`} color="#059669" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        <KpiCard label="Abandons" value={data.abandons} color="#D97706" />
        <KpiCard label="Leads Essentiel / Flex" value={data.leads} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px" }}>
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Abandons par dernière étape</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {data.byStep.map((s) => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px" }}>{s.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    height: "8px",
                    width: `${Math.max(20, (s.count / maxStep) * 200)}px`,
                    background: "#1D2C6B",
                    borderRadius: "4px",
                  }} />
                  <span style={{ fontSize: "14px", fontWeight: 600, minWidth: "40px", textAlign: "right" }}>{s.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Actions rapides</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link to="/pbis/admin/import" className="admin-btn admin-btn-outline" style={{ textAlign: "center" }}>
              Importer un fichier Excel
            </Link>
            <a href="/pbis/admin/export-links" className="admin-btn admin-btn-outline" style={{ textAlign: "center" }}>
              Exporter les liens d'accès
            </a>
            <a href="/pbis/admin/export-souscriptions" className="admin-btn admin-btn-outline" style={{ textAlign: "center" }}>
              Exporter les souscriptions signées
            </a>
            <a href="/pbis/admin/export-abandons" className="admin-btn admin-btn-outline" style={{ textAlign: "center" }}>
              Exporter les abandons
            </a>
          </div>
        </div>
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