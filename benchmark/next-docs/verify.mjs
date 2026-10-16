import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createWriteStream, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { once } from "node:events";
import { chromium } from "playwright";

const run = resolve(process.argv[2]);
const channel = process.argv[3];
const metadata = JSON.parse(readFileSync(join(run, "results.json"), "utf8"));
const results = [];
const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
const pause = (ms) => new Promise((done) => setTimeout(done, ms));

try {
  for (const pages of metadata.arguments.pages) {
    for (const provider of metadata.arguments.providers) {
      const app = join(run, "apps", `${provider}-${pages}`);
      const port = 43791;
      const origin = `http://127.0.0.1:${port}`;
      // Never accidentally inspect an unrelated server already using this port.
      let occupied = false;
      try {
        await fetch(`${origin}/docs`);
        occupied = true;
      } catch {
        /* no HTTP server */
      }
      assert(!occupied, `Port ${port} is already in use`);
      const log = createWriteStream(join(run, `verify-${provider}-${pages}.log`));
      const server = spawn(
        process.execPath,
        [
          join(app, "node_modules/next/dist/bin/next"),
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
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        permissions: ["clipboard-read", "clipboard-write"],
      });
      context.setDefaultTimeout(15000);
      try {
        let ready = false;
        for (let attempt = 0; attempt < 60; attempt++) {
          if (server.exitCode !== null || server.signalCode !== null)
            throw new Error(`${provider} server exited: ${server.exitCode}`);
          try {
            const response = await fetch(`${origin}/docs`);
            if (response.ok) {
              ready = true;
              break;
            }
          } catch {
            /* wait for this server */
          }
          await pause(500);
        }
        assert(ready, `${provider} server did not start`);
        const page = await context.newPage();
        const errors = [];
        const failedRequests = [];
        page.on("requestfailed", (request) =>
          failedRequests.push({ url: request.url(), error: request.failure()?.errorText }),
        );
        page.on("pageerror", (error) => errors.push(error.message));
        const response = await page.goto(`${origin}/docs`, { waitUntil: "load", timeout: 60000 });
        assert.equal(response.status(), 200);
        await page.getByRole("heading", { name: /^Benchmark page 0000/ }).waitFor();
        await page.getByRole("heading", { name: /^Section 6/ }).waitFor();
        assert.equal(await page.locator("pre:visible").count(), 6);
        await page.getByRole("button", { name: "Copy Text", exact: true }).first().click();
        assert.match(await page.evaluate(() => navigator.clipboard.readText()), /loadTopic/);
        await page.evaluate(() => {
          window.__benchmarkNavigation = "same-document";
        });
        await page.locator('a[href="/docs/page-0001"]').first().click();
        await page.getByRole("heading", { name: /^Benchmark page 0001/ }).waitFor();
        assert.equal(await page.evaluate(() => window.__benchmarkNavigation), "same-document");
        await page.locator("[data-search-full]").click();
        const dialog = page.getByRole("dialog");
        const last = String(pages - 1).padStart(4, "0");
        const searchResponse = page.waitForResponse(
          (value) => value.url().includes("/api/") && value.url().includes(last),
        );
        await dialog.locator("input").fill(last);
        const search = await searchResponse;
        assert(search.ok(), `Search returned ${search.status()}`);
        assert.match(JSON.stringify(await search.json()), new RegExp(`/docs/page-${last}`));
        await dialog
          .getByRole("option")
          .filter({ hasText: `Benchmark page ${last}` })
          .first()
          .click();
        await page.getByRole("heading", { name: new RegExp(`^Benchmark page ${last}`) }).waitFor();
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        await page.screenshot({
          path: join(run, `${provider}-${pages}-desktop.png`),
          fullPage: false,
          animations: "disabled",
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${origin}/docs`, { waitUntil: "load", timeout: 60000 });
        await page.getByRole("heading", { name: /^Benchmark page 0000/ }).waitFor();
        assert(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
          "Mobile page overflows horizontally",
        );
        await page.getByRole("button", { name: "Open Sidebar", exact: true }).click();
        await page.locator('a[href="/docs/page-0001"]:visible').first().click();
        await page.getByRole("heading", { name: /^Benchmark page 0001/ }).waitFor();
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        await page.screenshot({
          path: join(run, `${provider}-${pages}-mobile.png`),
          fullPage: false,
          animations: "disabled",
        });
        assert.deepEqual(errors, [], "Browser runtime errors");
        const result = {
          provider,
          pages,
          browser: browser.version(),
          checks: [
            "production HTTP 200",
            "six highlighted code blocks",
            "clipboard copy",
            "client navigation",
            "search API and result navigation",
            "mobile overflow and sidebar",
          ],
          pageErrors: errors,
          failedRequests,
        };
        results.push(result);
        console.log(JSON.stringify(result));
      } catch (error) {
        const page = context.pages()[0];
        if (page) {
          await page.getByRole("dialog").waitFor({ state: "hidden" });
          await page
            .screenshot({ path: join(run, `failure-${provider}-${pages}.png`) })
            .catch(() => {});
          console.error(
            "Page diagnostic",
            await page
              .locator("body")
              .innerText()
              .catch(() => "unavailable"),
          );
        }
        throw error;
      } finally {
        await context.close();
        if (server.exitCode === null && server.signalCode === null) {
          const stopped = once(server, "exit");
          server.kill("SIGTERM");
          await stopped;
        }
        log.end();
      }
    }
  }
} finally {
  await browser.close();
}
writeFileSync(join(run, "verification.json"), JSON.stringify(results, null, 2) + "\n");
