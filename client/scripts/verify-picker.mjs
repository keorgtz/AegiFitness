import { chromium } from "playwright";
import { setTimeout as wait } from "node:timers/promises";

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
	// Pre-seed user with Aumento + no split (full body, easier to test)
	await page.evaluate(() => {
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
	await page.reload();
	await wait(900);

	await page.locator('.nav-item[aria-label="Rutinas"]').click();
	await wait(700);

	const cases = [];

	// Test 1: Ambos (default) — full body Aumento
	let count = await page.locator(".routine-preview__ex").count();
	let types = await page
		.locator(".routine-preview__ex-tags .chip__tag")
		.allTextContents();
	let totalExInList = types.length / 2; // each ex has 2 tags
	cases.push({ test: "Ambos (default)", expected: 5, actual: count });

	// Test 2: Gimnasio only — pick Gimnasio from select
	await page.selectOption("select.input", "Gimnasio");
	await wait(300);
	count = await page.locator(".routine-preview__ex").count();
	cases.push({ test: "Gimnasio only", expected: 5, actual: count });

	// Test 3: Calistenia only
	await page.selectOption("select.input", "Calistenia");
	await wait(300);
	count = await page.locator(".routine-preview__ex").count();
	cases.push({ test: "Calistenia only", expected: 5, actual: count });

	// Test 4: Pecho (single muscle) — click Pecho chip
	await page.selectOption("select.input", "Ambos");
	await wait(300);
	await page.locator('.chip:has-text("Pecho")').first().click();
	await wait(300);
	count = await page.locator(".routine-preview__ex").count();
	cases.push({ test: "Single muscle (Pecho)", expected: 5, actual: count });

	// Test 5: Pecho + Gimnasio (single muscle + single type)
	await page.selectOption("select.input", "Gimnasio");
	await wait(300);
	count = await page.locator(".routine-preview__ex").count();
	cases.push({ test: "Pecho + Gym only", expected: 5, actual: count });

	// Test 6: Pecho + Calistenia (most restrictive combo)
	await page.selectOption("select.input", "Calistenia");
	await wait(300);
	count = await page.locator(".routine-preview__ex").count();
	cases.push({ test: "Pecho + Calistenia only", expected: 5, actual: count });

	// Verify the actual mix
	const mix = await page.evaluate(() => {
		const items = document.querySelectorAll(".routine-preview__ex");
		return Array.from(items).map((item) => {
			const tags = Array.from(item.querySelectorAll(".chip__tag")).map(
				(t) => t.textContent,
			);
			return { muscle: tags[0], type: tags[1] };
		});
	});
	console.log(
		"Last selection (Pecho + Calistenia):",
		JSON.stringify(mix, null, 2),
	);

	console.log("\n=== Test Results ===");
	let allPass = true;
	for (const c of cases) {
		const pass = c.actual >= c.expected;
		if (!pass) allPass = false;
		const status = pass ? "✓ PASS" : "✗ FAIL";
		console.log(
			`${status} | ${c.test.padEnd(30)} | expected ≥ ${c.expected} | got ${c.actual}`,
		);
	}
	console.log(allPass ? "\nAll tests passed!" : "\nSome tests failed.");

	await browser.close();
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
