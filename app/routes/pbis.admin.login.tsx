import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { Form, redirect, useActionData } from "react-router";
import { sessionStorage, verifyPassword } from "~/lib/pbis-admin-auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const url = new URL(request.url);

  if (url.searchParams.get("logout") === "1") {
    return redirect("/pbis/admin/login", {
      headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
    });
  }

  if (session.get("authenticated") === true) {
    return redirect("/pbis/admin");
  }
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const password = String(form.get("password") || "");

  if (!verifyPassword(password)) {
    return { error: "Mot de passe incorrect" };
  }

  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  session.set("authenticated", true);
  return redirect("/pbis/admin", {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

export default function PbisAdminLogin() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="admin-login-wrap">
      <div className="admin-login-card admin-card">
        <h1 className="admin-login-title">PBIS — Admin</h1>
        <Form method="post">
          <label className="admin-label" htmlFor="password">Mot de passe</label>
          <input id="password" name="password" type="password" className="admin-input" autoFocus required />
          {actionData?.error && (
            <p className="admin-error-text" style={{ marginTop: "8px" }}>{actionData.error}</p>
          )}
          <button type="submit" className="admin-btn" style={{ width: "100%", justifyContent: "center", marginTop: "16px" }}>
            Se connecter
          </button>
        </Form>
      </div>
    </div>
  );
}