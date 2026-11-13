import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { docsMdx, type FarmDocsMdxOptions } from "./vite.js";

let root: string;
const plugin = (name: string, source: string) => fs.writeFile(path.join(root, "lib", name), source);

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "farm-mdx-plugins-"));
  await fs.mkdir(path.join(root, "lib"));
  await fs.writeFile(
    path.join(root, "page.mdx"),
    "# Plugins\n\nplain text\n\n```ts\nconst answer = 42;\n```\n",
  );
  await plugin(
    "remark-note.mjs",
    `export default function remarkNote() {
  return (tree) => {
    tree.children.push({ type: "paragraph", children: [{ type: "text", value: "remark-plugin-ran" }] });
  };
}`,
  );
  await plugin(
    "rehype-note.mjs",
    `export default function rehypeNote(options) {
  return (tree) => {
    tree.children.push({ type: "element", tagName: "p", properties: {}, children: [{ type: "text", value: "rehype-" + options.label }] });
  };
}`,
  );
  await plugin(
    "rehype-plain-code.mjs",
    `export default function rehypePlainCode() {
  const visit = (node) => {
    if (node.tagName === "pre") node.properties = { ...node.properties, dataHighlighter: "app" };
    node.children?.forEach(visit);
  };
  return visit;
}`,
  );
  await plugin("not-a-plugin.mjs", "export default 42;");
});
afterEach(() => fs.rm(root, { recursive: true, force: true }));

async function bundle(options: FarmDocsMdxOptions) {
  const output = await build({
    root,
    configFile: false,
    cacheDir: path.join(root, ".cache"),
    logLevel: "silent",
    plugins: [docsMdx(options)],
    build: {
      write: false,
      minify: false,
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

const docsConfig = (source: string) => fs.writeFile(path.join(root, "docs.config.ts"), source);

describe("docsMdx app plugins", { timeout: 20_000 }, () => {
  it("runs the docs config's remark and rehype plugins after the built-in ones", async () => {
    await docsConfig(`export default {
  entry: "docs",
  mdx: {
    remarkPlugins: ["./lib/remark-note.mjs"],
    rehypePlugins: [["./lib/rehype-note.mjs", { label: "with-options" }]],
  },
};`);
    const code = await bundle({});

    expect(code).toContain("remark-plugin-ran");
    expect(code).toContain("rehype-with-options");
    expect(code).toContain("--shiki-light");
    expect(code).toMatch(/\btoc\b/);
  });

  it("replaces only the code highlighter", async () => {
    const code = await bundle({
      config: { mdx: { codeHighlighter: "./lib/rehype-plain-code.mjs" } },
    });

    expect(code).toContain('"data-highlighter": "app"');
    expect(code).not.toContain("--shiki-light");
    expect(code).toMatch(/\btoc\b/);
  });

  it("lets the inline config replace the file's plugins", async () => {
    await docsConfig(
      'export default { entry: "docs", mdx: { remarkPlugins: ["./lib/remark-note.mjs"] } };',
    );

    expect(await bundle({ config: { mdx: undefined } })).not.toContain("remark-plugin-ran");
  });

  it("reads the docs config at configPath", async () => {
    await fs.mkdir(path.join(root, "config"));
    await fs.writeFile(
      path.join(root, "config", "docs.ts"),
      'export default { entry: "docs", mdx: { remarkPlugins: ["./lib/remark-note.mjs"] } };',
    );

    expect(await bundle({ configPath: "config/docs.ts" })).toContain("remark-plugin-ran");
    await expect(bundle({ configPath: "config/missing.ts" })).rejects.toThrow(
      "Could not find docs config at config/missing.ts",
    );
  });

  it("compiles every production build rather than reusing output it cannot fingerprint", async () => {
    const cacheFile = path.join(root, ".cache", "farming-docs", "mdx-v1.json");

    await bundle({ config: { mdx: { remarkPlugins: ["./lib/remark-note.mjs"] } } });
    await expect(fs.access(cacheFile)).rejects.toThrow();
    await bundle({});
    await expect(fs.access(cacheFile)).resolves.toBeUndefined();
  });

  it("rejects an explicit build cache alongside app plugins", async () => {
    await expect(
      bundle({ buildCache: true, config: { mdx: { remarkPlugins: ["./lib/remark-note.mjs"] } } }),
    ).rejects.toThrow("`buildCache: true` cannot be combined with `mdx` plugins");
  });

  it("rejects a plugin that is not a module or a [module, options] tuple", async () => {
    await expect(
      bundle({ config: { mdx: { rehypePlugins: [["./lib/rehype-note.mjs", {}, {}] as never] } } }),
    ).rejects.toThrow("`mdx.rehypePlugins[0]` must be an MDX plugin module name or path");
  });

  it("names a plugin it cannot load", async () => {
    await expect(
      bundle({ config: { mdx: { remarkPlugins: ["./lib/missing.mjs"] } } }),
    ).rejects.toThrow('Could not resolve the MDX plugin "./lib/missing.mjs"');
    await expect(
      bundle({ config: { mdx: { remarkPlugins: ["./lib/not-a-plugin.mjs"] } } }),
    ).rejects.toThrow(
      'The MDX plugin "./lib/not-a-plugin.mjs" must default-export a unified plugin',
    );
  });

  it("refuses a docs config it cannot evaluate only when it sets mdx", async () => {
    await docsConfig(
      'import "./missing-module.js";\nexport default { entry: "docs", mdx: { remarkPlugins: ["./lib/remark-note.mjs"] } };',
    );
    await expect(bundle({})).rejects.toThrow("to read its `mdx` plugins");

    await docsConfig('import "./missing-module.js";\nexport default { entry: "docs" };');
    expect(await bundle({})).toContain("--shiki-light");
  });
});
