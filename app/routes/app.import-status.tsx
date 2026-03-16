import type { LoaderFunctionArgs } from "react-router";
import { getImportStatus } from "~/lib/import.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId) return Response.json({ job: null });

  const job = getImportStatus(jobId) ?? null;
  return Response.json({ job });
}