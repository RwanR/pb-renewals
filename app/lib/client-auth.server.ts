import { createCookieSessionStorage, redirect } from "react-router";
import prisma from "~/db.server";

export const clientSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__client",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || "dev-secret-change-me"],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24, // 24h
  },
});

/**
 * Validate a token from URL and return the client's accountNumber
 */
export async function validateToken(token: string): Promise<string | null> {
  const accessToken = await prisma.accessToken.findUnique({
    where: { token },
  });

  if (!accessToken) return null;
  if (accessToken.expiresAt < new Date()) return null;

  // Mark as used
  await prisma.accessToken.update({
    where: { token },
    data: { usedAt: new Date() },
  });

  return accessToken.clientAccountNumber;
}

/**
 * Validate an account number exists in the database
 */
export async function validateAccountNumber(accountNumber: string): Promise<boolean> {
  const client = await prisma.client.findUnique({
    where: { accountNumber },
    select: { accountNumber: true },
  });
  return !!client;
}

/**
 * Create a session for an authenticated client
 */
export async function createClientSession(accountNumber: string, redirectTo: string) {
  const session = await clientSessionStorage.getSession();
  session.set("accountNumber", accountNumber);
  session.set("authenticatedAt", new Date().toISOString());

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await clientSessionStorage.commitSession(session),
    },
  });
}

/**
 * Get the authenticated client's account number from session
 */
export async function getClientAccountNumber(request: Request): Promise<string | null> {
  const session = await clientSessionStorage.getSession(
    request.headers.get("Cookie")
  );
  return session.get("accountNumber") || null;
}

/**
 * Require an authenticated client, redirect to fallback if not
 */
export async function requireClient(request: Request): Promise<string> {
  const accountNumber = await getClientAccountNumber(request);
  if (!accountNumber) {
    throw redirect("/offre");
  }
  return accountNumber;
}

/**
 * Require that the session matches the requested account
 */
export async function requireClientAccess(
  request: Request,
  requestedAccount: string
): Promise<string> {
  const accountNumber = await requireClient(request);
  if (accountNumber !== requestedAccount) {
    throw redirect("/offre");
  }
  return accountNumber;
}