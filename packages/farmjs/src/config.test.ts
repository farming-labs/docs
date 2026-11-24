import { describe, expect, it } from "vitest";
import { withDocs } from "./config.js";

describe("withDocs", () => {
  it("enables Farm docs without mutating the input config", () => {
    const input = { preset: "vercel" } as const;
    const result = withDocs(input);

    expect(result).toMatchObject({
      preset: "vercel",
      docs: {
        enabled: true,
        adapter: {
          id: "@farming-labs/farmjs",
          protocol: 1,
          server: "@farming-labs/farmjs/server",
          react: "@farming-labs/farmjs/react",
          vite: "@farming-labs/farmjs/vite",
          edgeCompiler: "@farming-labs/farmjs/edge-compiler",
        },
      },
    });
    expect("docs" in input).toBe(false);
  });

  it("preserves native Farm docs options", () => {
    const result = withDocs({
      docs: {
        entry: "/guide",
        contentDir: "content/guide",
      },
    });

    expect(result.docs).toEqual({
      enabled: true,
      adapter: expect.objectContaining({ id: "@farming-labs/farmjs", protocol: 1 }),
      entry: "/guide",
      contentDir: "content/guide",
    });
  });

  it("merges adapter options after existing docs options", () => {
    const result = withDocs(
      {
        docs: {
          configPath: "legacy.config.ts",
          config: { entry: "docs", search: false },
        },
      },
      {
        configPath: "docs.config.ts",
        config: { search: true },
      },
    );

    expect(result.docs).toEqual({
      enabled: true,
      adapter: expect.objectContaining({ id: "@farming-labs/farmjs", protocol: 1 }),
      configPath: "docs.config.ts",
      config: { entry: "docs", search: true },
    });
  });

  it("names the React UI for Farm releases that read either field", () => {
    expect(withDocs({}).docs.adapter).toMatchObject({
      ui: "@farming-labs/farmjs/react",
      renderer: "react",
      react: "@farming-labs/farmjs/react",
    });
  });

  it("describes a docs UI written for another renderer", () => {
    const adapter = withDocs({}, { ui: { module: "@acme/leaf-docs", renderer: "leaf" } }).docs
      .adapter!;

    expect(adapter).toMatchObject({
      id: "@farming-labs/farmjs",
      protocol: 1,
      server: "@farming-labs/farmjs/server",
      ui: "@acme/leaf-docs",
      renderer: "leaf",
    });
    // Older Farm releases read `react` as the React UI, and the edge snapshot renders React.
    expect(adapter).not.toHaveProperty("react");
    expect(adapter).not.toHaveProperty("edgeCompiler");
  });

  it("builds docs pages with the app's renderer when it is not React", () => {
    const leaf = { name: "leaf", server: "farm-leaf/server", client: "farm-leaf/client" };
    const adapter = withDocs({ renderer: leaf }).docs.adapter!;

    expect(adapter).toMatchObject({ ui: "@farming-labs/farmjs/universal", renderer: "leaf" });
    expect(adapter).not.toHaveProperty("react");
    expect(adapter).not.toHaveProperty("edgeCompiler");
    // A React app, named or not, keeps the React UI; `ui` still wins over the default.
    expect(withDocs({ renderer: { name: "react" } }).docs.adapter).toMatchObject({
      ui: "@farming-labs/farmjs/react",
      renderer: "react",
    });
    expect(
      withDocs({ renderer: leaf }, { ui: { module: "@acme/leaf-docs", renderer: "leaf" } }).docs
        .adapter,
    ).toMatchObject({ ui: "@acme/leaf-docs" });
  });

  it("says why a shell has nothing to wrap on a renderer other than React", () => {
    const leaf = { name: "leaf", server: "farm-leaf/server", client: "farm-leaf/client" };
    expect(() => withDocs({ renderer: leaf }, { shell: "src/shell.tsx" })).toThrow(
      'the app renders with "leaf", so its docs use the renderer-neutral UI, which has no shell. ' +
        "Remove `shell`, or render what it adds in a UI of your own named with `ui`.",
    );
  });

  it("reports every problem with a docs UI at once", () => {
    expect(() =>
      withDocs({}, { ui: { module: "./docs-ui.ts", renderer: "" }, shell: "src/shell.tsx" }),
    ).toThrow(
      /^withDocs\(\): `ui.module` "\.\/docs-ui\.ts" is relative.*`ui.renderer` must name.*`shell` wraps/,
    );
    expect(() => withDocs({}, { ui: { module: "", renderer: "svelte" } })).toThrow(
      "`ui.module` must name the docs UI module",
    );
  });

  it("supports explicitly disabling the adapter", () => {
    expect(withDocs({}, { enabled: false }).docs).toMatchObject({
      enabled: false,
      adapter: { id: "@farming-labs/farmjs", protocol: 1 },
    });
  });

  it("registers the adapter-owned MDX and Agent Skills plugins before existing Vite plugins", () => {
    const existingPlugin = { name: "existing" };
    const result = withDocs({ vite: { plugins: [existingPlugin] } });

    expect(result.vite).toMatchObject({
      plugins: [
        expect.any(Array),
        expect.objectContaining({ name: "farming-labs-farmjs-agent-skills" }),
        expect.objectContaining({ name: "farming-labs-farmjs-shell" }),
        existingPlugin,
      ],
    });
  });

  it("forwards additional documentation roots to the adapter MDX plugin", () => {
    const result = withDocs({}, { contentRoots: ["../shared-docs"] });
    const plugins = (result.vite as { plugins: unknown[] }).plugins;
    const adapterPlugins = plugins[0] as Array<{
      config?: (config: object, env: { command: string; mode: string }) => Record<string, any>;
    }>;

    expect(
      adapterPlugins[0]?.config?.({}, { command: "serve", mode: "development" }),
    ).toMatchObject({
      server: {
        fs: {
          allow: expect.arrayContaining([expect.stringContaining("shared-docs")]),
        },
      },
    });
  });

  it("forwards the docs config's MDX plugins to the adapter MDX plugin", async () => {
    const result = withDocs(
      { docs: { config: { mdx: { remarkPlugins: ["./lib/remark-docs.mjs"] } } } },
      { buildCache: true, config: { entry: "docs" } },
    );
    const plugins = (result.vite as { plugins: unknown[] }).plugins;
    const [, compiler] = plugins[0] as Array<{ configResolved: (config: unknown) => unknown }>;

    await expect(
      compiler!.configResolved({ root: process.cwd(), command: "build", build: {} }),
    ).rejects.toThrow("`buildCache: true` cannot fingerprint the `mdx` plugins");
  });

  it("points the docs page shell at the module named by the shell option", () => {
    const result = withDocs({}, { shell: "src/docs-shell.tsx" });
    const plugins = (result.vite as { plugins: Array<{ name?: string; config?: Function }> })
      .plugins;
    const shellPlugin = plugins.find((plugin) => plugin?.name === "farming-labs-farmjs-shell");

    expect(shellPlugin?.config?.({ root: "/app" })).toMatchObject({
      resolve: { alias: [{ replacement: expect.stringContaining("src/docs-shell.tsx") }] },
    });
  });

  it("preserves functional Vite config while registering the MDX transform", () => {
    const existingPlugin = { name: "existing" };
    const result = withDocs({
      vite: (config) => ({ ...config, plugins: [existingPlugin] }),
    });

    expect(result.vite).toBeTypeOf("function");
    expect(
      (result.vite as (config: Record<string, unknown>) => Record<string, unknown>)({}),
    ).toMatchObject({
      plugins: [
        expect.any(Array),
        expect.objectContaining({ name: "farming-labs-farmjs-agent-skills" }),
        expect.objectContaining({ name: "farming-labs-farmjs-shell" }),
        existingPlugin,
      ],
    });
  });
});
