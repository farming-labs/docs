/** Production docs checks. Every failure is retained; this is not a live-service test. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createWriteStream, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
const root = dirname(fileURLToPath(import.meta.url));
const provider = process.argv[2];
assert(["fumadocs", "farming"].includes(provider), "Choose fumadocs or farming");
const id = process.env.VERIFY_RUN_ID ?? "verification";
const out = resolve(root, "artifacts", id);
mkdirSync(out, { recursive: true });
const receipt = resolve(out, provider + ".json");
assert(!existsSync(receipt), "Use a new VERIFY_RUN_ID");
const app = resolve(
  root,
  "artifacts/snapshot/apps",
  provider === "farming" ? "docs-farming" : "docs",
);
assert(existsSync(resolve(app, ".next/BUILD_ID")), "Production build required");
const port = 43797;
const origin = `http://127.0.0.1:${port}`;
try {
  await fetch(origin);
  throw new Error("Port is occupied");
} catch (e) {
  if (e.message === "Port is occupied") throw e;
}
const log = createWriteStream(resolve(out, provider + "-server.log"));
const server = spawn(
  process.execPath,
  [
    resolve(app, "node_modules/next/dist/bin/next"),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: app,
    env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
server.stdout.pipe(log, { end: false });
server.stderr.pipe(log, { end: false });
const result = {
  provider,
  checks: [],
  failures: [],
  pageErrors: [],
  failedRequests: [],
  httpErrors: [],
  pages: [],
};
let browser, context, page;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function check(name, run) {
  try {
    await run();
    result.checks.push(name);
  } catch (e) {
    result.failures.push({
      name,
      error: e.message,
      url: page?.url(),
      platform: page
        ? await page
            .locator("[data-docs-platform]")
            .evaluateAll((els) => els.map((el) => el.getAttribute("data-docs-platform")))
        : undefined,
    });
    if (page)
      await page
        .screenshot({
          path: resolve(
            out,
            provider + "-failure-" + name.replaceAll(/[^a-z0-9]+/gi, "-") + ".png",
          ),
        })
        .catch(() => {});
  }
}
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    assert(server.exitCode === null, "Server exited");
    try {
      if ((await fetch(origin + "/docs")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await pause(500);
  }
  assert(ready, "Server did not become ready");
  const manifest = JSON.parse(readFileSync(resolve(app, ".next/prerender-manifest.json"), "utf8"));
  result.docsRoutes = Object.keys(manifest.routes)
    .filter((p) => p === "/docs" || p.startsWith("/docs/"))
    .sort();
  await check("337 prerendered docs pages", async () =>
    assert.equal(result.docsRoutes.length, 337),
  );
  await check("search API contains 502 pages", async () => {
    const r = await fetch(origin + "/api/search");
    assert(r.ok);
    const data = await r.json();
    result.searchRecords = data.length;
    writeFileSync(resolve(out, provider + "-search.json"), JSON.stringify(data, null, 2));
    assert.equal(data.length, 502);
  });
  await check("Markdown page endpoint", async () => {
    const r = await fetch(origin + "/docs/installation.md");
    assert(r.ok, `HTTP ${r.status}`);
    const text = await r.text();
    assert(text.includes("Installation"));
    assert(!text.startsWith("<!DOCTYPE"));
    result.markdownBytes = Buffer.byteLength(text);
    writeFileSync(resolve(out, provider + "-installation.md"), text);
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  result.browser = browser.version();
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  context.setDefaultTimeout(15000);
  page = await context.newPage();
  page.on("pageerror", (e) => result.pageErrors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) result.httpErrors.push({ url: r.url(), status: r.status() });
  });
  page.on("requestfailed", (r) =>
    result.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }),
  );
  const initialHtml = await (await fetch(origin + "/docs")).text();
  const initialJs = new Set(
    [...initialHtml.matchAll(/<script[^>]+src="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((u) => u.startsWith("/_next/"))
      .map((u) => origin + u),
  );
  for (const path of [
    "/docs",
    "/docs/installation",
    "/docs/integrations",
    "/docs/primitives/thread",
    "/docs/api-reference/primitives/thread",
  ]) {
    await check("render " + path, async () => {
      const r = await page.goto(origin + path, { waitUntil: "load", timeout: 60000 });
      assert.equal(r.status(), 200);
      await page.locator("h1").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const info = await page
        .locator("[data-page-content]")
        .evaluate((el) => ({
          title: el.querySelector("h1")?.textContent,
          text: el.textContent,
          headings: [...el.querySelectorAll("h2,h3")].map((e) => ({
            id: e.id,
            text: e.textContent,
          })),
          codeBlocks: el.querySelectorAll("pre").length,
          images: [...el.querySelectorAll("img")].map((e) => ({
            src: e.getAttribute("src"),
            loaded: e.complete && e.naturalWidth > 0,
          })),
        }));
      assert(info.text.length > 100);
      result.pages.push({ path, ...info });
      if (path === "/docs") {
        await pause(300);
        result.initialJsFiles = [...initialJs];
        const sizes = await Promise.all(
          [...initialJs].map(
            async (u) => gzipSync(Buffer.from(await (await fetch(u)).arrayBuffer())).length,
          ),
        );
        result.initialJsGzipBytes = sizes.reduce((a, b) => a + b, 0);
      }
      if (path === "/docs/integrations") {
        assert(
          (await page.locator("[data-page-content] figure svg").count()) > 0,
          "Mermaid SVG missing",
        );
        assert(!info.text.includes("diagram could not be rendered"));
      }
      if (path === "/docs/primitives/thread")
        assert(
          (await page.locator('[id="ThreadPrimitiveViewportProps"]').count()) > 0,
          "Generated type table missing",
        );
      if (path === "/docs/installation") {
        assert(
          info.images.some((i) => i.loaded && i.src.includes("assistant-ui-starter")),
          "Local MDX image failed",
        );
        await check("installation provider tabs", async () => {
          await page.getByRole("tab", { name: "Anthropic", exact: true }).first().click();
          assert.equal(
            await page
              .getByRole("tab", { name: "Anthropic", exact: true })
              .first()
              .getAttribute("aria-selected"),
            "true",
          );
        });
        await page.screenshot({
          path: resolve(out, provider + "-desktop.png"),
          animations: "disabled",
        });
      }
    });
  }
  await check("client navigation", async () => {
    await page.goto(origin + "/docs");
    await page.evaluate(() => (window.__benchNavigation = true));
    await page.locator('a[href="/docs/installation"]:visible').first().click();
    await page.waitForURL("**/docs/installation");
    assert(await page.evaluate(() => window.__benchNavigation));
  });
  await check("search dialog and results", async () => {
    await page
      .getByRole("button", { name: /^Search/ })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole("combobox").fill("Installation");
    await page.getByRole("option").filter({ hasText: "Installation" }).first().waitFor();
    await page.keyboard.press("Escape");
  });
  await check("copy page Markdown", async () => {
    await page.getByRole("button", { name: "More page actions" }).click();
    await page.getByRole("menuitem").filter({ hasText: "Copy page" }).click();
    await page.waitForFunction(async () =>
      (await navigator.clipboard.readText()).includes("Installation"),
    );
  });
  await check("copy code", async () => {
    const previous = await page.evaluate(() => navigator.clipboard.readText());
    await page.getByRole("button", { name: "Copy code", exact: true }).first().click();
    await page.waitForFunction(async (old) => {
      const text = await navigator.clipboard.readText();
      return text !== old && text.includes("assistant-ui");
    }, previous);
  });
  await check("TOC navigation", async () => {
    await page.locator('a[href="#quick-start"]:visible').first().click();
    await page.waitForURL("**#quick-start");
  });
  await check("platform switcher", async () => {
    await page
      .getByRole("button", { name: "React", exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole("menuitemradio", { name: "React Native", exact: true }).click();
    await page.locator('[data-docs-platform="rn"]:visible').first().waitFor();
    await page
      .getByRole("button", { name: "React Native", exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole("menuitemradio", { name: "React", exact: true }).click();
    await page.locator('[data-docs-platform="react"]:visible').first().waitFor();
  });
  await check("mobile layout and sidebar", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + "/docs/installation");
    await page.locator("h1").first().waitFor();
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      "Horizontal page overflow",
    );
    await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
    await page.locator('aside a[href="/docs/cli"]:visible').first().click();
    await page.waitForURL("**/docs/cli");
    await page.screenshot({ path: resolve(out, provider + "-mobile.png"), animations: "disabled" });
  });
  await check("no browser runtime errors", async () => assert.deepEqual(result.pageErrors, []));
} catch (e) {
  result.failures.push({ name: "setup", error: e.message });
} finally {
  await context?.close();
  await browser?.close();
  if (server.exitCode === null && server.signalCode === null) {
    const done = once(server, "exit");
    server.kill("SIGTERM");
    await done;
  }
  log.end();
  writeFileSync(receipt, JSON.stringify(result, null, 2) + "\n");
}
console.log(
  JSON.stringify({
    provider,
    checks: result.checks,
    failures: result.failures,
    docsRoutes: result.docsRoutes?.length,
    searchRecords: result.searchRecords,
    initialJsGzipBytes: result.initialJsGzipBytes,
  }),
);
process.exitCode = result.failures.length ? 1 : 0;
