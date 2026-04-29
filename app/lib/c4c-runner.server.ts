import prisma from "~/db.server";
import {
  generateC4CExport,
  type AcceptanceWithRelations,
} from "./c4c-export.server";

export type RunC4CExportInput = {
  /** Date de référence de l'export (sert de clé unique en DB) */
  refDate: Date;
  /** Début fenêtre signedAt (inclus) */
  signedFrom: Date;
  /** Fin fenêtre signedAt (exclu) */
  signedTo: Date;
  /** Origine de l'export : "cron" ou "admin:<email>" */
  generatedBy: string;
  /** Email destinataire (null = pas d'envoi mail, juste persistance) */
  emailTo?: string | null;
};

export type RunC4CExportResult = {
  exportId: string;
  acceptanceCount: number;
  fileName: string;
  alreadyExisted: boolean;
};

/**
 * Génère un export C4C pour une fenêtre de dates et le persiste en DB.
 * Si un export existe déjà pour cette refDate, le remplace (utile pour rejouer).
 */
export async function runC4CExport(
  input: RunC4CExportInput
): Promise<RunC4CExportResult> {
  const { refDate, signedFrom, signedTo, generatedBy, emailTo } = input;

  // Format YYYY-MM-DD pour le filename
  const y = refDate.getFullYear();
  const m = String(refDate.getMonth() + 1).padStart(2, "0");
  const d = String(refDate.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;
  const fileName = `c4c-export-${dateStr}.xlsx`;

  // Récupérer les acceptances signées dans la fenêtre
  const acceptances = (await prisma.acceptance.findMany({
    where: {
      adobeSignStatus: "signed",
      signedAt: {
        gte: signedFrom,
        lt: signedTo,
      },
    },
    include: {
      client: {
        include: {
          offers: true,
        },
      },
    },
    orderBy: { signedAt: "asc" },
  })) as AcceptanceWithRelations[];

  console.log(
    `[C4C] Generating export for ${dateStr}: ${acceptances.length} acceptances found`
  );

  // Générer le xlsx
  const fileData = await generateC4CExport(acceptances);

  // Vérifier si un export existe déjà pour cette refDate
  const existing = await prisma.c4CExport.findUnique({
    where: { exportDate: refDate },
  });

  let exportId: string;
  let alreadyExisted = false;

  if (existing) {
    alreadyExisted = true;
    const updated = await prisma.c4CExport.update({
      where: { id: existing.id },
      data: {
        signedFrom,
        signedTo,
        acceptanceCount: acceptances.length,
        fileData,
        fileName,
        generatedAt: new Date(),
        generatedBy,
      },
    });
    exportId = updated.id;
    console.log(`[C4C] Replaced existing export ${exportId}`);
  } else {
    const created = await prisma.c4CExport.create({
      data: {
        exportDate: refDate,
        signedFrom,
        signedTo,
        acceptanceCount: acceptances.length,
        fileData,
        fileName,
        generatedBy,
      },
    });
    exportId = created.id;
    console.log(`[C4C] Created export ${exportId}`);
  }

  // Envoi mail si demandé
  if (emailTo) {
    try {
      await sendC4CExportEmail({
        to: emailTo,
        fileName,
        fileData,
        acceptanceCount: acceptances.length,
        dateStr,
      });
      await prisma.c4CExport.update({
        where: { id: exportId },
        data: { emailSentTo: emailTo, emailSentAt: new Date() },
      });
      console.log(`[C4C] Email sent to ${emailTo}`);
    } catch (err) {
      console.error(`[C4C] Email send failed:`, err);
    }
  }

  return {
    exportId,
    acceptanceCount: acceptances.length,
    fileName,
    alreadyExisted,
  };
}

/** Envoie un mail avec le fichier xlsx en pièce jointe */
async function sendC4CExportEmail(params: {
  to: string;
  fileName: string;
  fileData: Buffer;
  acceptanceCount: number;
  dateStr: string;
}) {
  const { to, fileName, fileData, acceptanceCount, dateStr } = params;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "PB Renewals <noreply@nemet.tech>";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY not set");
  }

  const subject = `Export C4C ${dateStr} (${acceptanceCount} contrat${
    acceptanceCount > 1 ? "s" : ""
  })`;

  const body = `Bonjour,

Veuillez trouver ci-joint l'export C4C des contrats signés le ${dateStr}.

Nombre de contrats : ${acceptanceCount}

Cet export est également consultable sur la plateforme dans la section Admin.

Cordialement,
Plateforme PB Renewals`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: body,
      attachments: [
        {
          filename: fileName,
          content: fileData.toString("base64"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resend API error ${response.status}: ${errText}`);
  }
}

/**
 * Calcule la fenêtre J-1 : hier 00:00 → aujourd'hui 00:00.
 * refDate = hier (sert de clé unique).
 */
export function getYesterdayWindow(): {
  refDate: Date;
  signedFrom: Date;
  signedTo: Date;
} {
  const now = new Date();
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  const yesterdayMidnight = new Date(todayMidnight);
  yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);

  return {
    refDate: yesterdayMidnight,
    signedFrom: yesterdayMidnight,
    signedTo: todayMidnight,
  };
}

/**
 * Calcule la fenêtre pour une date donnée (00:00 → +24h).
 * Utilisé pour rejouer une date depuis l'admin.
 */
export function getDateWindow(dateStr: string): {
  refDate: Date;
  signedFrom: Date;
  signedTo: Date;
} {
  // dateStr format YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map(Number);
  const refDate = new Date(y, m - 1, d, 0, 0, 0, 0);
  const signedTo = new Date(refDate);
  signedTo.setDate(signedTo.getDate() + 1);
  return { refDate, signedFrom: refDate, signedTo };
}