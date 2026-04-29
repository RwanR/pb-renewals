import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/auth.server";
import prisma from "~/db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
    await requireAdmin(request);

  const id = params.id!;
  const exp = await prisma.c4CExport.findUnique({
    where: { id },
  });

  if (!exp) {
    throw new Response("Export introuvable", { status: 404 });
  }

  return new Response(exp.fileData, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exp.fileName}"`,
      "Content-Length": String(exp.fileData.length),
    },
  });
}