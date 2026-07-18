// Captures both viewports to verify the new navigation:
import { chromium } from "playwright";
import { setTimeout as wait } from "node:timers/promises";
import path from "node:path";

const URL = "http://127.0.0.1:5188/";
const OUT = "shots";

async function seed(page) {
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
	});
}

(async () => {
	const browser = await chromium.launch();

	// ----- MOBILE -----
	const mctx = await browser.newContext({
		viewport: { width: 412, height: 920 },
		deviceScaleFactor: 2,
		colorScheme: "dark",
	});
	const m = await mctx.newPage();
	await m.goto(URL);
	await wait(700);
	await m.evaluate(() => localStorage.clear());
	await m.reload();
	await wait(600);
	await seed(m);
	await m.reload();
	await wait(700);
	// Dashboard
	await m.screenshot({
		path: path.join(OUT, "nav-01-mobile-dashboard.png"),
		fullPage: false,
	});
	// Header close-up
	await m.screenshot({
		path: path.join(OUT, "nav-02-mobile-header-closeup.png"),
		clip: { x: 0, y: 0, width: 412, height: 110 },
	});
	// Bottom-nav close-up
	await m.screenshot({
		path: path.join(OUT, "nav-03-mobile-bottomnav-closeup.png"),
		clip: { x: 0, y: 820, width: 412, height: 100 },
	});
	// Switch to Diet via bottom-nav
	await m.locator('.nav-item[aria-label="Dieta"]').click();
	await wait(400);
	await m.screenshot({
		path: path.join(OUT, "nav-04-mobile-diet.png"),
		fullPage: false,
	});
	await mctx.close();

	// ----- DESKTOP -----
	const dctx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		deviceScaleFactor: 1,
		colorScheme: "dark",
	});
	const d = await dctx.newPage();
	await d.goto(URL);
	await wait(700);
	await d.evaluate(() => localStorage.clear());
	await d.reload();
	await wait(600);
	await seed(d);
	await d.reload();
	await wait(800);
	await d.screenshot({
		path: path.join(OUT, "nav-05-desktop-dashboard.png"),
		fullPage: false,
	});
	// Close-up of header with top tabbar
	await d.screenshot({
		path: path.join(OUT, "nav-06-desktop-header-closeup.png"),
		clip: { x: 0, y: 0, width: 1280, height: 100 },
	});
	// Switch tab to Routines via top tabbar
	await d.locator('.tab[aria-label="Rutinas"]').click();
	await wait(400);
	await d.screenshot({
		path: path.join(OUT, "nav-07-desktop-routines.png"),
		fullPage: false,
	});
	// Click Diet in the top tabbar
	await d.locator('.tab[aria-label="Dieta"]').click();
	await wait(400);
	await d.screenshot({
		path: path.join(OUT, "nav-08-desktop-diet.png"),
		fullPage: false,
	});

	await browser.close();
	console.log("Done.");
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
