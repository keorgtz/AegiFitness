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

	// Capture console errors
	const errors = [];
	page.on("pageerror", (e) => errors.push(`PAGE ERROR: ${e.message}`));
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(`CONSOLE ERR: ${msg.text()}`);
	});

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
				trainingSplit: { Lunes: ["Pecho"] },
			}),
		);
	});
	await page.reload();
	await wait(900);

	// Click perfil
	await page.locator('.nav-item[aria-label="Perfil"]').click();
	await wait(800);

	const state = await page.evaluate(() => {
		return {
			url: window.location.href,
			bodyHtml: document.body.innerHTML.slice(0, 800),
			// Find anything matching training-split
			hasTrainingSplit: document.body.innerHTML.includes("training-split"),
			hasObjetivo: document.body.innerHTML.includes("Objetivo actual"),
			hasProfileCard: document.body.innerHTML.includes("profile-card"),
			hasNavItemActive: Array.from(document.querySelectorAll(".nav-item")).map(
				(n) => ({
					label: n.getAttribute("aria-label"),
					active: n.classList.contains("nav-item--active"),
				}),
			),
		};
	});
	console.log("State after click:", JSON.stringify(state, null, 2));
	console.log("Errors:", errors);

	await browser.close();
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
