import prisma from "~/db.server";
import {
  generateC4CExport,
  type AcceptanceWithRelations,
} from "./c4c-export.server";

export type RunC4CExportInput = {
  /** Date de référence de l'export (clé en DB, plus unique) */
  refDate: Date;
  /** Début fenêtre signedAt (inclus) */
  signedFrom: Date;
  /** Fin fenêtre signedAt (exclu) */
  signedTo: Date;
  /** Origine de l'export : "cron" ou "admin" */
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

/** Format YYYY-MM-DD pour une date */
function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Génère un export C4C pour une fenêtre de dates et le persiste en DB.
 * Crée toujours un nouvel export. Ancien comportement d'écrasement supprimé.
 */
export async function runC4CExport(
  input: RunC4CExportInput
): Promise<RunC4CExportResult> {
  const { refDate, signedFrom, signedTo, generatedBy, emailTo } = input;

  const lastDay = new Date(signedTo.getTime() - 1);
  const fromStr = formatDateStr(signedFrom);
  const toStr = formatDateStr(lastDay);

  const isRange = fromStr !== toStr;
  const fileName = isRange
    ? `c4c-export-${fromStr}_to_${toStr}.xlsx`
    : `c4c-export-${fromStr}.xlsx`;
  const dateLabel = isRange ? `${fromStr} → ${toStr}` : fromStr;

  const acceptances = (await prisma.acceptance.findMany({
    where: {
      adobeSignStatus: "signed",
      signedAt: { gte: signedFrom, lt: signedTo },
    },
    include: { client: { include: { offers: true } } },
    orderBy: { signedAt: "asc" },
  })) as AcceptanceWithRelations[];

  console.log(
    `[C4C] Generating export for ${dateLabel}: ${acceptances.length} acceptances found`
  );

  const fileData = await generateC4CExport(acceptances);

  const created = await prisma.c4CExport.create({
    data: {
      exportDate: refDate,
      signedFrom,
      signedTo,
      acceptanceCount: acceptances.length,
      fileData: new Uint8Array(fileData),
      fileName,
      generatedBy,
    },
  });
  const exportId = created.id;
  console.log(`[C4C] Created export ${exportId}`);

  if (emailTo) {
    try {
      await sendC4CExportEmail({
        to: emailTo,
        fileName,
        fileData,
        acceptanceCount: acceptances.length,
        dateLabel,
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
    alreadyExisted: false,
  };
}

async function sendC4CExportEmail(params: {
  to: string;
  fileName: string;
  fileData: Buffer;
  acceptanceCount: number;
  dateLabel: string;
}) {
  const { to, fileName, fileData, acceptanceCount, dateLabel } = params;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "PB Renewals <noreply@nemet.tech>";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY not set");
  }

  const subject = `Export C4C ${dateLabel} (${acceptanceCount} contrat${
    acceptanceCount > 1 ? "s" : ""
  })`;

  const body = `Bonjour,

Veuillez trouver ci-joint l'export C4C des contrats signés sur la période ${dateLabel}.

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
      from, to, subject, text: body,
      attachments: [{ filename: fileName, content: fileData.toString("base64") }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resend API error ${response.status}: ${errText}`);
  }
}

/** Fenêtre J-1 : hier 00:00 → aujourd'hui 00:00. */
export function getYesterdayWindow(): {
  refDate: Date;
  signedFrom: Date;
  signedTo: Date;
} {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const yesterdayMidnight = new Date(todayMidnight);
  yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);
  return { refDate: yesterdayMidnight, signedFrom: yesterdayMidnight, signedTo: todayMidnight };
}

/** Fenêtre pour une date donnée (00:00 → +24h). */
export function getDateWindow(dateStr: string): {
  refDate: Date;
  signedFrom: Date;
  signedTo: Date;
} {
  const [y, m, d] = dateStr.split("-").map(Number);
  const refDate = new Date(y, m - 1, d, 0, 0, 0, 0);
  const signedTo = new Date(refDate);
  signedTo.setDate(signedTo.getDate() + 1);
  return { refDate, signedFrom: refDate, signedTo };
}

/** Fenêtre pour une plage de dates (fromStr 00:00 → toStr+1j 00:00). refDate = signedFrom. */
export function getDateRangeWindow(fromStr: string, toStr: string): {
  refDate: Date;
  signedFrom: Date;
  signedTo: Date;
} {
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = toStr.split("-").map(Number);
  const signedFrom = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
  const signedTo = new Date(ty, tm - 1, td, 0, 0, 0, 0);
  signedTo.setDate(signedTo.getDate() + 1);
  return { refDate: signedFrom, signedFrom, signedTo };
}