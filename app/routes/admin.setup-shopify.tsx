import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, Form, useNavigation } from "react-router";
import { requireAdmin } from "~/lib/admin-auth.server";
import { createMetafieldDefinitions } from "~/lib/shopify-admin.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);
  const result = await createMetafieldDefinitions();
  return { result };
}

export default function AdminSetupShopify() {
  const actionData = useActionData<{ result?: { created: number; errors: string[] } }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "32px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "16px" }}>Setup Shopify Metafields</h1>
      <p style={{ marginBottom: "24px", color: "#666" }}>
        Crée les définitions de metafields PB Renewals sur le Customer Shopify. À exécuter une seule fois.
      </p>

      <Form method="post">
        <button type="submit" disabled={isSubmitting} style={{
          padding: "12px 24px", background: "#005cb1", color: "white", border: "none",
          borderRadius: "8px", fontSize: "16px", cursor: "pointer",
        }}>
          {isSubmitting ? "Création en cours..." : "Créer les metafield definitions"}
        </button>
      </Form>

      {actionData?.result && (
        <div style={{ marginTop: "24px", padding: "16px", background: "#f0f9f0", borderRadius: "8px" }}>
          <p><strong>{actionData.result.created}</strong> définitions créées</p>
          {actionData.result.errors.length > 0 && (
            <div style={{ marginTop: "8px", color: "#dc2626" }}>
              {actionData.result.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}