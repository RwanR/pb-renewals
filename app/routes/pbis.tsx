import { Outlet } from "react-router";

export default function PbisLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b border-neutral-200 h-20 flex items-center justify-center">
        <span className="text-xl font-medium text-neutral-800">pitney bowes</span>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-neutral-200 py-6 text-center text-sm text-neutral-500">
        ©1996–{new Date().getFullYear()} Pitney Bowes Inc. Tous droits réservés.
      </footer>
    </div>
  );
}