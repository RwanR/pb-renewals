import type { Route } from "./+types/pbis_.admin.import";
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
    <div>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "24px" }}>Import PBIS</h1>

      <div className="admin-card" style={{ maxWidth: "640px" }}>
        <Form method="post" encType="multipart/form-data" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label className="admin-label">Fichier Excel (.xlsx, .xlsm)</label>
            <input
              type="file"
              name="file"
              accept=".xlsx,.xlsm"
              required
              className="admin-input"
            />
          </div>
          <button type="submit" disabled={isSubmitting} className="admin-btn" style={{ alignSelf: "flex-start" }}>
            {isSubmitting ? "Import en cours..." : "Lancer l'import"}
          </button>
        </Form>
      </div>

      {actionData && "error" in actionData && actionData.error && (
        <div style={{ maxWidth: "640px", marginTop: "20px", padding: "16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b", fontSize: "14px" }}>
          {actionData.error}
        </div>
      )}

      {actionData && "result" in actionData && actionData.result && (
        <div className="admin-card" style={{ maxWidth: "640px", marginTop: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>Résultat</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <li>Statut : <strong>{actionData.result.status}</strong></li>
            <li>Lignes traitées : {actionData.result.rowsProcessed}</li>
            <li>Clients uniques (déduplication SHIP_TO) : {actionData.result.uniqueClients}</li>
            <li>Upserted en base : {actionData.result.upserted}</li>
            <li>Tokens d'accès créés : {actionData.result.tokensCreated}</li>
            <li style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>Run ID : {actionData.result.importRunId}</li>
          </ul>
          {actionData.result.errors.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#991b1b" }}>Erreurs ({actionData.result.errors.length})</h3>
              <ul style={{ fontSize: "12px", color: "#991b1b", marginTop: "8px", paddingLeft: "16px", maxHeight: "240px", overflow: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
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