/**
 * DocuSign eSignature integration — drop-in replacement for yousign.server.ts
 * Uses JWT Grant for server-to-server auth.
 * Supports embedded signing (iframe) + email notification simultaneously.
 */

import crypto from "crypto";

const DOCUSIGN_INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY || "";
const DOCUSIGN_USER_ID = process.env.DOCUSIGN_USER_ID || "";
const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID || "";
const DOCUSIGN_BASE_URL = process.env.DOCUSIGN_BASE_URL || "https://demo.docusign.net/restapi";
const DOCUSIGN_AUTH_URL = DOCUSIGN_BASE_URL.includes("demo")
  ? "https://account-d.docusign.com"
  : "https://account.docusign.com";

// RSA private key — stored with \n literals in env var
const DOCUSIGN_RSA_PRIVATE_KEY = (process.env.DOCUSIGN_RSA_PRIVATE_KEY || "").replace(/\\n/g, "\n");

const APP_URL = process.env.APP_URL || "https://pb-renewals-production.up.railway.app";

// --- JWT Auth ---

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: DOCUSIGN_INTEGRATION_KEY,
    sub: DOCUSIGN_USER_ID,
    aud: DOCUSIGN_AUTH_URL.replace("https://", ""),
    iat: now,
    exp: now + 3600,
    scope: "signature impersonation",
  };

  const toBase64Url = (obj: any) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const signingInput = `${toBase64Url(header)}.${toBase64Url(payload)}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(DOCUSIGN_RSA_PRIVATE_KEY, "base64url");

  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(`${DOCUSIGN_AUTH_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[DOCUSIGN] JWT auth failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  console.log("[DOCUSIGN] JWT access token obtained");
  return cachedToken.token;
}

// --- API Helper ---

async function docusignAPI(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  const url = `${DOCUSIGN_BASE_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[DOCUSIGN] API error ${res.status} on ${path}: ${err}`);
  }

  return res.json();
}

// --- Create Signature Request ---

interface CreateSignatureParams {
  pdfBuffer: Buffer;
  pdfFilename: string;
  signerFirstName: string;
  signerLastName: string;
  signerEmail: string;
  signerPhone?: string;
  accountNumber: string;
}

export async function createSignatureRequest(params: CreateSignatureParams): Promise<{
  signatureRequestId: string;
  signerUrl: string | null;
}> {
  const { pdfBuffer, pdfFilename, signerFirstName, signerLastName, signerEmail, accountNumber } = params;

  const clientUserId = `pb-renewals-${accountNumber}`;

  // Create envelope with embedded signer + email notification
  const envelopeBody = {
    emailSubject: `Contrat de renouvellement — ${accountNumber}`,
    emailBlurb: "Veuillez signer votre contrat de location maintenance Pitney Bowes.",
    documents: [
      {
        documentBase64: pdfBuffer.toString("base64"),
        name: pdfFilename,
        fileExtension: "pdf",
        documentId: "1",
      },
    ],
    recipients: {
      signers: [
        {
          email: signerEmail,
          name: `${signerFirstName} ${signerLastName}`,
          recipientId: "1",
          clientUserId, // Makes it an embedded signer
          routingOrder: "1",
          tabs: {
            signHereTabs: [
              {
                documentId: "1",
                pageNumber: "1",
                anchorString: "Signature électronique via",
                anchorXOffset: "0",
                anchorYOffset: "-30",
                anchorUnits: "pixels",
              },
            ],
          },
          // Email notification — works WITH embedded signing in DocuSign
          embeddedRecipientStartURL: "SIGN_AT_DOCUSIGN",
        },
      ],
    },
    status: "sent", // Send immediately
    notification: {
      useAccountDefaults: "false",
      reminders: {
        reminderEnabled: "true",
        reminderDelay: "3",
        reminderFrequency: "2",
      },
    },
  };

  console.log(`[DOCUSIGN] Creating envelope for ${accountNumber}`);
  const envelope = await docusignAPI("/envelopes", {
    method: "POST",
    body: JSON.stringify(envelopeBody),
  });

  const envelopeId = envelope.envelopeId;
  console.log(`[DOCUSIGN] Created envelope: ${envelopeId}`);

  // Get embedded signing URL
  const recipientViewBody = {
    returnUrl: `${APP_URL}/offre/${accountNumber}/merci?event=signing_complete`,
    authenticationMethod: "none",
    email: signerEmail,
    userName: `${signerFirstName} ${signerLastName}`,
    clientUserId,
    frameAncestors: [APP_URL],
    messageOrigins: [APP_URL],
  };

  const recipientView = await docusignAPI(`/envelopes/${envelopeId}/views/recipient`, {
    method: "POST",
    body: JSON.stringify(recipientViewBody),
  });

  const signerUrl = recipientView.url;
  console.log(`[DOCUSIGN] Signer URL obtained for ${accountNumber}`);

  return { signatureRequestId: envelopeId, signerUrl };
}

// --- Get Signature Request Status ---

export async function getSignatureRequestStatus(envelopeId: string): Promise<any> {
  const envelope = await docusignAPI(`/envelopes/${envelopeId}`);
  const recipients = await docusignAPI(`/envelopes/${envelopeId}/recipients`);

  return {
    id: envelopeId,
    status: envelope.status, // "sent", "delivered", "completed", "voided", "declined"
    signers: recipients.signers?.map((s: any) => ({
      id: s.recipientId,
      status: s.status,
      signature_link: null, // DocuSign doesn't return a persistent link — must call createRecipientView each time
    })),
  };
}

// --- Get fresh signer URL (for return visits) ---

export async function getSignerUrl(envelopeId: string, accountNumber: string, signerEmail: string, signerName: string): Promise<string | null> {
  try {
    const recipientViewBody = {
      returnUrl: `${APP_URL}/offre/${accountNumber}/merci?event=signing_complete`,
      authenticationMethod: "none",
      email: signerEmail,
      userName: signerName,
      clientUserId: `pb-renewals-${accountNumber}`,
      frameAncestors: [APP_URL],
      messageOrigins: [APP_URL],
    };

    const recipientView = await docusignAPI(`/envelopes/${envelopeId}/views/recipient`, {
      method: "POST",
      body: JSON.stringify(recipientViewBody),
    });

    return recipientView.url;
  } catch (err) {
    console.error(`[DOCUSIGN] Failed to get signer URL for ${accountNumber}:`, err);
    return null;
  }
}

// --- Download Signed Documents ---

export async function downloadSignedDocuments(envelopeId: string): Promise<Buffer> {
  const token = await getAccessToken();
  const url = `${DOCUSIGN_BASE_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes/${envelopeId}/documents/combined`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`[DOCUSIGN] Failed to download documents: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// --- Parse Webhook Event (DocuSign Connect) ---

export function parseWebhookEvent(body: any): {
  eventName: string;
  signatureRequestId: string;
} {
  // DocuSign Connect sends XML by default, but can be configured for JSON
  // Assuming JSON format (configured in Connect settings)
  const event = body?.event || body?.Status || "";
  const envelopeId = body?.data?.envelopeId || body?.EnvelopeStatus?.EnvelopeID || body?.envelopeId || "";

  // Map DocuSign statuses to our normalized event names
  const eventMap: Record<string, string> = {
    "envelope-completed": "signature_request.done",
    completed: "signature_request.done",
    "envelope-voided": "signature_request.declined",
    voided: "signature_request.declined",
    "envelope-declined": "signature_request.declined",
    declined: "signature_request.declined",
    "recipient-completed": "signer.done",
  };

  return {
    eventName: eventMap[event] || event,
    signatureRequestId: envelopeId,
  };
}