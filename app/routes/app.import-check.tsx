import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import prisma from "~/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const [
    clientCount,
    offerCount,
    importRuns,
    modelDistribution,
    emailStats,
    sampleClient,
    lastErrorRun,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.offer.count(),
    prisma.importRun.findMany({
      orderBy: { importedAt: "desc" },
      take: 5,
    }),
    prisma.client.groupBy({
      by: ["currentModel"],
      _count: true,
      orderBy: { _count: { currentModel: "desc" } },
    }),
    prisma.client.aggregate({
      _count: {
        bestEmail: true,
        billingEmail: true,
        installEmail: true,
      },
    }),
    prisma.client.findUnique({
      where: { accountNumber: "30240367" },
      include: { offers: true },
    }),
    prisma.importRun.findFirst({
      where: { status: "error" },
      orderBy: { importedAt: "desc" },
    }),
  ]);

  const clientsWithoutEmail = await prisma.client.count({
    where: {
      bestEmail: null,
      billingEmail: null,
      installEmail: null,
    },
  });

  return {
    clientCount,
    offerCount,
    importRuns,
    modelDistribution,
    emailStats,
    clientsWithoutEmail,
    sampleClient,
    lastErrorRun,
  };
}

export default function ImportCheck() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Vérification des données</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded p-4">
          <p className="text-sm text-gray-500">Clients</p>
          <p className="text-3xl font-mono font-bold">{data.clientCount}</p>
        </div>
        <div className="bg-white border rounded p-4">
          <p className="text-sm text-gray-500">Offres</p>
          <p className="text-3xl font-mono font-bold">{data.offerCount}</p>
        </div>
        <div className="bg-white border rounded p-4">
          <p className="text-sm text-gray-500">Sans email</p>
          <p className="text-3xl font-mono font-bold text-orange-600">{data.clientsWithoutEmail}</p>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Répartition par modèle</h2>
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2 border">Modèle</th>
              <th className="text-right p-2 border">Clients</th>
            </tr>
          </thead>
          <tbody>
            {data.modelDistribution.map((m: any) => (
              <tr key={m.currentModel}>
                <td className="p-2 border">{m.currentModel ?? "N/A"}</td>
                <td className="p-2 border text-right font-mono">{m._count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Historique imports</h2>
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2 border">Date</th>
              <th className="text-left p-2 border">Fichier</th>
              <th className="text-right p-2 border">Lignes</th>
              <th className="text-left p-2 border">Statut</th>
            </tr>
          </thead>
          <tbody>
            {data.importRuns.map((run: any) => (
              <tr key={run.id}>
                <td className="p-2 border">{new Date(run.importedAt).toLocaleString("fr-FR")}</td>
                <td className="p-2 border">{run.filename}</td>
                <td className="p-2 border text-right font-mono">{run.rowCount}</td>
                <td className="p-2 border">
                  <span className={run.status === "success" ? "text-green-600" : "text-red-600"}>
                    {run.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.lastErrorRun?.errorLog && (
        <div>
          <h2 className="font-semibold mb-2">
            Dernières erreurs (run du {new Date(data.lastErrorRun.importedAt).toLocaleString("fr-FR")})
          </h2>
          <pre className="bg-red-50 p-4 rounded text-xs overflow-auto max-h-96 text-red-800">
            {data.lastErrorRun.errorLog}
          </pre>
        </div>
      )}

      <div>
        <h2 className="font-semibold mb-2">Client exemple — 30240367</h2>
        {data.sampleClient ? (
          <div className="space-y-4">
            <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-60">
              {JSON.stringify(data.sampleClient, null, 2)}
            </pre>
            <h3 className="font-semibold">Offres ({data.sampleClient.offers?.length})</h3>
            {data.sampleClient.offers?.map((offer: any) => (
              <pre key={offer.id} className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-60">
                {JSON.stringify(offer, null, 2)}
              </pre>
            ))}
          </div>
        ) : (
          <p className="text-red-600">Client 30240367 non trouvé</p>
        )}
      </div>
    </div>
  );
}