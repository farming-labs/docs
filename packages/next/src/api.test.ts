import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createDocsAPI,
  createDocsCloudRouteHandler,
  resolveNextProjectRoot,
  type DocsAPICloudOptions,
} from "./api.js";
import { createDocsCloudServer } from "@farming-labs/docs/cloud/server";
import { createDocsAPI as createThemeDocsAPI } from "@farming-labs/theme/api";
import type { DocsCloudServer } from "@farming-labs/docs/cloud/server";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createTestDocsCloudServer(): DocsCloudServer {
  const handleRequest = vi.fn(async (request: Request) => {
    if (request.method === "GET") {
      return Response.json({ ok: true, type: "config" });
    }

    return Response.json({ ok: true, type: "cloud" });
  });

  return {
    analytics: {
      track: vi.fn(async () => true),
    },
    trackEvent: vi.fn(async () => true),
    askAI: vi.fn(async () => Response.json({ ok: true, type: "ask-ai" })),
    handleRequest,
    getPublicConfig: vi.fn(() => ({
      ok: true as const,
      configured: {
        projectId: true,
        apiKey: true,
      },
      projectId: "project_test",
      apiBaseUrl: "https://cloud.example.com",
      features: {
        analytics: true,
        askAI: true,
      },
    })),
  };
}

describe("resolveNextProjectRoot", () => {
  it("resolves the root from a source app route path", () => {
    const routePath = path.join("/repo", "app", "api", "docs", "route.ts");
    expect(resolveNextProjectRoot(pathToFileURL(routePath).href)).toBe("/repo");
  });

  it("resolves the root from a source src/app route path", () => {
    const routePath = path.join("/repo", "src", "app", "api", "docs", "route.ts");
    expect(resolveNextProjectRoot(pathToFileURL(routePath).href)).toBe("/repo");
  });

  it("resolves the project root from a built .next server route path", () => {
    const routePath = path.join("/repo", ".next", "server", "app", "api", "docs", "route.js");
    expect(resolveNextProjectRoot(pathToFileURL(routePath).href)).toBe("/repo");
  });

  it("resolves the project root from a built .next dev server route path", () => {
    const routePath = path.join(
      "/repo",
      ".next",
      "dev",
      "server",
      "app",
      "api",
      "docs",
      "route.js",
    );
    expect(resolveNextProjectRoot(pathToFileURL(routePath).href)).toBe("/repo");
  });

  it("resolves the project root from a built nested project route path", () => {
    const routePath = path.join(
      "/repo",
      "apps",
      "orm",
      ".next",
      "server",
      "app",
      "api",
      "docs",
      "route.js",
    );
    expect(resolveNextProjectRoot(pathToFileURL(routePath).href)).toBe(
      path.join("/repo", "apps", "orm"),
    );
  });

  it("resolves the project root from a built custom distDir route path", () => {
    const routePath = path.join(
      "/repo",
      "examples",
      "next",
      ".next-build",
      "server",
      "app",
      "api",
      "docs",
      "route.js",
    );
    expect(resolveNextProjectRoot(pathToFileURL(routePath).href)).toBe(
      path.join("/repo", "examples", "next"),
    );
  });
});

