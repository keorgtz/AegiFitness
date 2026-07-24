// Captura detallada de todas las vistas + modales para revisión visual.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdirSync } from "node:fs";

const ROOT = "C:/Users/kevin/KeorSoft/Development/Web/AegiFitness";
const API = "http://localhost:5212";
const WEB = "http://localhost:5173";
const shots = `${ROOT}/shots/review`;
mkdirSync(shots, { recursive: true });

const procs = [];
function killTree(pid) { try { spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" }); } catch {} }
function cleanup() { procs.forEach((p) => { if (p?.pid) killTree(p.pid); }); }
const watchdog = setTimeout(() => { console.log("WATCHDOG"); cleanup(); process.exit(2); }, 240_000);

function run(cmd, args, cwd) { const p = spawn(cmd, args, { cwd, shell: true, stdio: "ignore" }); procs.push(p); return p; }
async function waitUp(url, tries = 45) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok || r.status === 401 || r.status === 404) return true; } catch {}
    await delay(1000);
  }
  return false;
}
async function api(path, { method = "GET", token, body } = {}) {
  const r = await fetch(`${API}/api${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
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
  // datos de hoy para vistas ricas
  const today = new Date().toISOString().slice(0, 10);
  const plan = await api("/workout-plans/current", { token: at });
  const dow = new Date().getDay();
  const pd = plan.days.find((d) => d.dayOfWeek === dow) ?? plan.days.find((d) => d.items.length > 0);
  if (pd) {
    await api("/workout-logs", { method: "POST", token: at, body: { date: today, planDayId: pd.id, entries: pd.items.slice(0, 2).map((i) => ({ exerciseId: i.exerciseId, plannedSets: i.sets, plannedReps: i.repsMin, actualSets: i.sets, actualReps: i.repsMin, actualWeightKg: 40, completed: true, isExtra: false })), notes: "" } });
  }
  const mp = await api("/meal-plans/today", { token: at });
  await api("/meal-logs", { method: "POST", token: at, body: { date: today, entries: [{ foodId: mp.items[0].foodId, mealType: mp.items[0].mealType, servings: 1, calories: mp.items[0].food.calories, proteinG: mp.items[0].food.proteinG, carbsG: mp.items[0].food.carbsG, fatG: mp.items[0].food.fatG, isExtra: false }] } });
  await api("/goals", { method: "POST", token: at, body: { type: "WeeklyWorkouts", title: "5 entrenos por semana", targetValue: 5, unit: "entrenos" } }).catch(() => {});
  await api("/metrics/weight", { method: "POST", token: at, body: { date: today, weightKg: 87.2 } }).catch(() => {});

  const browser = await chromium.launch();
  const NAV = { waitUntil: "domcontentloaded", timeout: 15000 };

  async function login(page) {
    await page.goto(`${WEB}/login`, NAV);
    await delay(700);
    const inputs = page.locator("input:visible");
    await inputs.nth(0).fill("admin");
    await inputs.nth(1).fill("Admin#2026!");
    await page.locator("button[type=submit]").first().click();
    await delay(1800);
  }

  // ── DESKTOP ──
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-MX" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(9000);
  await login(page);

  const routes = [["/", "d1-dashboard"], ["/today", "d2-today"], ["/training", "d3-training"], ["/nutrition", "d4-nutrition"], ["/progress", "d5-progress"], ["/achievements", "d6-achievements"], ["/settings", "d7-settings"], ["/admin", "d8-admin"]];
  for (const [r, n] of routes) {
    await page.goto(`${WEB}${r}`, NAV);
    await delay(1300);
    await page.screenshot({ path: `${shots}/${n}.png`, fullPage: true });
  }

  // modales: guía de ejercicio (today -> info)
  await page.goto(`${WEB}/today`, NAV); await delay(1300);
  const infoBtn = page.locator("button:has(.icon:text('info')), [class*=info]").first();
  if (await infoBtn.count()) { await infoBtn.click().catch(() => {}); await delay(600); await page.screenshot({ path: `${shots}/d9-modal-ejercicio.png` }); await page.keyboard.press("Escape"); }
  // receta (menu_book)
  const bookBtn = page.locator("button:has(.icon:text('menu_book')), .icon:text('menu_book')").first();
  if (await bookBtn.count()) { await bookBtn.click().catch(() => {}); await delay(600); await page.screenshot({ path: `${shots}/d10-modal-receta.png` }); await page.keyboard.press("Escape"); }
  // admin gestionar
  await page.goto(`${WEB}/admin`, NAV); await delay(1200);
  const manageBtn = page.locator("button:has-text('Gestionar')").first();
  if (await manageBtn.count()) { await manageBtn.click(); await delay(700); await page.screenshot({ path: `${shots}/d11-modal-gestionar.png` }); await page.keyboard.press("Escape"); }
  // settings cuenta
  await page.goto(`${WEB}/settings`, NAV); await delay(1000);
  const accTab = page.locator("text=Cuenta").first();
  if (await accTab.count()) { await accTab.click().catch(() => {}); await delay(600); await page.screenshot({ path: `${shots}/d12-settings-cuenta.png` }); }
  await ctx.close();

  // ── MOBILE ──
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "es-MX", isMobile: true, hasTouch: true });
  const mp2 = await mctx.newPage();
  mp2.setDefaultTimeout(9000);
  await login(mp2);
  for (const [r, n] of routes) {
    await mp2.goto(`${WEB}${r}`, NAV);
    await delay(1300);
    await mp2.screenshot({ path: `${shots}/m-${n}.png`, fullPage: true });
  }
  await mctx.close();

  await browser.close();
  console.log("CAPTURAS OK en shots/review");
} catch (e) {
  console.log("ERROR:", e.message);
}
clearTimeout(watchdog);
cleanup();
process.exit(0);
