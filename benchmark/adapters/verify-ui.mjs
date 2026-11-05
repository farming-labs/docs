import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { chromium } from "playwright";

const [phase = "after", directory = "/tmp/docs-performance-handoff/ui", only] =
  process.argv.slice(2);
const output = resolve(directory);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
const results = [];
const streamRequests = [];
let finishStream;
const mock = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  streamRequests.push(JSON.parse(body));
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  });
  const chunk = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
  res.write(chunk("Verified **stream**"));
  await new Promise((resolve) => {
    finishStream = resolve;
  });
  res.end(chunk("\n\n```ts\nconst answer = 42;\n```") + "data: [DONE]\n\n");
});
mock.listen(0, "127.0.0.1");
await once(mock, "listening");
try {
  for (const [name, port] of [
    ["svelte", 43101],
    ["nuxt", 43102],
    ["next", 43104],
  ]) {
    if (only && only !== name) continue;
    for (const [screen, viewport] of [
      ["desktop", { width: 1440, height: 1000 }],
      ["phone", { width: 390, height: 844 }],
    ]) {
      const context = await browser.newContext({
        viewport,
        reducedMotion: "reduce",
        permissions: ["clipboard-read", "clipboard-write"],
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      const responses = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.request().resourceType() === "script") responses.push(r);
      });
      const origin = `http://127.0.0.1:${port}`;
      const response = await page.goto(origin + "/docs", { waitUntil: "networkidle" });
      assert.equal(response.status(), 200);
      await page.locator("h1").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const snapshot = async (state) =>
        page.screenshot({
          path: join(output, `${name}-${phase}-${screen}-${state}.png`),
          animations: "disabled",
        });
      await snapshot("closed");
      const initialScripts = await Promise.all(
        responses.map(async (r) => {
          const body = await r.body();
          return {
            url: new URL(r.url()).pathname,
            bytes: body.length,
            chatImplementation: body.includes("fd-ai-fm-msg-content"),
          };
        }),
      );
      if (phase === "after" && name !== "next")
        assert(
          !initialScripts.some((script) => script.chatImplementation),
          `${name} eagerly loaded chat`,
        );
      const body = await response.text();
      writeFileSync(join(output, `${name}-${phase}-${screen}.html`), body);
      const baselineData = await page.evaluate(() => ({
        title: document.title,
        text: (document.querySelector("#nd-page") || document.querySelector("main"))?.innerText,
        headings: [...document.querySelectorAll("h1,h2,h3")].map((e) => e.textContent),
        schema: [...document.querySelectorAll('script[type="application/ld+json"]')].map(
          (e) => e.textContent,
        ),
      }));
      writeFileSync(
        join(output, `${name}-${phase}-${screen}.json`),
        JSON.stringify(baselineData, null, 2),
      );
      if (phase === "after")
        assert.deepEqual(
          baselineData,
          JSON.parse(readFileSync(join(output, `${name}-before-${screen}.json`), "utf8")),
          `${name} ${screen} visible content changed`,
        );
      if (name !== "next") {
        await page.getByRole("button", { name: "Ask DocsBot", exact: true }).click();
        await page.locator(".fd-ai-fm-input").waitFor();
        await snapshot("open");
        if (phase === "after") {
          const scripts = await Promise.all(
            responses.map(async (response) =>
              (await response.body()).includes("fd-ai-fm-msg-content"),
            ),
          );
          assert(scripts.some(Boolean), `${name} did not load the chat chunk after activation`);
        }
        if (phase === "after") {
          await page.route("**/api/docs", (route) =>
            route.request().method() === "POST"
              ? route.continue({ url: `http://127.0.0.1:${mock.address().port}/stream` })
              : route.continue(),
          );
          const input = page.locator(".fd-ai-fm-input");
          await input.fill("Verify streamed documentation answers");
          await page.getByRole("button", { name: "Send", exact: true }).click();
          await page.getByText("Verified stream", { exact: true }).waitFor();
          assert.equal(
            streamRequests.at(-1).messages.at(-1).content,
            "Verify streamed documentation answers",
          );
          finishStream();
          await page.locator(".fd-ai-fm-overlay pre").waitFor();
          assert.match(await page.locator(".fd-ai-fm-overlay").innerText(), /const answer = 42/);
          await page.getByRole("button", { name: "Close", exact: true }).click();
          await page.getByRole("button", { name: "Ask DocsBot", exact: true }).click();
          await page.locator(".fd-ai-fm-input").waitFor();
          const retained = await page.locator(".fd-ai-fm-overlay").innerText();
          assert.match(retained, /Verified stream/);
          assert.match(retained, /const answer = 42/);
          await page.getByRole("button", { name: "Close", exact: true }).click();
          assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");
          // Exercise the real search endpoint and select a returned page.
          await page
            .getByRole("button", { name: /Search/ })
            .first()
            .click();
          await page.locator(".omni-search-input").fill("installation");
          const result = page
            .locator(
              '.omni-item[data-id^="/docs/installation"], .omni-item[data-url^="/docs/installation"]',
            )
            .first();
          await result.waitFor();
          const destination =
            (await result.getAttribute("data-url")) || (await result.getAttribute("data-id"));
          await result.click();
          await page.waitForURL(origin + destination);
          await page.getByRole("heading", { name: "Installation", exact: true }).first().waitFor();
          if (screen === "desktop") {
            await page.getByRole("button", { name: "Copy code", exact: true }).first().click();
            assert((await page.evaluate(() => navigator.clipboard.readText())).length > 0);
          }
        } else await page.getByRole("button", { name: "Close", exact: true }).click();
      } else if (phase === "after") {
        // Same-document navigation must carry the new page's metadata and recover on back.
        await page.evaluate(() => {
          window.__docsNavigationMarker = "retained";
        });
        if (screen === "phone")
          await page.getByRole("button", { name: "Open Sidebar", exact: true }).click();
        await page.locator('a[href="/docs/getting-started"]:visible').first().click();
        await page.waitForURL("**/docs/getting-started");
        await page
          .locator("#nd-page h1")
          .filter({ hasText: /^Get Started/ })
          .first()
          .waitFor();
        assert.equal(await page.evaluate(() => window.__docsNavigationMarker), "retained");
        assert.equal(await page.locator("#nd-page").count(), 1);
        await page.goBack();
        await page.waitForURL("**/docs");
        await page.locator("#nd-page h1").waitFor();
        assert.equal(await page.locator("#nd-page").count(), 1);
      }
      assert.deepEqual(errors, [], `${name} ${screen} browser errors`);
      results.push({
        name,
        phase,
        screen,
        htmlBytes: Buffer.byteLength(body),
        initialScripts,
        initialScriptBytes: initialScripts.reduce((n, s) => n + s.bytes, 0),
        errors,
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
  mock.closeAllConnections();
  mock.close();
}
writeFileSync(
  join(output, `${phase}${only ? "-" + only : ""}-results.json`),
  JSON.stringify(results, null, 2),
);
console.log(
  JSON.stringify(
    results.map(({ initialScripts: _initialScripts, ...result }) => result),
    null,
    2,
  ),
);
