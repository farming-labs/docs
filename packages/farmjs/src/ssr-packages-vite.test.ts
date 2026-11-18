import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build, createServer, type Plugin } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { docsMdx } from "./vite.js";

let root: string;

// An installed copy of each docs package, as an app outside this repository has them.
async function installPackage(name: string, marker: string) {
  const directory = path.join(root, "node_modules", ...name.split("/"));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({ name, type: "module", exports: { ".": "./index.js" } }),
  );
  await fs.writeFile(path.join(directory, "index.js"), `export const marker = "${marker}";\n`);
  return path.join(directory, "index.js");
}

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "farm-docs-ssr-packages-")));
  await fs.writeFile(
    path.join(root, "entry.js"),
    `export { marker as docs } from "@farming-labs/docs";
export { marker as theme } from "@farming-labs/theme";
`,
  );
});
afterEach(() => fs.rm(root, { recursive: true, force: true }));

describe("docsMdx server packages", { timeout: 20_000 }, () => {
  it("loads @farming-labs/docs in Node during development and keeps transforming the theme", async () => {
    const docsFile = await installPackage("@farming-labs/docs", "docs-package");
    const themeFile = await installPackage("@farming-labs/theme", "theme-package");
    const transformed: string[] = [];
    const recordServerTransforms: Plugin = {
      name: "test:record-server-transforms",
      transform(_code, id) {
        if (this.environment.config.consumer === "server") transformed.push(id);
      },
    };
    const server = await createServer({
      root,
      configFile: false,
      cacheDir: path.join(root, ".cache"),
      logLevel: "silent",
      plugins: [docsMdx(), recordServerTransforms],
      server: { middlewareMode: true, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const loaded = await server.ssrLoadModule("/entry.js");
      expect(loaded).toMatchObject({ docs: "docs-package", theme: "theme-package" });
      expect(transformed).toContain(themeFile);
      expect(transformed).not.toContain(docsFile);
    } finally {
      await server.close();
    }
  });

  it("bundles both docs packages into the server build", async () => {
    await installPackage("@farming-labs/docs", "docs-package");
    await installPackage("@farming-labs/theme", "theme-package");
    const output = await build({
      root,
      configFile: false,
      cacheDir: path.join(root, ".cache"),
      logLevel: "silent",
      plugins: [docsMdx()],
      build: { ssr: path.join(root, "entry.js"), write: false, minify: false },
    });
    if (!("output" in output)) throw new Error("Expected a single build output");
    const code = output.output
      .filter((item) => item.type === "chunk")
      .map((item) => item.code)
      .join("\n");
    expect(code).toContain('"docs-package"');
    expect(code).toContain('"theme-package"');
    expect(code).not.toMatch(/from ["']@farming-labs\//);
  });
});
