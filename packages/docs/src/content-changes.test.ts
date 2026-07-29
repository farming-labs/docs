import { describe, expect, it, vi } from "vitest";
import type { DocsContentSnapshot, DocsSearchSourcePage } from "./types.js";
import {
  createDocsContentChangeFeed,
  createDocsContentChangesHttpResponse,
  resolveDocsContentChangesConfig,
  resolveDocsContentChangesRequest,
} from "./content-changes.js";
import { buildDocsContentSnapshot, performDocsSearchWithMetadata } from "./search.js";

const digestPattern = /^sha256:[a-f\d]{64}$/u;
const baseUrl = "https://docs.example.com";

function pages(version = 1): DocsSearchSourcePage[] {
  if (version === 1) {
    return [
      {
        title: "Install",
        url: "/docs/install",
        content: "Install version one.",
        rawContent: "# Install\n\nInstall version one.",
        lastmod: "2026-07-01",
      },
      {
        title: "Removed",
        url: "/docs/removed",
        content: "This page will be removed.",
        rawContent: "# Removed\n\nThis page will be removed.",
        lastmod: "2026-07-02",
      },
    ];
  }
  return [
    {
      title: "Install",
      url: "/docs/install",
      content: "Install version two.",
      rawContent: "# Install\n\nInstall version two.",
      lastmod: "2026-07-03",
    },
    {
      title: "Added",
      url: "/docs/added",
      content: "This page was added.",
      rawContent: "# Added\n\nThis page was added.",
      lastmod: "2026-07-04",
    },
  ];
}

