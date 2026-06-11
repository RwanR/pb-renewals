import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Entrée Shopify admin : ?shop=... → app embed
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  // Entrée racine selon l'app servie (résolue par APP_NAME côté Railway).
  // url.search conservé pour ne pas perdre un éventuel ?token=... sur la racine.
  const entry = process.env.APP_NAME === "pbis" ? "/pbis" : "/offre";
  return redirect(entry + url.search);
};