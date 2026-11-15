import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadDocsContent, loadDocsNavTree } from "../src/content.js";
import { createDocsServer } from "../src/server.js";

const page = (title: string, extra = "") =>
  `---\ntitle: ${title}\n${extra}---\n# ${title}\n\n${title} runbook body.`;
const agentOnly = "audience: agent\n";
const files: Record<string, string> = {
  "page.md": page("Home"),
  "guides/page.md": page("Guides"),
  "guides/install/page.md": page("Install"),
  "guides/release-runbook/page.md": page("Release runbook", agentOnly),
  "internal/page.md": page("Internal", agentOnly),
  "internal/visible/page.md": page("Visible child"),
};

const server = createDocsServer({
  entry: "docs",
  contentDir: "docs",
  telemetry: false,
  sitemap: true,
  _preloadedContent: Object.fromEntries(
    Object.entries(files).map(([name, source]) => [`/docs/${name}`, source]),
  ),
} as Parameters<typeof createDocsServer>[0]);

const load = (path: string) => server.load({ pathname: path });
const get = (path: string, init?: RequestInit) =>
  server.GET({ request: new Request(`https://site.test${path}`, init) });

function treeUrls(nodes: Array<Record<string, any>>): string[] {
  return nodes.flatMap((node) => [
    ...(typeof node.url === "string" ? [node.url] : []),
    ...(node.index?.url ? [node.index.url] : []),
    ...treeUrls(node.children ?? []),
  ]);
}

describe("audience: agent pages", () => {
  it("leaves agent-only pages out of the sidebar and prev/next links", async () => {
    const result = await load("/docs/guides/install");
    const urls = treeUrls(result.tree.children);
    expect(urls).toContain("/docs/guides/install");
    expect(urls).toContain("/docs/internal/visible");
    expect(urls).not.toContain("/docs/guides/release-runbook");
    expect(urls).not.toContain("/docs/internal");
    expect(result.flatPages.map((node: { url: string }) => node.url)).not.toContain(
      "/docs/guides/release-runbook",
    );
  });

  it("returns 404 for the HTML page of an agent-only page", async () => {
    await expect(load("/docs/guides/release-runbook")).rejects.toMatchObject({ status: 404 });
    await expect(load("/docs/guides/install")).resolves.toMatchObject({ title: "Install" });
  });

  it("serves agent-only pages as Markdown", async () => {
    const response = await get("/docs/guides/release-runbook.md");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Release runbook runbook body.");
  });

  it("keeps agent-only pages out of human search only", async () => {
    const urls = async (query: string) =>
      ((await (await get(`/api/docs?query=${query}`)).json()) as Array<{ url: string }>).map(
        (result) => result.url.split("#")[0],
      );
    expect(await urls("runbook")).not.toContain("/docs/guides/release-runbook");
    expect(await urls("runbook%20release&audience=agent")).toContain(
      "/docs/guides/release-runbook",
    );
  });

  it("lists agent-only pages in sitemap.md but not sitemap.xml", async () => {
    const xml = await (await get("/sitemap.xml")).text();
    expect(xml).toContain("/docs/guides/install");
    expect(xml).not.toContain("release-runbook");
    const markdown = await (await get("/sitemap.md")).text();
    expect(markdown).toContain("[Release runbook](/docs/guides/release-runbook.md)");
  });

  it("skips agent-only pages when building navigation from the filesystem", () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "docs-agent-only-"));
    try {
      for (const [name, source] of Object.entries(files)) {
        const file = path.join(rootDir, name);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, source);
      }
      const urls = treeUrls(loadDocsNavTree(rootDir, "docs").children);
      expect(urls).toEqual(expect.arrayContaining(["/docs", "/docs/guides/install"]));
      expect(urls).toContain("/docs/internal/visible");
      expect(urls).not.toContain("/docs/guides/release-runbook");
      expect(urls).not.toContain("/docs/internal");

      const runbook = loadDocsContent(rootDir, "docs").find(
        (entry) => entry.url === "/docs/guides/release-runbook",
      );
      expect(runbook?.audience).toBe("agent");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
