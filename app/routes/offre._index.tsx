import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useNavigation, useLoaderData } from "react-router";
import {
  validateAccountNumber,
  createClientSession,
  getClientAccountNumber,
} from "~/lib/client-auth.server";
import prisma from "~/db.server";
import { redirect } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const accountNumber = await getClientAccountNumber(request);
  if (accountNumber) {
    return redirect(`/offre/${accountNumber}`);
  }

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

  const cleaned = accountNumber.replace(/[\s\-]/g, "");

  const exists = await validateAccountNumber(cleaned);
  if (!exists) {
    return {
      error: "Numéro de compte non reconnu. Vérifiez le numéro figurant sur votre courrier ou email.",
    };
  }

  const client = await prisma.client.findUnique({
    where: { accountNumber: cleaned },
    select: { customerName: true },
  });

  return createClientSession(cleaned, `/offre/${cleaned}`, client?.customerName || undefined);
}

export default function OffreFallback() {
  const { tokenError } = useLoaderData<{ tokenError: boolean }>();
  const actionData = useActionData<{ error?: string }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 260px)", padding: "0 16px" }}>
      <div style={{ maxWidth: "596px", width: "100%", textAlign: "center", paddingBottom: "32px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 500, lineHeight: "24px", letterSpacing: "0.1px", color: "var(--pb-text)" }}>
          Pour renouveler votre contrat en ligne, veuillez saisir votre numéro de compte
        </h1>
      </div>

      {tokenError && (
        <div className="pb-error" style={{ maxWidth: "390px", width: "100%", marginBottom: "16px" }}>
          Votre lien a expiré ou n'est plus valide. Veuillez saisir votre numéro de compte ci-dessous.
        </div>
      )}

      <Form method="post" style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", width: "100%", maxWidth: "390px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          minHeight: "40px",
          padding: "9.5px 16px",
          background: "white",
          border: "1px solid var(--pb-border)",
          borderRadius: "8px",
          boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <circle cx="10" cy="7.5" r="3" stroke="#737373" strokeWidth="1.3" fill="none"/>
            <path d="M4 17.5C4 14 6.5 12 10 12s6 2 6 5.5" stroke="#737373" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
          </svg>
          <input
            id="accountNumber"
            name="accountNumber"
            type="text"
            inputMode="numeric"
            placeholder="Votre numéro de compte"
            autoFocus
            required
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "inherit",
              fontSize: "14px",
              lineHeight: "20px",
              color: "var(--pb-foreground)",
            }}
          />
        </div>

        {actionData?.error && (
          <div className="pb-error" style={{ width: "100%" }}>{actionData.error}</div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: "100%",
            minHeight: "40px",
            padding: "10px 24px",
            background: "var(--pb-cta)",
            color: "#fafafa",
            border: "none",
            borderRadius: "8px",
            fontFamily: "inherit",
            fontSize: "14px",
            fontWeight: 500,
            lineHeight: "20px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            opacity: isSubmitting ? 0.5 : 1,
          }}
        >
          {isSubmitting ? (
            <><span className="pb-spinner" /> Vérification...</>
          ) : (
            "Continuer"
          )}
        </button>
      </Form>
    </div>
  );
}