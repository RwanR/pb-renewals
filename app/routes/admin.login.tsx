import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData } from "react-router";
import { sessionStorage } from "~/lib/admin-auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  if (url.searchParams.get("logout") === "1") {
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    return redirect("/admin/login", {
      headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
    });
  }
  return {};
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const password = formData.get("password") as string;

  if (password !== (process.env.ADMIN_PASSWORD || "admin")) {
    return { error: "Mot de passe incorrect" };
  }

  const session = await sessionStorage.getSession();
  session.set("authenticated", true);

  return redirect("/admin/import", {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

export default function AdminLogin() {
  const actionData = useActionData<{ error?: string }>();

  return (
    <div className="admin-login-wrap">
      <div className="admin-card admin-login-card">
        <div className="admin-login-title">PB Renewals — Admin</div>
        <Form method="post" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label htmlFor="password" className="admin-label">Mot de passe</label>
            <input id="password" name="password" type="password" autoFocus required className="admin-input" />
          </div>
          {actionData?.error && <p className="admin-error-text">{actionData.error}</p>}
          <button type="submit" className="admin-btn" style={{ width: "100%", justifyContent: "center" }}>
            Connexion
          </button>
        </Form>
      </div>
    </div>
  );
}