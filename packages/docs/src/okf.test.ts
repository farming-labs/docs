import { describe, expect, it } from "vitest";
import {
  buildDocsOkfBundle,
  normalizeDocsOkfTrustMetadataInput,
  resolveDocsOkfConfig,
  resolveDocsOkfTrustMetadata,
} from "./okf.js";
import { renderDocsMarkdownDocument } from "./agent.js";

describe("OKF trust metadata", () => {
  it("normalizes OKF v0.2 provenance without accepting malformed records", () => {
    expect(
      normalizeDocsOkfTrustMetadataInput({
        sources: [
          {
            resource: " https://docs.example.com/source ",
            usage_count: 3,
            usage_window: {
              start: "2026-01-01",
              end: "2026-02-01",
            },
          },
          { title: "missing resource" },
        ],
        generated: { by: " software:generator ", at: "2026-02-02" },
        verified: [{ by: "human:docs-team", at: "2026-02-03" }, { by: "bad" }],
        status: "stable",
        stale_after: "2026-05-01",
      }),
    ).toEqual({
      sources: [
        {
          resource: "https://docs.example.com/source",
          usage_count: 3,
          usage_window: {
            start: "2026-01-01T00:00:00.000Z",
            end: "2026-02-01T00:00:00.000Z",
          },
        },
      ],
      generated: { by: "software:generator", at: "2026-02-02T00:00:00.000Z" },
      verified: [{ by: "human:docs-team", at: "2026-02-03T00:00:00.000Z" }],
      status: "stable",
      stale_after: "2026-05-01",
    });
  });

  it("derives conservative trust tiers and an explicit staleness result", () => {
    const trust = resolveDocsOkfTrustMetadata(
      {
        url: "/docs/install",
        canonicalUrl: "https://docs.example.com/docs/install",
        sourcePath: "docs/install/page.mdx",
        title: "Install",
        lastmod: "2026-01-01",
        okf: {
          verified: [{ by: "human:docs-team", at: "2026-01-02" }],
        },
      },
      { staleAfterDays: 30 },
      new Date("2026-03-01T00:00:00.000Z"),
    );

    expect(trust).toMatchObject({
      trust_tier: "human-reviewed",
      stale_after: "2026-01-31",
      stale: true,
      sources: [
        {
          resource: "https://docs.example.com/docs/install",
          id: "docs/install/page.mdx",
        },
      ],
    });
  });

  it("builds a deterministic, URL-sorted knowledge bundle", () => {
    const bundle = buildDocsOkfBundle(
      [
        { url: "/docs/z", title: "Z", content: "z", lastmod: "2026-02-01" },
        { url: "/docs/a", title: "A", content: "a", lastmod: "2026-01-01" },
      ],
      true,
    );

    expect(bundle.format).toBe("open-knowledge-format.v0.2");
    expect(bundle.spec_version).toBe("0.2");
    expect(bundle.documents.map((document) => document.url)).toEqual(["/docs/a", "/docs/z"]);
    expect(bundle.generated.at).toBe("2026-02-01T00:00:00.000Z");
    expect(resolveDocsOkfConfig(undefined).enabled).toBe(false);
  });

  it("surfaces trust metadata in the Markdown representation when enabled", () => {
    const markdown = renderDocsMarkdownDocument(
      {
        url: "/docs/install",
        title: "Install",
        content: "Run the installer.",
        lastmod: "2026-01-01",
      },
      { origin: "https://docs.example.com", okf: true },
    );

    expect(markdown).toContain('okf: {"sources":');
    expect(markdown).toContain('"resource":"https://docs.example.com/docs/install"');
    expect(markdown).toContain('"trust_tier":"unverified"');
  });
});
