import { afterEach, describe, expect, it } from "vitest";
import {
  docsMdx,
  remarkStandaloneCodeLabels,
  resolveFarmDocsCodeBlockThemes,
  resolveFarmDocsViteContentRoots,
} from "./vite.js";

const paragraphLabel = (value: string) => ({
  type: "paragraph",
  children: [{ type: "strong", children: [{ type: "text", value }] }],
});

describe("remarkStandaloneCodeLabels", () => {
  it("turns a standalone file label into code-block title metadata", () => {
    const tree = {
      type: "root",
      children: [paragraphLabel("src/app/page.tsx"), { type: "code", lang: "tsx", value: "x" }],
    };

    remarkStandaloneCodeLabels()(tree);

    expect(tree.children).toEqual([
      expect.objectContaining({
        type: "code",
        meta: 'title="src/app/page.tsx"',
      }),
    ]);
  });

  it("removes redundant terminal labels without adding a framed title", () => {
    const tree = {
      type: "root",
      children: [paragraphLabel("Terminal"), { type: "code", lang: "bash", value: "pnpm dev" }],
    };

    remarkStandaloneCodeLabels()(tree);

    expect(tree.children).toHaveLength(1);
    expect(tree.children[0]).toMatchObject({ type: "code", lang: "bash" });
    expect(tree.children[0]).not.toHaveProperty("meta");
  });
});

describe("resolveFarmDocsCodeBlockThemes", () => {
  it("preserves the Farm adapter defaults", () => {
    expect(resolveFarmDocsCodeBlockThemes()).toEqual({
      light: "github-light",
      dark: "github-dark",
    });
  });

  it("allows a Farm app to opt into Vesper without replacing the MDX pipeline", () => {
    expect(
      resolveFarmDocsCodeBlockThemes({
        light: "github-light-default",
        dark: "vesper",
      }),
    ).toEqual({
      light: "github-light-default",
      dark: "vesper",
    });
  });
});

describe("resolveFarmDocsViteContentRoots", () => {
  it("allows a nested Farm application to compile repository-owned documentation", () => {
    const applicationRoot = new URL("../../../fixtures/site", import.meta.url).pathname;
    const roots = resolveFarmDocsViteContentRoots(applicationRoot);

    expect(roots).toContain(applicationRoot);
    expect(roots).toContain(new URL("../../../", import.meta.url).pathname.replace(/\/$/, ""));
  });

  it("resolves explicit external content roots from the application directory", () => {
    const applicationRoot = new URL("../../../fixtures/site", import.meta.url).pathname;

    expect(resolveFarmDocsViteContentRoots(applicationRoot, ["../shared-docs"])).toContain(
      new URL("../../../fixtures/shared-docs", import.meta.url).pathname.replace(/\/$/, ""),
    );
  });
});

describe("docsMdx workspace sources", () => {
  const configOf = () => {
    const [workspacePlugin] = docsMdx() as Array<{ config: () => Record<string, any> }>;
    return workspacePlugin.config();
  };

  afterEach(() => {
    delete process.env.FARMING_LABS_DOCS_SOURCE;
  });

  it("lets apps in this repository run the built packages", () => {
    expect(configOf().resolve).toBeUndefined();
  });

  it("points the docs packages at their sources when asked to", () => {
    process.env.FARMING_LABS_DOCS_SOURCE = "1";
    const aliases = configOf().resolve.alias as Array<{ find: RegExp; replacement: string }>;
    const docs = aliases.find((alias) => alias.find.test("@farming-labs/docs"));
    expect(docs?.replacement).toMatch(/packages\/docs\/src\/index\.ts$/);
  });
});
