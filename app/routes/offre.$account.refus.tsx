import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, Form, Link } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import prisma from "~/db.server";
import { useState } from "react";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const client = await prisma.client.findUnique({
    where: { accountNumber },
    select: { accountNumber: true, customerName: true, ownerName: true, ownerEmail: true },
  });

  if (!client) throw new Response("Client non trouvé", { status: 404 });

  return { client };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const accountNumber = params.account!;
  await requireClientAccess(request, accountNumber);

  const formData = await request.formData();
  const reason = formData.get("reason") as string;
  const comment = (formData.get("comment") as string)?.trim();

  if (!reason) {
    return { error: "Veuillez sélectionner une raison." };
  }

  const client = await prisma.client.findUnique({
    where: { accountNumber },
    select: { customerName: true, ownerName: true, ownerEmail: true },
  });

  // Store in DB
  await prisma.refusal.upsert({
    where: { clientAccountNumber: accountNumber },
    create: { clientAccountNumber: accountNumber, reason, comment: comment || null },
    update: { reason, comment: comment || null },
  });

  console.log(`[REFUS] Client ${accountNumber}: reason=${reason}, comment=${comment}`);

  // Email commercial PB
  if (client?.ownerEmail) {
    try {
      const reasonLabels: Record<string, string> = {
        trop_cher: "Tarif trop élevé",
        plus_besoin: "Plus besoin de machine à affranchir",
        concurrent: "Choix d'un autre prestataire",
        contact: "Souhaite être contacté",
        autre: "Autre raison",
      };

      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: process.env.EMAIL_FROM || "PB Renewals <onboarding@resend.dev>",
        to: client.ownerEmail,
        subject: `[PB Renewals] Refus – ${client.customerName} (${accountNumber})`,
        html: `
          <h2>Refus de renouvellement</h2>
          <p><strong>Client :</strong> ${client.customerName} (${accountNumber})</p>
          <p><strong>Raison :</strong> ${reasonLabels[reason] || reason}</p>
          ${comment ? `<p><strong>Commentaire :</strong> ${comment}</p>` : ""}
          <p style="color:#666;font-size:13px">Email envoyé automatiquement par la plateforme PB Renewals.</p>
        `,
      });

      console.log(`[REFUS] Email sent to ${client.ownerEmail}`);
    } catch (err) {
      console.error(`[REFUS] Email failed:`, err);
      // Don't block — the refusal is already saved
    }
  }

  return { success: true };
}

export default function OffreRefus() {
  const { client } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string; success?: boolean }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [reason, setReason] = useState("");

  if (actionData?.success) {
    return (
      <div className="pb-space" style={{ maxWidth: "500px", margin: "40px auto 0" }}>
        <div className="pb-card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>📝</div>
          <h1 className="pb-subtitle" style={{ marginBottom: "8px" }}>
            Merci pour votre retour
          </h1>
          <p className="pb-text" style={{ color: "var(--pb-text-light)" }}>
            Nous avons bien pris en compte votre réponse.
            {client.ownerName && (
              <> Votre interlocuteur <strong>{client.ownerName}</strong> vous contactera si nécessaire.</>
            )}
          </p>
        </div>
      </div>
    );
  }

  const reasons = [
    { value: "trop_cher", label: "Le tarif proposé est trop élevé" },
    { value: "plus_besoin", label: "Nous n'avons plus besoin de machine à affranchir" },
    { value: "concurrent", label: "Nous avons choisi un autre prestataire" },
    { value: "contact", label: "Je souhaite être contacté pour en discuter" },
    { value: "autre", label: "Autre raison" },
  ];

  return (
    <div className="pb-space" style={{ maxWidth: "500px", margin: "40px auto 0" }}>
      <Link to={`/offre/${client.accountNumber}`} className="pb-link" style={{ fontSize: "14px" }}>
        ← Retour aux offres
      </Link>

      <h1 className="pb-title" style={{ fontSize: "22px" }}>
        Aucune offre ne vous convient ?
      </h1>
      <p className="pb-text" style={{ color: "var(--pb-text-light)" }}>
        Aidez-nous à comprendre vos besoins pour mieux vous accompagner.
      </p>

      <Form method="post" className="pb-space-sm">
        <div className="pb-card pb-space-sm">
          {reasons.map((r) => (
            <label
              key={r.value}
              className={`pb-option ${reason === r.value ? "pb-option-selected" : ""}`}
              onClick={() => setReason(r.value)}
            >
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                style={{ display: "none" }}
              />
              <div className="pb-option-radio" />
              <span style={{ fontSize: "14px" }}>{r.label}</span>
            </label>
          ))}
        </div>

        {(reason === "autre" || reason === "contact") && (
          <div>
            <label htmlFor="comment" className="pb-label">Précisez (facultatif)</label>
            <textarea
              id="comment"
              name="comment"
              rows={3}
              className="pb-input"
              style={{ resize: "vertical" }}
              placeholder="Votre message..."
            />
          </div>
        )}

        {actionData?.error && <div className="pb-error">{actionData.error}</div>}

        <button
          type="submit"
          disabled={isSubmitting || !reason}
          className="pb-btn pb-btn-secondary pb-btn-full"
        >
          {isSubmitting ? (
            <><span className="pb-spinner" /> Envoi...</>
          ) : (
            "Envoyer mon retour"
          )}
        </button>
      </Form>
    </div>
  );
}