describe("createDocsAPI", () => {
  it("forwards to the theme api handler when called without options", () => {
    const nextHandlers = createDocsAPI();
    const themeHandlers = createThemeDocsAPI();

    expect(Object.keys(nextHandlers).sort()).toEqual(Object.keys(themeHandlers).sort());
  });

  it("accepts a Docs Cloud server instance as the optional second argument", async () => {
    const docsCloud = createTestDocsCloudServer();
    const handlers = createDocsAPI({}, docsCloud);

    const response = await handlers.GET(
      new Request("https://docs.example.com/api/docs?cloud=config"),
    );

    await expect(response.json()).resolves.toEqual({ ok: true, type: "config" });
    expect(docsCloud.handleRequest).toHaveBeenCalledTimes(1);
  });

  it("routes explicit cloud POST actions to the second-argument Docs Cloud server", async () => {
    const docsCloud = createTestDocsCloudServer();
    const handlers = createDocsAPI({}, docsCloud);

    const analyticsResponse = await handlers.POST(
      jsonRequest("https://docs.example.com/api/docs", {
        type: "search",
        path: "/docs/install",
      }),
    );
    const aiResponse = await handlers.POST(
      jsonRequest("https://docs.example.com/api/docs?action=ask-ai", {
        messages: [{ role: "user", content: "How do I deploy?" }],
      }),
    );

    await expect(analyticsResponse.json()).resolves.toEqual({ ok: true, type: "cloud" });
    await expect(aiResponse.json()).resolves.toEqual({ ok: true, type: "cloud" });
    expect(docsCloud.handleRequest).toHaveBeenCalledTimes(2);
  });

  it("falls through to the docs API for normal AI POST bodies", async () => {
    const docsCloud = createTestDocsCloudServer();
    const handlers = createDocsAPI({}, docsCloud);

    const response = await handlers.POST(
      jsonRequest("https://docs.example.com/api/docs", {
        messages: [{ role: "user", content: "How do I deploy?" }],
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("AI is not enabled"),
    });
    expect(docsCloud.handleRequest).not.toHaveBeenCalled();
  });

  it("accepts Docs Cloud route options when the second argument is an object", async () => {
    const docsCloud = createTestDocsCloudServer();
    const options: DocsAPICloudOptions = {
      docsCloud,
      locale: "en",
      publicBaseUrl: "https://docs.example.com",
    };
    const handlers = createDocsAPI({}, options);

    await handlers.POST(
      jsonRequest("https://docs.example.com/api/docs", {
        action: "analytics",
        event: {
          type: "page_view",
        },
      }),
    );

    expect(docsCloud.handleRequest).toHaveBeenCalledWith(expect.any(Request), {
      locale: "en",
      publicBaseUrl: "https://docs.example.com",
    });
  });
});

describe("createDocsAPI with docs roots", () => {
  let rootDir: string;

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  function createRootsAPI() {
    rootDir = mkdtempSync(path.join(tmpdir(), "next-docs-roots-api-"));
    const config = {
      entry: "docs",
      docsPath: "/guide",
      roots: [{ entry: "statewire/docs" }],
    };
    // A root's own docsPath must win over the one the theme reads from docs.config.
    writeFileSync(
      path.join(rootDir, "docs.config.ts"),
      `export default ${JSON.stringify(config)};\n`,
    );
    for (const [dir, title] of [
      ["docs/intro", "Harness intro"],
      ["statewire/docs/intro", "Statewire intro"],
    ]) {
      mkdirSync(path.join(rootDir, "app", dir), { recursive: true });
      writeFileSync(
        path.join(rootDir, "app", dir, "page.mdx"),
        `---\ntitle: "${title}"\n---\n\n# ${title}\n\nThe envelope format for ${title}.\n`,
      );
    }
    return createDocsAPI({ ...config, rootDir });
  }

  async function search(api: ReturnType<typeof createDocsAPI>, query: string, referer?: string) {
    const response = await api.GET(
      new Request(`https://site.test/api/docs?query=envelope${query}`, {
        headers: referer ? { referer: `https://site.test${referer}` } : {},
      }),
    );
    const results = (await response.json()) as Array<{ url: string }>;
    return {
      vary: response.headers.get("vary"),
      urls: [...new Set(results.map(({ url }) => url.split("#")[0]))],
    };
  }

  it("answers search from the root of the page that asked, varying on Referer", async () => {
    const api = createRootsAPI();

    expect(await search(api, "", "/statewire/docs/intro")).toEqual({
      vary: "Referer",
      urls: ["/statewire/docs/intro"],
    });
    expect(await search(api, "", "/guide/intro")).toEqual({
      vary: "Referer",
      urls: ["/guide/intro"],
    });
  });

  it("lets ?root= and ?pathname= override the Referer", async () => {
    const api = createRootsAPI();

    expect(await search(api, "&root=statewire/docs", "/guide/intro")).toEqual({
      vary: null,
      urls: ["/statewire/docs/intro"],
    });
    expect(await search(api, "&pathname=/statewire/docs/intro", "/guide/intro")).toEqual({
      vary: null,
      urls: ["/statewire/docs/intro"],
    });
  });

  it("serves a Markdown mirror from the root it names", async () => {
    const api = createRootsAPI();
    const markdown = async (query: string) =>
      (await api.GET(new Request(`https://site.test/api/docs?format=markdown${query}`))).text();

    expect(await markdown("&root=statewire/docs&path=intro")).toContain("# Statewire intro");
    expect(await markdown("&path=intro")).toContain("# Harness intro");
  });
});

describe("createDocsCloudRouteHandler", () => {
  it("returns Next-compatible GET and POST route handlers from a server SDK", async () => {
    const docsCloud = createDocsCloudServer({
      projectId: "project_next",
      apiKey: "fl_key_next",
    });
    const handlers = createDocsCloudRouteHandler(docsCloud);

    expect(Object.keys(handlers).sort()).toEqual(["GET", "POST"]);

    const response = await handlers.GET(new Request("https://docs.example.com/api/cloud"));
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      projectId: "project_next",
    });
  });
});
