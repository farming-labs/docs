import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fingerprintMdxPlugins, readMdxPluginFingerprint } from "./mdx-plugin-fingerprint.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});

async function app() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "farm-docs-plugins-")));
  roots.push(root);
  const write = async (file: string, content: string) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  };
  await write("package.json", JSON.stringify({ name: "app", type: "module" }));
  await write(
    "node_modules/highlight-kit/package.json",
    JSON.stringify({ name: "highlight-kit", type: "module", exports: { import: "./index.js" } }),
  );
  await write("node_modules/highlight-kit/index.js", "export const theme = 'one';");
  await write("lib/helper.mjs", "export const marker = 1;");
  await write(
    "lib/remark-docs.mjs",
    [
      'import { marker } from "./helper.mjs";',
      'import { theme } from "highlight-kit";',
      'import path from "node:path";',
      "export default () => () => [marker, theme, path.sep];",
    ].join("\n"),
  );
  await write("lib/unrelated.mjs", "export const other = 1;");
  return { root, write };
}

describe("readMdxPluginFingerprint", () => {
  it("changes with the plugins' own source, packages and options, and nothing else", async () => {
    const { root, write } = await app();
    const options = { remarkPlugins: ["./lib/remark-docs.mjs"] };
    const initial = await readMdxPluginFingerprint(options, root);
    expect(initial).toMatch(/^[0-9a-f]{64}$/);

    await write("lib/unrelated.mjs", "export const other = 2;");
    expect(await readMdxPluginFingerprint(options, root)).toBe(initial);

    await write("lib/helper.mjs", "export const marker = 2;");
    const helperEdited = await readMdxPluginFingerprint(options, root);
    expect(helperEdited).not.toBe(initial);

    await write("node_modules/highlight-kit/index.js", "export const theme = 'two';");
    const packageEdited = await readMdxPluginFingerprint(options, root);
    expect(packageEdited).not.toBe(helperEdited);

    expect(
      await readMdxPluginFingerprint(
        { remarkPlugins: [["./lib/remark-docs.mjs", { a: 1 }]] },
        root,
      ),
    ).not.toBe(packageEdited);
  });

  it("disables reuse when a plugin imports a module it names at runtime", async () => {
    const { root, write } = await app();
    await write(
      "lib/remark-docs.mjs",
      "const name = './helper.mjs'; export default async () => (await import(name)).marker;",
    );
    expect(await readMdxPluginFingerprint({ remarkPlugins: ["./lib/remark-docs.mjs"] }, root)).toBe(
      undefined,
    );
  });

  it("stops reuse once a plugin changes under the process that loaded it", async () => {
    const { root, write } = await app();
    const options = { remarkPlugins: ["./lib/remark-docs.mjs"] };
    const loaded = await fingerprintMdxPlugins(options, root);
    expect(loaded).toMatch(/^[0-9a-f]{64}$/);
    expect(await fingerprintMdxPlugins(options, root)).toBe(loaded);

    await write("lib/helper.mjs", "export const marker = 3;");
    expect(await fingerprintMdxPlugins(options, root)).toBeUndefined();
  });
});
