// Compatibility entry point for HTML cached before managed updates were introduced.
// New builds register their worker through src/utils/pwaUpdates.ts instead.
if ("serviceWorker" in navigator) {
  let interacted = false;
  let controlled = !!navigator.serviceWorker.controller;
  let refreshing = false;
  window.addEventListener("input", () => { interacted = true; }, { capture: true, once: true });
  window.addEventListener("pointerdown", () => { interacted = true; }, { capture: true, once: true });
  window.addEventListener("keydown", () => { interacted = true; }, { capture: true, once: true });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (controlled && !interacted && !refreshing && document.visibilityState === "visible" && location.pathname !== "/training/session") {
      refreshing = true;
      location.reload();
    }
    controlled = true;
  });
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then((registration) => registration.update())
    .catch(() => { /* Keep the cached app available when offline. */ });
}
