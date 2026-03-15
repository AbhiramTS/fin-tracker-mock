export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then((r) => console.info("[SW] registered:", r.scope))
      .catch((e) => console.warn("[SW] failed:", e));
  });
}
