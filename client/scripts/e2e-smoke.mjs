// E2E smoke: API + Vite dev + flujos UI clave (login, onboarding-vía-API, vistas, pending, admin).
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const ROOT = "C:/Users/kevin/KeorSoft/Development/Web/AegiFitness";
const API = "http://localhost:5212";
const WEB = "http://localhost:5173";
const shots = `${ROOT}/shots/e2e`;
import { mkdirSync } from "node:fs";
mkdirSync(shots, { recursive: true });

const procs = [];
function run(cmd, args, cwd, name) {
  const p = spawn(cmd, args, { cwd, shell: true, stdio: "ignore" });
  procs.push(p);
  return p;
}
async function waitUp(url, tries = 60) {
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

const results = [];
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`); };

try {
  run("dotnet", [`"${ROOT}/server/AegiFitness.Api/bin/Debug/net10.0/AegiFitness.Api.dll"`, "--urls", API], `${ROOT}/server/AegiFitness.Api`, "api");
  run("npm", ["run", "dev", "--", "--port", "5173", "--strictPort"], `${ROOT}/client`, "web");

  if (!(await waitUp(`${API}/api/health`))) throw new Error("API no levantó");
  if (!(await waitUp(WEB))) throw new Error("Vite no levantó");

  // Preparar admin vía API (onboarding completo para acceder al dashboard)
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
  // marcar onboarding completo vía profile (el PUT debe setearlo; si no, la UI redirigirá al wizard)
  const prof = await api("/profile", { token: at });

  const browser = await chromium.launch();
  const errors = [];

  // ── Desktop: login → dashboard → todas las vistas ──
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-MX" });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  await page.goto(`${WEB}/login`, { waitUntil: "networkidle" });
  check("login render", await page.locator("input").first().isVisible());
  await page.screenshot({ path: `${shots}/01-login.png` });

  const inputs = page.locator("input:visible");
  await inputs.nth(0).fill("admin");
  await inputs.nth(1).fill("Admin#2026!");
  await page.locator("button[type=submit], button:has-text('sesión'), button:has-text('entrar'), button:has-text('Entrar')").first().click();
  await page.waitForLoadState("networkidle");
  await delay(1200);
  const url1 = page.url();
  check("admin login navega", !url1.includes("/login"), `-> ${url1.replace(WEB, "")}`);
  await page.screenshot({ path: `${shots}/02-after-login.png`, fullPage: false });

  const routes = [
    ["/", "03-dashboard"], ["/today", "04-today"], ["/training", "05-training"],
    ["/nutrition", "06-nutrition"], ["/progress", "07-progress"], ["/achievements", "08-achievements"],
    ["/settings", "09-settings"], ["/admin", "10-admin"],
  ];
  for (const [route, name] of routes) {
    await page.goto(`${WEB}${route}`, { waitUntil: "networkidle" });
    await delay(700);
    const body = await page.locator("body").innerText();
    const hasContent = body.trim().length > 40;
    const sidebar = await page.locator("nav, aside, [class*=sidebar]").first().isVisible().catch(() => false);
    check(`vista ${route}`, hasContent, `(sidebar=${sidebar})`);
    await page.screenshot({ path: `${shots}/${name}.png` });
  }
  await ctx.close();

  // ── Móvil portrait: bottom-nav + today ──
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-MX", isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  mp.on("pageerror", (e) => errors.push("m: " + String(e).slice(0, 120)));
  await mp.goto(`${WEB}/login`, { waitUntil: "networkidle" });
  const minputs = mp.locator("input:visible");
  await minputs.nth(0).fill("admin");
  await minputs.nth(1).fill("Admin#2026!");
  await mp.locator("button[type=submit]").first().click();
  await mp.waitForLoadState("networkidle"); await delay(1000);
  await mp.screenshot({ path: `${shots}/11-mobile-dashboard.png` });
  await mp.goto(`${WEB}/today`, { waitUntil: "networkidle" }); await delay(700);
  await mp.screenshot({ path: `${shots}/12-mobile-today.png` });
  check("mobile render", (await mp.locator("body").innerText()).trim().length > 40);
  await mctx.close();

  // ── Registro → pending ──
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await ctx2.newPage();
  await p2.goto(`${WEB}/register`, { waitUntil: "networkidle" });
  await p2.screenshot({ path: `${shots}/13-register.png` });
  const u = `e2e${Date.now() % 100000}`;
  await p2.locator('input[name="username"]').fill(u);
  await p2.locator('input[name="email"]').fill(`${u}@test.dev`);
  await p2.locator('input[name="displayName"]').fill("E2E User");
  await p2.locator('input[name="password"]').fill("Test#12345");
  await p2.locator('input[name="confirmPassword"]').fill("Test#12345");
  await p2.locator("button[type=submit]").first().click();
  await p2.waitForLoadState("networkidle"); await delay(800);
  // login con el nuevo usuario
  await p2.goto(`${WEB}/login`, { waitUntil: "networkidle" });
  const linputs = p2.locator("input:visible");
  await linputs.nth(0).fill(u);
  await linputs.nth(1).fill("Test#12345");
  await p2.locator("button[type=submit]").first().click();
  await p2.waitForLoadState("networkidle"); await delay(1000);
  const url2 = p2.url();
  check("usuario nuevo -> pending", url2.includes("/pending") || (await p2.locator("body").innerText()).toLowerCase().includes("licencia"), `-> ${url2.replace(WEB, "")}`);
  await p2.screenshot({ path: `${shots}/14-pending.png` });
  await ctx2.close();

  await browser.close();
  const realErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("manifest") && !e.includes("net::ERR_") && !e.includes("401"));
  check("sin errores JS en consola", realErrors.length === 0, realErrors.length ? `(${realErrors.length}: ${realErrors[0]})` : "");
} catch (e) {
  results.push(`FAIL  E2E fatal: ${e.message}`);
} finally {
  procs.forEach((p) => { try { process.kill(p.pid); } catch {} });
  try { spawn("taskkill", ["/F", "/IM", "AegiFitness.Api.exe"], { shell: true, stdio: "ignore" }); } catch {}
  try { spawn("taskkill", ["/F", "/FI", "WINDOWTITLE eq vite*"], { shell: true, stdio: "ignore" }); } catch {}
}
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
