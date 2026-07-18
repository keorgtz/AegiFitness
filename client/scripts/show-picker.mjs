import { chromium } from "playwright";
import { setTimeout as wait } from "node:timers/promises";
import path from "node:path";

const URL = "http://127.0.0.1:5188/";

(async () => {
	const browser = await chromium.launch();

	// ---------- MOBILE ----------
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
				trainingSplit: {},
			}),
		);
	});
	await m.reload();
	await wait(900);
	await m.locator('.nav-item[aria-label="Rutinas"]').click();
	await wait(700);
	// Set Calistenia only
	await m.selectOption("select.input", "Calistenia");
	await wait(400);
	// Pick single muscle (Pecho)
	await m.locator('.chip:has-text("Pecho")').first().click();
	await wait(400);
	await m.screenshot({ path: "shots/picker-01-mobile.png", fullPage: true });

	// Now switch to Gimnasio only
	await m.selectOption("select.input", "Gimnasio");
	await wait(400);
	await m.screenshot({ path: "shots/picker-02-mobile.png", fullPage: true });

	await mctx.close();

	// ---------- DESKTOP ----------
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
				currentObjective: "Aumento",
				trainingSplit: {},
			}),
		);
	});
	await d.reload();
	await wait(900);
	await d.locator('.tab[aria-label="Rutinas"]').click();
	await wait(700);
	// Select Pecho only
	await d.locator('.chip:has-text("Pecho")').first().click();
	await wait(300);
	// Switch to Calistenia
	await d.selectOption("select.input", "Calistenia");
	await wait(400);
	await d.screenshot({ path: "shots/picker-03-desktop.png", fullPage: true });

	await browser.close();
	console.log("Done.");
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
