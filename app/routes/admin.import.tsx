import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useNavigation, Form, useFetcher, useRevalidator } from "react-router";
import { requireAdmin } from "~/lib/admin-auth.server";
import { startImportJob } from "~/lib/import.server";
import type { ImportJobStatus } from "~/lib/import.server";
import { useEffect, useState, useRef } from "react";
import prisma from "~/db.server";

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) return { error: "Aucun fichier sélectionné" };
  if (!file.name.endsWith(".xlsx")) return { error: "Le fichier doit être au format .xlsx" };

  const buffer = await file.arrayBuffer();
  const jobId = startImportJob(buffer, file.name);
  return { jobId };
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  const importRuns = await prisma.importRun.findMany({ orderBy: { importedAt: "desc" }, take: 5 });
  const stats = {
    clientCount: await prisma.client.count(),
    offerCount: await prisma.offer.count(),
  };
  return { importRuns, stats };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminImport() {
  const actionData = useActionData<{ error?: string; jobId?: string }>();
  const { importRuns, stats } = useLoaderData<{ importRuns: any[]; stats: { clientCount: number; offerCount: number } }>();
  const navigation = useNavigation();
  const fetcher = useFetcher<{ job: ImportJobStatus | null }>();
  const revalidator = useRevalidator();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasFile, setHasFile] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const isUploading = navigation.state === "submitting";
  const fetcherJob = fetcher.data?.job ?? null;
  const [job, setJob] = useState<ImportJobStatus | null>(null);

  // Reset job when jobId changes
  useEffect(() => {
    setJob(null);
  }, [jobId]);

  // Update job from fetcher only if it matches current polling
  useEffect(() => {
    if (fetcherJob) {
      setJob(fetcherJob);
    }
  }, [fetcherJob]);

  const isProcessing = job?.status === "parsing" || job?.status === "importing";
  const isDone = jobId && (job?.status === "success" || job?.status === "error");
  const isBusy = isUploading || isProcessing;

  useEffect(() => {
    if (actionData?.jobId && actionData.jobId !== jobId && !dismissed) {
      setJobId(actionData.jobId);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setHasFile(false);
    }
  }, [actionData, dismissed]);

  useEffect(() => {
    if (!jobId || isDone) return;
    fetcher.load(`/admin/import-status?jobId=${jobId}`);
    const interval = setInterval(() => {
      fetcher.load(`/admin/import-status?jobId=${jobId}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [jobId, isDone]);

  // Refresh stats when done
  useEffect(() => {
    if (isDone) {
      revalidator.revalidate();
    }
  }, [isDone]);

  return (
    <div className="admin-space">
      <h1 className="admin-title">Import Excel</h1>

      {/* Stats */}
      <div className="admin-grid-2">
        <div className="admin-card">
          <div className="admin-stat-label">Clients en base</div>
          <div className="admin-stat-value">{stats.clientCount.toLocaleString("fr-FR")}</div>
        </div>
        <div className="admin-card">
          <div className="admin-stat-label">Offres en base</div>
          <div className="admin-stat-value">{stats.offerCount.toLocaleString("fr-FR")}</div>
        </div>
      </div>

      {/* Upload */}
      {!isBusy && !isDone && (
        <div className="admin-card">
          <Form method="post" encType="multipart/form-data">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label htmlFor="file" className="admin-label">Fichier Excel (.xlsx)</label>
                <input
                  ref={fileInputRef}
                  id="file"
                  name="file"
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => { setHasFile(!!(e.target.files && e.target.files.length > 0)); setDismissed(false); }}
                  className="admin-input-file"
                />
              </div>
              <div>
                <button type="submit" disabled={!hasFile} className="admin-btn">
                  Importer
                </button>
              </div>
            </div>
          </Form>
          {actionData?.error && <p className="admin-error-text" style={{ marginTop: 12 }}>{actionData.error}</p>}
        </div>
      )}

      {/* Uploading */}
      {isUploading && (
        <div className="admin-card">
          <div className="admin-flex">
            <div className="admin-spinner" />
            <div>
              <div style={{ fontWeight: 500 }}>Envoi du fichier...</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Le fichier est en cours d'envoi au serveur.</div>
            </div>
          </div>
        </div>
      )}

      {/* Parsing */}
      {job?.status === "parsing" && (
        <div className="admin-card">
          <div className="admin-flex">
            <div className="admin-spinner" />
            <div>
              <div style={{ fontWeight: 500 }}>{job.message}</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Analyse des colonnes et des lignes du fichier.</div>
            </div>
          </div>
        </div>
      )}

      {/* Importing with progress */}
      {job?.status === "importing" && (
        <div className="admin-card" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="admin-flex">
            <div className="admin-spinner" />
            <div style={{ fontWeight: 500 }}>{job.message}</div>
          </div>

          {/* Clients progress */}
          <div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Clients</div>
            <div className="admin-progress-wrap">
              <div className="admin-progress-bar" style={{ width: `${job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0}%` }} />
            </div>
            <div className="admin-progress-text">
              <span>{job.progress.toLocaleString("fr-FR")} / {job.total.toLocaleString("fr-FR")}</span>
              <span style={{ fontWeight: 600 }}>{job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0}%</span>
            </div>
          </div>

          {/* Offers progress */}
          {job.offersTotal > 0 && (
            <div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Offres</div>
              <div className="admin-progress-wrap">
                <div className="admin-progress-bar" style={{ width: `${Math.round((job.offersProgress / job.offersTotal) * 100)}%`, background: "#7c3aed" }} />
              </div>
              <div className="admin-progress-text">
                <span>{job.offersProgress.toLocaleString("fr-FR")} / {job.offersTotal.toLocaleString("fr-FR")}</span>
                <span style={{ fontWeight: 600 }}>{Math.round((job.offersProgress / job.offersTotal) * 100)}%</span>
              </div>
            </div>
          )}

          <div className="admin-grid-3">
            <div className="admin-stat-box blue">
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Avec email</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#1d4ed8" }}>{job.clientsWithEmail.toLocaleString("fr-FR")}</div>
            </div>
            <div className="admin-stat-box orange">
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Sans email</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#c2410c" }}>{job.clientsWithoutEmail.toLocaleString("fr-FR")}</div>
            </div>
            <div className="admin-stat-box">
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Erreurs</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#dc2626" }}>{job.errorCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {isDone && job?.result && (
        <div className={`admin-card ${job.status === "success" ? "admin-card-success" : "admin-card-error"}`} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="admin-flex">
            <div className={`admin-result-icon ${job.status === "success" ? "success" : "error"}`}>
              {job.status === "success" ? "✓" : "⚠"}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>
                {job.status === "success" ? "Import terminé avec succès" : "Import terminé avec erreurs"}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                {job.result.rowCount.toLocaleString("fr-FR")} clients · {job.result.clientsWithEmail.toLocaleString("fr-FR")} avec email · {job.result.clientsWithoutEmail.toLocaleString("fr-FR")} sans email
              </div>
            </div>
          </div>

          {job.result.errors.length > 0 && (
            <details className="admin-details">
              <summary>{job.result.errors.length} erreur(s)</summary>
              <pre>{job.result.errors.join("\n")}</pre>
            </details>
          )}

          <div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button className="admin-btn admin-btn-outline" onClick={() => { setJobId(null); setDismissed(true); }}>
              Nouvel import
            </button>
            <a href="/admin/export-links" className="admin-btn">
              Exporter les liens
            </a>
          </div>
          </div>
        </div>
      )}

      {/* History */}
      {importRuns.length > 0 && (
        <div>
          <div className="admin-subtitle">Historique des imports</div>
          <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Fichier</th>
                  <th className="right">Lignes</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {importRuns.map((run: any) => (
                  <tr key={run.id}>
                    <td>{formatDate(run.importedAt)}</td>
                    <td className="mono" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{run.filename}</td>
                    <td className="mono right">{run.rowCount.toLocaleString("fr-FR")}</td>
                    <td>
                      {run.status === "success" && <span className="admin-badge admin-badge-success">✓ Succès</span>}
                      {run.status === "error" && <span className="admin-badge admin-badge-error">⚠ Erreurs</span>}
                      {run.status === "processing" && <span className="admin-badge admin-badge-processing">En cours</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}