import { createCookieSessionStorage, redirect } from "react-router";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__admin",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || "dev-secret-change-me"],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  },
});

export async function requireAdmin(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  if (session.get("authenticated") !== true) {
    throw redirect("/admin/login");
  }
  return session;
}