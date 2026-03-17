import { Outlet } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  validateToken,
  createClientSession,
} from "~/lib/client-auth.server";

// Handle token-based auth: /offre?token=xxx
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (token) {
    const accountNumber = await validateToken(token);
    if (accountNumber) {
      return createClientSession(accountNumber, `/offre/${accountNumber}`);
    }
    // Invalid/expired token → fall through to fallback page
    return { tokenError: true };
  }

  return { tokenError: false };
}

export default function OffreLayout() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PB_CSS }} />
      <div className="pb-page">
        <header className="pb-header">
          <div className="pb-header-inner">
            <div className="pb-logo">
              <svg width="140" height="28" viewBox="0 0 140 28" fill="none">
                <text x="0" y="22" fontFamily="'Segoe UI', system-ui, sans-serif" fontSize="18" fontWeight="300" fill="#4A4A4A" letterSpacing="1">pitney bowes</text>
              </svg>
            </div>
          </div>
        </header>
        <main className="pb-main">
          <Outlet />
        </main>
        <footer className="pb-footer">
          <div className="pb-footer-inner">
            <p>Pitney Bowes SAS – Capital 11 789 424,25 € – RCS Bobigny 562 046 235</p>
            <p>5 Rue Francis de Pressensé, Immeuble VOX, CS20012, 93456 La Plaine Saint-Denis Cedex</p>
          </div>
        </footer>
      </div>
    </>
  );
}

