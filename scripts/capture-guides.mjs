import { chromium } from "playwright";
import { setTimeout as wait } from "node:timers/promises";
import path from "node:path";

const URL = "http://127.0.0.1:5188/";
const OUT = "shots";

(async () => {
	const browser = await chromium.launch();

	// ------- MOBILE -------
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
			}),
		);
	});
	const meals = await m.evaluate(async () => {
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
	await m.evaluate(
		(p) => {
			localStorage.setItem(
				"aegifitness_diet_plan_Aumento",
				JSON.stringify({
					date: new Date().toDateString(),
					meals: p.meals,
					eaten: {
						Desayuno: false,
						Almuerzo: false,
						Cena: false,
						Bebida: false,
					},
				}),
			);
		},
		{ meals },
	);
	await m.reload();
	await wait(900);

	// 1. Recipe button visual upgrade (mobile)
	await m.locator('.nav-item[aria-label="Dieta"]').click();
	await wait(500);
	await m.screenshot({
		path: path.join(OUT, "rec-btn-01-mobile.png"),
		fullPage: true,
	});

	// Open recipe dialog (Cena)
	const infoBtnsM = await m.locator(".meal-card__info").all();
	await infoBtnsM[2].click();
	await wait(700);
	await m.screenshot({
		path: path.join(OUT, "rec-btn-02-mobile-dialog.png"),
		fullPage: false,
	});

	await mctx.close();

	// ------- DESKTOP -------
	const dctx = await browser.newContext({
		viewport: { width: 1280, height: 900 },
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
			}),
		);
	});
	const mealsD = await d.evaluate(async () => {
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
	await d.evaluate(
		(p) => {
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
		{ meals: mealsD },
	);
	await d.reload();
	await wait(900);

	// 2. Recipe button on desktop
	await d.locator('.tab[aria-label="Dieta"]').click();
	await wait(500);
	await d.screenshot({
		path: path.join(OUT, "rec-btn-03-desktop-diet.png"),
		fullPage: true,
	});

	// Open recipe dialog (Almuerzo)
	const infoBtnsD = await d.locator(".meal-card__info").all();
	await infoBtnsD[1].click();
	await wait(700);
	await d.screenshot({
		path: path.join(OUT, "rec-btn-04-desktop-dialog.png"),
		fullPage: false,
	});

	// 3. Routines overview with guide buttons
	await d.keyboard.press("Escape");
	await wait(400);
	await d.locator('.tab[aria-label="Rutinas"]').click();
	await wait(500);
	await d.screenshot({
		path: path.join(OUT, "rec-btn-05-desktop-routines.png"),
		fullPage: true,
	});

	// Open guide for first exercise
	const guideBtns = await d
		.locator('.routine-preview__ex button[aria-label*="Ver guía"]')
		.all();
	if (guideBtns.length) {
		await guideBtns[0].click();
		await wait(700);
		await d.screenshot({
			path: path.join(OUT, "rec-btn-06-desktop-guide-dialog.png"),
			fullPage: false,
		});
	}

	await dctx.close();

	// ------- MOBILE: Routines with guide button -------
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
			}),
		);
	});
	await m2.reload();
	await wait(900);
	await m2.locator('.nav-item[aria-label="Rutinas"]').click();
	await wait(500);
	await m2.screenshot({
		path: path.join(OUT, "rec-btn-07-mobile-routines.png"),
		fullPage: true,
	});

	// Open guide on mobile
	const guideBtnsM = await m2
		.locator('.routine-preview__ex button[aria-label*="Ver guía"]')
		.all();
	if (guideBtnsM.length) {
		await guideBtnsM[0].click();
		await wait(700);
		await m2.screenshot({
			path: path.join(OUT, "rec-btn-08-mobile-guide.png"),
			fullPage: false,
		});
	}

	// Start routine → active workout with guide button in card
	await m2.keyboard.press("Escape");
	await wait(400);
	await m2.getByRole("button", { name: /comenzar rutina/i }).click();
	await wait(400);
	await m2.screenshot({
		path: path.join(OUT, "rec-btn-09-mobile-active-workout.png"),
		fullPage: true,
	});

	await browser.close();
	console.log("Done.");
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
