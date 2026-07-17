import { chromium } from "playwright";
import { setTimeout as wait } from "node:timers/promises";
import path from "node:path";

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
	await wait(700);

	// Seed user + previously completed routine
	await page.evaluate(() => {
		localStorage.setItem(
			"aegifitness_user_data",
			JSON.stringify({
				name: "Kevin",
				height: "175",
				weight: "72",
				bodyType: "mesomorfo",
			}),
		);
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
	});
	await page.reload();
	await wait(900);
	await page.locator('.nav-pill[aria-label="Rutinas"]').click();
	await wait(400);
	await page.getByRole("button", { name: /comenzar rutina/i }).click();
	await wait(400);

	// Use the sets + buttons to advance progress
	const plusButtons = await page
		.locator('button[aria-label="Sumar serie"]')
		.all();
	for (const b of plusButtons) {
		await b.click().catch(() => {});
		await wait(80);
	}
	// Complete all exercises
	const completeBtns = await page
		.locator('button:has-text("Completar ejercicio")')
		.all();
	for (const b of completeBtns) {
		await b.click().catch(() => {});
		await wait(80);
	}
	await wait(300);
	// Finalize
	await page.getByRole("button", { name: /finalizar rutina/i }).click();
	await wait(900);
	await page.screenshot({
		path: "shots/12-routine-completed.png",
		fullPage: true,
	});

	await browser.close();
	console.log("Done.");
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
