import pbisDb from "../db.pbis.server";

// Étapes du parcours Start, dans l'ordre. L'ordinal (index + 1) sert à la progression
// monotone : on n'enregistre jamais un recul d'étape. Modifier/compléter cette liste
// pour changer le funnel.
export const FUNNEL_STEPS = [
  "offres",
  "detail",
  "informations",
  "recapitulatif",
  "signer",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

const STEP_LABELS: Record<FunnelStep, string> = {
  offres: "Offres",
  detail: "Détail offre",
  informations: "Informations",
  recapitulatif: "Récapitulatif",
  signer: "Signature",
};

// À appeler dans le loader de chaque étape, après résolution du shipTo (ignorer si null).
// Non bloquant pour le rendu : on récupère l'erreur sans la propager.
export async function trackStep(clientId: string, step: FunnelStep): Promise<void> {
  const idx = FUNNEL_STEPS.indexOf(step) + 1;
  if (idx === 0) return;
  try {
    // 1) garantit la ligne + rafraîchit lastSeenAt
    await pbisDb.pbisFunnelProgress.upsert({
      where: { clientId },
      create: { clientId, lastStep: idx, lastStepName: STEP_LABELS[step] },
      update: { lastSeenAt: new Date() },
    });
    // 2) avance l'étape seulement si elle est plus loin (monotone, race-safe)
    await pbisDb.pbisFunnelProgress.updateMany({
      where: { clientId, lastStep: { lt: idx } },
      data: { lastStep: idx, lastStepName: STEP_LABELS[step] },
    });
  } catch (err) {
    console.error(`[PBIS FUNNEL] trackStep ${clientId} ${step} failed:`, err);
  }
}

// À appeler quand la signature est confirmée (webhook Yousign).
export async function markSigned(clientId: string): Promise<void> {
  const last = FUNNEL_STEPS.length;
  try {
    await pbisDb.pbisFunnelProgress.upsert({
      where: { clientId },
      create: { clientId, lastStep: last, lastStepName: "Signature", status: "signed", signedAt: new Date() },
      update: { status: "signed", signedAt: new Date() },
    });
  } catch (err) {
    console.error(`[PBIS FUNNEL] markSigned ${clientId} failed:`, err);
  }
}