/**
 * Bouclier EMAIL_OVERRIDE.
 *
 * Si la variable d'env EMAIL_OVERRIDE est définie (staging / recette), tout email
 * est redirigé vers cette adresse au lieu du destinataire réel. Vide ou absente
 * en prod = comportement normal (envoi au vrai destinataire).
 *
 * À appeler sur CHAQUE `to:` de chaque envoi (Resend ou autre).
 */
export function withEmailOverride(to: string): string {
  const override = process.env.EMAIL_OVERRIDE?.trim();
  if (override) {
    console.log(`[EMAIL OVERRIDE] ${to} -> ${override}`);
    return override;
  }
  return to;
}