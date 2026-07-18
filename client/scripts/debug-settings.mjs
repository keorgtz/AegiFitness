import { chromium } from "playwright";
import { setTimeout as wait } from "node:timers/promises";

(async () => {
	const browser = await chromium.launch();
	const ctx = await browser.newContext({
		viewport: { width: 412, height: 920 },
		deviceScaleFactor: 2,
		colorScheme: "dark",
	});
	const page = await ctx.newPage();
	await page.goto("http://127.0.0.1:5188/");
	await wait(700);
	await page.evaluate(() => {
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
	await page.reload();
	await wait(900);

	// Navigate to Perfil via direct state set (force)
	await page.evaluate(() => {
		// Try changing via the nav-item
	});
	await page.locator('.nav-item[aria-label="Perfil"]').click();
	await wait(700);

	// Verify we're on settings
	const isSettings = await page.evaluate(() => {
		return {
			h1Text: document.querySelector(".hero__title")?.textContent,
			hasObjectiveSection: !!document.querySelector(".training-split"),
			panelClass: document.querySelector(".panel")?.className,
		};
	});
	console.log("Page state:", JSON.stringify(isSettings, null, 2));

	await page.screenshot({
		path: "shots/rot-debug-settings.png",
		fullPage: true,
	});

	await browser.close();
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
