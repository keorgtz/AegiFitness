import { chromium } from "playwright";
import { setTimeout as wait } from "node:timers/promises";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("shots");
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL = "http://127.0.0.1:5188/";

(async () => {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({
		viewport: { width: 412, height: 920 },
		deviceScaleFactor: 2,
		colorScheme: "dark",
	});
	const page = await ctx.newPage();
	await page.goto(URL);
	await wait(800);

	// Empty DB
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await wait(700);

	// Seed
	const meals = await page.evaluate(async () => {
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

	await page.evaluate(
		(p) => {
			localStorage.setItem(
				"aegifitness_user_data",
				JSON.stringify({
					name: "Kevin",
					height: "175",
					weight: "72",
					bodyType: "mesomorfo",
				}),
			);
			localStorage.setItem(
				"aegifitness_diet_plan_Aumento",
				JSON.stringify({
					date: new Date().toDateString(),
					meals: p.meals,
					eaten: {
						Desayuno: true,
						Almuerzo: false,
						Cena: false,
						Bebida: false,
					},
				}),
			);
		},
		{ meals },
	);

	await page.reload();
	await wait(900);

	// 1. Diet swap modal
	await page.locator('.nav-pill[aria-label="Dieta"]').click();
	await wait(500);
	// Click the second "Cambiar" button
	const cambiaBtns = await page.locator('button:has-text("Cambiar")').all();
	if (cambiaBtns.length > 1) {
		await cambiaBtns[1].click();
		await wait(400);
	}
	await page.screenshot({
		path: path.join(OUT_DIR, "10-diet-swap.png"),
		fullPage: true,
	});

	// 2. Diet full day with all eaten
	await page.goBack();
	await page.goto(URL);
	await wait(700);
	await page.evaluate(() => {
		const planKey = "aegifitness_diet_plan_Aumento";
		let plan = {};
		try {
			plan = JSON.parse(localStorage.getItem(planKey) || "{}");
		} catch {
			plan = {};
		}
		if (plan.meals) {
			plan.eaten = { Desayuno: true, Almuerzo: true, Cena: true, Bebida: true };
			localStorage.setItem(planKey, JSON.stringify(plan));
		}
	});
	await page.reload();
	await wait(900);
	await page.locator('.nav-pill[aria-label="Dieta"]').click();
	await wait(500);
	await page.screenshot({
		path: path.join(OUT_DIR, "11-diet-all-eaten.png"),
		fullPage: true,
	});

	// 3. Completed routine
	await page.evaluate(() => {
		const today = new Date().toISOString();
		localStorage.setItem(
			"aegifitness_history",
			JSON.stringify([
				{
					date: today,
					type: "Completa",
					timeSpent: 42,
					completionRate: 1,
					caloriesBurned: 380,
					objective: "Aumento",
				},
			]),
		);
		const planKey = "aegifitness_diet_plan_Aumento";
		let plan = {};
		try {
			plan = JSON.parse(localStorage.getItem(planKey) || "{}");
		} catch {
			plan = {};
		}
		if (plan.meals) {
			plan.eaten = {
				Desayuno: false,
				Almuerzo: false,
				Cena: false,
				Bebida: false,
			};
			localStorage.setItem(planKey, JSON.stringify(plan));
		}
	});
	await page.reload();
	await wait(900);
	await page.locator('.nav-pill[aria-label="Rutinas"]').click();
	await wait(500);
	await page.getByRole("button", { name: /comenzar rutina/i }).click();
	await wait(400);
	// Mark all exercises complete
	const completes = await page
		.locator('button:has-text("Completar ejercicio")')
		.all();
	for (const b of completes) await b.click();
	await wait(400);
	await page.getByRole("button", { name: /finalizar rutina/i }).click();
	await wait(800);
	await page.screenshot({
		path: path.join(OUT_DIR, "12-routine-completed.png"),
		fullPage: true,
	});

	await browser.close();
	console.log("Done.");
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
