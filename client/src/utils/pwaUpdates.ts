declare const __APP_VERSION__: string;

const UPDATE_EVENT = "aegi:update-ready";
const CHECK_INTERVAL = 5 * 60 * 1000;
let ready = false;
let started = false;
let interacted = false;
let reloading = false;
let targetVersion = "";

export function isUpdateReady() { return ready; }
export function subscribeToUpdates(callback: () => void) {
  window.addEventListener(UPDATE_EVENT, callback);
  return () => window.removeEventListener(UPDATE_EVENT, callback);
}

export function applyAppUpdate() {
  if (reloading || !navigator.onLine) return;
  // Bound automatic retries if an upstream cache still serves an old deployment.
  try {
    const key = `aegi:update-reload:${__APP_VERSION__}`;
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(key, String(Date.now()));
  } catch { /* Reload remains possible when session storage is unavailable. */ }
  reloading = true;
  window.location.reload();
}

function updateReady() {
  ready = true;
  window.dispatchEvent(new Event(UPDATE_EVENT));
  // A new launch can refresh automatically; editing and active sessions keep their screen.
  if (!interacted && document.visibilityState === "visible" && window.location.pathname !== "/training/session") {
    applyAppUpdate();
  }
}

function workerVersion(worker: ServiceWorker): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (value: string | null) => {
      clearTimeout(timeout);
      channel.port1.close();
      resolve(value);
    };
    const timeout = window.setTimeout(() => finish(null), 1500);
    channel.port1.onmessage = (event: MessageEvent<unknown>) => finish(typeof event.data === "string" ? event.data : null);
    try { worker.postMessage({ type: "AEGI_VERSION" }, [channel.port2]); }
    catch { finish(null); }
  });
}

export function startAppUpdates() {
  if (started || !import.meta.env.PROD) return;
  started = true;
  window.addEventListener("pointerdown", () => { interacted = true; }, { capture: true, once: true });
  window.addEventListener("keydown", () => { interacted = true; }, { capture: true, once: true });
  window.addEventListener("input", () => { interacted = true; }, { capture: true, once: true });

  let registration: ServiceWorkerRegistration | undefined;
  const supported = "serviceWorker" in navigator;
  let hadController = supported && !!navigator.serviceWorker.controller;
  if (supported) navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController || targetVersion) updateReady();
    hadController = true;
  });

  const registered = supported
    ? navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((value) => { registration = value; })
      .catch(() => { /* Offline launches keep the previously installed application. */ })
    : Promise.resolve();

  let checking = false;
  let lastCheck = 0;
  const check = async () => {
    if (checking || !navigator.onLine || document.visibilityState !== "visible" || Date.now() - lastCheck < 15_000) return;
    checking = true;
    lastCheck = Date.now();
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (response.ok) {
        const value: unknown = await response.json();
        if (typeof value === "object" && value !== null && "version" in value && typeof value.version === "string" && value.version !== __APP_VERSION__) {
          targetVersion = value.version;
        }
      }
    } catch { /* Connectivity failures must not interrupt offline use. */ }
    try {
      await registered;
      if (supported && !registration) {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      }
      if (registration) {
        await registration.update();
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        // An update may already have activated before this document attached its listener.
        const controller = navigator.serviceWorker.controller;
        if (controller) {
          const version = await workerVersion(controller);
          if (version && version !== __APP_VERSION__) updateReady();
        }
      }
    } catch { /* The next online/foreground check retries the installation. */ }
    finally {
      checking = false;
      // Browsers that block workers still receive updates through the version endpoint.
      // Controlled pages wait for worker activation rather than reloading the stale shell.
      if (targetVersion && (!supported || !navigator.serviceWorker.controller)) updateReady();
    }
  };

  void check();
  window.addEventListener("online", () => { void check(); });
  window.addEventListener("pageshow", () => { void check(); });
  document.addEventListener("visibilitychange", () => { void check(); });
  window.setInterval(() => { void check(); }, CHECK_INTERVAL);
}
