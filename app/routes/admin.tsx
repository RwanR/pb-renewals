import type { LoaderFunctionArgs } from "react-router";
import { Outlet, redirect, useLocation, Link } from "react-router";
import { sessionStorage } from "~/lib/admin-auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const isAuthenticated = session.get("authenticated") === true;

  const url = new URL(request.url);
  if (!isAuthenticated && url.pathname !== "/admin/login") {
    return redirect("/admin/login");
  }

  return { authenticated: true };
}

export default function AdminLayout() {
  const location = useLocation();
  const isLogin = location.pathname === "/admin/login";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ADMIN_CSS }} />
      {!isLogin && (
        <header className="admin-header">
          <span className="admin-logo">PB Renewals — Admin</span>
          <nav className="admin-nav">
            <Link to="/admin" className="admin-nav-link">Dashboard</Link>
            <Link to="/admin/import" className="admin-nav-link">Import</Link>
            <a href="/admin/export-links" className="admin-nav-link">Export liens</a>
            <a href="/admin/login?logout=1" className="admin-nav-link admin-logout">Déconnexion</a>
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
  .admin-main { max-width: 800px; margin: 0 auto; padding: 32px 24px; }

  .admin-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
  .admin-card-success { border-color: #86efac; background: #f0fdf4; }
  .admin-card-error { border-color: #fdba74; background: #fff7ed; }

  .admin-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .admin-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

  .admin-stat-label { font-size: 13px; color: #6b7280; margin-bottom: 4px; }
  .admin-stat-value { font-size: 24px; font-weight: 700; font-family: 'SF Mono', monospace; }

  .admin-title { font-size: 24px; font-weight: 700; margin-bottom: 24px; }
  .admin-subtitle { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px; }

  .admin-space > * + * { margin-top: 20px; }

  .admin-btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 20px; background: #1a1a1a; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
  .admin-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .admin-btn-outline { background: #fff; color: #374151; border: 1px solid #d1d5db; }

  .admin-input-file { font-size: 14px; }
  .admin-input-file::file-selector-button { margin-right: 12px; padding: 8px 16px; border-radius: 8px; border: none; font-size: 13px; font-weight: 600; background: #eff6ff; color: #1d4ed8; cursor: pointer; }

  .admin-input { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }

  .admin-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }

  .admin-progress-wrap { width: 100%; background: #e5e7eb; border-radius: 99px; height: 10px; overflow: hidden; }
  .admin-progress-bar { height: 10px; border-radius: 99px; background: #2563eb; transition: width 0.7s ease-out; }
  .admin-progress-text { display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-top: 6px; }

  .admin-spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .admin-flex { display: flex; align-items: center; gap: 12px; }

  .admin-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 99px; font-size: 12px; font-weight: 500; }
  .admin-badge-success { background: #f0fdf4; color: #15803d; }
  .admin-badge-error { background: #fff7ed; color: #c2410c; }
  .admin-badge-processing { background: #eff6ff; color: #1d4ed8; }

  .admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .admin-table th { text-align: left; padding: 10px 12px; font-weight: 500; color: #6b7280; font-size: 12px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
  .admin-table td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
  .admin-table tr:hover td { background: #f9fafb; }
  .admin-table .mono { font-family: 'SF Mono', monospace; }
  .admin-table .right { text-align: right; }

  .admin-stat-box { background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center; }
  .admin-stat-box.blue { background: #eff6ff; }
  .admin-stat-box.orange { background: #fff7ed; }
  .admin-stat-box.green { background: #f0fdf4; }
  .admin-stat-box.red { background: #fef2f2; }

  .admin-result-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; }
  .admin-result-icon.success { background: #dcfce7; color: #15803d; }
  .admin-result-icon.error { background: #fed7aa; color: #c2410c; }

  .admin-error-text { color: #dc2626; font-size: 13px; }

  .admin-details summary { font-size: 13px; color: #dc2626; cursor: pointer; }
  .admin-details pre { margin-top: 8px; font-size: 11px; background: #fef2f2; padding: 12px; border-radius: 8px; overflow: auto; max-height: 160px; color: #991b1b; }

  .admin-login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .admin-login-card { width: 100%; max-width: 360px; }
  .admin-login-title { font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 24px; }
`;