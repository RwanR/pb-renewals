import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useNavigation, Form, useRevalidator } from "react-router";
import { startImportJob, getImportStatus } from "~/lib/import.server";
import type { ImportJobStatus } from "~/lib/import.server";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { useEffect, useState, useRef } from "react";
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
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");

  const job = jobId ? getImportStatus(jobId) ?? null : null;

  const importRuns = await prisma.importRun.findMany({
    orderBy: { importedAt: "desc" },
    take: 5,
  });

  const stats = {
    clientCount: await prisma.client.count(),
    offerCount: await prisma.offer.count(),
  };

  return { job, importRuns, stats };
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{value.toLocaleString("fr-FR")} / {max.toLocaleString("fr-FR")}</span>
        <span>{percent}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
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
  switch (status) {
    case "success":
      return <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs font-medium">✓ Succès</span>;
    case "error":
      return <span className="inline-flex items-center gap-1 text-orange-700 bg-orange-50 px-2 py-0.5 rounded text-xs font-medium">⚠ Erreurs</span>;
    case "processing":
      return <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs font-medium"><Spinner /> En cours</span>;
    default:
      return <span className="text-gray-500 text-xs">{status}</span>;
  }
}

export default function AdminImport() {
  const actionData = useActionData<{ error?: string; jobId?: string }>();
  const { job, importRuns, stats } = useLoaderData<{
    job: ImportJobStatus | null;
    importRuns: any[];
    stats: { clientCount: number; offerCount: number };
  }>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const isUploading = navigation.state === "submitting";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(false);

  useEffect(() => {
    if (actionData?.jobId) {
      setJobId(actionData.jobId);
      window.history.replaceState(null, "", `?jobId=${actionData.jobId}`);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
      setHasFile(false);
    }
  }, [actionData]);

  // Poll while processing
  useEffect(() => {
    if (!jobId) return;
    if (job?.status === "success" || job?.status === "error") return;

    const interval = setInterval(() => {
      revalidator.revalidate();
    }, 1500);

    return () => clearInterval(interval);
  }, [jobId, job?.status]);

  const isProcessing = job?.status === "parsing" || job?.status === "importing";
  const isDisabled = isUploading || isProcessing;
  const isDone = job?.status === "success" || job?.status === "error";

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Import Excel</h1>

      {/* Stats actuelles */}
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

      {/* Upload */}
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
                disabled={isDisabled}
                onChange={(e) => setHasFile(!!(e.target.files && e.target.files.length > 0))}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <Button type="submit" disabled={isDisabled || !hasFile} className="w-full sm:w-auto">
              {isUploading ? (
                <span className="flex items-center gap-2"><Spinner /> Envoi du fichier...</span>
              ) : isProcessing ? (
                <span className="flex items-center gap-2"><Spinner /> Import en cours...</span>
              ) : (
                "Importer"
              )}
            </Button>
          </div>
        </Form>
      </Card>

      {/* Erreur upload */}
      {actionData?.error && !isUploading && (
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-red-700 text-sm">{actionData.error}</p>
        </Card>
      )}

      {/* État : Upload en cours */}
      {isUploading && (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Spinner />
            <div>
              <p className="font-medium text-sm">Envoi du fichier en cours...</p>
              <p className="text-xs text-gray-500">Le fichier est envoyé au serveur. Veuillez patienter.</p>
            </div>
          </div>
        </Card>
      )}

      {/* État : Parsing / Import */}
      {isProcessing && job && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Spinner />
            <div>
              <p className="font-medium text-sm">{job.message}</p>
            </div>
          </div>

          {job.total > 0 && (
            <>
              <ProgressBar value={job.progress} max={job.total} />

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 rounded p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Avec email</p>
                  <p className="font-mono font-semibold">{job.clientsWithEmail.toLocaleString("fr-FR")}</p>
                </div>
                <div className="bg-gray-50 rounded p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Sans email</p>
                  <p className="font-mono font-semibold text-orange-600">{job.clientsWithoutEmail.toLocaleString("fr-FR")}</p>
                </div>
                <div className="bg-gray-50 rounded p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Erreurs</p>
                  <p className="font-mono font-semibold text-red-600">{job.errorCount.toLocaleString("fr-FR")}</p>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Résultat final */}
      {isDone && job?.result && (
        <Card className={`p-5 space-y-4 ${job.status === "success" ? "border-green-200" : "border-orange-200"}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{job.status === "success" ? "✓" : "⚠"}</span>
            <div>
              <p className="font-semibold text-sm">
                {job.status === "success" ? "Import terminé avec succès" : "Import terminé avec erreurs"}
              </p>
              <p className="text-xs text-gray-500">
                {job.result.rowCount.toLocaleString("fr-FR")} clients importés
                {job.result.errors.length > 0 && ` · ${job.result.errors.length} erreur(s)`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 text-sm">
            <div className="bg-green-50 rounded p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Clients</p>
              <p className="text-lg font-mono font-bold text-green-700">{job.result.rowCount.toLocaleString("fr-FR")}</p>
            </div>
            <div className="bg-blue-50 rounded p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Avec email</p>
              <p className="text-lg font-mono font-bold text-blue-700">{job.result.clientsWithEmail.toLocaleString("fr-FR")}</p>
            </div>
            <div className="bg-orange-50 rounded p-3 text-center">
              <p className="text-xs text-gray-600 mb-1">Sans email</p>
              <p className="text-lg font-mono font-bold text-orange-700">{job.result.clientsWithoutEmail.toLocaleString("fr-FR")}</p>
            </div>
            <div className={`rounded p-3 text-center ${job.result.errors.length > 0 ? "bg-red-50" : "bg-gray-50"}`}>
              <p className="text-xs text-gray-600 mb-1">Erreurs</p>
              <p className={`text-lg font-mono font-bold ${job.result.errors.length > 0 ? "text-red-700" : "text-gray-400"}`}>
                {job.result.errors.length}
              </p>
            </div>
          </div>

          {job.result.errors.length > 0 && (
            <details>
              <summary className="text-sm text-red-600 cursor-pointer">Voir les erreurs</summary>
              <pre className="mt-2 text-xs bg-red-50 p-3 rounded overflow-auto max-h-48 text-red-800">
                {job.result.errors.join("\n")}
              </pre>
            </details>
          )}
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