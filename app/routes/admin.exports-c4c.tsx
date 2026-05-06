import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { requireAdmin } from "~/lib/admin-auth.server";
import prisma from "~/db.server";
import { runC4CExport, getDateWindow, getDateRangeWindow } from "~/lib/c4c-runner.server";

const PAGE_SIZE = 50;

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const [exports, total, totalContracts, totalSentByEmail, lastExport] = await Promise.all([
    prisma.c4CExport.findMany({
      orderBy: { generatedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        exportDate: true,
        signedFrom: true,
        signedTo: true,
        acceptanceCount: true,
        fileName: true,
        generatedAt: true,
        generatedBy: true,
        emailSentTo: true,
        emailSentAt: true,
      },
    }),
    prisma.c4CExport.count(),
    prisma.c4CExport.aggregate({ _sum: { acceptanceCount: true } }),
    prisma.c4CExport.count({ where: { NOT: { emailSentAt: null } } }),
    prisma.c4CExport.findFirst({ orderBy: { generatedAt: "desc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    exports,
    total,
    totalContracts: totalContracts._sum.acceptanceCount || 0,
    totalSentByEmail,
    lastExport,
    page,
    totalPages,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "regenerate") {
    const dateStr = (formData.get("date") as string)?.trim();
    const sendMail = formData.get("sendMail") === "1";

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return { error: "Date invalide (format attendu : YYYY-MM-DD)" };
    }

    try {
      const window = getDateWindow(dateStr);
      const result = await runC4CExport({
        ...window,
        generatedBy: "admin",
        emailTo: sendMail ? process.env.C4C_EXPORT_EMAIL || null : null,
      });

      return {
        success: `Export généré pour ${dateStr} : ${result.acceptanceCount} contrat${
          result.acceptanceCount > 1 ? "s" : ""
        }`,
      };
    } catch (err: any) {
      console.error("[ADMIN C4C] Export failed:", err);
      return { error: `Erreur : ${err.message || "inconnue"}` };
    }
  }

  if (intent === "regenerate-range") {
    const fromStr = (formData.get("from") as string)?.trim();
    const toStr = (formData.get("to") as string)?.trim();
    const sendMail = formData.get("sendMail") === "1";

    if (!fromStr || !/^\d{4}-\d{2}-\d{2}$/.test(fromStr)) {
      return { error: "Date de début invalide (format attendu : YYYY-MM-DD)" };
    }
    if (!toStr || !/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
      return { error: "Date de fin invalide (format attendu : YYYY-MM-DD)" };
    }
    if (fromStr > toStr) {
      return { error: "La date de début doit être antérieure ou égale à la date de fin" };
    }

    try {
      const window = getDateRangeWindow(fromStr, toStr);
      const result = await runC4CExport({
        ...window,
        generatedBy: "admin",
        emailTo: sendMail ? process.env.C4C_EXPORT_EMAIL || null : null,
      });

      return {
        success: `Export généré pour ${fromStr} → ${toStr} : ${result.acceptanceCount} contrat${
          result.acceptanceCount > 1 ? "s" : ""
        }`,
      };
    } catch (err: any) {
      console.error("[ADMIN C4C] Range export failed:", err);
      return { error: `Erreur : ${err.message || "inconnue"}` };
    }
  }

  return { error: "Action inconnue" };
}

export default function AdminExportsC4C() {
  const { exports, total, totalContracts, totalSentByEmail, lastExport, page, totalPages } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const defaultDate = yesterday.toISOString().split("T")[0];

  const lastWeekStart = new Date();
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const defaultFrom = lastWeekStart.toISOString().split("T")[0];

  return (
    <div>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "24px" }}>Exports C4C</h1>

      {lastExport && (
        <div style={{ fontSize: "13px", color: "#6B7280", marginBottom: "20px" }}>
          Dernier export : <strong>{lastExport.fileName}</strong> — {new Date(lastExport.generatedAt).toLocaleString("fr-FR")} — {lastExport.acceptanceCount} contrats
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
        <KpiCard label="Exports générés" value={total} />
        <KpiCard label="Contrats exportés" value={totalContracts} />
        <KpiCard label="Envoyés par email" value={totalSentByEmail} sub={total > 0 ? `${Math.round((totalSentByEmail / total) * 100)}%` : undefined} color="#059669" />
      </div>

      {/* Forms régénération */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        {/* Form date unique */}
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Export sur une date</h2>
          <Form method="post" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input type="hidden" name="intent" value="regenerate" />
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", color: "#6B7280", fontWeight: 500 }}>Date des contrats signés</label>
              <input type="date" name="date" defaultValue={defaultDate} required
                style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "14px", fontFamily: "inherit" }} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
              <input type="checkbox" name="sendMail" value="1" />
              Envoyer par email
            </label>
            <button type="submit" disabled={isSubmitting} className="admin-btn admin-btn-primary">
              {isSubmitting ? "Génération..." : "Générer"}
            </button>
          </Form>
        </div>

        {/* Form plage */}
        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Export sur une plage de dates</h2>
          <Form method="post" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input type="hidden" name="intent" value="regenerate-range" />
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                <label style={{ fontSize: "13px", color: "#6B7280", fontWeight: 500 }}>Du</label>
                <input type="date" name="from" defaultValue={defaultFrom} required
                  style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "14px", fontFamily: "inherit" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                <label style={{ fontSize: "13px", color: "#6B7280", fontWeight: 500 }}>Au</label>
                <input type="date" name="to" defaultValue={defaultDate} required
                  style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: "6px", fontSize: "14px", fontFamily: "inherit" }} />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
              <input type="checkbox" name="sendMail" value="1" />
              Envoyer par email
            </label>
            <button type="submit" disabled={isSubmitting} className="admin-btn admin-btn-primary">
              {isSubmitting ? "Génération..." : "Générer"}
            </button>
          </Form>
        </div>
      </div>

      {actionData && "success" in actionData && actionData.success && (
        <div style={{ padding: "12px 16px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "6px", marginBottom: "24px", fontSize: "14px", color: "#166534" }}>
          {actionData.success}
        </div>
      )}
      {actionData && "error" in actionData && actionData.error && (
        <div style={{ padding: "12px 16px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", marginBottom: "24px", fontSize: "14px", color: "#991B1B" }}>
          {actionData.error}
        </div>
      )}

      {/* Liste */}
      <div style={{ background: "white", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Historique</h2>
        {exports.length === 0 ? (
          <p style={{ color: "#9CA3AF", fontSize: "14px" }}>Aucun export pour l'instant</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E5E7EB", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>Période</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Contrats</th>
                <th style={{ padding: "8px 12px" }}>Généré le</th>
                <th style={{ padding: "8px 12px" }}>Origine</th>
                <th style={{ padding: "8px 12px" }}>Email</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {exports.map((exp: any) => {
                const from = new Date(exp.signedFrom);
                const toExclusive = new Date(exp.signedTo);
                const to = new Date(toExclusive.getTime() - 1);
                const fromStr = from.toLocaleDateString("fr-FR");
                const toStr = to.toLocaleDateString("fr-FR");
                const periodLabel = fromStr === toStr ? fromStr : `${fromStr} → ${toStr}`;
                return (
                  <tr key={exp.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 600 }}>{periodLabel}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{exp.acceptanceCount}</td>
                    <td style={{ padding: "8px 12px", color: "#6B7280" }}>{new Date(exp.generatedAt).toLocaleString("fr-FR")}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: "4px", fontSize: "12px",
                        background: exp.generatedBy === "cron" ? "#EEF2FF" : "#F3F4F6",
                        color: exp.generatedBy === "cron" ? "#1D2C6B" : "#6B7280",
                      }}>
                        {exp.generatedBy}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", color: "#6B7280", fontSize: "12px" }}>
                      {exp.emailSentTo ? `✓ ${exp.emailSentTo}` : "—"}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      <a href={`/admin/exports-c4c/${exp.id}/download`} className="admin-btn admin-btn-outline" style={{ fontSize: "12px", padding: "4px 12px" }}>
                        Télécharger
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "20px" }}>
          {page > 1 && (
            <Link to={`/admin/exports-c4c?page=${page - 1}`} className="admin-btn admin-btn-outline" style={{ fontSize: "13px" }}>
              ← Précédent
            </Link>
          )}
          <span style={{ padding: "6px 12px", color: "#6B7280", fontSize: "13px" }}>
            Page {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link to={`/admin/exports-c4c?page=${page + 1}`} className="admin-btn admin-btn-outline" style={{ fontSize: "13px" }}>
              Suivant →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "white", borderRadius: "8px", border: "1px solid #E5E7EB", padding: "20px" }}>
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