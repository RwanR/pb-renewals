import type { LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useLocation, Link } from "react-router";
import { sessionStorage } from "~/lib/pbis-admin-auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const isAuthenticated = session.get("authenticated") === true;

  const url = new URL(request.url);
  if (!isAuthenticated && url.pathname !== "/pbis/admin/login") {
    return redirect("/pbis/admin/login");
  }

  return { authenticated: true };
}

export default function PbisAdminLayout() {
  const location = useLocation();
  const isLogin = location.pathname === "/pbis/admin/login";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      {!isLogin && (
        <header className="admin-header">
          <span className="admin-logo">PBIS — Admin</span>
          <nav className="admin-nav">
            <Link to="/pbis/admin" className="admin-nav-link">Dashboard</Link>
            <Link to="/pbis/admin/import" className="admin-nav-link">Import</Link>
            <a href="/pbis/admin/export-links" className="admin-nav-link">Export liens</a>
            <a href="/pbis/admin/export-souscriptions" className="admin-nav-link">Export souscriptions</a>
            <a href="/pbis/admin/export-abandons" className="admin-nav-link">Export abandons</a>
            <a href="/pbis/admin/login?logout=1" className="admin-nav-link admin-logout">Déconnexion</a>
          </nav>
        </header>
      )}
      <main className="admin-main">
        <Outlet />
      </main>
    </>
  );
}

const ADMIN_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; background: #f8f9fa; }

  .admin-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; background: #fff; border-bottom: 1px solid #e5e7eb; }
  .admin-logo { font-weight: 700; font-size: 16px; }
  .admin-nav { display: flex; gap: 16px; align-items: center; }
  .admin-nav-link { font-size: 14px; color: #6b7280; text-decoration: none; }
  .admin-nav-link:hover { color: #1a1a1a; }
  .admin-logout { color: #dc2626; }
  .admin-main { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }

  .admin-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }

  .admin-btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 20px; background: #1a1a1a; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; text-decoration: none; }
  .admin-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .admin-btn-outline { background: #fff; color: #374151; border: 1px solid #d1d5db; }

  .admin-input { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
  .admin-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
  .admin-error-text { color: #dc2626; font-size: 13px; }

  .admin-login-wrap { min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .admin-login-card { width: 100%; max-width: 360px; }
  .admin-login-title { font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 24px; }
`;