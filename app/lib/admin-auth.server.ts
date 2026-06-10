import { createCookieSessionStorage, redirect } from "react-router";
import { scryptSync, timingSafeEqual } from "node:crypto";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET manquant en production");
}

export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__admin",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret || "dev-secret-change-me"],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  },
});

export async function requireAdmin(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  if (session.get("authenticated") !== true) {
    throw redirect("/admin/login");
  }
  return session;
}