const PB_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');

  :root {
    --pb-navy: #1D2C6B;
    --pb-cyan: #00A3E0;
    --pb-violet: #7B2D8E;
    --pb-magenta: #E91E8C;
    --pb-text: #2D2D2D;
    --pb-text-light: #6B7280;
    --pb-bg: #F8F9FC;
    --pb-white: #FFFFFF;
    --pb-border: #E5E8F0;
    --pb-success: #059669;
    --pb-radius: 12px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--pb-text);
    background: var(--pb-bg);
    -webkit-font-smoothing: antialiased;
  }

  .pb-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Header */
  .pb-header {
    background: var(--pb-white);
    border-bottom: 1px solid var(--pb-border);
    position: sticky;
    top: 0;
    z-index: 50;
  }
  .pb-header-inner {
    max-width: 960px;
    margin: 0 auto;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .pb-logo { display: flex; align-items: center; }

  /* Main */
  .pb-main {
    flex: 1;
    max-width: 960px;
    width: 100%;
    margin: 0 auto;
    padding: 32px 24px 64px;
  }

  /* Footer */
  .pb-footer {
    background: var(--pb-navy);
    color: rgba(255,255,255,0.6);
    font-size: 12px;
    padding: 24px;
    text-align: center;
    margin-top: auto;
  }
  .pb-footer-inner { max-width: 960px; margin: 0 auto; line-height: 1.6; }

  /* Cards */
  .pb-card {
    background: var(--pb-white);
    border: 1px solid var(--pb-border);
    border-radius: var(--pb-radius);
    padding: 24px;
  }
  .pb-card-highlight {
    border-color: var(--pb-cyan);
    box-shadow: 0 0 0 1px var(--pb-cyan), 0 4px 24px rgba(0,163,224,0.08);
  }
  .pb-card-secondary {
    background: var(--pb-bg);
    border-color: var(--pb-border);
  }

  /* Badge */
  .pb-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    border-radius: 99px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .pb-badge-recommended {
    background: linear-gradient(135deg, var(--pb-magenta), var(--pb-violet));
    color: white;
  }
  .pb-badge-current {
    background: #EEF2FF;
    color: var(--pb-navy);
  }

  /* Typography */
  .pb-title {
    font-size: 28px;
    font-weight: 700;
    color: var(--pb-navy);
    line-height: 1.2;
  }
  .pb-subtitle {
    font-size: 18px;
    font-weight: 600;
    color: var(--pb-navy);
    line-height: 1.3;
  }
  .pb-text { font-size: 15px; line-height: 1.6; color: var(--pb-text); }
  .pb-text-sm { font-size: 13px; color: var(--pb-text-light); }
  .pb-text-xs { font-size: 12px; color: var(--pb-text-light); }

  /* Greeting */
  .pb-greeting {
    font-size: 15px;
    color: var(--pb-text-light);
    margin-bottom: 8px;
  }

  /* Situation block */
  .pb-situation {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }
  .pb-situation-item {
    padding: 12px 16px;
    background: #F1F5F9;
    border-radius: 8px;
  }
  .pb-situation-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--pb-text-light);
    margin-bottom: 4px;
    font-weight: 500;
  }
  .pb-situation-value {
    font-size: 15px;
    font-weight: 600;
    color: var(--pb-text);
  }

  /* Price */
  .pb-price {
    font-size: 32px;
    font-weight: 700;
    color: var(--pb-navy);
    font-variant-numeric: tabular-nums;
  }
  .pb-price-period {
    font-size: 14px;
    font-weight: 400;
    color: var(--pb-text-light);
  }
  .pb-price-monthly {
    font-size: 14px;
    color: var(--pb-text-light);
    margin-top: 2px;
  }

  /* Buttons */
  .pb-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 28px;
    border: none;
    border-radius: 8px;
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    text-decoration: none;
  }
  .pb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .pb-btn-primary {
    background: linear-gradient(135deg, var(--pb-navy), #2A3F8F);
    color: white;
  }
  .pb-btn-primary:hover:not(:disabled) { box-shadow: 0 4px 16px rgba(29,44,107,0.3); transform: translateY(-1px); }
  .pb-btn-secondary {
    background: var(--pb-white);
    color: var(--pb-navy);
    border: 1.5px solid var(--pb-border);
  }
  .pb-btn-secondary:hover:not(:disabled) { border-color: var(--pb-navy); }
  .pb-btn-full { width: 100%; }

  /* Forms */
  .pb-input {
    width: 100%;
    padding: 12px 16px;
    border: 1.5px solid var(--pb-border);
    border-radius: 8px;
    font-family: inherit;
    font-size: 16px;
    color: var(--pb-text);
    transition: border-color 0.15s;
    background: var(--pb-white);
  }
  .pb-input:focus { outline: none; border-color: var(--pb-cyan); box-shadow: 0 0 0 3px rgba(0,163,224,0.1); }
  .pb-input::placeholder { color: #B0B7C3; }

  .pb-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--pb-text);
    margin-bottom: 6px;
  }

  /* Value props */
  .pb-props { display: flex; flex-direction: column; gap: 10px; }
  .pb-prop {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 14px;
    line-height: 1.5;
    color: var(--pb-text);
  }
  .pb-prop-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ECFDF5;
    color: var(--pb-success);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  /* Promo */
  .pb-promo {
    padding: 10px 16px;
    background: linear-gradient(135deg, #FDF2F8, #FAF5FF);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--pb-violet);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Spacing */
  .pb-space > * + * { margin-top: 24px; }
  .pb-space-sm > * + * { margin-top: 16px; }
  .pb-space-lg > * + * { margin-top: 32px; }

  /* Grid */
  .pb-offers-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }
  @media (min-width: 768px) {
    .pb-offers-grid { grid-template-columns: 1fr 1fr; }
    .pb-offer-main { grid-column: 1; }
    .pb-offer-alt { grid-column: 2; }
  }

  /* Divider */
  .pb-divider {
    height: 1px;
    background: var(--pb-border);
    margin: 24px 0;
  }

  /* Error */
  .pb-error {
    padding: 12px 16px;
    background: #FEF2F2;
    border: 1px solid #FECACA;
    border-radius: 8px;
    color: #DC2626;
    font-size: 14px;
  }

  /* Link */
  .pb-link {
    color: var(--pb-cyan);
    text-decoration: none;
    font-weight: 500;
  }
  .pb-link:hover { text-decoration: underline; }

  /* Machine image */
  .pb-machine-img {
    width: 100%;
    max-width: 200px;
    height: auto;
    border-radius: 8px;
    margin: 0 auto;
    display: block;
  }

  /* Options */
  .pb-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border: 1.5px solid var(--pb-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .pb-option:hover { border-color: var(--pb-cyan); }
  .pb-option-selected { border-color: var(--pb-cyan); background: rgba(0,163,224,0.04); }
  .pb-option-radio {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid var(--pb-border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pb-option-selected .pb-option-radio {
    border-color: var(--pb-cyan);
  }
  .pb-option-selected .pb-option-radio::after {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--pb-cyan);
  }

  /* Login centered */
  .pb-login-center {
    max-width: 420px;
    margin: 60px auto 0;
  }

  /* Spinner */
  .pb-spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 2.5px solid var(--pb-border);
    border-top-color: var(--pb-cyan);
    border-radius: 50%;
    animation: pb-spin 0.8s linear infinite;
  }
  @keyframes pb-spin { to { transform: rotate(360deg); } }

  /* Responsive */
  @media (max-width: 640px) {
    .pb-main { padding: 20px 16px 48px; }
    .pb-title { font-size: 22px; }
    .pb-price { font-size: 26px; }
    .pb-card { padding: 16px; }
    .pb-situation { grid-template-columns: 1fr 1fr; }
  }
`;