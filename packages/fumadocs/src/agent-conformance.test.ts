import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDocsAgentConformance } from "@farming-labs/docs";
import { createDocsAPI, createDocsMCPAPI } from "./docs-api.js";

describe("Next.js agent surface contract", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("conforms to the shared public agent contract", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-agent-conformance-next-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs", "en"), { recursive: true });
    mkdirSync(join(rootDir, "app", "docs", "fr"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "en", "page.mdx"),
      `---\ntitle: Introduction\ndescription: Start here.\n---\n\n# Introduction\n\nWelcome.`,
    );
    writeFileSync(
      join(rootDir, "app", "docs", "fr", "page.mdx"),
      `---\ntitle: Introduction\n---\n\n# Introduction\n\nBonjour.`,
    );

    const options = {
      rootDir,
      entry: "docs",
      nav: { title: "Conformance Docs" },
      i18n: { locales: ["en", "fr"], defaultLocale: "en" },
      mcp: true,
      sitemap: true,
      robots: true,
    };
    const docs = createDocsAPI(options);
    const mcp = createDocsMCPAPI(options);

    const report = await runDocsAgentConformance({
      adapter: "next",
      async handle(request, surface) {
        if (surface === "mcp-initialize") return mcp.POST(request);
        return docs.GET(request);
      },
    });

    expect(report.cases.filter((result) => !result.passed)).toEqual([]);
    expect(report.passed).toBe(true);
  });
});
