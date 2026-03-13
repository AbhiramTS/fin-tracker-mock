// ─────────────────────────────────────────────────────────────────────────────
//  utils/pwa.ts  –  Register the real service worker from /public/sw.js
//  Called once from main.tsx before React renders.
// ─────────────────────────────────────────────────────────────────────────────

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => console.info("[SW] registered:", reg.scope))
      .catch((err) => console.warn("[SW] registration failed:", err));
  });
}
