// Quick screenshot script using Playwright's Chrome driver.
import { chromium } from "playwright";
import { setTimeout as wait } from "node:timers/promises";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("shots");
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL = process.env.URL || "http://127.0.0.1:5188/";

async function ensureSaved(page, payload) {
	await page.evaluate((p) => {
		localStorage.clear();
		localStorage.setItem(
			"aegifitness_user_data",
			JSON.stringify({
				name: p.name,
				height: p.height,
				weight: p.weight,
				bodyType: p.bodyType,
			}),
		);
		const todayKey = new Date().toDateString();
		localStorage.setItem(
			`aegifitness_diet_plan_${p.objective || "Aumento"}`,
			JSON.stringify({
				date: todayKey,
				meals: p.meals,
				eaten: p.eaten || {
					Desayuno: false,
					Almuerzo: false,
					Cena: false,
					Bebida: false,
				},
			}),
		);
		const history = [];
		for (const e of p.dietHistory)
			history.push({ date: e.date, mealId: e.mealId, calories: e.calories });
		localStorage.setItem("aegifitness_diet_history", JSON.stringify(history));
		const rout = [];
		for (const e of p.routineHistory)
			rout.push({
				date: e.date,
				type: e.type,
				timeSpent: e.timeSpent,
				completionRate: e.completionRate,
				caloriesBurned: e.caloriesBurned,
			});
		localStorage.setItem("aegifitness_history", JSON.stringify(rout));
	}, payload);
}

(async () => {
	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport: { width: 412, height: 920 },
		deviceScaleFactor: 2,
		colorScheme: "dark",
	});
	const page = await context.newPage();
	await page.goto(URL);
	await wait(800);

	// 1. Settings (onboarding) — fresh localStorage
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await wait(700);
	await page.screenshot({
		path: path.join(OUT_DIR, "01-settings-onboarding.png"),
		fullPage: true,
	});

	// Seed a user
	const today = new Date();
	function isoDaysAgo(n) {
		const d = new Date(today);
		d.setDate(d.getDate() - n);
		d.setHours(12, 0, 0, 0);
		return d.toISOString();
	}

	const dietHist = [];
	const routHist = [];
	for (let d = 1; d <= 6; d++) {
		dietHist.push({
			date: isoDaysAgo(d),
			mealId: `meal_seed_${d}_1`,
			calories: 400 + d * 30,
		});
		dietHist.push({
			date: isoDaysAgo(d),
			mealId: `meal_seed_${d}_2`,
			calories: 350 + d * 25,
		});
		dietHist.push({
			date: isoDaysAgo(d),
			mealId: `meal_seed_${d}_3`,
			calories: 280 + d * 20,
		});
		routHist.push({
			date: isoDaysAgo(d),
			type: d % 2 ? "Completa" : "Mínima",
			timeSpent: d % 2 ? 42 : 14,
			completionRate: 0.85 + (d % 3) * 0.05,
			caloriesBurned: d % 2 ? 380 : 145,
		});
	}

	// Inject dummy seed meals (random selection from real data). We grab them here:
	const meals0 = await page.evaluate(async () => {
		const r = await fetch("/src/data/meals.json");
		const data = await r.json();
		const pick = (type, objective) =>
			data.filter(
				(m) =>
					m.type === type &&
					(m.objective === objective || m.objective === "Ambos"),
			)[0];
		return {
			Desayuno: pick("Desayuno", "Aumento"),
			Almuerzo: pick("Almuerzo", "Aumento"),
			Cena: pick("Cena", "Aumento"),
			Bebida: pick("Bebida", "Aumento"),
		};
	});

	await ensureSaved(page, {
		name: "Kevin",
		height: "175",
		weight: "72",
		bodyType: "mesomorfo",
		objective: "Aumento",
		meals: meals0,
		eaten: { Desayuno: true, Almuerzo: false, Cena: false, Bebida: true },
		dietHistory: dietHist,
		routineHistory: routHist,
	});
	await page.reload();
	await wait(900);

	// 2. Dashboard
	await page.screenshot({
		path: path.join(OUT_DIR, "02-dashboard.png"),
		fullPage: true,
	});

	// 3. Routines overview
	await page.locator('.nav-pill[aria-label="Rutinas"]').click();
	await wait(500);
	await page.screenshot({
		path: path.join(OUT_DIR, "03-routines-overview.png"),
		fullPage: true,
	});

	// 4. Routines active
	await page.getByRole("button", { name: /comenzar rutina/i }).click();
	await wait(400);
	// Click + twice on the first sets + button
	const plusButtons = await page
		.locator('button[aria-label="Sumar serie"]')
		.all();
	for (let i = 0; i < Math.min(plusButtons.length, 2); i++) {
		await plusButtons[i].click();
		await wait(120);
	}
	await page.screenshot({
		path: path.join(OUT_DIR, "04-routines-active.png"),
		fullPage: true,
	});

	// 5. Diet
	await page.goto(URL);
	await wait(600);
	await page.locator('.nav-pill[aria-label="Dieta"]').click();
	await wait(500);
	await page.screenshot({
		path: path.join(OUT_DIR, "05-diet.png"),
		fullPage: true,
	});

	// 6. Settings profile
	await page.locator('.nav-pill[aria-label="Perfil"]').click();
	await wait(500);
	await page.screenshot({
		path: path.join(OUT_DIR, "06-settings-profile.png"),
		fullPage: true,
	});

	// 7. Swap view inside Routines
	await page.locator('.nav-pill[aria-label="Rutinas"]').click();
	await wait(400);
	const swapButtons = await page
		.locator('button[aria-label="Cambiar ejercicio"]')
		.all();
	if (swapButtons.length) {
		await swapButtons[0].click();
		await wait(400);
		await page.screenshot({
			path: path.join(OUT_DIR, "07-routines-swap.png"),
			fullPage: true,
		});
	}

	// 8. Tablet/desktop dashboard
	await context.close();
	const desktop = await browser.newContext({
		viewport: { width: 1280, height: 880 },
		deviceScaleFactor: 1,
		colorScheme: "dark",
	});
	const dpage = await desktop.newPage();
	await dpage.goto(URL);
	const mealsD = await dpage.evaluate(async () => {
		const r = await fetch("/src/data/meals.json");
		const data = await r.json();
		const pick = (type, objective) =>
			data.filter(
				(m) =>
					m.type === type &&
					(m.objective === objective || m.objective === "Ambos"),
			)[0];
		return {
			Desayuno: pick("Desayuno", "Aumento"),
			Almuerzo: pick("Almuerzo", "Aumento"),
			Cena: pick("Cena", "Aumento"),
			Bebida: pick("Bebida", "Aumento"),
		};
	});
	await ensureSaved(dpage, {
		name: "Kevin",
		height: "175",
		weight: "72",
		bodyType: "mesomorfo",
		objective: "Aumento",
		meals: mealsD,
		eaten: { Desayuno: true, Almuerzo: true, Cena: false, Bebida: false },
		dietHistory: dietHist,
		routineHistory: routHist,
	});
	await dpage.reload();
	await wait(900);
	await dpage.screenshot({
		path: path.join(OUT_DIR, "08-desktop-dashboard.png"),
		fullPage: true,
	});

	await dpage.locator('.nav-pill[aria-label="Rutinas"]').click();
	await wait(500);
	await dpage.screenshot({
		path: path.join(OUT_DIR, "09-desktop-routines.png"),
		fullPage: true,
	});

	await browser.close();
	console.log("Done. Saved screenshots to", OUT_DIR);
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
