import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useNavigation, useLoaderData } from "react-router";
import {
  validateAccountNumber,
  createClientSession,
  getClientAccountNumber,
} from "~/lib/client-auth.server";
import { redirect } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  // If already authenticated, redirect to their offer
  const accountNumber = await getClientAccountNumber(request);
  if (accountNumber) {
    return redirect(`/offre/${accountNumber}`);
  }

  // Check if there was a token error from the layout
  const url = new URL(request.url);
  const tokenError = url.searchParams.get("token") !== null;

  return { tokenError };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const accountNumber = (formData.get("accountNumber") as string)?.trim();

  if (!accountNumber) {
    return { error: "Veuillez saisir votre numéro de compte." };
  }

  // Clean: remove spaces, dashes
  const cleaned = accountNumber.replace(/[\s\-]/g, "");

  const exists = await validateAccountNumber(cleaned);
  if (!exists) {
    return {
      error: "Numéro de compte non reconnu. Vérifiez le numéro figurant sur votre courrier ou email.",
    };
  }

  return createClientSession(cleaned, `/offre/${cleaned}`);
}

export default function OffreFallback() {
  const { tokenError } = useLoaderData<{ tokenError: boolean }>();
  const actionData = useActionData<{ error?: string }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="pb-login-center pb-space">
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h1 className="pb-title" style={{ marginBottom: "12px" }}>
          Votre offre de renouvellement
        </h1>
        <p className="pb-text" style={{ color: "var(--pb-text-light)" }}>
          Saisissez votre numéro de compte pour accéder à votre offre personnalisée.
          Ce numéro figure sur le courrier ou l'email que vous avez reçu de Pitney Bowes.
        </p>
      </div>

      {tokenError && (
        <div className="pb-error">
          Votre lien a expiré ou n'est plus valide. Veuillez saisir votre numéro de compte ci-dessous.
        </div>
      )}

      <div className="pb-card">
        <Form method="post" className="pb-space-sm">
          <div>
            <label htmlFor="accountNumber" className="pb-label">
              Numéro de compte
            </label>
            <input
              id="accountNumber"
              name="accountNumber"
              type="text"
              inputMode="numeric"
              placeholder="Ex : 30240367"
              autoFocus
              required
              className="pb-input"
              style={{ fontSize: "18px", letterSpacing: "0.05em", fontWeight: 500 }}
            />
          </div>

          {actionData?.error && (
            <div className="pb-error">{actionData.error}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="pb-btn pb-btn-primary pb-btn-full"
          >
            {isSubmitting ? (
              <><span className="pb-spinner" /> Vérification...</>
            ) : (
              "Accéder à mon offre"
            )}
          </button>
        </Form>
      </div>

      <p className="pb-text-xs" style={{ textAlign: "center", marginTop: "24px" }}>
        Besoin d'aide ? Contactez-nous au{" "}
        <strong>0 825 850 825</strong> ou sur{" "}
        <a href="https://www.pitneybowes.fr" className="pb-link" target="_blank" rel="noopener">
          pitneybowes.fr
        </a>
      </p>
    </div>
  );
}