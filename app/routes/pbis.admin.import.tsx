import type { Route } from "./+types/pbis.admin.import";
import { Form, useNavigation } from "react-router";
import { importPbisExcel } from "../lib/pbis-import.server";

export function meta() {
  return [{ title: "Import PBIS - Admin" }];
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Aucun fichier sélectionné" };
  }

  const result = await importPbisExcel(await file.arrayBuffer(), file.name);
  return { result };
}

export default function PbisAdminImport({ actionData }: Route.ComponentProps) {
  const nav = useNavigation();
  const isSubmitting = nav.state === "submitting";

  return (
    <div className="max-w-2xl mx-auto p-8 font-inter">
      <h1 className="font-precision text-3xl mb-6">Import PBIS</h1>

      <Form method="post" encType="multipart/form-data" className="flex flex-col gap-4">
        <input
          type="file"
          name="file"
          accept=".xlsx,.xlsm"
          required
          className="block w-full text-sm border border-neutral-200 rounded-lg p-3"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="self-start px-6 py-3 rounded-full bg-[#d7008f] text-white font-medium disabled:opacity-50"
        >
          {isSubmitting ? "Import en cours..." : "Lancer l'import"}
        </button>
      </Form>

      {actionData && "error" in actionData && actionData.error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded text-red-900 text-sm">
          {actionData.error}
        </div>
      )}

      {actionData && "result" in actionData && actionData.result && (
        <div className="mt-6 p-4 bg-neutral-50 border border-neutral-200 rounded">
          <h2 className="font-medium mb-3">Résultat</h2>
          <ul className="text-sm space-y-1">
            <li>Statut : <strong>{actionData.result.status}</strong></li>
            <li>Lignes traitées : {actionData.result.rowsProcessed}</li>
            <li>Clients uniques (déduplication SHIP_TO) : {actionData.result.uniqueClients}</li>
            <li>Upserted en base : {actionData.result.upserted}</li>
            <li className="text-xs text-neutral-500 mt-2">Run ID : {actionData.result.importRunId}</li>
          </ul>
          {actionData.result.errors.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-red-900">Erreurs ({actionData.result.errors.length})</h3>
              <ul className="text-xs text-red-900 mt-2 space-y-1 max-h-60 overflow-auto">
                {actionData.result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}