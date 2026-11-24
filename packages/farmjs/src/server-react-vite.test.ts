import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { docsMdx } from "./vite.js";

let root: string;

async function write(file: string, contents: string) {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), contents);
}

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "farm-docs-server-react-")));
  // A stand-in for preact/compat, which @preact/preset-vite aliases `react` to.
  await write(
    "node_modules/react-compat/package.json",
    JSON.stringify({
      name: "react-compat",
      type: "module",
      exports: { ".": "./index.js", "./jsx-runtime": "./jsx.js", "./jsx-dev-runtime": "./jsx.js" },
    }),
  );
  await write(
    "node_modules/react-compat/index.js",
    'export const marker = "compat";\nexport function createElement() {}\n',
  );
  await write(
    "node_modules/react-compat/jsx.js",
    "export const Fragment = {};\nexport const jsx = () => ({});\nexport const jsxs = jsx;\nexport const jsxDEV = jsx;\n",
  );
  await write(
    "node_modules/@farming-labs/theme/package.json",
    JSON.stringify({ name: "@farming-labs/theme", type: "module", exports: { ".": "./index.js" } }),
  );
  await write(
    "node_modules/@farming-labs/theme/index.js",
    'export { createElement } from "react";\n',
  );
  await write("page.md", "# Hello\n");
  await write(
    "entry.js",
    `export { createElement as themeCreateElement } from "@farming-labs/theme";
export { default as Page } from "./page.md";
export { marker as appReact } from "react";
`,
  );
});
afterEach(() => fs.rm(root, { recursive: true, force: true }));

describe("docsMdx server React", { timeout: 20_000 }, () => {
  it("renders docs pages with React in development while the app points react elsewhere", async () => {
    const server = await createServer({
      root,
      configFile: false,
      cacheDir: path.join(root, ".cache"),
      logLevel: "silent",
      plugins: [docsMdx()],
      resolve: { alias: { react: "react-compat" } },
      server: { middlewareMode: true, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const loaded = await server.ssrLoadModule("/entry.js");
      expect(loaded.appReact).toBe("compat");
      expect(loaded.themeCreateElement).toBe(React.createElement);
      expect(renderToStaticMarkup(React.createElement(loaded.Page))).toBe(
        '<h1 id="hello">Hello</h1>',
      );
    } finally {
      await server.close();
    }
  });

  it("leaves react to Vite when the app does not alias it", async () => {
    await write(
      "node_modules/react/package.json",
      JSON.stringify({ name: "react", type: "module", exports: { ".": "./index.js" } }),
    );
    await write("node_modules/react/index.js", "export function createElement() {}\n");
    const server = await createServer({
      root,
      configFile: false,
      cacheDir: path.join(root, ".cache"),
      logLevel: "silent",
      plugins: [docsMdx()],
      server: { middlewareMode: true, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const resolved = await server.environments.ssr.pluginContainer.resolveId(
        "react",
        path.join(root, "node_modules/@farming-labs/theme/index.js"),
      );
      expect(resolved?.id).toBe(path.join(root, "node_modules/react/index.js"));
    } finally {
      await server.close();
    }
  });
});
