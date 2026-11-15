import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  filterDocsPagesByAudience,
  isDocsPageVisibleToAudience,
  resolveDocsPageAudience,
} from "./audience-exposure.js";
import { createFilesystemDocsMcpSource } from "./mcp.js";
import { buildDocsSearchDocuments, performDocsSearch } from "./search.js";
import {
  buildDocsSitemapManifest,
  renderDocsSitemapMarkdown,
  renderDocsSitemapXml,
} from "./sitemap.js";
import type { DocsSearchSourcePage } from "./types.js";

const pages: DocsSearchSourcePage[] = [
  { title: "Install", url: "/docs/install", content: "Install the runbook tooling." },
  {
    title: "Release runbook",
    url: "/docs/release-runbook",
    audience: "agent",
    content: "Exact runbook steps an agent follows to cut a release.",
  },
];

describe("page audience helpers", () => {
  it("only treats the literal agent value as a restriction", () => {
    expect(resolveDocsPageAudience("agent")).toBe("agent");
    for (const value of [undefined, "human", "Agent", true, ["agent"]]) {
      expect(resolveDocsPageAudience(value)).toBeUndefined();
    }
    expect(isDocsPageVisibleToAudience({ audience: "agent" }, "human")).toBe(false);
    expect(isDocsPageVisibleToAudience({ audience: "agent" }, "agent")).toBe(true);
    expect(isDocsPageVisibleToAudience({ audience: "human" }, "human")).toBe(true);
    expect(filterDocsPagesByAudience(pages, "human").map((page) => page.url)).toEqual([
      "/docs/install",
    ]);
    expect(filterDocsPagesByAudience(pages, "agent")).toHaveLength(2);
  });
});

describe("agent-only pages in search", () => {
  const search = { provider: "simple" as const, chunking: { strategy: "page" as const } };

  it("keeps agent-only pages out of human search and in agent search", async () => {
    const human = await performDocsSearch({ pages, search, query: "runbook" });
    expect(human.map((result) => result.url)).toEqual(["/docs/install"]);

    const agent = await performDocsSearch({ pages, search, query: "runbook", audience: "agent" });
    expect(agent.map((result) => result.url)).toContain("/docs/release-runbook");
  });

  it("builds the human search projection without agent-only documents", () => {
    const urls = (audience: "human" | "agent") =>
      new Set(buildDocsSearchDocuments(pages, { strategy: "page" }, audience).map((d) => d.url));
    expect(urls("human").has("/docs/release-runbook")).toBe(false);
    expect(urls("agent").has("/docs/release-runbook")).toBe(true);
  });
});

describe("agent-only pages in sitemaps", () => {
  const manifest = buildDocsSitemapManifest({
    entry: "docs",
    baseUrl: "https://docs.example.com",
    generatedAt: "2026-11-14T00:00:00.000Z",
    pages,
  });

  it("leaves agent-only pages out of sitemap.xml", () => {
    const xml = renderDocsSitemapXml(manifest);
    expect(xml).toContain("https://docs.example.com/docs/install");
    expect(xml).not.toContain("release-runbook");
  });

  it("links agent-only pages to their Markdown in sitemap.md", () => {
    const markdown = renderDocsSitemapMarkdown(manifest);
    expect(markdown).toContain("- [Release runbook](/docs/release-runbook.md)");
    expect(markdown).not.toContain("(/docs/release-runbook)");
    expect(markdown).toContain("- [Install](/docs/install)");
  });
});

describe("agent-only pages in the filesystem source", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-agent-only-"));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  function write(name: string, content: string) {
    const file = path.join(rootDir, "docs", name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }

  it("lists agent-only pages for agents and marks their audience", async () => {
    write("page.md", "# Home");
    write("release-runbook/page.md", "---\ntitle: Release runbook\naudience: agent\n---\n# Steps");
    const docs = createFilesystemDocsMcpSource({ rootDir });
    const listed = await docs.getPages();
    const runbook = listed.find((page) => page.url === "/docs/release-runbook");
    expect(runbook?.audience).toBe("agent");
    expect(runbook?.title).toBe("Release runbook");
    expect(listed.find((page) => page.url === "/docs")?.audience).toBeUndefined();
    const navigation = JSON.stringify(await docs.getNavigation?.());
    expect(navigation).toContain('"/docs"');
    expect(navigation).not.toContain("release-runbook");
  });

  it("does not treat an agent-only child as a visible descendant of a hidden folder index", async () => {
    write(
      "guides/page.md",
      "---\ntitle: Guides\nsidebar:\n  folderIndexBehavior: hidden\n---\n# Guides",
    );
    write("guides/runbook/page.md", "---\ntitle: Runbook\naudience: agent\n---\n# Steps");
    const listed = await createFilesystemDocsMcpSource({ rootDir }).getPages();
    // With no human-visible child, the hidden folder index stays a real page.
    expect(listed.map((page) => page.url)).toContain("/docs/guides");
  });
});
