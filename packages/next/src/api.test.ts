import { describe, expect, it } from "vitest";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createDocsAPI, createDocsCloudRouteHandler, resolveNextProjectRoot } from "./api.js";
import { createDocsCloudServer } from "@farming-labs/docs/server";
import { createDocsAPI as createThemeDocsAPI } from "@farming-labs/theme/api";

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
