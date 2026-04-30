/**
 * Cron quotidien C4C
 *
 * Lancé chaque jour à 00:05 Paris (TZ=Europe/Paris sur Railway).
 *
 * Comportement :
 *   1. Calcule la fenêtre J-1 (hier 00:00 → aujourd'hui 00:00, heure locale)
 *   2. Cherche les contrats signés dans cette fenêtre
 *   3. Si 0 contrat : log + exit 0 (pas d'export, pas de mail)
 *   4. Sinon : génère le xlsx, le persiste en DB, envoie le mail
 *
 * Variables d'env requises :
 *   - DATABASE_URL
 *   - RESEND_API_KEY
 *   - EMAIL_FROM (optionnel, default "PB Renewals <noreply@nemet.tech>")
 *   - C4C_EXPORT_EMAIL (destinataire)
 *
 * Lancé par Railway en mode "cron service" via railway.json schedule.
 */

import { runC4CExport, getYesterdayWindow } from "../app/lib/c4c-runner.server";
import prisma from "../app/db.server";

async function main() {
  const startedAt = new Date();
  console.log(`[CRON C4C] Started at ${startedAt.toISOString()}`);

  const window = getYesterdayWindow();
  const dateStr = window.refDate.toISOString().split("T")[0];

  console.log(
    `[CRON C4C] Window: signedAt >= ${window.signedFrom.toISOString()} AND < ${window.signedTo.toISOString()}`
  );

  // Pré-check : combien de contrats dans la fenêtre ?
  const count = await prisma.acceptance.count({
    where: {
      adobeSignStatus: "signed",
      signedAt: {
        gte: window.signedFrom,
        lt: window.signedTo,
      },
    },
  });

  if (count === 0) {
    console.log(`[CRON C4C] 0 contracts signed on ${dateStr} — skipping export and email`);
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`[CRON C4C] ${count} contract(s) to export for ${dateStr}`);

  const emailTo = process.env.C4C_EXPORT_EMAIL || null;
  if (!emailTo) {
    console.warn("[CRON C4C] C4C_EXPORT_EMAIL not set — export will be persisted but no email sent");
  }

  try {
    const result = await runC4CExport({
      refDate: window.refDate,
      signedFrom: window.signedFrom,
      signedTo: window.signedTo,
      generatedBy: "cron",
      emailTo,
    });

    console.log(
      `[CRON C4C] Done: export ${result.exportId}, ${result.acceptanceCount} contracts, file=${result.fileName}${
        result.alreadyExisted ? " (replaced previous)" : ""
      }`
    );
  } catch (err) {
    console.error("[CRON C4C] Export failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("[CRON C4C] Unhandled error:", err);
  await prisma.$disconnect();
  process.exit(1);
});