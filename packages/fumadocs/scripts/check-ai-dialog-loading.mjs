import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { build } from "tsdown";
import { chromium } from "playwright";

// A small browser fixture measures this component boundary, not an entire Next app.
const packageRoot = resolve(import.meta.dirname, "..");
const require = createRequire(join(packageRoot, "package.json"));
const temp = mkdtempSync(join(packageRoot, ".ai-dialog-check-"));
const baseline = process.argv[2];
let server;
let browser;
try {
  let component = join(packageRoot, "src/docs-ai-features.tsx");
  if (baseline) {
    const original = execFileSync(
      "git",
      ["show", `${baseline}:packages/fumadocs/src/docs-ai-features.tsx`],
      { cwd: packageRoot, encoding: "utf8" },
    );
    component = join(temp, "baseline.tsx");
    writeFileSync(component, original.replaceAll('from "./', `from "${packageRoot}/src/`));
  }
  writeFileSync(
    join(temp, "index.tsx"),
    `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { FrameworkProvider } from "fumadocs-core/framework";
    import { DocsAIFeatures } from ${JSON.stringify(component)};
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode") || "search";
    createRoot(document.getElementById("root")!).render(<FrameworkProvider
      useRouter={() => ({push: (url) => history.pushState({}, "", url), refresh: () => {}})}
      usePathname={() => location.pathname} useParams={() => ({})}>
      <button onClick={() => window.dispatchEvent(new Event("fd-open-search"))}>Search ⌘ K</button>
      <button onClick={() => window.dispatchEvent(new Event("fd-open-ai"))}>Open sidebar AI</button>
      <DocsAIFeatures mode={mode as any} api="/api/docs" requestMode="docs-cloud"
        floatingStyle={(params.get("style") || "panel") as any} suggestedQuestions={["Explain setup"]} />
    </FrameworkProvider>);
  `,
  );
  const output = join(temp, "out");
  await build({
    config: false,
    entry: { index: join(temp, "index.tsx") },
    outDir: output,
    dts: false,
    minify: true,
    platform: "browser",
    format: "esm",
    noExternal: [/.*/],
    inlineOnly: false,
    define: { "process.env.NODE_ENV": '"production"' },
    alias: {
      react: dirname(require.resolve("react/package.json")),
      "react-dom": dirname(require.resolve("react-dom/package.json")),
    },
    outExtensions: () => ({ js: ".js" }),
    report: false,
  });
  const requests = [];
  server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://local");
    if (url.pathname === "/api/docs") {
      requests.push({
        method: req.method,
        query: url.searchParams.get("query"),
        lang: url.searchParams.get("lang"),
      });
      if (req.method === "POST" && requests.filter((item) => item.method === "POST").length > 1) {
        res.setHeader("content-type", "text/event-stream");
        return res.end(
          ["Verified setup ", "answer"]
            .map(
              (content) =>
                "data: " + JSON.stringify({ choices: [{ delta: { content } }] }) + "\n\n",
            )
            .join("") + "data: [DONE]\n\n",
        );
      }
      res.setHeader("content-type", "application/json");
      return res.end(
        JSON.stringify(
          req.method === "POST"
            ? { answer: "Verified setup answer" }
            : [{ id: "setup", url: "/docs/setup", type: "page", content: "Setup guide" }],
        ),
      );
    }
    if (url.pathname === "/ai.css") {
      res.setHeader("content-type", "text/css");
      return res.end(readFileSync(join(packageRoot, "styles/ai.css")));
    }
    if (url.pathname.endsWith(".js")) {
      // Exercise the cancellable loading shell with a delayed chunk response.
      if (url.pathname.includes("ai-search-dialog"))
        await new Promise((done) => setTimeout(done, 350));
      res.setHeader("content-type", "text/javascript");
      return res.end(readFileSync(join(output, url.pathname)));
    }
    res.setHeader("content-type", "text/html");
    res.end(
      '<link rel="stylesheet" href="/ai.css"><div id="root"></div><script type="module" src="/index.js"></script>',
    );
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  const scripts = new Set();
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".js"))
      scripts.add(new URL(request.url()).pathname);
  });
  await page.goto(`${origin}/?mode=search&lang=fr`, { waitUntil: "networkidle" });
  const initialScripts = [...scripts];
  const initialGzipBytes = initialScripts.reduce(
    (sum, path) => sum + gzipSync(readFileSync(join(output, path)), { level: 9 }).length,
    0,
  );
  if (!baseline)
    assert.equal(
      initialScripts.some((path) => path.includes("ai-search-dialog")),
      false,
    );
  console.log("Open search");
  await page.keyboard.press("Control+k");
  if (!baseline) {
    await page.getByRole("dialog", { name: "Loading dialog" }).waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.keyboard.press("Control+k");
  }
  console.log("Search query");
  await page.getByPlaceholder("Search documentation...").fill("setup");
  await page.getByText("Setup guide", { exact: true }).waitFor();
  assert(requests.some((r) => r.method === "GET" && r.query === "setup" && r.lang === "fr"));
  await page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await page.getByPlaceholder("Ask a question...").fill("Explain setup");
  await page.getByPlaceholder("Ask a question...").press("Enter");
  await page.getByText("Verified setup answer", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Search ⌘ K" }).click();
  await page.getByText("Verified setup answer", { exact: true }).waitFor();
  assert.equal(requests.filter((r) => r.method === "POST").length, 1);
  await page.keyboard.press("Escape");
  const initial = { initialScripts, initialGzipBytes, scriptsAfterOpen: [...scripts] };

  await page.goto(`${origin}/?mode=sidebar-icon`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open sidebar AI" }).click();
  await page.getByPlaceholder("Ask a question...").fill("Explain setup");
  await page.getByPlaceholder("Ask a question...").press("Enter");
  await page.getByText("Verified setup answer", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open sidebar AI" }).click();
  await page.getByText("Verified setup answer", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Search ⌘ K" }).click();
  await page.getByPlaceholder("Search documentation...").fill("setup");
  await page.getByText("Setup guide", { exact: true }).waitFor();

  await page.getByPlaceholder("Search documentation...").press("Enter");
  await page.waitForURL("**/docs/setup");

  for (const style of ["panel", "modal", "popover", "full-modal"]) {
    await page.goto(`${origin}/?mode=floating&style=${style}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Ask AI", exact: true }).click();
    const input = page.getByPlaceholder(style === "full-modal" ? "Ask AI" : "Ask a question...", {
      exact: true,
    });
    await input.fill("Explain setup");
    await input.press("Enter");
    await page.getByText("Verified setup answer", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Ask AI", exact: true }).click();
    await page.getByText("Verified setup answer", { exact: true }).waitFor();
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        baseline: baseline || null,
        ...initial,
        verified: [
          "keyboard",
          ...(!baseline ? ["loading cancellation"] : []),
          "JSON and streaming AI responses",
          "result navigation",
          "localized search",
          "button",
          "search AI history",
          "sidebar AI history",
          "sidebar search",
          "panel",
          "modal",
          "popover",
          "full-modal",
        ],
        runtimeErrors: errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await browser?.close();
  server?.closeAllConnections();
  await new Promise((done) => (server ? server.close(done) : done()));
  rmSync(temp, { recursive: true, force: true });
}
