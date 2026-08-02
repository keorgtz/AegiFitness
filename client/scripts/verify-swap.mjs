// Verificación funcional del swap de ejercicios en /today:
// abre el modal de sustitución, cambia el primer ejercicio del plan,
// guarda el entreno y confirma que el cambio persiste tras recargar.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdirSync } from "node:fs";

const ROOT = "C:/Users/kevin/KeorSoft/Development/Web/AegiFitness";
const API = "http://localhost:5212";
const WEB = "http://localhost:5173";
const shots = `${ROOT}/shots/swap`;
mkdirSync(shots, { recursive: true });

const procs = [];
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`); };

function killTree(pid) { try { spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" }); } catch {} }
function cleanup() {
  procs.forEach((p) => { if (p?.pid) killTree(p.pid); });
  for (const port of [5212, 5173]) {
    try {
      const out = spawnSync("netstat", ["-ano"], { shell: true }).stdout?.toString() ?? "";
      for (const line of out.split("\n")) {
        if (line.includes(`:${port}`) && line.includes("LISTENING")) {
          const pid = line.trim().split(/\s+/).pop();
          if (pid && pid !== "0") killTree(Number(pid));
        }
      }
    } catch {}
  }
}
const watchdog = setTimeout(() => { results.push("FAIL  watchdog"); console.log(results.join("\n")); cleanup(); process.exit(2); }, 180_000);

function run(cmd, args, cwd) { const p = spawn(cmd, args, { cwd, shell: true, stdio: "ignore" }); procs.push(p); return p; }
// Fecha LOCAL (yyyy-MM-dd), igual que today() del frontend — NO toISOString (UTC)
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
async function waitUp(url, tries = 45) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok || r.status === 401 || r.status === 404) return true; } catch {}
    await delay(1000);
  }
  return false;
}
async function api(path, { method = "GET", token, body } = {}) {
  const r = await fetch(`${API}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}`);
  return r.json();
}

try {
  run("dotnet", [`"${ROOT}/server/AegiFitness.Api/bin/Debug/net10.0/AegiFitness.Api.dll"`, "--urls", API], `${ROOT}/server/AegiFitness.Api`);
  run("npm", ["run", "dev", "--", "--port", "5173", "--strictPort"], `${ROOT}/client`);
  if (!(await waitUp(`${API}/api/health`))) throw new Error("API no levantó");
  if (!(await waitUp(WEB))) throw new Error("Vite no levantó");

  const admin = await api("/auth/login", { method: "POST", body: { usernameOrEmail: "admin", password: "Admin#2026!" } });
  const at = admin.accessToken;
  await api("/profile", { method: "PUT", token: at, body: { sex: "Male", birthDate: "1994-03-10", heightCm: 180, weightKg: 88, targetWeightKg: 95, bodyType: "mesomorfo", activityFactor: 1.55, goal: "Bulk", mealTypes: ["Breakfast", "Lunch", "Dinner", "Snack"], onboardingCompleted: true } });
  await api("/training-config", { method: "PUT", token: at, body: { gymMode: "Bodybuilding", calisthenicsMode: "Classic", days: [
    { dayOfWeek: 0, modality: "Rest", muscleGroups: [] },
    { dayOfWeek: 1, modality: "Gym", muscleGroups: ["Chest", "Triceps"] },
    { dayOfWeek: 2, modality: "Gym", muscleGroups: ["Back", "Biceps"] },
    { dayOfWeek: 3, modality: "Gym", muscleGroups: ["Legs", "Core"] },
    { dayOfWeek: 4, modality: "Gym", muscleGroups: ["Shoulders"] },
    { dayOfWeek: 5, modality: "Both", muscleGroups: ["Chest", "Back"] },
    { dayOfWeek: 6, modality: "Calisthenics", muscleGroups: ["Core"] },
  ] } });
  // Asegurar que no hay log previo hoy que interfiera
  const today = localToday();
  await api("/workout-logs", { method: "POST", token: at, body: { date: today, planDayId: null, entries: [], notes: "" } });

  const browser = await chromium.launch();
  const errors = [];
  const NAV = { waitUntil: "domcontentloaded", timeout: 15000 };

  // ── Desktop: tarjetas + swap ──
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-MX" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  await page.goto(`${WEB}/login`, NAV);
  await delay(800);
  const inputs = page.locator("input:visible");
  await inputs.nth(0).fill("admin");
  await inputs.nth(1).fill("Admin#2026!");
  await page.locator("button[type=submit]").first().click();
  await delay(1800);

  await page.goto(`${WEB}/today`, NAV);
  await delay(1500);

  const cards = page.locator(".exercise-card");
  const cardCount = await cards.count();
  check("tarjetas de ejercicio renderizan", cardCount > 0, `(${cardCount})`);
  check("muscle tags visibles", (await page.locator(".muscle-tag").count()) >= cardCount);
  check("botón cambiar presente en cada tarjeta", (await page.locator("button[aria-label^='Cambiar']").count()) >= cardCount);
  await page.screenshot({ path: `${shots}/01-cards-nuevas.png` });

  const firstName = (await cards.first().locator(".exercise-card__name").innerText()).trim();

  // Abrir modal de sustitución
  await cards.first().locator("button[aria-label^='Cambiar']").click();
  await delay(1200);
  check("modal de sustitución abre", await page.locator(".dialog").first().isVisible());
  check("modal muestra ejercicio actual", (await page.locator(".swap-modal__current-name").innerText()).trim() === firstName);
  const altCount = await page.locator(".catalog-picker__item").count();
  check("alternativas del mismo músculo listadas", altCount > 0, `(${altCount})`);
  const thumbCount = await page.locator(".catalog-picker__thumb").count();
  check("alternativas con thumbnail RepDB", thumbCount > 0, `(${thumbCount})`);
  await page.screenshot({ path: `${shots}/02-modal-swap.png` });

  // Elegir sustituto con imagen (determinista para el check de la guía visual)
  const withThumb = page.locator(".catalog-picker__item", { has: page.locator("img") });
  const pick = (await withThumb.count()) > 0 ? withThumb.first() : page.locator(".catalog-picker__item").first();
  const newName = (await pick.locator(".catalog-picker__item-title").innerText()).trim();
  await pick.click();
  await delay(900);
  check("sustituto aplicado en tarjeta", (await cards.first().locator(".exercise-card__name").innerText()).trim() === newName, `(${newName})`);
  check("chip Cambiado visible", (await cards.first().innerText()).includes("Cambiado"));
  await page.screenshot({ path: `${shots}/03-tarjeta-cambiada.png` });

  // Guía visual: el sustituto (RepDB) debe mostrar imágenes start/peak o main
  await cards.first().locator("button[aria-label^='Guía']").click();
  await delay(1200);
  const guideImgs = await page.locator(".guide-images img").count();
  check("guía muestra imágenes del ejercicio", guideImgs > 0, `(${guideImgs})`);
  if (guideImgs > 0) {
    const src = await page.locator(".guide-images img").first().getAttribute("src");
    const imgResp = await page.request.get(`${WEB}${src}`);
    check("imagen de guía responde 200", imgResp.ok(), `(${src})`);
  }
  check("atribución RepDB visible en guía", (await page.locator(".guide-attribution").count()) > 0);
  await page.screenshot({ path: `${shots}/09-guia-imagenes.png` });
  await page.locator(".dialog__close").first().click();
  await delay(500);

  // Guardar y verificar persistencia del contrato (exercise incluido).
  // Ojo: EF no garantiza el orden de Entries (PK Guid) — buscar en todas.
  await page.locator("button:has-text('Guardar entreno')").first().click();
  await delay(800);
  const toastText = await page.locator("[class*='toast']").allInnerTexts().catch(() => []);
  await page.screenshot({ path: `${shots}/04-tras-guardar.png` });
  await delay(1200);
  const logs = await api(`/workout-logs?from=${today}&to=${today}`, { token: at });
  const savedEntries = logs[0]?.entries ?? [];
  check(
    "log guardado con ejercicio sustituto",
    savedEntries.some((e) => e.exercise?.name === newName),
    `(api: ${savedEntries.map((e) => e.exercise?.name ?? "?").join(", ")} | toast: ${toastText.join(" / ") || "ninguno"})`,
  );

  await page.goto(`${WEB}/today`, NAV);
  await delay(1500);
  const swappedCard = page.locator(".exercise-card", { hasText: newName }).first();
  check("nombre sustituto persiste tras recargar", (await swappedCard.count()) > 0);
  check("chip Cambiado persiste tras recargar", (await swappedCard.innerText()).includes("Cambiado"));

  // ── Swap de platillo (desktop) ──
  const mealCards = page.locator(".meal-rec-card");
  const mealCount = await mealCards.count();
  check("tarjetas de comida recomendada renderizan", mealCount > 0, `(${mealCount})`);
  const firstMealName = (await mealCards.first().locator(".meal-rec-card__name").innerText()).trim();
  await mealCards.first().locator("button[aria-label^='Cambiar']").click();
  await delay(1200);
  check("modal de platillo abre", await page.locator(".dialog").first().isVisible());
  check(
    "modal muestra platillo actual",
    (await page.locator(".swap-modal__current-name").innerText()).trim() === firstMealName,
  );
  const mealAltCount = await page.locator(".catalog-picker__item").count();
  check("alternativas del mismo tipo listadas", mealAltCount > 0, `(${mealAltCount})`);
  await page.screenshot({ path: `${shots}/06-modal-swap-comida.png` });
  const newMealName = (await page.locator(".catalog-picker__item-title").first().innerText()).trim();
  await page.locator(".catalog-picker__item").first().click();
  await delay(2000);
  check(
    "sustituto de platillo aplicado en tarjeta",
    (await mealCards.first().locator(".meal-rec-card__name").innerText()).trim() === newMealName,
    `(${newMealName})`,
  );
  const mp2 = await api(`/meal-plans/today?date=${today}`, { token: at });
  check(
    "plan persiste platillo sustituto (API)",
    mp2.items.some((i) => i.food.name === newMealName),
  );
  await page.goto(`${WEB}/today`, NAV);
  await delay(1500);
  check(
    "platillo sustituto persiste tras recargar",
    (await page.locator(".meal-rec-card", { hasText: newMealName }).count()) > 0,
  );
  await page.screenshot({ path: `${shots}/08-comida-cambiada.png` });
  await page.screenshot({ path: `${shots}/04-persistencia.png` });
  await ctx.close();

  // ── Móvil: tarjetas respiran ──
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-MX", isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  mp.setDefaultTimeout(10000);
  mp.on("pageerror", (e) => errors.push("m: " + String(e).slice(0, 120)));
  await mp.goto(`${WEB}/login`, NAV);
  await delay(800);
  const minputs = mp.locator("input:visible");
  await minputs.nth(0).fill("admin");
  await minputs.nth(1).fill("Admin#2026!");
  await mp.locator("button[type=submit]").first().click();
  await delay(1800);
  await mp.goto(`${WEB}/today`, NAV);
  await delay(1500);
  check("móvil: tarjetas renderizan", (await mp.locator(".exercise-card").count()) > 0);
  await mp.screenshot({ path: `${shots}/05-movil-cards.png` });

  // Bottom-sheet: la guía de ejercicio debe cubrir pantalla completa de ancho,
  // pegada abajo, sin encimarse con header/nav
  await mp.locator(".exercise-card button[aria-label^='Guía']").first().click();
  await delay(1000);
  const sheet = mp.locator(".dialog").first();
  check("móvil: diálogo abre", await sheet.isVisible());
  const box = await sheet.boundingBox();
  const vp = mp.viewportSize();
  check(
    "móvil: diálogo es bottom-sheet de ancho completo",
    !!box && !!vp && Math.abs(box.width - vp.width) < 2 && box.y + box.height <= vp.height + 2,
    box ? `(w=${Math.round(box.width)}, bottom=${Math.round(box.y + box.height)}/${vp?.height})` : "",
  );
  await mp.screenshot({ path: `${shots}/07-movil-dialog.png` });
  await mctx.close();

  check("sin errores JS en consola", errors.length === 0, errors.slice(0, 2).join(" | "));
  await browser.close();
} catch (err) {
  results.push(`FAIL  excepción: ${String(err).slice(0, 200)}`);
} finally {
  clearTimeout(watchdog);
  cleanup();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\nRESULTADO: ${results.length - fails} PASS / ${fails} FAIL`);
process.exit(fails > 0 ? 1 : 0);
