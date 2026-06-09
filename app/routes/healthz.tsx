import prisma from "~/db.server";

/**
 * Healthcheck Railway — resource route (loader seul, pas de default export).
 * Path : /healthz
 *
 * Vérifie l'accès DB via SELECT 1. Renvoie 200 si OK, 503 sinon.
 * À câbler dans Railway (service web uniquement) :
 *   Settings > Deploy > Healthcheck Path = /healthz
 * Ne pas configurer de healthcheck sur le service cron (pas de serveur HTTP).
 */
export async function loader() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new Response("ok", {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("db unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}