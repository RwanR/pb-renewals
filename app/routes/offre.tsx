import { Outlet, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  validateToken,
  createClientSession,
  getClientName,
} from "~/lib/client-auth.server";
import prisma from "~/db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  var url = new URL(request.url);
  var token = url.searchParams.get("token");

  if (token) {
    var accountNumber = await validateToken(token);
    if (accountNumber) {
      var client = await prisma.client.findUnique({
        where: { accountNumber },
        select: { customerName: true },
      });
      return createClientSession(accountNumber, "/offre/" + accountNumber, client?.customerName || undefined);
    }
    return { tokenError: true, clientName: null };
  }

  var clientName = await getClientName(request);
  return { tokenError: false, clientName };
}

export default function OffreLayout() {
  var data = useLoaderData<typeof loader>();
  var clientName = data?.clientName || null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PB_CSS }} />
      <div className="pb-page">
        <header className="pb-header">
          <div className="pb-header-inner">
            <div className="pb-logo">
              <img src="/images/pb-logo.png" alt="Pitney Bowes" height="40" />
            </div>
            {clientName ? (
              <div className="pb-header-client">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8" cy="6" r="2.5" stroke="#737373" strokeWidth="1.2" fill="none"/>
                  <path d="M3 13.5C3 11 5 9.5 8 9.5s5 1.5 5 4" stroke="#737373" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                  <circle cx="8" cy="8" r="7" stroke="#737373" strokeWidth="1.2" fill="none"/>
                </svg>
                <span>{clientName}</span>
              </div>
            ) : null}
          </div>
          <div className="pb-header-gradient" />
        </header>
        <main>
          <Outlet />
        </main>
        <footer className="pb-footer">
          <div className="pb-footer-inner">
            <p>©1996-2026 Pitney Bowes Inc. Tous droits réservés.</p>
            <p className="pb-footer-links">
              <a href="https://www.pitneybowes.com/fr/legal.html" target="_blank" rel="noopener">Mentions légales</a>
              {"  "}
              <a href="https://www.pitneybowes.com/fr/legal/politique-de-confidentialite.html" target="_blank" rel="noopener">Protection des données</a>
              {"  "}
              <span>ISO9001 ISO27001</span>
              {"  "}
              <a href="#" onClick={function(e) { e.preventDefault(); }}>Cookies</a>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

