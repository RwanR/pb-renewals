import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useNavigation, Form } from "react-router";
import { startImportJob } from "~/lib/import.server";
import type { ImportJobStatus } from "~/lib/import.server";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { useEffect, useState, useRef, useCallback } from "react";
import prisma from "~/db.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return { error: "Aucun fichier sélectionné" };
  }

  if (!file.name.endsWith(".xlsx")) {
    return { error: "Le fichier doit être au format .xlsx" };
  }

  const buffer = await file.arrayBuffer();
  const jobId = startImportJob(buffer, file.name);

  return { jobId };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const importRuns = await prisma.importRun.findMany({
    orderBy: { importedAt: "desc" },
    take: 5,
  });

  const stats = {
    clientCount: await prisma.client.count(),
    offerCount: await prisma.offer.count(),
  };

  return { importRuns, stats };
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className="bg-blue-600 h-3 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{value.toLocaleString("fr-FR")} / {max.toLocaleString("fr-FR")} clients</span>
        <span className="font-semibold">{percent}%</span>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs font-medium">✓ Succès</span>;
  if (status === "error") return <span className="text-orange-700 bg-orange-50 px-2 py-0.5 rounded text-xs font-medium">⚠ Erreurs</span>;
  if (status === "processing") return <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs font-medium">En cours</span>;
  return <span className="text-gray-500 text-xs">{status}</span>;
}

export default function AdminImport() {
  const actionData = useActionData<{ error?: string; jobId?: string }>();
  const { importRuns, stats } = useLoaderData<{
    importRuns: any[];
    stats: { clientCount: number; offerCount: number };
  }>();
  const navigation = useNavigation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasFile, setHasFile] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<ImportJobStatus | null>(null);

  const isUploading = navigation.state === "submitting";
  const isProcessing = job?.status === "parsing" || job?.status === "importing";
  const isDone = job?.status === "success" || job?.status === "error";
  const isBusy = isUploading || isProcessing;

  // When action returns a jobId, start polling
  useEffect(() => {
    if (actionData?.jobId && actionData.jobId !== jobId) {
      setJobId(actionData.jobId);
      setJob(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setHasFile(false);
    }
  }, [actionData]);

  // Poll job status via fetch
  const pollStatus = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/app/import-status?jobId=${jobId}`);
      const data = await res.json();
      if (data.job) {
        setJob(data.job);
      }
    } catch (e) {
      console.error("Poll error:", e);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    if (isDone) return;

    // Poll immediately
    pollStatus();

    const interval = setInterval(pollStatus, 1000);
    return () => clearInterval(interval);
  }, [jobId, isDone, pollStatus]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Import Excel</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Clients en base</p>
          <p className="text-2xl font-mono font-bold">{stats.clientCount.toLocaleString("fr-FR")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Offres en base</p>
          <p className="text-2xl font-mono font-bold">{stats.offerCount.toLocaleString("fr-FR")}</p>
        </Card>
      </div>

      {/* Upload — masqué pendant le traitement */}
      {!isBusy && !isDone && (
        <Card className="p-6">
          <Form method="post" encType="multipart/form-data">
            <div className="space-y-4">
              <div>
                <label htmlFor="file" className="block text-sm font-medium mb-2">
                  Fichier Excel (.xlsx)
                </label>
                <input
                  ref={fileInputRef}
                  id="file"
                  name="file"
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setHasFile(!!(e.target.files && e.target.files.length > 0))}
                  className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <Button type="submit" disabled={!hasFile}>
                Importer
              </Button>
            </div>
          </Form>

          {actionData?.error && (
            <p className="mt-3 text-red-600 text-sm">{actionData.error}</p>
          )}
        </Card>
      )}

      {/* État : Upload du fichier */}
      {isUploading && (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Spinner className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium">Envoi du fichier...</p>
              <p className="text-sm text-gray-500">Le fichier est en cours d'envoi au serveur.</p>
            </div>
          </div>
        </Card>
      )}

      {/* État : Parsing */}
      {job?.status === "parsing" && (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Spinner className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium">{job.message}</p>
              <p className="text-sm text-gray-500">Analyse des colonnes et des lignes du fichier.</p>
            </div>
          </div>
        </Card>
      )}

      {/* État : Import en cours avec barre de progression */}
      {job?.status === "importing" && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Spinner className="h-5 w-5 text-blue-600" />
            <p className="font-medium">{job.message}</p>
          </div>

          <ProgressBar value={job.progress} max={job.total} />

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Avec email</p>
              <p className="text-lg font-mono font-bold text-blue-700">{job.clientsWithEmail.toLocaleString("fr-FR")}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Sans email</p>
              <p className="text-lg font-mono font-bold text-orange-600">{job.clientsWithoutEmail.toLocaleString("fr-FR")}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Erreurs</p>
              <p className="text-lg font-mono font-bold text-red-600">{job.errorCount}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Résultat final */}
      {isDone && job?.result && (
        <Card className={`p-6 space-y-5 ${job.status === "success" ? "border-green-300 bg-green-50/30" : "border-orange-300 bg-orange-50/30"}`}>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg ${job.status === "success" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
              {job.status === "success" ? "✓" : "⚠"}
            </div>
            <div>
              <p className="font-semibold">
                {job.status === "success" ? "Import terminé avec succès" : "Import terminé avec erreurs"}
              </p>
              <p className="text-sm text-gray-600">
                {job.result.rowCount.toLocaleString("fr-FR")} clients · {job.result.clientsWithEmail.toLocaleString("fr-FR")} avec email · {job.result.clientsWithoutEmail.toLocaleString("fr-FR")} sans email
              </p>
            </div>
          </div>

          {job.result.errors.length > 0 && (
            <details>
              <summary className="text-sm text-red-600 cursor-pointer">{job.result.errors.length} erreur(s)</summary>
              <pre className="mt-2 text-xs bg-red-50 p-3 rounded overflow-auto max-h-40 text-red-800">
                {job.result.errors.join("\n")}
              </pre>
            </details>
          )}

          <Button
            variant="outline"
            onClick={() => { setJobId(null); setJob(null); }}
          >
            Nouvel import
          </Button>
        </Card>
      )}

      {/* Historique */}
      {importRuns.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3 text-sm text-gray-700">Historique des imports</h2>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-gray-500">Date</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500">Fichier</th>
                  <th className="text-right p-3 text-xs font-medium text-gray-500">Lignes</th>
                  <th className="text-left p-3 text-xs font-medium text-gray-500">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {importRuns.map((run: any) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-600 text-xs">{formatDate(run.importedAt)}</td>
                    <td className="p-3 font-mono text-xs truncate max-w-[200px]">{run.filename}</td>
                    <td className="p-3 text-right font-mono text-xs">{run.rowCount.toLocaleString("fr-FR")}</td>
                    <td className="p-3"><StatusBadge status={run.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}