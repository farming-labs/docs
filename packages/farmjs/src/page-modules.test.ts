import { describe, expect, it, vi } from "vitest";
import { createFarmDocsPageModules, type FarmDocsMdxModule } from "./page-modules.js";

function mdx(name: string): FarmDocsMdxModule {
  return { default: () => name };
}

describe("Farm docs page modules", () => {
  it("loads only the page asked for, and only once", async () => {
    const guide = mdx("guide");
    const loadGuide = vi.fn(async () => guide);
    const loadApi = vi.fn(async () => mdx("api"));
    const modules = createFarmDocsPageModules({
      "/src/app/docs/guide/page.md": loadGuide,
      "/src/app/docs/api/page.md": loadApi,
    });
    const page = { sourcePath: "/guide/page.md", entry: "docs" };

    expect(modules.get(page)).toBeUndefined();
    await modules.load(page);
    await modules.load(page);

    expect(modules.get(page)).toBe(guide);
    expect(loadGuide).toHaveBeenCalledOnce();
    expect(loadApi).not.toHaveBeenCalled();
  });

  it("resolves production glob keys the way the module map does", async () => {
    const index = mdx("index");
    const modules = createFarmDocsPageModules({
      "./src/app/docs/page.md": async () => index,
      "/src/app/blog/page.md": async () => mdx("blog"),
    });
    const page = { sourcePath: "/page.md", entry: "docs" };

    await modules.load(page);

    expect(modules.get(page)).toBe(index);
  });

  it("leaves pages without a compiled module alone", async () => {
    const modules = createFarmDocsPageModules({});
    const page = { sourcePath: "/missing/page.md" };

    await expect(modules.load(page)).resolves.toBeUndefined();
    expect(modules.get(page)).toBeUndefined();
  });

  it("reports a module that fails to load and can try again", async () => {
    const guide = mdx("guide");
    const load = vi
      .fn<() => Promise<FarmDocsMdxModule>>()
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockResolvedValueOnce(guide);
    const modules = createFarmDocsPageModules({ "/guide/page.md": load });
    const page = { sourcePath: "/guide/page.md" };

    await expect(modules.load(page)).rejects.toThrow("chunk failed");
    expect(modules.get(page)).toBeUndefined();
    await modules.load(page);
    expect(modules.get(page)).toBe(guide);
  });
});
