import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useNavigation, Form, useRevalidator } from "react-router";
import { startImportJob, getImportStatus } from "~/lib/import.server";
import type { ImportJobStatus } from "~/lib/import.server";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { useEffect, useState } from "react";
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

  const stats = await prisma.client.count().then(async (clientCount) => ({
    clientCount,
    offerCount: await prisma.offer.count(),
  }));

  return { job, importRuns, stats };
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div
        className="bg-blue-600 h-3 rounded-full transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    if (actionData?.jobId) {
      setJobId(actionData.jobId);
      window.history.replaceState(null, "", `?jobId=${actionData.jobId}`);
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

  const isProcessing = job?.status === "processing";

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
                id="file"
                name="file"
                type="file"
                accept=".xlsx"
                disabled={isUploading || isProcessing}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
            </div>
            <Button type="submit" disabled={isUploading || isProcessing}>
              {isUploading ? "Envoi du fichier..." : isProcessing ? "Import en cours..." : "Importer"}
            </Button>
          </div>
        </Form>
      </Card>

      {/* Erreur upload */}
      {actionData?.error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-red-700 text-sm">{actionData.error}</p>
        </Card>
      )}

      {/* Progression */}
      {isProcessing && job && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Import en cours</h2>
            <span className="text-sm text-gray-500 font-mono">
              {job.progress.toLocaleString("fr-FR")} / {job.total.toLocaleString("fr-FR")}
            </span>
          </div>

          <ProgressBar value={job.progress} max={job.total} />

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-gray-50 rounded p-3">
              <p className="text-gray-500">Avec email</p>
              <p className="font-mono font-semibold">{job.clientsWithEmail.toLocaleString("fr-FR")}</p>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-gray-500">Sans email</p>
              <p className="font-mono font-semibold text-orange-600">{job.clientsWithoutEmail.toLocaleString("fr-FR")}</p>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-gray-500">Erreurs</p>
              <p className="font-mono font-semibold text-red-600">{job.errorCount.toLocaleString("fr-FR")}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Résultat final */}
      {job?.result && (job.status === "success" || job.status === "error") && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className={job.status === "success" ? "text-green-600 text-xl" : "text-orange-500 text-xl"}>
              {job.status === "success" ? "✓" : "⚠"}
            </span>
            <h2 className="font-semibold">
              {job.status === "success" ? "Import terminé" : "Import terminé avec erreurs"}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-green-50 rounded p-3">
              <p className="text-gray-600">Clients importés</p>
              <p className="text-xl font-mono font-bold text-green-700">
                {job.result.rowCount.toLocaleString("fr-FR")}
              </p>
            </div>
            <div className="bg-blue-50 rounded p-3">
              <p className="text-gray-600">Avec email</p>
              <p className="text-xl font-mono font-bold text-blue-700">
                {job.result.clientsWithEmail.toLocaleString("fr-FR")}
              </p>
            </div>
            <div className="bg-orange-50 rounded p-3">
              <p className="text-gray-600">Sans email</p>
              <p className="text-xl font-mono font-bold text-orange-700">
                {job.result.clientsWithoutEmail.toLocaleString("fr-FR")}
              </p>
            </div>
            <div className={job.result.errors.length > 0 ? "bg-red-50 rounded p-3" : "bg-gray-50 rounded p-3"}>
              <p className="text-gray-600">Erreurs</p>
              <p className={`text-xl font-mono font-bold ${job.result.errors.length > 0 ? "text-red-700" : "text-gray-400"}`}>
                {job.result.errors.length.toLocaleString("fr-FR")}
              </p>
            </div>
          </div>

          {job.result.errors.length > 0 && (
            <details>
              <summary className="text-sm text-red-600 cursor-pointer">
                Voir les {job.result.errors.length} erreurs
              </summary>
              <pre className="mt-2 text-xs bg-red-50 p-3 rounded overflow-auto max-h-60 text-red-800">
                {job.result.errors.join("\n")}
              </pre>
            </details>
          )}
        </Card>
      )}

      {/* Historique */}
      {importRuns.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">Historique des imports</h2>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Fichier</th>
                  <th className="text-right p-3">Lignes</th>
                  <th className="text-left p-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {importRuns.map((run: any) => (
                  <tr key={run.id}>
                    <td className="p-3 text-gray-600">{formatDate(run.importedAt)}</td>
                    <td className="p-3 font-mono text-xs">{run.filename}</td>
                    <td className="p-3 text-right font-mono">{run.rowCount.toLocaleString("fr-FR")}</td>
                    <td className="p-3">
                      {run.status === "success" && <span className="text-green-600 font-medium">✓ Succès</span>}
                      {run.status === "error" && <span className="text-orange-500 font-medium">⚠ Erreurs</span>}
                      {run.status === "processing" && <span className="text-blue-500 font-medium">⏳ En cours</span>}
                    </td>
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