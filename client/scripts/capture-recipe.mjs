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

	// Seed diet plan with 4 real meals
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

	// Diet panel
	await m.locator('.nav-item[aria-label="Dieta"]').click();
	await wait(500);
	await m.screenshot({
		path: path.join(OUT, "rec-01-mobile-diet-with-info.png"),
		fullPage: true,
	});

	// Open the recipe dialog for "Almuerzo" (Pechuga de Pollo con Arroz) — second card
	const infoBtns = await m.locator(".meal-card__info").all();
	await infoBtns[1].click();
	await wait(700);
	await m.screenshot({
		path: path.join(OUT, "rec-02-mobile-dialog.png"),
		fullPage: false,
	});

	// Close with Esc
	await m.keyboard.press("Escape");
	await wait(400);
	await m.screenshot({
		path: path.join(OUT, "rec-03-mobile-after-close.png"),
		fullPage: false,
	});

	// Scroll the dialog (if content is long)
	await infoBtns[2].click();
	await wait(700);
	// Scroll inside the dialog
	await m.evaluate(() => {
		const dlg = document.querySelector(".dialog");
		if (dlg) dlg.scrollTop = 250;
	});
	await wait(400);
	await m.screenshot({
		path: path.join(OUT, "rec-04-mobile-dialog-scrolled.png"),
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
	await d.locator('.tab[aria-label="Dieta"]').click();
	await wait(500);
	await d.screenshot({
		path: path.join(OUT, "rec-05-desktop-diet.png"),
		fullPage: true,
	});

	// Open dialog
	const infoBtnsD = await d.locator(".meal-card__info").all();
	await infoBtnsD[0].click();
	await wait(700);
	await d.screenshot({
		path: path.join(OUT, "rec-06-desktop-dialog.png"),
		fullPage: false,
	});

	await browser.close();
	console.log("Done.");
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