var PB_CSS = "\
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');\
:root {\
  --pb-cta: #005cb1;\
  --pb-text: #404040;\
  --pb-text-muted: #737373;\
  --pb-border: #e5e5e5;\
  --pb-border-dark: #d4d4d4;\
  --pb-bg: white;\
  --pb-muted: #f5f5f5;\
  --pb-muted-bg: #fafafa;\
  --pb-promo-bg: #e8f4fd;\
  --pb-badge-grey: #a3a3a3;\
  --pb-foreground: #0a0a0a;\
  --pb-step-active: #171717;\
  --pb-step-inactive: #d4d4d4;\
  --pb-radius-card: 16px;\
  --pb-radius-btn: 8px;\
}\
* { box-sizing: border-box; margin: 0; padding: 0; }\
body {\
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;\
  color: var(--pb-text);\
  background: var(--pb-muted-bg);\
  -webkit-font-smoothing: antialiased;\
}\
.pb-page { min-height: 100vh; display: flex; flex-direction: column; }\
.pb-header { background: white; border-bottom: 1px solid var(--pb-border); position: sticky; top: 0; z-index: 50; }\
.pb-header-inner { max-width: 1280px; margin: 0 auto; padding: 20px 32px; display: flex; align-items: center; justify-content: center; position: relative; height: 80px; }\
.pb-header-gradient { height: 3px; background: linear-gradient(90deg, #1D2C6B 0%, #00A3E0 40%, #7B2D8E 70%, #E91E8C 100%); }\
.pb-logo img { height: 40px; width: auto; }\
.pb-header-client { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--pb-text); position: absolute; right: 32px; top: 50%; transform: translateY(-50%); }\
.pb-header-client-icon { width: 16px; height: 16px; color: var(--pb-text-muted); }\
.pb-banner { background: var(--pb-muted-bg); border-bottom: 1px solid var(--pb-border); text-align: center; padding: 16px 32px; font-size: 14px; color: var(--pb-text); height: 64px; display: flex; align-items: center; justify-content: center; }\
.pb-banner strong { font-weight: 600; }\
.pb-main { flex: 1; max-width: 1280px; width: 100%; margin: 0 auto; padding: 32px 32px 64px; }\
.pb-footer { background: white; color: var(--pb-text); font-size: 12px; padding: 48px 16px; text-align: center; margin-top: auto; }\
.pb-footer-inner { max-width: 1280px; margin: 0 auto; line-height: 1.8; }\
.pb-footer-links { margin-top: 4px; }\
.pb-footer-links a, .pb-footer-links span { color: var(--pb-text); text-decoration: underline; font-size: 12px; }\
.pb-footer-links span { text-decoration: underline; }\
.pb-card { background: white; border: 1px solid var(--pb-border); border-radius: var(--pb-radius-card); padding: 32px; }\
.pb-card-recommended { border: 2px solid var(--pb-text); }\
.pb-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; line-height: 16px; width: fit-content; }\
.pb-badge-recommended { background: var(--pb-cta); color: #fafafa; }\
.pb-badge-current { background: var(--pb-badge-grey); color: #fafafa; }\
.pb-heading { font-size: 24px; font-weight: 500; color: var(--pb-text); line-height: 28.8px; letter-spacing: 0.1px; }\
.pb-text-sm { font-size: 14px; line-height: 20px; color: var(--pb-text); }\
.pb-text-muted { font-size: 12px; line-height: 16px; color: var(--pb-text-muted); }\
.pb-text-xs { font-size: 12px; color: var(--pb-text-muted); }\
.pb-price { font-size: 30px; font-weight: 500; color: var(--pb-text); line-height: 30px; letter-spacing: 0.1px; }\
.pb-price-unit { font-size: 14px; font-weight: 400; color: var(--pb-text-muted); padding-top: 9px; }\
.pb-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 32px; border: none; border-radius: var(--pb-radius-btn); font-family: inherit; font-size: 16px; font-weight: 500; line-height: 24px; cursor: pointer; transition: all 0.15s ease; text-decoration: none; }\
.pb-btn:disabled { opacity: 0.5; cursor: not-allowed; }\
.pb-btn-primary { background: var(--pb-cta); color: #fafafa; }\
.pb-btn-primary:hover:not(:disabled) { opacity: 0.9; }\
.pb-btn-secondary { background: rgba(255,255,255,0.1); color: var(--pb-foreground); border: 1px solid var(--pb-border-dark); box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }\
.pb-btn-secondary:hover:not(:disabled) { background: var(--pb-muted); }\
.pb-btn-outline { background: rgba(255,255,255,0.1); color: var(--pb-foreground); border: 1px solid var(--pb-border-dark); box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }\
.pb-btn-full { width: 100%; }\
.pb-input { width: 100%; padding: 12px 16px; border: 1px solid var(--pb-border); border-radius: var(--pb-radius-btn); font-family: inherit; font-size: 14px; color: var(--pb-foreground); background: white; }\
.pb-input:focus { outline: none; border-color: var(--pb-cta); box-shadow: 0 0 0 3px rgba(0,92,177,0.1); }\
.pb-label { display: block; font-size: 14px; font-weight: 500; color: var(--pb-foreground); margin-bottom: 6px; }\
.pb-select { padding: 5.5px 16px; border: 1px solid var(--pb-step-active); border-radius: var(--pb-radius-btn); font-family: inherit; font-size: 14px; font-weight: 500; color: var(--pb-foreground); background: white; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); cursor: pointer; min-height: 32px; }\
.pb-promo { padding: 12px 16px; border-radius: 8px; }\
.pb-promo-recommended { background: var(--pb-promo-bg); color: var(--pb-cta); }\
.pb-promo-default { background: var(--pb-muted); color: var(--pb-text-muted); }\
.pb-promo-title { font-size: 14px; font-weight: 500; line-height: 20px; }\
.pb-promo-sub { font-size: 12px; font-weight: 400; line-height: 16px; margin-top: 4px; }\
.pb-check-icon { color: var(--pb-cta); font-size: 18px; flex-shrink: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }\
.pb-prop { display: flex; gap: 8px; align-items: center; font-size: 14px; line-height: 20px; color: var(--pb-text); }\
.pb-props { display: flex; flex-direction: column; }\
.pb-step { width: 24px; height: 24px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500; }\
.pb-step-active { background: var(--pb-step-active); color: white; }\
.pb-step-inactive { background: var(--pb-step-inactive); color: var(--pb-text-muted); }\
.pb-step-line { width: 16px; height: 1px; background: var(--pb-step-inactive); }\
.pb-offers-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }\
@media (min-width: 768px) { .pb-offers-grid { grid-template-columns: 1fr 1fr; } }\
.pb-space > * + * { margin-top: 20px; }\
.pb-space-sm > * + * { margin-top: 16px; }\
.pb-link { color: var(--pb-cta); text-decoration: none; font-weight: 500; }\
.pb-link:hover { text-decoration: underline; }\
.pb-error { padding: 12px 16px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; color: #DC2626; font-size: 14px; }\
.pb-machine-img { width: 100%; max-width: 200px; height: auto; margin: 0 auto; display: block; }\
.pb-login-center { max-width: 420px; margin: 80px auto 0; }\
.pb-spinner { display: inline-block; width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: pb-spin 0.8s linear infinite; }\
@keyframes pb-spin { to { transform: rotate(360deg); } }\
.pb-divider { height: 1px; background: var(--pb-border); }\
.pb-situation-label { font-size: 12px; color: var(--pb-text-muted); line-height: 20px; }\
.pb-situation-value { font-size: 14px; font-weight: 600; color: var(--pb-text); line-height: 20px; text-align: right; }\
.pb-option { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid var(--pb-border); border-radius: 8px; cursor: pointer; transition: all 0.15s; }\
.pb-option:hover { border-color: var(--pb-cta); }\
.pb-option-selected { border-color: var(--pb-step-active); background: rgba(0,0,0,0.02); }\
@media (max-width: 640px) {\
  .pb-main { padding: 16px 16px 48px; }\
  .pb-heading { font-size: 20px; }\
  .pb-price { font-size: 24px; }\
  .pb-card { padding: 20px; }\
  .pb-header-inner { padding: 16px; height: 60px; }\
  .pb-offers-grid { gap: 16px; }\
}\
";