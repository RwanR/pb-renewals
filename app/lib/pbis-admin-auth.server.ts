import { createCookieSessionStorage, redirect } from "react-router";

const PBIS_ADMIN_PASSWORD = process.env.PBIS_ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

// Cookie distinct de celui de Renewals -> session admin totalement séparée.
export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "pbis_admin_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  },
});

export function verifyPassword(password: string): boolean {
  return PBIS_ADMIN_PASSWORD.length > 0 && password === PBIS_ADMIN_PASSWORD;
}

export async function requireAdmin(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  if (session.get("authenticated") !== true) {
    throw redirect("/pbis/admin/login");
  }
  return true;
}