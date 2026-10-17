import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { build, type Plugin, type ResolvedConfig } from "vite";
import { docsMdx } from "./vite.js";
import * as fingerprint from "./mdx-compiler-fingerprint.js";

const { compiled } = vi.hoisted(() => ({ compiled: vi.fn() }));
vi.mock("@mdx-js/rollup", async (original) => {
  const actual = await original<typeof import("@mdx-js/rollup")>();
  return {
    ...actual,
    default: (...args: Parameters<typeof actual.default>) => {
      const plugin = actual.default(...args);
      return {
        ...plugin,
        transform(...input: Parameters<typeof plugin.transform>) {
          if (/\.mdx?$/.test(input[1])) compiled(input[1]);
          return plugin.transform(...input);
        },
      };
    },
  };
});

let root: string;
const source =
  "# Cached page\n\nimport Demo from './demo.tsx'\n\n<Demo />\n\n```ts\nconst answer = 42;\n```\n";
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "farm-mdx-vite-"));
  await fs.writeFile(path.join(root, "page.mdx"), source);
  await fs.writeFile(
    path.join(root, "demo.tsx"),
    "export default function Demo(){return 'before-component-edit'}",
  );
  compiled.mockClear();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

async function bundle(
  options: Parameters<typeof docsMdx>[0] = {},
  mode = "production",
  plugins = docsMdx(options),
) {
  const output = await build({
    root,
    mode,
    configFile: false,
    cacheDir: path.join(root, ".cache"),
    logLevel: "silent",
    plugins: [plugins],
    build: {
      write: false,
      minify: false,
      sourcemap: true,
      rollupOptions: {
        input: path.join(root, "page.mdx"),
        external: [/^react\//],
        preserveEntrySignatures: "strict",
      },
    },
  });
  if (!("output" in output)) throw new Error("Expected a single build output");
  return output.output
    .filter((item) => item.type === "chunk")
    .map((item) => item.code)
    .join("\n");
}

describe("Farm MDX production cache", () => {
  it("keys the captured compiler themes rather than a later mutation of the options", async () => {
    const options = { codeBlockThemes: { dark: "github-dark" } };
    const original = docsMdx(options);
    options.codeBlockThemes.dark = "vesper";
    const originalOutput = await bundle({}, "production", original);
    expect(await bundle(options)).not.toBe(originalOutput);
    expect(compiled).toHaveBeenCalledTimes(2);
  });

  it("disables reuse when the same plugin is configured again with caching off", async () => {
    const options = { buildCache: true };
    const plugin = docsMdx(options);
    await bundle({}, "production", plugin);
    options.buildCache = false;
    await bundle({}, "production", plugin);
    expect(compiled).toHaveBeenCalledTimes(2);
  });

  it("preserves build output while skipping MDX compilation in a subsequent build", async () => {
    const cold = await bundle();
    expect(compiled).toHaveBeenCalledTimes(1);
    expect(await bundle()).toBe(cold);
    expect(compiled).toHaveBeenCalledTimes(1);
  });

  it("recompiles edited MDX and changed themes", async () => {
    const cold = await bundle();
    await fs.writeFile(path.join(root, "page.mdx"), source.replace("Cached page", "Edited page"));
    expect(await bundle()).toContain("Edited page");
    expect(compiled).toHaveBeenCalledTimes(2);
    const themed = await bundle({
      codeBlockThemes: { light: "github-light-default", dark: "vesper" },
    });
    expect(themed).not.toBe(cold);
    expect(compiled).toHaveBeenCalledTimes(3);
  });

  it("rebuilds imported components even when their importing MDX is cached", async () => {
    await bundle();
    await fs.writeFile(
      path.join(root, "demo.tsx"),
      "export default function Demo(){return 'after-component-edit'}",
    );
    const output = await bundle();
    expect(output).toContain("after-component-edit");
    expect(output).not.toContain("before-component-edit");
    expect(compiled).toHaveBeenCalledTimes(1);
    await fs.unlink(path.join(root, "demo.tsx"));
    await expect(bundle()).rejects.toThrow();
  });

  it("supports opting out and preserves compilation errors after a successful build", async () => {
    await bundle();
    await bundle({ buildCache: false });
    expect(compiled).toHaveBeenCalledTimes(2);
    await fs.writeFile(path.join(root, "page.mdx"), "# Broken\n\n<Unclosed>");
    await expect(bundle()).rejects.toThrow();
    await fs.writeFile(path.join(root, "page.mdx"), source);
    expect(await bundle()).toContain("Cached page");
  });

  it("separates production and development-mode builds", async () => {
    const production = await bundle();
    const development = await bundle({}, "development");
    expect(development).not.toBe(production);
    expect(compiled).toHaveBeenCalledTimes(2);
    expect(await bundle({}, "development")).toBe(development);
    expect(compiled).toHaveBeenCalledTimes(2);
  });

  it("recompiles when a compiler fingerprint changes or cannot be established", async () => {
    const version = vi
      .spyOn(fingerprint, "fingerprintMdxCompiler")
      .mockResolvedValue("compiler-v1");
    await bundle();
    version.mockResolvedValue("compiler-v2");
    await bundle();
    expect(compiled).toHaveBeenCalledTimes(2);
    version.mockResolvedValue(undefined);
    await bundle();
    await bundle();
    expect(compiled).toHaveBeenCalledTimes(4);
  });

  it.each(["serve", "watch"])("does not cache %s transforms", async (mode) => {
    const plugins = docsMdx() as Plugin[];
    const plugin = plugins.find((p) => p.name === "@mdx-js/rollup")!;
    const config = {
      root,
      mode: "production",
      command: mode === "serve" ? "serve" : "build",
      cacheDir: path.join(root, ".cache"),
      build: { watch: mode === "watch" ? {} : null },
    } as ResolvedConfig;
    const context = { environment: { config } };
    const hook = (value: unknown): Function =>
      typeof value === "function" ? value : (value as { handler: Function }).handler;
    await hook(plugin.config).call(context, {}, { mode: "production" });
    await hook(plugin.configResolved).call(context, config);
    for (let i = 0; i < 2; i++)
      await hook(plugin.transform).call(context, source, path.join(root, "page.mdx"));
    await hook(plugin.buildEnd).call(context);
    expect(compiled).toHaveBeenCalledTimes(2);
    await expect(fs.stat(path.join(root, ".cache"))).rejects.toThrow();
  });
});
