import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileFarmDocsEdgeManifest } from "./edge-compiler.js";

const roots: string[] = [];

async function createFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "farming-labs-farm-edge-"));
  roots.push(root);
  const contentDir = path.join(root, "content", "docs");
  await fs.mkdir(path.join(contentDir, "guide"), { recursive: true });
  await fs.writeFile(
    path.join(contentDir, "page.md"),
    "---\ntitle: Home\ndescription: Edge docs\n---\n\n# Home\n\nWelcome.\n",
  );
  await fs.writeFile(
    path.join(contentDir, "guide", "page.md"),
    "---\ntitle: Guide\n---\n\n# Guide\n\nBuild at the edge.\n",
  );
  return { root, contentDir };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("compileFarmDocsEdgeManifest", () => {
  it("precompiles pages, navigation, CSS, and custom API routes without build paths", async () => {
    const { root, contentDir } = await createFixture();
    const manifest = await compileFarmDocsEdgeManifest(
      {
        entry: "docs",
        docsPath: "/docs",
        contentDir,
        nav: { title: "Edge Docs" },
        cloud: { apiRoute: "/internal/docs" },
        search: true,
        mcp: false,
        telemetry: false,
        ai: { enabled: false },
      },
      {
        rootDir: root,
        clientEntry: "/farm-client.js",
        stylesheets: ["/farm-fonts.css", "/assets/globals.css"],
      },
    );

    expect(manifest).toMatchObject({
      protocol: 1,
      entry: "/docs",
      apiPath: "/internal/docs",
      api: { search: { siteTitle: "Edge Docs" } },
    });
    expect(manifest.routes["/docs"]?.body).toContain("Home");
    expect(manifest.routes["/docs"]?.body).toContain("Welcome.");
    expect(manifest.routes["/docs"]?.body).not.toContain("Page module missing");
    expect(manifest.routes["/docs/guide.md"]?.body).toContain("# Guide");
    expect(manifest.routes["/__farm_docs/browser.css"]?.headers).toContainEqual([
      "content-type",
      "text/css; charset=utf-8",
    ]);
    expect(JSON.parse(manifest.navigation["/docs/guide"]!.body)).toMatchObject({
      data: { title: "Guide", url: "/docs/guide" },
    });
    expect(manifest.api.markdown.guide?.body).toContain("# Guide");
    expect(JSON.stringify(manifest)).not.toContain(root);
    expect(JSON.stringify(manifest)).not.toContain(contentDir);
  });

  it("rejects runtime-only features instead of silently dropping them", async () => {
    const { root, contentDir } = await createFixture();

    await expect(
      compileFarmDocsEdgeManifest(
        { entry: "docs", contentDir, telemetry: false },
        { rootDir: root, clientEntry: "/farm-client.js", stylesheets: [] },
      ),
    ).rejects.toThrow("runtime-only docs features for an edge deployment: mcp");
  });
});
