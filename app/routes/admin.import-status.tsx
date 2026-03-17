import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/admin-auth.server";
import { getImportStatus } from "~/lib/import.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireAdmin(request);

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId) return Response.json({ job: null });

  const job = getImportStatus(jobId) ?? null;
  return Response.json({ job });
}