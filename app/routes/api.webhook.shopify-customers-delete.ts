import type { ActionFunctionArgs } from "react-router";
import crypto from "node:crypto";
import prisma from "~/db.server";

/**
 * Webhook Shopify customers/delete.
 *
 * Payload Shopify (topic delete) = uniquement l'id numérique du customer.
 * On reconstruit le GID pour matcher Client.shopifyCustomerId (stocké au format GID).
 * Action = soft-delete : Client.archived = true (cohérent avec le filtre archived:false
 * appliqué partout dans l'admin, et avec la délégation d'archivage depuis import.server.ts).
 *
 * Sécurité : vérification HMAC-SHA256 sur le corps brut avant tout traitement.
 *
 * Enregistrement requis (shopify.app.toml) :
 *   [[webhooks.subscriptions]]
 *   topics = ["customers/delete"]
 *   uri = "/api/webhook/shopify-customers-delete"
 * Scope requis : write_customers (déjà présent).
 */

function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!secret) {
    console.error("[SHOPIFY WEBHOOK] Missing SHOPIFY_WEBHOOK_SECRET");
    return new Response("Server misconfigured", { status: 500 });
    }

  // Corps brut obligatoire pour la vérification HMAC (ne pas utiliser request.json())
  const rawBody = await request.text();
  const hmac = request.headers.get("X-Shopify-Hmac-Sha256");

  if (!verifyShopifyWebhook(rawBody, hmac, secret)) {
    console.warn("[SHOPIFY WEBHOOK] HMAC verification failed");
    return new Response("Unauthorized", { status: 401 });
  }

  const topic = request.headers.get("X-Shopify-Topic");
  if (topic !== "customers/delete") {
    // Endpoint dédié, mais on ack tout topic mal routé sans le traiter
    return Response.json({ ok: true, ignored: topic });
  }

  let payload: { id?: number | string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  if (!payload.id) {
    console.warn("[SHOPIFY WEBHOOK] customers/delete sans id");
    return Response.json({ ok: true });
  }

  const gid = `gid://shopify/Customer/${payload.id}`;

  const client = await prisma.client.findFirst({
    where: { shopifyCustomerId: gid },
    select: { accountNumber: true, archived: true },
  });

  // Idempotence : ack 200 si pas de match ou déjà archivé (évite les retries Shopify)
  if (!client) {
    console.log(`[SHOPIFY WEBHOOK] Aucun client pour le customer supprimé ${gid}`);
    return Response.json({ ok: true, matched: false });
  }

  if (client.archived) {
    return Response.json({ ok: true, alreadyArchived: true });
  }

  await prisma.client.update({
    where: { accountNumber: client.accountNumber },
    data: { archived: true },
  });

  console.log(`[SHOPIFY WEBHOOK] Client ${client.accountNumber} archivé (customer Shopify supprimé)`);
  return Response.json({ ok: true, archived: client.accountNumber });
}