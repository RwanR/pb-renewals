import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { requireAdmin } from "~/lib/admin-auth.server";
import prisma from "~/db.server";
import { runC4CExport, getDateWindow } from "~/lib/c4c-runner.server";

const PAGE_SIZE = 50;

export async function loader({ request }: LoaderFunctionArgs) {
await requireAdmin(request);

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const [exports, total] = await Promise.all([
    prisma.c4CExport.findMany({
      orderBy: { exportDate: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        exportDate: true,
        acceptanceCount: true,
        fileName: true,
        generatedAt: true,
        generatedBy: true,
        emailSentTo: true,
        emailSentAt: true,
      },
    }),
    prisma.c4CExport.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return { exports, total, page, totalPages };
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await requireAdmin(request);

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
        }${result.alreadyExisted ? " (export précédent remplacé)" : ""}`,
      };
    } catch (err: any) {
      console.error("[ADMIN C4C] Export failed:", err);
      return { error: `Erreur : ${err.message || "inconnue"}` };
    }
  }

  return { error: "Action inconnue" };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminExportsC4C() {
  const { exports, total, page, totalPages } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Date par défaut = hier
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const defaultDate = yesterday.toISOString().split("T")[0];

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 600, color: "var(--pb-text)", margin: 0 }}>
            Exports C4C
          </h1>
          <p style={{ fontSize: "14px", color: "var(--pb-text-muted)", margin: "4px 0 0" }}>
            {total} export{total > 1 ? "s" : ""} au total
          </p>
        </div>
        <Link
          to="/admin"
          style={{
            fontSize: "14px",
            color: "var(--pb-text-muted)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          ← Retour admin
        </Link>
      </div>

      {/* Form régénération */}
      <div
        style={{
          border: "1px solid var(--pb-border)",
          borderRadius: "12px",
          padding: "20px 24px",
          marginBottom: "32px",
          background: "var(--pb-muted-bg, #fafafa)",
        }}
      >
        <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--pb-text)", marginTop: 0, marginBottom: "12px" }}>
          Générer un export
        </h2>
        <Form method="post" style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <input type="hidden" name="intent" value="regenerate" />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "13px", color: "var(--pb-text)", fontWeight: 500 }}>
              Date des contrats signés
            </label>
            <input
              type="date"
              name="date"
              defaultValue={defaultDate}
              required
              style={{
                padding: "8px 12px",
                border: "1px solid var(--pb-border)",
                borderRadius: "8px",
                fontSize: "14px",
                fontFamily: "inherit",
              }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", marginBottom: "9px" }}>
            <input type="checkbox" name="sendMail" value="1" style={{ accentColor: "#005cb1" }} />
            Envoyer par email
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="pb-btn pb-btn-primary"
            style={{ padding: "8px 20px", fontSize: "14px" }}
          >
            {isSubmitting ? "Génération..." : "Générer"}
          </button>
        </Form>
        <p style={{ fontSize: "12px", color: "var(--pb-text-muted)", margin: "12px 0 0" }}>
          Si un export existe déjà pour cette date, il sera remplacé.
        </p>
      </div>

      {actionData && "success" in actionData && actionData.success && (
        <div
          style={{
            padding: "12px 16px",
            background: "#e8f5e8",
            border: "1px solid #00b44a",
            borderRadius: "8px",
            marginBottom: "24px",
            fontSize: "14px",
            color: "#1a5d1a",
          }}
        >
          {actionData.success}
        </div>
      )}
      {actionData && "error" in actionData && actionData.error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fee",
            border: "1px solid #dc2626",
            borderRadius: "8px",
            marginBottom: "24px",
            fontSize: "14px",
            color: "#991b1b",
          }}
        >
          {actionData.error}
        </div>
      )}

      {/* Liste */}
      {exports.length === 0 ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            border: "1px dashed var(--pb-border)",
            borderRadius: "12px",
            color: "var(--pb-text-muted)",
            fontSize: "14px",
          }}
        >
          Aucun export généré pour le moment.
        </div>
      ) : (
        <div style={{ border: "1px solid var(--pb-border)", borderRadius: "12px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "var(--pb-muted-bg, #fafafa)", borderBottom: "1px solid var(--pb-border)" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Date</th>
                <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: 600 }}>Contrats</th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Généré le</th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Origine</th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 600 }}>Email</th>
                <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: 600 }}></th>
              </tr>
            </thead>
            <tbody>
              {exports.map((exp) => (
                <tr key={exp.id} style={{ borderBottom: "1px solid var(--pb-border)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 500 }}>{formatDate(new Date(exp.exportDate))}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>{exp.acceptanceCount}</td>
                  <td style={{ padding: "12px 16px", color: "var(--pb-text-muted)" }}>
                    {formatDateTime(new Date(exp.generatedAt))}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--pb-text-muted)", fontSize: "13px" }}>
                    {exp.generatedBy}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--pb-text-muted)", fontSize: "13px" }}>
                    {exp.emailSentTo ? `✓ ${exp.emailSentTo}` : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <a
                      href={`/admin/exports-c4c/${exp.id}/download`}
                      style={{
                        padding: "6px 12px",
                        background: "#005cb1",
                        color: "white",
                        borderRadius: "6px",
                        textDecoration: "none",
                        fontSize: "13px",
                        fontWeight: 500,
                      }}
                    >
                      Télécharger
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "24px" }}>
          {page > 1 && (
            <Link
              to={`/admin/exports-c4c?page=${page - 1}`}
              style={{ padding: "6px 12px", border: "1px solid var(--pb-border)", borderRadius: "6px", textDecoration: "none", color: "var(--pb-text)" }}
            >
              ← Précédent
            </Link>
          )}
          <span style={{ padding: "6px 12px", color: "var(--pb-text-muted)", fontSize: "14px" }}>
            Page {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              to={`/admin/exports-c4c?page=${page + 1}`}
              style={{ padding: "6px 12px", border: "1px solid var(--pb-border)", borderRadius: "6px", textDecoration: "none", color: "var(--pb-text)" }}
            >
              Suivant →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}