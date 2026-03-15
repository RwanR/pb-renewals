import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useNavigation, Form, useRevalidator } from "react-router";
import { startImportJob, getImportStatus } from "~/lib/import.server";
import type { ImportResult } from "~/lib/import.server";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { useEffect, useState } from "react";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return { error: "Aucun fichier sélectionné" };
  }

  const buffer = await file.arrayBuffer();
  const jobId = startImportJob(buffer, file.name);

  return { jobId };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId) return { job: null };

  const job = getImportStatus(jobId);
  return { job: job ?? null };
}

export default function AdminImport() {
  const actionData = useActionData<{
    error?: string;
    jobId?: string;
  }>();
  const { job } = useLoaderData<{
    job: { status: string; result?: ImportResult } | null;
  }>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const isImporting = navigation.state === "submitting";

  const [jobId, setJobId] = useState<string | null>(null);

  // When we get a jobId from the action, start polling
  useEffect(() => {
    if (actionData?.jobId) {
      setJobId(actionData.jobId);
    }
  }, [actionData]);

  // Poll for status
  useEffect(() => {
    if (!jobId) return;
    if (job?.status === "success" || job?.status === "error") return;

    const interval = setInterval(() => {
      revalidator.revalidate();
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, job?.status, revalidator]);

  // Append jobId to loader URL
  useEffect(() => {
    if (jobId && !window.location.search.includes("jobId")) {
      window.history.replaceState(null, "", `?jobId=${jobId}`);
    }
  }, [jobId]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Import Excel</h1>

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
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <Button type="submit" disabled={isImporting || job?.status === "processing"}>
              {isImporting ? "Envoi..." : job?.status === "processing" ? "Import en cours..." : "Importer"}
            </Button>
          </div>
        </Form>
      </Card>

      {actionData?.error && (
        <Card className="mt-4 p-4 border-red-200 bg-red-50">
          <p className="text-red-700">{actionData.error}</p>
        </Card>
      )}

      {job?.status === "processing" && (
        <Card className="mt-4 p-4">
          <p className="text-sm text-gray-600 animate-pulse">
            Import en cours... Cette opération peut prendre quelques minutes.
          </p>
        </Card>
      )}

      {job?.result && (
        <Card className="mt-4 p-4">
          <h2 className="font-semibold mb-2">
            {job.status === "success" ? "✓ Import terminé" : "⚠ Import terminé avec erreurs"}
          </h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Lignes importées</dt>
              <dd className="font-mono">{job.result.rowCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Clients avec email</dt>
              <dd className="font-mono">{job.result.clientsWithEmail}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Clients sans email</dt>
              <dd className="font-mono text-orange-600">{job.result.clientsWithoutEmail}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Erreurs</dt>
              <dd className="font-mono text-red-600">{job.result.errors.length}</dd>
            </div>
          </dl>

          {job.result.errors.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-red-600 cursor-pointer">Voir les erreurs</summary>
              <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-60">
                {job.result.errors.join("\n")}
              </pre>
            </details>
          )}
        </Card>
      )}
    </div>
  );
}