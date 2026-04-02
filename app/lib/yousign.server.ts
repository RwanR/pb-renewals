/**
 * Yousign API v3 integration
 * Docs: https://developers.yousign.com/docs
 * 
 * Flow:
 * 1. Create a Signature Request (draft)
 * 2. Upload the PDF document
 * 3. Add signer with signature field
 * 4. Activate the Signature Request
 * 5. Redirect signer to signing URL
 * 6. Receive webhook when signed
 * 7. Download signed document
 */

const YOUSIGN_API_URL = process.env.YOUSIGN_API_URL || "https://api-sandbox.yousign.app/v3";
const YOUSIGN_API_KEY = process.env.YOUSIGN_API_KEY || "";
const APP_URL = process.env.APP_URL || "https://pb-renewals.railway.app";

interface YousignError {
  type: string;
  detail: string;
}

async function yousignFetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${YOUSIGN_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${YOUSIGN_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[YOUSIGN] ${options.method || "GET"} ${path} failed (${res.status}):`, body);
    throw new Error(`Yousign API error ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Create a signature request, upload PDF, add signer, activate, and return the signing URL.
 */
export async function createSignatureRequest(params: {
  pdfBuffer: Buffer;
  pdfFilename: string;
  signerFirstName: string;
  signerLastName: string;
  signerEmail: string;
  signerPhone?: string;
  accountNumber: string;
}): Promise<{
  signatureRequestId: string;
  signerUrl: string;
}> {
  const {
    pdfBuffer,
    pdfFilename,
    signerFirstName,
    signerLastName,
    signerEmail,
    signerPhone,
    accountNumber,
  } = params;

  console.log(`[YOUSIGN] Creating signature request for ${accountNumber}`);

  // 1. Create Signature Request (draft)
  const signatureRequest = await yousignFetch("/signature_requests", {
    method: "POST",
    body: JSON.stringify({
      name: `Contrat PB Renewals - ${accountNumber}`,
      delivery_mode: "none",
      timezone: "Europe/Paris",
      ordered_signers: false,
      reminder_settings: {
        interval_in_days: 7,
        max_occurrences: 3,
      },
    expiration_date: new Date(
    Date.now() + 90 * 24 * 60 * 60 * 1000
    ).toISOString().split("T")[0],
      external_id: accountNumber,
    }),
  });

  const signatureRequestId = signatureRequest.id;
  console.log(`[YOUSIGN] Created signature request: ${signatureRequestId}`);

  // 2. Upload PDF document (multipart)
  const formData = new FormData();
  formData.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), pdfFilename);
  formData.append("nature", "signable_document");

  const document = await fetch(
    `${YOUSIGN_API_URL}/signature_requests/${signatureRequestId}/documents`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${YOUSIGN_API_KEY}`,
      },
      body: formData,
    }
  ).then(async (res) => {
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Yousign upload error ${res.status}: ${body}`);
    }
    return res.json();
  });

  const documentId = document.id;
  console.log(`[YOUSIGN] Uploaded document: ${documentId}`);

  // 3. Add signer with signature field on page 1
  const signerPayload: any = {
    info: {
      first_name: signerFirstName,
      last_name: signerLastName,
      email: signerEmail,
      locale: "fr",
    },
    signature_level: "electronic_signature",
    signature_authentication_mode: "no_otp",
    fields: [
      {
        document_id: documentId,
        type: "signature",
        page: 1,
        x: 60,
        y: 710,
        width: 200,
        height: 60,
      },
    ],
  };

  if (signerPhone) {
    signerPayload.info.phone_number = signerPhone;
  }

  const signer = await yousignFetch(
    `/signature_requests/${signatureRequestId}/signers`,
    {
      method: "POST",
      body: JSON.stringify(signerPayload),
    }
  );

  console.log(`[YOUSIGN] Added signer: ${signer.id}`);

  // 4. Activate the Signature Request
  await yousignFetch(
    `/signature_requests/${signatureRequestId}/activate`,
    { method: "POST" }
  );

  console.log(`[YOUSIGN] Activated signature request`);

  // 5. Fetch signer to get the signature_link (available only after activation)
  const activatedSigner = await yousignFetch(
    `/signature_requests/${signatureRequestId}/signers/${signer.id}`
  );
  const signerUrl = activatedSigner.signature_link;
  console.log(`[YOUSIGN] Signer URL: ${signerUrl}`);

  return {
    signatureRequestId,
    signerUrl,
  };
}

/**
 * Get the status of a signature request
 */
export async function getSignatureRequestStatus(signatureRequestId: string): Promise<{
  status: string;
  signers: Array<{
    id: string;
    status: string;
    signature_link: string;
  }>;
}> {
  return yousignFetch(`/signature_requests/${signatureRequestId}`);
}

/**
 * Download the signed PDF document
 */
export async function downloadSignedDocument(
  signatureRequestId: string,
  documentId: string
): Promise<Buffer> {
  const url = `${YOUSIGN_API_URL}/signature_requests/${signatureRequestId}/documents/${documentId}/download`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${YOUSIGN_API_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Yousign download error ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Download all documents of a completed signature request
 */
export async function downloadSignedDocuments(
  signatureRequestId: string
): Promise<Buffer> {
  const url = `${YOUSIGN_API_URL}/signature_requests/${signatureRequestId}/documents/download`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${YOUSIGN_API_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Yousign download error ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Validate a webhook payload from Yousign
 * In production, you should verify the webhook signature
 */
export function parseWebhookEvent(body: any): {
  eventName: string;
  signatureRequestId: string;
  data: any;
} {
  return {
    eventName: body.event_name,
    signatureRequestId: body.data?.signature_request?.id || body.data?.id,
    data: body.data,
  };
}