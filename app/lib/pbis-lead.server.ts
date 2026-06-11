const LEAD_INBOX = "pitneybowes@pb.com";

export type LeadInput = {
  offer: string; // "Essentiel" | "Flex"
  fullName: string;
  email: string;
  phone: string;
  message?: string | null;
};

export type LeadResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Anti-injection d'en-tête sur les champs qui finissent dans un header (reply-to, subject).
function safeHeader(s: string): string {
  return s.replace(/[\r\n]/g, " ").slice(0, 200);
}

export async function submitPbisLead(input: LeadInput): Promise<LeadResult> {
  const offer = input.offer.trim();
  const fullName = input.fullName.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  const message = (input.message ?? "").trim();

  if (!fullName || !email || !phone) {
    return { ok: false, error: "Merci de renseigner votre nom, votre e-mail et votre téléphone." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "L'adresse e-mail saisie n'est pas valide." };
  }

  const rows: [string, string][] = [
    ["Offre", `PBIS ${offer}`],
    ["Nom complet", fullName],
    ["E-mail", email],
    ["Téléphone", phone],
    ["Message", message || "-"],
  ];

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: process.env.EMAIL_FROM || "PBIS <noreply@nemet.tech>",
      to: process.env.EMAIL_OVERRIDE || LEAD_INBOX,
      replyTo: safeHeader(email),
      subject: safeHeader(`Nouvelle demande de contact - PBIS ${offer}`),
      html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:24px; background:#f8f9fa; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:white; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
      <tr><td style="height:4px; background:linear-gradient(90deg,#CF0989,#009DBF,#00B140);"></td></tr>
      <tr><td style="padding:24px;">
        <h2 style="margin:0 0 16px; font-size:18px; font-weight:600;">Nouvelle demande de contact - PBIS ${escapeHtml(offer)}</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px; border-collapse:collapse;">
          ${rows
            .map(
              ([k, v]) =>
                `<tr><td style="padding:6px 16px 6px 0; color:#6b7280; vertical-align:top; white-space:nowrap;">${escapeHtml(k)}</td><td style="padding:6px 0; font-weight:500;">${escapeHtml(v).replace(/\n/g, "<br/>")}</td></tr>`
            )
            .join("")}
        </table>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`,
    });

    return { ok: true };
  } catch (err) {
    console.error("[PBIS LEAD] Email send failed:", err);
    return { ok: false, error: "L'envoi a échoué. Réessayez dans un instant." };
  }
}