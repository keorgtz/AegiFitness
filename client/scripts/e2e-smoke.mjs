// E2E smoke: API + Vite dev + flujos UI clave (login, vistas, pending, admin).
// Con watchdog duro (3 min), sin networkidle (HMR de Vite lo impide) y kills por árbol de procesos.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdirSync } from "node:fs";

const ROOT = "C:/Users/kevin/KeorSoft/Development/Web/AegiFitness";
const API = "http://localhost:5212";
const WEB = "http://localhost:5173";
const shots = `${ROOT}/shots/e2e`;
mkdirSync(shots, { recursive: true });

const procs = [];
const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`); };

function killTree(pid) {
  try { spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" }); } catch {}
}
function cleanup() {
  procs.forEach((p) => { if (p?.pid) killTree(p.pid); });
  // barrido final por puertos por si algo quedó
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

// Watchdog: nunca más de 3 minutos en total
const watchdog = setTimeout(() => {
  results.push("FAIL  watchdog: tiempo máximo excedido");
  console.log(results.join("\n"));
  cleanup();
  process.exit(2);
}, 180_000);

function run(cmd, args, cwd) {
  const p = spawn(cmd, args, { cwd, shell: true, stdio: "ignore", detached: false });
  procs.push(p);
  return p;
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

  // Preparar admin vía API (onboarding completo)
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

  const browser = await chromium.launch();
  const errors = [];
  const NAV = { waitUntil: "domcontentloaded", timeout: 15000 };

  // ── Desktop ──
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-MX" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  await page.goto(`${WEB}/login`, NAV);
  await delay(800);
  check("login render", await page.locator("input").first().isVisible());
  await page.screenshot({ path: `${shots}/01-login.png` });

  const inputs = page.locator("input:visible");
  await inputs.nth(0).fill("admin");
  await inputs.nth(1).fill("Admin#2026!");
  await page.locator("button[type=submit]").first().click();
  await delay(1800);
  const url1 = page.url();
  check("admin login navega", !url1.includes("/login"), `-> ${url1.replace(WEB, "")}`);

  const routes = [
    ["/", "03-dashboard"], ["/today", "04-today"], ["/training", "05-training"],
    ["/nutrition", "06-nutrition"], ["/progress", "07-progress"], ["/achievements", "08-achievements"],
    ["/settings", "09-settings"], ["/admin", "10-admin"],
  ];
  for (const [route, name] of routes) {
    await page.goto(`${WEB}${route}`, NAV);
    await delay(1200);
    const body = await page.locator("body").innerText();
    const hasContent = body.trim().length > 40;
    const sidebar = await page.locator("nav, aside, [class*=sidebar]").first().isVisible().catch(() => false);
    check(`vista ${route}`, hasContent, `(sidebar=${sidebar})`);
    await page.screenshot({ path: `${shots}/${name}.png` });
  }
  await ctx.close();

  // ── Móvil portrait ──
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
  await mp.screenshot({ path: `${shots}/11-mobile-dashboard.png` });
  await mp.goto(`${WEB}/today`, NAV);
  await delay(1200);
  await mp.screenshot({ path: `${shots}/12-mobile-today.png` });
  check("mobile render", (await mp.locator("body").innerText()).trim().length > 40);
  await mctx.close();

  // ── Registro → pending ──
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await ctx2.newPage();
  p2.setDefaultTimeout(10000);
  await p2.goto(`${WEB}/register`, NAV);
  await delay(800);
  await p2.screenshot({ path: `${shots}/13-register.png` });
  const u = `e2e${Date.now() % 100000}`;
  await p2.locator('input[name="username"]').fill(u);
  await p2.locator('input[name="email"]').fill(`${u}@test.dev`);
  await p2.locator('input[name="displayName"]').fill("E2E User");
  await p2.locator('input[name="password"]').fill("Test#12345");
  await p2.locator('input[name="confirmPassword"]').fill("Test#12345");
  await p2.locator("button[type=submit]").first().click();
  await delay(1500);
  await p2.goto(`${WEB}/login`, NAV);
  await delay(600);
  const linputs = p2.locator("input:visible");
  await linputs.nth(0).fill(u);
  await linputs.nth(1).fill("Test#12345");
  await p2.locator("button[type=submit]").first().click();
  await delay(1500);
  const url2 = p2.url();
  check("usuario nuevo -> pending", url2.includes("/pending") || (await p2.locator("body").innerText()).toLowerCase().includes("licencia"), `-> ${url2.replace(WEB, "")}`);
  await p2.screenshot({ path: `${shots}/14-pending.png` });
  await ctx2.close();

  await browser.close();
  const realErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("manifest") && !e.includes("net::ERR_") && !e.includes("401"));
  check("sin errores JS en consola", realErrors.length === 0, realErrors.length ? `(${realErrors.length}: ${realErrors[0]})` : "");
} catch (e) {
  results.push(`FAIL  E2E fatal: ${e.message}`);
}

clearTimeout(watchdog);
console.log(results.join("\n"));
cleanup();
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
