import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const [phase = "after", output = "/tmp/docs-performance-handoff/next-metadata"] =
  process.argv.slice(2);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
const origin = "http://127.0.0.1:43104";
const paths = ["/docs", "/docs/getting-started", "/docs/changelogs", "/docs/changelogs/2026-04-03"];
const results = [];
const content = (page) =>
  page.evaluate(() => ({
    title: document.title,
    text: document.querySelector("#nd-page")?.textContent,
    pageCount: document.querySelectorAll("#nd-page").length,
    headings: [...document.querySelectorAll("#nd-page h1, #nd-page h2, #nd-page h3")].map(
      (e) => e.textContent,
    ),
    schema: [...document.querySelectorAll('script[type="application/ld+json"]')].map(
      (e) => e.textContent,
    ),
  }));
try {
  for (const [screen, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["phone", { width: 390, height: 844 }],
  ]) {
    for (const javaScriptEnabled of [false, true]) {
      const context = await browser.newContext({
        viewport,
        javaScriptEnabled,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const [index, path] of paths.entries()) {
        if (!javaScriptEnabled || index === 0) {
          const response = await page.goto(origin + path, { waitUntil: "networkidle" });
          assert.equal(response.status(), 200);
        } else {
          const link = page.locator(`a[href="${path}"]:visible`).first();
          if ((await link.count()) === 0 && screen === "phone")
            await page.getByRole("button", { name: "Open Sidebar", exact: true }).click();
          await page.locator(`a[href="${path}"]:visible`).first().click();
          await page.waitForURL(origin + path);
          await page.waitForLoadState("networkidle");
          assert.equal(await page.evaluate(() => window.__metadataNavigation), "same-document");
        }
        await page
          .locator("#nd-page")
          .first()
          .waitFor({ state: javaScriptEnabled ? "visible" : "attached" });
        if (javaScriptEnabled) assert.equal(await page.locator("#nd-page").count(), 1);
        if (javaScriptEnabled && index === 0)
          await page.evaluate(() => {
            window.__metadataNavigation = "same-document";
          });
        await page.evaluate(() => document.fonts.ready);
        await page.mouse.move(0, 0);
        const key = `${screen}-${javaScriptEnabled ? "client" : "ssr"}-${index}`;
        const state = await content(page);
        writeFileSync(join(output, `${phase}-${key}.json`), JSON.stringify(state, null, 2));
        if (phase === "after")
          assert.deepEqual(
            state,
            JSON.parse(readFileSync(join(output, `before-${key}.json`), "utf8")),
            key,
          );
        await page.screenshot({
          path: join(output, `${phase}-${key}.png`),
          animations: "disabled",
        });
        results.push({ screen, javaScriptEnabled, path });
      }
      if (javaScriptEnabled) {
        await page.goBack();
        await page.waitForURL(origin + paths[2]);
        await page.goForward();
        await page.waitForURL(origin + paths[3]);
        assert.equal(await page.locator("#nd-page").count(), 1);
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(join(output, `${phase}-results.json`), JSON.stringify(results, null, 2));
console.log(`${results.length} metadata/SSR/navigation cases passed`);
