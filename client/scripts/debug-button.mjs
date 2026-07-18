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
			}),
		);
	});

	await page.reload();
	await wait(900);
	await page.locator('.nav-item[aria-label="Dieta"]').click();
	await wait(500);

	// Zoom into the recipe button
	const button = page.locator(".meal-card__info").first();
	await button.scrollIntoViewIfNeeded();
	await wait(200);

	// Get inner HTML
	const html = await button.evaluate((el) => el.outerHTML);
	console.log("Button HTML:", html);

	// Get computed styles
	const styles = await button.evaluate((el) => {
		const cs = getComputedStyle(el);
		const labelEl = el.querySelector(".meal-card__info-label");
		const labelCs = labelEl ? getComputedStyle(labelEl) : null;
		return {
			button: {
				width: cs.width,
				height: cs.height,
				display: cs.display,
				padding: cs.padding,
				color: cs.color,
			},
			label: labelCs
				? {
						display: labelCs.display,
						flex: labelCs.flex,
						width: labelCs.width,
						color: labelCs.color,
						text: labelEl?.textContent,
					}
				: null,
		};
	});
	console.log("Styles:", JSON.stringify(styles, null, 2));

	await button.screenshot({ path: "shots/debug-recipe-btn.png" });
	await browser.close();
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
