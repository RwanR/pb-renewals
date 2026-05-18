import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter, isRouteErrorResponse } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { type EntryContext } from "react-router";
import { isbot } from "isbot";

console.log("NODE_ENV =", process.env.NODE_ENV);

export const streamTimeout = 5000;

export function handleError(error: unknown, { request }: { request: Request }) {
  if (request.signal.aborted) return;
  // Bruit de scanners : ne pas logger les erreurs client (404, 405, etc.)
  if (isRouteErrorResponse(error) && error.status >= 400 && error.status < 500) return;
  console.error(error);
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext
) {
  const appName = process.env.APP_NAME ?? 'renewals';
  const url = new URL(request.url);
  const isPbisRoute = url.pathname.startsWith('/pbis');

  if (isPbisRoute && appName !== 'pbis') {
    return new Response('Not Found', { status: 404 });
  }
  if (!isPbisRoute && appName !== 'renewals') {
    return new Response('Not Found', { status: 404 });
  }

  if (appName === "renewals") {
    const { addDocumentResponseHeaders } = await import("./shopify.server");
    addDocumentResponseHeaders(request, responseHeaders);
  }

  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? '')
    ? "onAllReady"
    : "onShellReady";

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
      />,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        },
      }
    );

    setTimeout(abort, streamTimeout + 1000);
  });
}