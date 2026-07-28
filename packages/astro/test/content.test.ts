import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadDocsContent } from "../src/content.js";

describe("loadDocsContent", () => {
  it("tracks the explicit agent.md modified time separately from the page source", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "farming-labs-astro-content-"));

    try {
      const pageDir = join(rootDir, "guide");
      const pagePath = join(pageDir, "page.mdx");
      const agentPath = join(pageDir, "agent.md");
      mkdirSync(pageDir, { recursive: true });
      writeFileSync(
        pagePath,
        "---\ntitle: Guide\nlastmod: 2026-07-17\n---\n\n# Guide\n\nHuman source.\n",
      );
      writeFileSync(agentPath, "# Guide\n\nAgent source.\n");

      const pageModified = new Date("2026-07-18T08:00:00.000Z");
      const agentModified = new Date("2026-07-19T09:30:00.000Z");
      utimesSync(pagePath, pageModified, pageModified);
      utimesSync(agentPath, agentModified, agentModified);

      expect(loadDocsContent(rootDir)).toEqual([
        expect.objectContaining({
          url: "/docs/guide",
          lastmod: "2026-07-17T00:00:00.000Z",
          lastModified: pageModified.toISOString(),
          agentLastModified: agentModified.toISOString(),
          agentRawContent: "# Guide\n\nAgent source.\n",
        }),
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
