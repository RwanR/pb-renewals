import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useNavigation, Form, Link } from "react-router";
import { requireClientAccess } from "~/lib/client-auth.server";
import prisma from "~/db.server";

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

  await prisma.refusal.upsert({
    where: { clientAccountNumber: accountNumber },
    create: { clientAccountNumber: accountNumber, reason, comment: comment || null },
    update: { reason, comment: comment || null },
  });

  console.log(`[REFUS] Client ${accountNumber}: reason=${reason}, comment=${comment}`);

  if (client?.ownerEmail) {
    try {
      const reasonLabels: Record<string, string> = {
        economies: "Faire des économies sur les dépenses de courrier",
        simplifier: "Simplifier les processus de traitement des envois",
        temps: "Gagner du temps sur le traitement des envois",
        facturation: "Se conformer à la facturation électronique",
        digitaliser: "Digitaliser la gestion des documents",
      };

      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: process.env.EMAIL_FROM || "PB Renewals <onboarding@resend.dev>",
        to: "erwann.bocher@proton.me",
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
    }
  }

  return { success: true };
}

export default function OffreRefus() {
  const { client } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string; success?: boolean }>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  if (actionData?.success) {
    return (
      <div className="pb-main" style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: "596px", width: "100%", paddingTop: "48px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="#00b44a" strokeWidth="2.5" fill="none"/>
            <path d="M15 24L21 30L33 18" stroke="#00b44a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p style={{ fontSize: "24px", fontWeight: 500, color: "var(--pb-text)", letterSpacing: "0.1px" }}>
            Merci pour votre retour
          </p>
          <p style={{ fontSize: "14px", color: "var(--pb-text-muted)", lineHeight: "20px" }}>
            Nous avons bien pris en compte votre réponse.
            {client.ownerName && (
              <> Votre interlocuteur <strong>{client.ownerName}</strong> vous contactera si nécessaire.</>
            )}
          </p>
          <Link
            to={`/offre/${client.accountNumber}`}
            className="pb-btn pb-btn-secondary"
            style={{ marginTop: "16px", padding: "12px 32px", fontSize: "16px", textDecoration: "none" }}
          >
            Retour aux offres
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-main" style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: "596px", width: "100%", display: "flex", flexDirection: "column", gap: "48px" }}>

        {/* Title */}
        <div style={{ paddingTop: "48px", textAlign: "center" }}>
          <p style={{ fontSize: "24px", fontWeight: 500, color: "var(--pb-text)", letterSpacing: "0.1px", lineHeight: "28.8px" }}>
            Questionnaire
          </p>
        </div>

        {/* Description */}
        <p style={{ fontSize: "14px", lineHeight: "20px", color: "var(--pb-text)" }}>
          Si vous souhaitez procéder différemment pour gérer vos envois de courrier, veuillez remplir le formulaire ci-dessous afin de nous faire part de vos attentes et de vos objectifs.
        </p>
        {/* Form */}
        <Form method="post" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Select */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "14px", fontWeight: 500, color: "var(--pb-foreground)" }}>
              Raison du refus
            </label>
            <select
              name="reason"
              required
              defaultValue=""
              style={{
                width: "100%",
                minHeight: "36px",
                padding: "8px 12px",
                paddingRight: "32px",
                border: "1px solid var(--pb-border-dark)",
                borderRadius: "8px",
                fontFamily: "inherit",
                fontSize: "14px",
                color: "var(--pb-foreground)",
                background: "white",
                boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
                cursor: "pointer",
                appearance: "auto",
              }}
            >
              <option value="" disabled>Sélectionnez une raison</option>
              <option value="economies">Faire des économies sur vos dépenses de courrier</option>
              <option value="simplifier">Simplifier les processus de traitement de vos envois</option>
              <option value="temps">Gagner du temps sur le traitement de vos envois</option>
              <option value="facturation">Se conformer à la facturation électronique</option>
              <option value="digitaliser">Digitaliser la gestion de vos documents</option>
            </select>
          </div>

          {/* Textarea */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "14px", fontWeight: 500, color: "var(--pb-foreground)" }}>
              Informations complémentaires
            </label>
            <textarea
              name="comment"
              rows={3}
              placeholder=""
              style={{
                width: "100%",
                minHeight: "76px",
                padding: "8px 12px",
                border: "1px solid var(--pb-border)",
                borderRadius: "8px",
                fontFamily: "inherit",
                fontSize: "14px",
                color: "var(--pb-foreground)",
                background: "white",
                boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
                resize: "vertical",
              }}
            />
          </div>

          {actionData?.error && <div className="pb-error">{actionData.error}</div>}

          {/* CTA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "48px", paddingTop: "28px" }}>
            <Link to={`/offre/${client.accountNumber}`} style={{ color: "var(--pb-text)", display: "flex", alignItems: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="pb-btn pb-btn-primary"
              style={{ padding: "12px 32px", fontSize: "16px" }}
            >
              {isSubmitting ? (
                <><span className="pb-spinner" /> Envoi...</>
              ) : (
                "Envoyer"
              )}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}