import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";

const [base, provider, countText, destination] = process.argv.slice(2);
const count = Number(countText);
const start = performance.now();
const response = await fetch(base + "/docs");
assert.equal(response.status, 200);
const html = await response.text();
const firstPageMs = performance.now() - start;
assert.ok(html.includes("Benchmark page 0000"));
assert.ok(html.includes("Section 6"));
assert.ok(html.includes("shiki"));
assert.ok(html.includes(`Benchmark page ${String(count - 1).padStart(4, "0")}`));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const scripts = new Map();
page.on("response", async (response) => {
  if (response.request().resourceType() === "script" && response.url().startsWith(base)) {
    try {
      scripts.set(response.url(), await response.body());
    } catch {}
  }
});
let result;
try {
  await page.goto(base + "/docs", { waitUntil: "networkidle" });
  await page.locator("pre").first().waitFor();
  const initialJsGzipBytes = [...scripts.values()].reduce((sum, b) => sum + gzipSync(b).length, 0);
  assert.equal(await page.locator("pre").count(), 6);
  assert.equal(await page.locator("table").count(), 6);
  const body = await page.locator("body").innerText();
  assert.ok(body.includes("Section 6"));
  const initial = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  assert.ok(initial.width <= initial.viewport + 1, "Desktop overflow");
  // Read every route and reject missing or incomplete pages.
  for (let i = 1; i < count; i++) {
    const name = `page-${String(i).padStart(4, "0")}`;
    const r = await fetch(base + "/docs/" + name);
    assert.equal(r.status, 200, name);
    const source = await r.text();
    assert.ok(source.includes(`Benchmark page ${String(i).padStart(4, "0")}`), name);
    assert.ok(source.includes("Section 6"), name);
    assert.ok(source.includes(`configure topic ${i} safely`), `${name}: wrong article body`);
  }
  if (count > 1) {
    await page.evaluate(() => (window.__benchmarkNavigationSentinel = true));
    await page.locator('a[href="/docs/page-0001"]').first().click();
    await page.waitForURL("**/docs/page-0001");
    await page
      .getByRole("heading", { name: /Benchmark page 0001/ })
      .first()
      .waitFor();
    assert.ok(
      await page.evaluate(() => window.__benchmarkNavigationSentinel),
      "Navigation performed full document reload",
    );
  }
  await page.getByRole("button", { name: "Copy Text", exact: true }).first().click();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /loadTopic/);
  const searchUrl = provider === "fumadocs" ? "/api/search?query=topic" : "/api/docs?query=topic";
  const search = await fetch(base + searchUrl);
  assert.equal(search.status, 200, "Search endpoint");
  const searchData = await search.json();
  assert.ok(JSON.stringify(searchData).includes("page-"), "Search results missing");
  await page.locator("[data-search-full]").click();
  const dialog = page.getByRole("dialog");
  const last = String(count - 1).padStart(4, "0");
  await dialog.locator("input").fill(last);
  await dialog
    .getByRole("option")
    .filter({ hasText: `Benchmark page ${last}` })
    .first()
    .click();
  await page
    .getByRole("heading", { name: new RegExp(`^Benchmark page ${last}`) })
    .first()
    .waitFor();
  await dialog.waitFor({ state: "hidden" });
  await page.screenshot({
    path: destination.replace(".json", "-desktop.png"),
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/docs", { waitUntil: "networkidle" });
  const mobile = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  assert.ok(mobile.width <= mobile.viewport + 1, "Mobile overflow");
  await page.getByRole("button", { name: "Open Sidebar", exact: true }).click();
  await page.locator('a[href="/docs/page-0001"]:visible').first().click();
  await page
    .getByRole("heading", { name: /^Benchmark page 0001/ })
    .first()
    .waitFor();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.screenshot({
    path: destination.replace(".json", "-mobile.png"),
    animations: "disabled",
  });
  assert.deepEqual(errors, [], "Browser exceptions");
  result = {
    firstPageMs,
    htmlBytes: Buffer.byteLength(html),
    htmlGzipBytes: gzipSync(html).length,
    initialJsGzipBytes,
    verifiedPages: count,
    highlightedCodeBlocks: 6,
    tables: 6,
    clientNavigation: true,
    clipboard: true,
    search: true,
    searchNavigation: true,
    mobileSidebar: true,
    mobileNoOverflow: true,
    browserErrors: errors,
    editVisible: html.includes("BENCHMARK_EDIT_MARKER"),
  };
} finally {
  await browser.close();
}
writeFileSync(destination, JSON.stringify(result, null, 2) + "\n");
