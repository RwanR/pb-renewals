import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useActionData } from "react-router";
import { sessionStorage } from "~/lib/admin-auth.server";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-xl font-bold mb-6 text-center">PB Renewals — Admin</h1>
        <Form method="post" className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Mot de passe
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoFocus
              required
            />
          </div>
          {actionData?.error && (
            <p className="text-red-600 text-sm">{actionData.error}</p>
          )}
          <Button type="submit" className="w-full">
            Connexion
          </Button>
        </Form>
      </Card>
    </div>
  );
}