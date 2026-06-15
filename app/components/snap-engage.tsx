import { useEffect } from "react";
import { useLocation } from "react-router";

const WIDGET_ID = "ce362c6d-08c9-4abc-87cf-6380725e1e10";
const STYLE_ID = "snapengage-hide-style";

// Conteneur racine du widget SnapEngage à masquer hors whitelist.
const SE_CONTAINER = '[id^="designstudio"]';

function loadScript() {
  if (document.getElementById("snapengage-script")) return;
  const se = document.createElement("script");
  se.id = "snapengage-script";
  se.async = true;
  se.src =
    "https://storage.googleapis.com/code.snapengage.com/js/" + WIDGET_ID + ".js";
  document.body.appendChild(se);
}

function whenReady(fn: (se: NonNullable<Window["SnapEngage"]>) => void) {
  const start = Date.now();
  const tick = () => {
    if (window.SnapEngage) return fn(window.SnapEngage);
    if (Date.now() - start < 10000) window.setTimeout(tick, 200);
  };
  tick();
}

// Force le masquage de tout le widget (bouton + fenêtre ouverte) via CSS,
// car SnapEngage n'expose pas d'API pour fermer une fenêtre de chat active.
function setHidden(hidden: boolean) {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = hidden ? `${SE_CONTAINER} { display: none !important; }` : "";
}

export function SnapEngage({ visibleOn }: { visibleOn?: string[] }) {
  const { pathname } = useLocation();

  useEffect(() => {
    loadScript();
  }, []);

  useEffect(() => {
    const show = !visibleOn || visibleOn.includes(pathname);
    setHidden(!show);
    whenReady((se) => (show ? se.showButton() : se.hideButton()));
  }, [pathname, visibleOn]);

  return null;
}