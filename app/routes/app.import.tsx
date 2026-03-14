import type { ActionFunctionArgs } from "react-router";
import { useActionData, useNavigation, Form } from "react-router";
import { importExcel } from "~/lib/import.server";
import type { ImportResult } from "~/lib/import.server";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return { error: "Aucun fichier sélectionné" };
  }

  const buffer = await file.arrayBuffer();
  const result = await importExcel(buffer, file.name);

  return { result };
}

export default function AdminImport() {
  const actionData = useActionData<{
    error?: string;
    result?: ImportResult;
  }>();
  const navigation = useNavigation();
  const isImporting = navigation.state === "submitting";

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Import Excel</h1>

      <Card className="p-6">
        <Form method="post" encType="multipart/form-data">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="file"
                className="block text-sm font-medium mb-2"
              >
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

            <Button type="submit" disabled={isImporting}>
              {isImporting ? "Import en cours..." : "Importer"}
            </Button>
          </div>
        </Form>
      </Card>

      {actionData?.error && (
        <Card className="mt-4 p-4 border-red-200 bg-red-50">
          <p className="text-red-700">{actionData.error}</p>
        </Card>
      )}

      {actionData?.result && (
        <Card className="mt-4 p-4">
          <h2 className="font-semibold mb-2">Résultat</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Lignes importées</dt>
              <dd className="font-mono">{actionData.result.rowCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Clients avec email</dt>
              <dd className="font-mono">
                {actionData.result.clientsWithEmail}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Clients sans email</dt>
              <dd className="font-mono text-orange-600">
                {actionData.result.clientsWithoutEmail}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Erreurs</dt>
              <dd className="font-mono text-red-600">
                {actionData.result.errors.length}
              </dd>
            </div>
          </dl>

          {actionData.result.errors.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-red-600 cursor-pointer">
                Voir les erreurs
              </summary>
              <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-60">
                {actionData.result.errors.join("\n")}
              </pre>
            </details>
          )}
        </Card>
      )}
    </div>
  );
}