import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { requireAdmin } from "~/lib/admin-auth.server";
import prisma from "~/db.server";

type Status = "signed" | "pending" | "refused";

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
  too_expensive: "Tarif trop élevé",
  no_need: "Plus besoin",
  contact_me: "Souhaite être contacté",
  autre: "Autre",
  other: "Autre",
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const url = new URL(request.url);
  const raw = url.searchParams.get("status");
  const status: Status = raw === "pending" || raw === "refused" ? raw : "signed";

  const [signedCount, pendingCount, refusedCount] = await Promise.all([
    prisma.acceptance.count({ where: { adobeSignStatus: "signed" } }),
    prisma.acceptance.count({ where: { OR: [{ adobeSignStatus: "sent" }, { adobeSignStatus: null }] } }),
    prisma.refusal.count(),
  ]);

  let acceptances: any[] = [];
  let refusals: any[] = [];

  if (status === "refused") {
    refusals = await prisma.refusal.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        clientAccountNumber: true,
        reason: true,
        comment: true,
        createdAt: true,
        client: { select: { customerName: true, currentModel: true } },
      },
    });
  } else {
    const where =
      status === "signed"
        ? { adobeSignStatus: "signed" }
        : { OR: [{ adobeSignStatus: "sent" }, { adobeSignStatus: null }] };

    acceptances = await prisma.acceptance.findMany({
      where,
      orderBy: { acceptedAt: "desc" },
      select: {
        clientAccountNumber: true,
        offerPosition: true,
        signatoryFirstName: true,
        signatoryLastName: true,
        acceptedAt: true,
        signedAt: true,
        client: {
          select: {
            customerName: true,
            currentModel: true,
            offers: { select: { offerPosition: true, modelName: true } },
          },
        },
      },
    });
  }

  return { status, signedCount, pendingCount, refusedCount, acceptances, refusals };
}

const th: React.CSSProperties = { padding: "8px 12px" };
const td: React.CSSProperties = { padding: "8px 12px" };

export default function AdminReporting() {
  const data = useLoaderData<typeof loader>();
  const { status, signedCount, pendingCount, refusedCount } = data;

  const tabs: { key: Status; label: string; count: number; color: string }[] = [
    { key: "signed", label: "Signés", count: signedCount, color: "#059669" },
    { key: "pending", label: "En attente", count: pendingCount, color: "#D97706" },
    { key: "refused", label: "Refusés", count: refusedCount, color: "#DC2626" },
  ];

  const exportUrl =
    status === "refused" ? "/admin/export-refusals" : `/admin/export-acceptances?status=${status}`;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>Reporting</h1>
        <a href={exportUrl} download className="admin-btn admin-btn-primary" style={{ fontSize: "13px" }}>
          Exporter ce filtre (CSV)
        </a>
      </div>

      {/* Filtre par statut */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        {tabs.map((t) => {
          const active = t.key === status;
          return (
            <Link
              key={t.key}
              to={`/admin/reporting?status=${t.key}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
                textDecoration: "none",
                border: `1px solid ${active ? t.color : "#E5E7EB"}`,
                background: active ? t.color : "white",
                color: active ? "white" : "#374151",
              }}
            >
              {t.label}
              <span style={{
                fontSize: "12px",
                fontWeight: 700,
                padding: "1px 8px",
                borderRadius: "999px",
                background: active ? "rgba(255,255,255,0.25)" : "#F3F4F6",
                color: active ? "white" : "#6B7280",
              }}>
                {t.count}
              </span>
            </Link>
          );
        })}
      </div>

      <div style={{ background: "white", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px" }}>
        {status === "refused"
          ? <RefusedTable rows={data.refusals} />
          : <AcceptanceTable rows={data.acceptances} status={status} />}
      </div>
    </div>
  );
}

function AcceptanceTable({ rows, status }: { rows: any[]; status: Status }) {
  if (rows.length === 0) {
    return <p style={{ color: "#9CA3AF", fontSize: "14px" }}>Aucun élément</p>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #E5E7EB", textAlign: "left" }}>
          <th style={th}>N° Compte</th>
          <th style={th}>Client</th>
          <th style={th}>Signataire</th>
          <th style={th}>Offre</th>
          <th style={th}>Machine</th>
          <th style={th}>{status === "signed" ? "Date signature" : "Initiée le"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => {
          const offer = a.client.offers.find((o: any) => o.offerPosition === a.offerPosition);
          const d = status === "signed" ? (a.signedAt || a.acceptedAt) : a.acceptedAt;
          return (
            <tr key={a.clientAccountNumber} style={{ borderBottom: "1px solid #F3F4F6" }}>
              <td style={{ ...td, fontFamily: "monospace" }}>{a.clientAccountNumber}</td>
              <td style={td}>{a.client.customerName}</td>
              <td style={td}>{a.signatoryFirstName} {a.signatoryLastName}</td>
              <td style={td}>
                <span style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  background: a.offerPosition === 1 ? "#EEF2FF" : "#F3F4F6",
                  color: a.offerPosition === 1 ? "#1D2C6B" : "#6B7280",
                }}>
                  {a.offerPosition === 1 ? "Upgrade" : "Reconduction"}
                </span>
              </td>
              <td style={td}>{offer?.modelName || a.client.currentModel || "—"}</td>
              <td style={td}>{d ? new Date(d).toLocaleDateString("fr-FR") : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RefusedTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) {
    return <p style={{ color: "#9CA3AF", fontSize: "14px" }}>Aucun refus</p>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #E5E7EB", textAlign: "left" }}>
          <th style={th}>N° Compte</th>
          <th style={th}>Client</th>
          <th style={th}>Machine</th>
          <th style={th}>Raison</th>
          <th style={th}>Commentaire</th>
          <th style={th}>Date</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.clientAccountNumber} style={{ borderBottom: "1px solid #F3F4F6" }}>
            <td style={{ ...td, fontFamily: "monospace" }}>{r.clientAccountNumber}</td>
            <td style={td}>{r.client.customerName}</td>
            <td style={td}>{r.client.currentModel || "—"}</td>
            <td style={td}>{reasonLabels[r.reason] || r.reason || "—"}</td>
            <td style={{ ...td, maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.comment || "—"}
            </td>
            <td style={td}>{new Date(r.createdAt).toLocaleDateString("fr-FR")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}