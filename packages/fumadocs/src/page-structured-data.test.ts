import { describe, expect, it } from "vitest";
import {
  renderDocsPageStructuredDataJson,
  type DocsPageStructuredDataInput,
} from "@farming-labs/docs";
import { compactPageStructuredData, renderPageStructuredData } from "./page-structured-data.js";

describe("compact structured data", () => {
  const cases: DocsPageStructuredDataInput[] = [
    { title: "Home", url: "/docs" },
    {
      title: "Install",
      description: "Setup",
      url: "/docs/guides/install?lang=fr",
      baseUrl: "https://example.com",
      dateModified: "2026-09-29",
    },
    { title: "Root", url: "/", entry: "guide", baseUrl: "https://example.com/" },
    {
      title: "</script><script>alert(1)</script>",
      description: "Unicode 日本語",
      url: "/docs/日本語",
      dateModified: "unknown",
    },
    {
      title: "Custom",
      url: "/guide/a",
      entry: "guide",
      breadcrumbs: [{ name: "Different", url: "/custom" }],
    },
    {
      title: "Agent",
      description: "Install",
      url: "/docs/agent",
      agent: {
        task: "Configure",
        outcome: "Ready",
        commands: [{ run: "pnpm dev", cwd: "app", description: "Start" }],
        verification: [{ run: "curl localhost", expect: "200" }],
        files: ["app.ts"],
        prerequisites: ["Node"],
        appliesTo: { framework: "Next" },
        rollback: ["Unused rollback"],
        access: { visibility: "authenticated" },
        tokenBudget: 123,
      },
    },
  ];
  it.each(cases)("preserves existing JSON-LD for $url", (input) => {
    const compact = {
      baseUrl: input.baseUrl,
      entry: input.entry,
      pages: { [input.url]: compactPageStructuredData(input) },
    };
    const json = renderPageStructuredData(compact, input.url)!;
    expect(JSON.parse(json)).toEqual(JSON.parse(renderDocsPageStructuredDataJson(input)));
    expect(json).not.toContain("</script>");
    expect(JSON.stringify(compact)).not.toContain("Unused rollback");
    expect(JSON.stringify(compact)).not.toContain('"visibility"');
    expect(JSON.stringify(compact)).not.toContain('"tokenBudget"');
  });

  it("selects the current route without leaking a previous or missing page", () => {
    const data = {
      pages: {
        "/docs/a": compactPageStructuredData({ title: "A", url: "/docs/a" }),
        "/docs/b": compactPageStructuredData({ title: "B", url: "/docs/b" }),
      },
    };
    expect(JSON.parse(renderPageStructuredData(data, "/docs/a")!).headline).toBe("A");
    expect(JSON.parse(renderPageStructuredData(data, "/docs/b")!).headline).toBe("B");
    expect(renderPageStructuredData(data, "/missing")).toBeUndefined();
    expect(renderPageStructuredData(undefined, "/docs/a")).toBeUndefined();
  });
});
