import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const [phase = "after", output = "/tmp/docs-performance-handoff/chat-styles"] =
  process.argv.slice(2);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
const results = [];
try {
  for (const [name, port] of [
    ["svelte", 43101],
    ["nuxt", 43102],
  ]) {
    const url = `http://127.0.0.1:${port}/performance-chat`;
    let chatUrl;
    for (const [screen, viewport] of [
      ["desktop", { width: 1440, height: 1000 }],
      ["phone", { width: 390, height: 844 }],
    ]) {
      for (const style of ["panel", "modal", "popover", "full-modal"]) {
        const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
        const page = await context.newPage();
        const responses = [];
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("response", (response) => {
          if (response.request().resourceType() === "script") responses.push(response);
        });
        await page.goto(url, { waitUntil: "networkidle" });
        await page.getByLabel("Chat style").selectOption(style);
        const trigger = page.getByRole("button", { name: "Ask AI", exact: true });
        await trigger.waitFor();
        const snap = (state) =>
          page.screenshot({
            path: join(output, `${name}-${phase}-${screen}-${style}-${state}.png`),
            animations: "disabled",
          });
        await snap("closed");
        await trigger.click();
        const input = page.locator(style === "full-modal" ? ".fd-ai-fm-input" : ".fd-ai-input");
        await input.waitFor();
        await page.waitForFunction(
          (selector) => document.querySelector(selector) === document.activeElement,
          style === "full-modal" ? ".fd-ai-fm-input" : ".fd-ai-input",
        );
        await snap("open");
        if (phase === "before")
          await page.getByRole("button", { name: "Close", exact: true }).click();
        else await page.keyboard.press("Escape");
        await trigger.waitFor();
        assert.notEqual(await page.evaluate(() => document.body.style.overflow), "hidden");
        if (phase === "after") {
          await trigger.click();
          await input.waitFor();
          await page.getByRole("button", { name: "Toggle chat mount" }).dispatchEvent("click");
          await input.waitFor({ state: "detached" });
          assert.notEqual(
            await page.evaluate(() => document.body.style.overflow),
            "hidden",
            `${name} ${style} unmount unlocks body`,
          );
          for (const response of responses) {
            if ((await response.body()).includes("fd-ai-fm-msg-content")) chatUrl = response.url();
          }
        }
        assert.deepEqual(errors, []);
        results.push({ name, screen, style, errors });
        await context.close();
      }
    }
    if (phase === "after") {
      assert(chatUrl, `${name} chat chunk found`);
      // Delay the actual chunk until Escape has cancelled the pending open.
      const context = await browser.newContext();
      const page = await context.newPage();
      let release;
      let requested;
      const pending = new Promise((resolve) => {
        requested = resolve;
      });
      await page.route(chatUrl, async (route) => {
        requested();
        await new Promise((resolve) => {
          release = resolve;
        });
        await route.continue();
      });
      await page.goto(url, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Ask AI", exact: true }).click();
      await pending;
      await page.keyboard.press("Escape");
      const response = page.waitForResponse(chatUrl);
      release();
      await (await response).finished();
      await page.waitForLoadState("networkidle");
      assert.equal(await page.locator(".fd-ai-input").count(), 0);
      await page.getByRole("button", { name: "Ask AI", exact: true }).click();
      await page.locator(".fd-ai-input").waitFor();
      await context.close();
      // A failed network fetch must leave the trigger usable for a second attempt.
      const retryContext = await browser.newContext();
      const retry = await retryContext.newPage();
      let attempts = 0;
      await retry.route(chatUrl, (route) =>
        ++attempts === 1 ? route.abort("failed") : route.continue(),
      );
      await retry.goto(url, { waitUntil: "networkidle" });
      const failure = retry.waitForEvent("console", (message) =>
        message.text().includes("Unable to load Ask AI"),
      );
      await retry.getByRole("button", { name: "Ask AI", exact: true }).click();
      await failure;
      await retry.getByRole("button", { name: "Ask AI", exact: true }).click();
      await retry.locator(".fd-ai-input").waitFor();
      assert.equal(attempts, 2);
      await retryContext.close();
      results.push({ name, pendingEscape: true, networkRetry: true });
    }
  }
} finally {
  await browser.close();
}
writeFileSync(join(output, `${phase}-results.json`), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
