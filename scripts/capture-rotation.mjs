import { chromium } from "playwright";
import { setTimeout as wait } from "node:timers/promises";
import path from "node:path";

const URL = "http://127.0.0.1:5188/";
const OUT = "shots";

(async () => {
	const browser = await chromium.launch();

	// ------- MOBILE - Settings page with new fields -------
	const mctx = await browser.newContext({
		viewport: { width: 412, height: 920 },
		deviceScaleFactor: 2,
		colorScheme: "dark",
	});
	const m = await mctx.newPage();
	await m.goto(URL);
	await wait(700);
	await m.evaluate(() => {
		localStorage.setItem(
			"aegifitness_user_data",
			JSON.stringify({
				name: "Kevin",
				height: "175",
				weight: "72",
				bodyType: "mesomorfo",
				currentObjective: "Aumento",
				trainingSplit: {
					Lunes: ["Pecho"],
					Martes: ["Espalda", "Bíceps"],
					Miércoles: [],
					Jueves: ["Piernas"],
					Viernes: ["Hombros"],
					Sábado: [],
					Domingo: [],
				},
			}),
		);
	});
	await m.reload();
	await wait(900);
	await m.locator('.nav-item[aria-label="Perfil"]').click();
	await wait(500);
	await m.screenshot({
		path: path.join(OUT, "rot-01-mobile-settings.png"),
		fullPage: true,
	});

	// Toggle objective to Déficit
	await m.locator('.seg__btn:has-text("Déficit")').first().click();
	await wait(400);
	await m.evaluate(() => {
		window.scrollTo(0, 200);
	});
	await wait(300);
	await m.screenshot({
		path: path.join(OUT, "rot-02-mobile-settings-objetivo.png"),
		fullPage: false,
	});

	await mctx.close();

	// ------- DESKTOP - Settings -------
	const dctx = await browser.newContext({
		viewport: { width: 1280, height: 1100 },
		deviceScaleFactor: 1,
		colorScheme: "dark",
	});
	const d = await dctx.newPage();
	await d.goto(URL);
	await wait(700);
	await d.evaluate(() => {
		localStorage.setItem(
			"aegifitness_user_data",
			JSON.stringify({
				name: "Kevin",
				height: "175",
				weight: "72",
				bodyType: "mesomorfo",
				currentObjective: "Aumento",
				trainingSplit: {
					Lunes: ["Pecho"],
					Martes: ["Espalda", "Bíceps"],
					Miércoles: [],
					Jueves: ["Piernas"],
					Viernes: ["Hombros", "Abdomen"],
					Sábado: [],
					Domingo: [],
				},
			}),
		);
	});
	await d.reload();
	await wait(900);
	await d.locator('.tab[aria-label="Perfil"]').click();
	await wait(500);
	await d.screenshot({
		path: path.join(OUT, "rot-03-desktop-settings.png"),
		fullPage: true,
	});

	await dctx.close();

	// ------- Test diet rotation: seed recently eaten ----------
	// Scenario 1: After eating "meal_1" (Huevos Revueltos), verify next day's
	// Desayuno is different.
	const m2ctx = await browser.newContext({
		viewport: { width: 412, height: 920 },
		deviceScaleFactor: 2,
		colorScheme: "dark",
	});
	const m2 = await m2ctx.newPage();
	await m2.goto(URL);
	await wait(700);
	await m2.evaluate(() => {
		localStorage.setItem(
			"aegifitness_user_data",
			JSON.stringify({
				name: "Kevin",
				height: "175",
				weight: "72",
				bodyType: "mesomorfo",
				currentObjective: "Aumento",
				trainingSplit: {},
			}),
		);
		// Seed diet history with 6 eaten meals from yesterday
		const y = new Date();
		y.setDate(y.getDate() - 1);
		const yesterday = y.toISOString();
		const history = [
			{ date: yesterday, mealId: "meal_1", calories: 586 },
			{ date: yesterday, mealId: "meal_5", calories: 528 },
			{ date: yesterday, mealId: "meal_10", calories: 627 },
			{ date: yesterday, mealId: "meal_7", calories: 580 },
			{ date: yesterday, mealId: "meal_20", calories: 460 },
			{ date: yesterday, mealId: "meal_14", calories: 380 },
		];
		localStorage.setItem("aegifitness_diet_history", JSON.stringify(history));
		// Don't seed today plan — let it regenerate via rotation
		localStorage.removeItem("aegifitness_diet_plan_Aumento");
	});
	await m2.reload();
	await wait(900);
	await m2.locator('.nav-item[aria-label="Dieta"]').click();
	await wait(700);
	await m2.screenshot({
		path: path.join(OUT, "rot-04-mobile-diet-rotation.png"),
		fullPage: true,
	});

	// Extract meal names shown
	const mealNames = await m2.evaluate(() => {
		const cards = document.querySelectorAll(".meal-card__name");
		return Array.from(cards).map((c) => c.textContent);
	});
	console.log("Diet plan (after rotation):", mealNames);

	await m2ctx.close();

	// ------- Test routine rotation: seed recent exercises ----------
	const m3ctx = await browser.newContext({
		viewport: { width: 412, height: 920 },
		deviceScaleFactor: 2,
		colorScheme: "dark",
	});
	const m3 = await m3ctx.newPage();
	await m3.goto(URL);
	await wait(700);
	await m3.evaluate(() => {
		localStorage.setItem(
			"aegifitness_user_data",
			JSON.stringify({
				name: "Kevin",
				height: "175",
				weight: "72",
				bodyType: "mesomorfo",
				currentObjective: "Aumento",
				trainingSplit: {
					Lunes: ["Pecho"],
					Martes: ["Espalda", "Bíceps"],
					Miércoles: [],
					Jueves: ["Piernas"],
					Viernes: ["Hombros"],
					Sábado: [],
					Domingo: [],
				},
			}),
		);
		// Seed recent exercises: 4 chest exercises from yesterday so rotation should skip them
		const y = new Date();
		y.setDate(y.getDate() - 1);
		const yesterday = y.toISOString();
		const recent = [
			{ date: yesterday, exerciseId: "ex_1" },
			{ date: yesterday, exerciseId: "ex_3" },
			{ date: yesterday, exerciseId: "ex_5" },
			{ date: yesterday, exerciseId: "ex_7" },
			{ date: yesterday, exerciseId: "ex_9" },
		];
		localStorage.setItem(
			"aegifitness_exercise_history",
			JSON.stringify(recent),
		);
	});
	await m3.reload();
	await wait(900);
	await m3.locator('.nav-item[aria-label="Rutinas"]').click();
	await wait(700);
	await m3.screenshot({
		path: path.join(OUT, "rot-05-mobile-routine-rotation.png"),
		fullPage: true,
	});

	// Pull the muscle groups & exercise names shown to verify rotation worked
	const exNames = await m3.evaluate(() => {
		const items = document.querySelectorAll(".routine-preview__ex");
		return Array.from(items).map((item) => {
			const name = item.querySelector(".routine-preview__ex-name")?.textContent;
			const tags = Array.from(item.querySelectorAll(".chip__tag")).map(
				(t) => t.textContent,
			);
			return { name, tags };
		});
	});
	console.log("Routine (after rotation):", JSON.stringify(exNames, null, 2));

	await browser.close();
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
