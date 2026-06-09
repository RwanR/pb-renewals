/**
 * Healthcheck Railway — resource route (loader seul, pas de default export).
 * Path : /healthz
 *
 * Renvoie 200 dès que le serveur HTTP répond. Pas de ping DB : la disponibilité
 * Postgres est déjà garantie au boot par `prisma migrate deploy` (start command),
 * donc l'app ne sert pas si la DB est injoignable.
 *
 * À câbler dans Railway (service web uniquement) :
 *   Settings > Deploy > Healthcheck Path = /healthz
 * Ne pas configurer de healthcheck sur le service cron (pas de serveur HTTP).
 */
export async function loader() {
  return new Response("ok", {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}