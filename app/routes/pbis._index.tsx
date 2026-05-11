import type { Route } from "./+types/pbis._index";

export function meta({}: Route.MetaArgs) {
  return [{ title: "PBIS — Pitney Bowes Invoicing Solutions" }];
}

export default function PbisIndex() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">PBIS</h1>
        <p className="text-gray-500 mt-2">Route opérationnelle</p>
      </div>
    </div>
  );
}