describe("agent content change feed", () => {
  it("uses the structured-search generation for the same content projection", async () => {
    const snapshot = await buildDocsContentSnapshot({
      pages: pages(),
      audience: "agent",
      baseUrl,
      search: { provider: "simple", chunking: { strategy: "page" } },
    });
    const search = await performDocsSearchWithMetadata({
      pages: pages(),
      query: "install",
      audience: "agent",
      baseUrl,
      search: { provider: "simple", chunking: { strategy: "page" } },
    });

    expect(snapshot.indexGeneration).toBe(search.indexGeneration);
    expect(snapshot.documents).toEqual([
      {
        url: "/docs/install",
        canonicalUrl: "https://docs.example.com/docs/install",
        digest: expect.stringMatching(digestPattern),
        lastModified: "2026-07-01",
      },
      {
        url: "/docs/removed",
        canonicalUrl: "https://docs.example.com/docs/removed",
        digest: expect.stringMatching(digestPattern),
        lastModified: "2026-07-02",
      },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("Install version one");
  });

  it("returns a snapshot, exact deltas, current-generation no-ops, and honest resets", async () => {
    const feed = createDocsContentChangeFeed();
    const first = await feed.resolve({
      pages: pages(1),
      audience: "agent",
      baseUrl,
    });
    expect(first).toMatchObject({
      format: "docs-content-changes.v1",
      audience: "agent",
      since: null,
      mode: "snapshot",
      resetRequired: false,
      documentCount: 2,
      counts: { added: 2, changed: 0, deleted: 0 },
    });

    const unchanged = await feed.resolve({
      pages: pages(1),
      audience: "agent",
      baseUrl,
      since: first.indexGeneration,
    });
    expect(unchanged).toMatchObject({
      mode: "delta",
      resetRequired: false,
      counts: { added: 0, changed: 0, deleted: 0 },
      added: [],
      changed: [],
      deleted: [],
    });

    const changed = await feed.resolve({
      pages: pages(2),
      audience: "agent",
      baseUrl,
      since: first.indexGeneration,
    });
    expect(changed).toMatchObject({
      mode: "delta",
      resetRequired: false,
      documentCount: 2,
      counts: { added: 1, changed: 1, deleted: 1 },
      added: [
        {
          canonicalUrl: "https://docs.example.com/docs/added",
          digest: expect.stringMatching(digestPattern),
          lastModified: "2026-07-04",
        },
      ],
      changed: [
        {
          canonicalUrl: "https://docs.example.com/docs/install",
          digest: expect.stringMatching(digestPattern),
          previousDigest: first.added[0]?.digest,
          lastModified: "2026-07-03",
          previousLastModified: "2026-07-01",
        },
      ],
      deleted: [
        {
          canonicalUrl: "https://docs.example.com/docs/removed",
          digest: first.added[1]?.digest,
          lastModified: "2026-07-02",
        },
      ],
    });

    const reset = await feed.resolve({
      pages: pages(2),
      audience: "agent",
      baseUrl,
      since: `sha256:${"f".repeat(64)}`,
    });
    expect(reset).toMatchObject({
      mode: "reset",
      resetRequired: true,
      counts: { added: 2, changed: 0, deleted: 0 },
    });

    const metadataOnly = pages(2);
    metadataOnly[0] = { ...metadataOnly[0]!, title: "Install renamed" };
    const metadataChanged = await feed.resolve({
      pages: metadataOnly,
      audience: "agent",
      baseUrl,
      since: changed.indexGeneration,
    });
    expect(metadataChanged).toMatchObject({
      mode: "delta",
      resetRequired: false,
      counts: { added: 0, changed: 1, deleted: 0 },
      changed: [{ canonicalUrl: "https://docs.example.com/docs/install" }],
    });
  });

  it("loads and saves snapshots for exact cross-deployment deltas", async () => {
    const snapshots = new Map<string, DocsContentSnapshot>();
    const saveSnapshot = vi.fn((snapshot: DocsContentSnapshot) => {
      snapshots.set(snapshot.indexGeneration, structuredClone(snapshot));
    });
    const firstFeed = createDocsContentChangeFeed({ saveSnapshot });
    const first = await firstFeed.resolve({
      pages: pages(1),
      audience: "agent",
      baseUrl,
    });
    expect(saveSnapshot).toHaveBeenCalledTimes(1);

    const loadSnapshot = vi.fn((generation: string) => snapshots.get(generation));
    const nextFeed = createDocsContentChangeFeed({ loadSnapshot, saveSnapshot });
    const next = await nextFeed.resolve({
      pages: pages(2),
      audience: "agent",
      baseUrl,
      since: first.indexGeneration,
    });
    expect(loadSnapshot).toHaveBeenCalledWith(
      first.indexGeneration,
      expect.objectContaining({ audience: "agent", baseUrl }),
    );
    expect(next).toMatchObject({
      mode: "delta",
      resetRequired: false,
      counts: { added: 1, changed: 1, deleted: 1 },
    });
  });

  it("validates configuration and request parameters", () => {
    expect(resolveDocsContentChangesConfig()).toMatchObject({
      enabled: true,
      maxSnapshots: 8,
    });
    expect(resolveDocsContentChangesConfig(false).enabled).toBe(false);
    expect(resolveDocsContentChangesConfig(true, { staticExport: true }).enabled).toBe(false);
    expect(resolveDocsContentChangesConfig({ maxSnapshots: 100 }).maxSnapshots).toBe(8);
    expect(
      resolveDocsContentChangesRequest(
        new URL(
          `https://docs.example.com/api/docs?response=changes&audience=human&since=sha256:${"a".repeat(64)}`,
        ),
      ),
    ).toEqual({
      audience: "human",
      since: `sha256:${"a".repeat(64)}`,
    });
    expect(() =>
      resolveDocsContentChangesRequest(
        new URL("https://docs.example.com/api/docs?response=changes&audience=robot"),
      ),
    ).toThrow("audience must be");
    expect(() =>
      resolveDocsContentChangesRequest(
        new URL("https://docs.example.com/api/docs?response=changes&since=latest"),
      ),
    ).toThrow("must be a SHA-256");
  });

  it("serves cache-aware HTTP responses without document bodies", async () => {
    const feed = createDocsContentChangeFeed();
    const request = new Request(
      "https://docs.example.com/api/docs?response=changes&audience=agent",
    );
    const response = await createDocsContentChangesHttpResponse({
      request,
      feed,
      pages: pages(),
      baseUrl,
    });
    const etag = response.headers.get("etag");
    expect(response.status).toBe(200);
    expect(etag).toMatch(/^"sha256:[a-f\d]{64}"$/u);
    expect(response.headers.get("x-docs-index-generation")).toMatch(digestPattern);
    expect(response.headers.get("cache-control")).toContain("stale-while-revalidate=300");
    expect(await response.text()).not.toContain("Install version one");

    const notModified = await createDocsContentChangesHttpResponse({
      request: new Request(request, { headers: { "if-none-match": etag! } }),
      feed,
      pages: pages(),
      baseUrl,
    });
    expect(notModified.status).toBe(304);
    expect(await notModified.text()).toBe("");

    const head = await createDocsContentChangesHttpResponse({
      request: new Request(request, { method: "HEAD" }),
      feed,
      pages: pages(),
      baseUrl,
    });
    expect(head.status).toBe(200);
    expect(head.headers.get("x-docs-index-generation")).toBe(
      response.headers.get("x-docs-index-generation"),
    );
    expect(await head.text()).toBe("");
  });
});
