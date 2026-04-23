import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Dynamic import to avoid loading DocuSign at startup
    const { createSignatureRequest } = await import("~/lib/docusign.server");
    
    // Generate a minimal test PDF
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent("<html><body><h1>Test DocuSign</h1><p>Ceci est un test.</p><br><br><p>Signature électronique via DocuSign</p></body></html>");
    const pdfBuffer = Buffer.from(await page.pdf({ format: "A4" }));
    await browser.close();

    const result = await createSignatureRequest({
      pdfBuffer,
      pdfFilename: "test-docusign.pdf",
      signerFirstName: "Erwann",
      signerLastName: "Test",
      signerEmail: "erwann.bocher@gmail.com",
      accountNumber: "TEST001",
    });

    return Response.json({
      ok: true,
      envelopeId: result.signatureRequestId,
      signerUrl: result.signerUrl ? result.signerUrl.substring(0, 80) + "..." : null,
    });
  } catch (err) {
    return Response.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}