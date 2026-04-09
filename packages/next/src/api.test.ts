import { describe, expect, it } from "vitest";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveNextProjectRoot } from "./api.js";

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
});
