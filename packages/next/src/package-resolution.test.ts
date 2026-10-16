import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { realpathSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DocsPackageResolutionPlugin } from "./package-resolution.js";

const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");
const packages = Object.fromEntries(
  ["fumadocs-core", "fumadocs-ui", "fumadocs-openapi"].map((name) => [
    name,
    dirname(require.resolve(`${name}/package.json`)),
  ]),
);

function resolveModule(request: string, conditions: string[], from = "/tmp", alias = {}) {
  const compiler = webpack({
    mode: "none",
    optimization: { minimize: false },
    context: from,
    resolve: {
      conditionNames: conditions,
      alias,
      plugins: [new DocsPackageResolutionPlugin(packages)],
    },
  });
  const resolver = compiler.resolverFactory.get("normal");
  return new Promise<string>((resolve, reject) => {
    resolver.resolve({}, from, request, {}, (error: Error | null, result: string) => {
      compiler.close(() => (error ? reject(error) : resolve(realpathSync(result))));
    });
  });
}

describe("shared docs package resolution", () => {
  it.each([
    ["fumadocs-core/source", "dist/source/index.js"],
    ["fumadocs-core/page-tree", "dist/page-tree/index.js"],
    ["fumadocs-core/highlight", "dist/highlight/index.js"],
    ["fumadocs-core/source/lucide-icons", "dist/source/plugins/lucide-icons.js"],
    ["fumadocs-ui/layouts/notebook", "dist/layouts/notebook/index.js"],
    ["fumadocs-ui/provider/next", "dist/provider/next.js"],
    ["fumadocs-ui/components/tabs.unstyled", "dist/components/ui/tabs.js"],
    ["fumadocs-openapi/ui", "dist/ui/index.js"],
    ["fumadocs-openapi/server", "dist/server/index.js"],
  ])("resolves exported subpath %s", async (name, target) => {
    expect(await resolveModule(name, ["node", "import", "default"])).toBe(
      realpathSync(join(packages[name.split("/")[0]], target)),
    );
  });

  it.each([
    ["fumadocs-core/server", "fumadocs-core", "dist/server.js", "dist/server.browser.js"],
    ["fumadocs-ui/mdx", "fumadocs-ui", "dist/mdx.server.js", "dist/mdx.js"],
    ["fumadocs-openapi", "fumadocs-openapi", "dist/index.js", "dist/index.browser.js"],
  ])("preserves conditional exports for %s", async (name, pkg, server, browser) => {
    expect(await resolveModule(name, ["node", "import", "default"])).toBe(
      realpathSync(join(packages[pkg], server)),
    );
    expect(await resolveModule(name, ["browser", "import", "default"])).toBe(
      realpathSync(join(packages[pkg], browser)),
    );
  });

  it("shares the framework context across app and package consumers", async () => {
    const app = await resolveModule("fumadocs-core/framework", ["import"]);
    const theme = await resolveModule(
      "fumadocs-core/framework",
      ["import"],
      packages["fumadocs-ui"],
    );
    expect(app).toBe(theme);
  });

  it("does not expose unexported files", async () => {
    await expect(resolveModule("fumadocs-core/dist/source/index.js", ["import"])).rejects.toThrow();
  });

  it("preserves an explicit user alias", async () => {
    const replacement = require.resolve("fumadocs-core/page-tree");
    expect(
      await resolveModule("fumadocs-core/source", ["import"], "/tmp", {
        "fumadocs-core/source$": replacement,
      }),
    ).toBe(realpathSync(replacement));
  });
});
