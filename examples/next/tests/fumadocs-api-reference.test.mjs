import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import test from "node:test";

const exampleDir = path.resolve(import.meta.dirname, "..");
const configPath = path.join(exampleDir, "docs.config.tsx");
const apiReferenceDir = path.join(exampleDir, "app", "api-reference");
const generatedPagePath = path.join(apiReferenceDir, "page.tsx");
const generatedRouteDir = path.join(apiReferenceDir, "[[...slug]]");
const generatedRoutePath = path.join(generatedRouteDir, "route.ts");

const fumadocsApiReferenceBlock = `  apiReference: {
    enabled: true,
    path: "api-reference",
    renderer: "fumadocs",
    specUrl: "https://petstore3.swagger.io/api/v3/openapi.json",
  },
`;

function injectFumadocsApiReference(configSource) {
  const needle = `  entry: "docs",\n`;
  assert.ok(configSource.includes(needle), "expected docs.config.tsx to contain the docs entry");
  return configSource.replace(needle, `${needle}${fumadocsApiReferenceBlock}`);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("failed to resolve a free port"));
        return;
      }
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

async function waitForApiReferenceHtml(url) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      }
      lastError = new Error(`unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw lastError ?? new Error("timed out waiting for the API reference page");
}

test("Next example builds with the Fumadocs API reference renderer", async () => {
  const originalConfig = readFileSync(configPath, "utf8");
  const hadGeneratedPage = existsSync(generatedPagePath);
  const originalGeneratedPage = hadGeneratedPage ? readFileSync(generatedPagePath, "utf8") : null;
  const hadGeneratedRoute = existsSync(generatedRoutePath);
  const originalGeneratedRoute = hadGeneratedRoute
    ? readFileSync(generatedRoutePath, "utf8")
    : null;
  const port = await getFreePort();
  let serverProcess;

  try {
    writeFileSync(configPath, injectFumadocsApiReference(originalConfig));

    execFileSync("pnpm", ["build"], {
      cwd: exampleDir,
      stdio: "pipe",
      encoding: "utf8",
      env: {
        ...process.env,
        CI: "1",
      },
    });

    assert.ok(
      existsSync(generatedPagePath),
      "expected Fumadocs API reference page to be generated",
    );
    const generatedPage = readFileSync(generatedPagePath, "utf8");
    assert.match(
      generatedPage,
      /@farming-labs\/next\/fumadocs-openapi\.css/,
      "expected generated page to import the package-owned Fumadocs OpenAPI CSS",
    );
    assert.match(
      generatedPage,
      /createNextApiReferencePage/,
      "expected generated page to use the shared Next API reference page helper",
    );
    assert.equal(
      existsSync(generatedRoutePath),
      false,
      "did not expect the Scalar route handler to be generated in fumadocs mode",
    );

    serverProcess = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], {
      cwd: exampleDir,
      env: {
        ...process.env,
        PORT: String(port),
      },
      stdio: "ignore",
    });

    const html = await waitForApiReferenceHtml(`http://127.0.0.1:${port}/api-reference`);
    assert.match(
      html,
      /<title>API Reference – Docs – Docs<\/title>/,
      "expected the built Next example to serve the API reference page HTML",
    );
    assert.match(
      html,
      /_next\/static\/chunks\//,
      "expected the served API reference page to include built Next assets",
    );
  } finally {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill("SIGTERM");
      await new Promise((resolve) => {
        serverProcess.once("exit", resolve);
        setTimeout(resolve, 5_000);
      });
    }

    writeFileSync(configPath, originalConfig);

    if (hadGeneratedPage) {
      writeFileSync(generatedPagePath, originalGeneratedPage ?? "");
    } else if (existsSync(generatedPagePath)) {
      rmSync(generatedPagePath);
    }

    if (hadGeneratedRoute) {
      mkdirSync(generatedRouteDir, { recursive: true });
      writeFileSync(generatedRoutePath, originalGeneratedRoute ?? "");
    } else if (existsSync(generatedRoutePath)) {
      rmSync(generatedRoutePath);
    }

    if (existsSync(generatedRouteDir) && !hadGeneratedRoute) {
      rmSync(generatedRouteDir, { recursive: true, force: true });
    }

    if (existsSync(apiReferenceDir) && !hadGeneratedPage && !hadGeneratedRoute) {
      rmSync(apiReferenceDir, { recursive: true, force: true });
    }
  }
});
