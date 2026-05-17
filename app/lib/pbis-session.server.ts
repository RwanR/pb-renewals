import { createCookieSessionStorage } from "react-router";

type PbisSessionData = {
  shipTo: string;
};

const sessionStorage = createCookieSessionStorage<PbisSessionData>({
  cookie: {
    name: "pbis_session",
    httpOnly: true,
    path: "/pbis",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || "pbis-dev-secret"],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  },
});

export async function getPbisSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function commitPbisSession(
  session: Awaited<ReturnType<typeof getPbisSession>>
) {
  return sessionStorage.commitSession(session);
}

export async function destroyPbisSession(
  session: Awaited<ReturnType<typeof getPbisSession>>
) {
  return sessionStorage.destroySession(session);
}

/**
 * Lit le shipTo en session. Retourne null si pas de session active.
 */
export async function getSessionShipTo(request: Request): Promise<string | null> {
  const session = await getPbisSession(request);
  return session.get("shipTo") ?? null;
}