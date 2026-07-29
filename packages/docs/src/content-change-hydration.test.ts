import { describe, expect, it } from "vitest";
import { createDocsContentChangeFeed } from "./content-changes.js";
import {
  DOCS_CONTENT_CHANGE_HYDRATION_FORMAT,
  hydrateDocsContentChanges,
} from "./content-change-hydration.js";
import type { DocsContentChangeHydrationResponse } from "./content-change-hydration.js";
import type { DocsSearchSourcePage } from "./types.js";

const baseUrl = "https://docs.example.com";
const digestPattern = /^sha256:[a-f\d]{64}$/u;

function initialPages(): DocsSearchSourcePage[] {
  return [
    {
      title: "Stable",
      url: "/docs/stable",
      content: "Stable content.",
      rawContent: "# Stable\n\nStable content.",
    },
    {
      title: "Install",
      url: "/docs/install",
      content: "Old install content.",
      rawContent: "# Install\n\nOld install content.",
      lastmod: "2026-07-01",
    },
    {
      title: "Removed",
      url: "/docs/removed",
      content: "Removed content.",
      rawContent: "# Removed\n\nRemoved content.",
      lastmod: "2026-07-02",
    },
  ];
}

function currentPages(): DocsSearchSourcePage[] {
  return [
    initialPages()[0]!,
    {
      title: "Install",
      url: "/docs/install",
      content: "Updated install content.",
      rawContent: [
        "# Install",
        "",
        "Run the updated installer with the recommended package manager and verify every file.",
        "",
        "## Verify",
        "",
        "Check that the generated configuration exists and the development server starts.",
      ].join("\n"),
      lastmod: "2026-07-03",
    },
    {
      title: "Added",
      url: "/docs/added",
      content: "Newly added content.",
      rawContent: "# Added\n\nNewly added content for agents.",
      lastmod: "2026-07-04",
    },
  ];
}

async function buildDelta() {
  const feed = createDocsContentChangeFeed();
  const first = await feed.resolve({
    pages: initialPages(),
    audience: "agent",
    baseUrl,
  });
  const changes = await feed.resolve({
    pages: currentPages(),
    audience: "agent",
    baseUrl,
    since: first.indexGeneration,
  });
  return { feed, first, changes };
}

describe("content-change hydration", () => {
  it("returns only changed section content and deletion tombstones under a cursor budget", async () => {
    const { first, changes } = await buildDelta();
    const responses: DocsContentChangeHydrationResponse[] = [];
    let cursor: string | undefined;

    do {
      const response = hydrateDocsContentChanges({
        changes,
        pages: currentPages(),
        since: first.indexGeneration,
        tokenBudget: 64,
        cursor,
        cursorScope: "test-server",
      });
      responses.push(response);
      cursor = response.nextCursor;
    } while (cursor);

    expect(responses.length).toBeGreaterThan(1);
    expect(responses[0]).toMatchObject({
      format: DOCS_CONTENT_CHANGE_HYDRATION_FORMAT,
      audience: "agent",
      since: first.indexGeneration,
      indexGeneration: changes.indexGeneration,
      mode: "delta",
      resetRequired: false,
      counts: { added: 1, changed: 1, deleted: 1 },
      budget: {
        requestedTokens: 64,
        strategy: "utf8-bytes",
        maxUtf8Bytes: 64,
      },
    });
    expect(responses.every((response) => response.budget.usedUtf8Bytes <= 64)).toBe(true);
    expect(responses.at(-1)?.hasMore).toBe(false);
    expect(responses.at(-1)?.nextCursor).toBeUndefined();

    const content = responses.flatMap((response) => response.content);
    const tombstones = responses.flatMap((response) => response.tombstones);
    expect(content.length + tombstones.length).toBe(responses[0]?.total);
    expect(new Set(content.map((item) => item.canonicalUrl))).toEqual(
      new Set(["https://docs.example.com/docs/added", "https://docs.example.com/docs/install"]),
    );
    expect(content.some((item) => item.canonicalUrl.endsWith("/stable"))).toBe(false);
    expect(content.map((item) => item.section.id)).toEqual(
      expect.arrayContaining(["install", "verify", "added"]),
    );
    expect(
      content.every(
        (item) =>
          digestPattern.test(item.digest) &&
          digestPattern.test(item.sectionDigest) &&
          digestPattern.test(item.chunkDigest) &&
          item.utf8Bytes <= 64,
      ),
    ).toBe(true);
    expect(
      content
        .filter((item) => item.canonicalUrl.endsWith("/install"))
        .every(
          (item) => item.change === "changed" && digestPattern.test(item.previousDigest ?? ""),
        ),
    ).toBe(true);
    expect(tombstones).toEqual([
      expect.objectContaining({
        type: "tombstone",
        change: "deleted",
        canonicalUrl: "https://docs.example.com/docs/removed",
        digest: expect.stringMatching(digestPattern),
      }),
    ]);
  });

  it("binds cursors to the prior generation, current generation, locale, and budget", async () => {
    const { first, changes } = await buildDelta();
    const page = hydrateDocsContentChanges({
      changes,
      pages: currentPages(),
      since: first.indexGeneration,
      tokenBudget: 64,
      cursorScope: "test-server",
    });
    expect(page.nextCursor).toBeDefined();

    expect(() =>
      hydrateDocsContentChanges({
        changes,
        pages: currentPages(),
        since: first.indexGeneration,
        tokenBudget: 65,
        cursor: page.nextCursor,
        cursorScope: "test-server",
      }),
    ).toThrow("Invalid or stale pagination cursor");
    expect(() =>
      hydrateDocsContentChanges({
        changes: { ...changes, indexGeneration: `sha256:${"f".repeat(64)}` },
        pages: currentPages(),
        since: first.indexGeneration,
        tokenBudget: 64,
        cursor: page.nextCursor,
        cursorScope: "test-server",
      }),
    ).toThrow("Invalid or stale pagination cursor");
    expect(() =>
      hydrateDocsContentChanges({
        changes: {
          ...changes,
          mode: "reset",
          resetRequired: true,
          added: [...changes.added, ...changes.changed],
          changed: [],
          deleted: [],
        },
        pages: currentPages(),
        since: first.indexGeneration,
        tokenBudget: 64,
        cursor: page.nextCursor,
        cursorScope: "test-server",
      }),
    ).toThrow("Invalid or stale pagination cursor");
  });

  it("returns empty no-op hydration and marks stale generations as resets", async () => {
    const { feed, changes } = await buildDelta();
    const unchanged = await feed.resolve({
      pages: currentPages(),
      audience: "agent",
      baseUrl,
      since: changes.indexGeneration,
    });
    expect(
      hydrateDocsContentChanges({
        changes: unchanged,
        pages: currentPages(),
        since: changes.indexGeneration,
        tokenBudget: 500,
        cursorScope: "test-server",
      }),
    ).toMatchObject({
      mode: "delta",
      resetRequired: false,
      resultCount: 0,
      total: 0,
      hasMore: false,
      content: [],
      tombstones: [],
    });

    const missingGeneration = `sha256:${"e".repeat(64)}`;
    const reset = await feed.resolve({
      pages: currentPages(),
      audience: "agent",
      baseUrl,
      since: missingGeneration,
    });
    const hydratedReset = hydrateDocsContentChanges({
      changes: reset,
      pages: currentPages(),
      since: missingGeneration,
      tokenBudget: 500,
      cursorScope: "test-server",
    });
    expect(hydratedReset).toMatchObject({
      mode: "reset",
      resetRequired: true,
      counts: { added: 3, changed: 0, deleted: 0 },
      tombstones: [],
    });
    expect(hydratedReset.content.length).toBeGreaterThan(0);
  });

  it("continues safely across multi-byte content without losing chunk boundaries", async () => {
    const since = `sha256:${"d".repeat(64)}`;
    const unicodePages: DocsSearchSourcePage[] = [
      {
        title: "Emoji",
        url: "/docs/emoji",
        content: "🙂🙂",
        rawContent: "# Emoji\n\n🙂🙂",
      },
    ];
    const changes = await createDocsContentChangeFeed().resolve({
      pages: unicodePages,
      audience: "agent",
      baseUrl,
      since,
    });
    const chunks: string[] = [];
    let cursor: string | undefined;
    do {
      const response = hydrateDocsContentChanges({
        changes,
        pages: unicodePages,
        since,
        tokenBudget: 4,
        cursor,
        cursorScope: "test-server",
      });
      chunks.push(...response.content.map((item) => item.content));
      cursor = response.nextCursor;
    } while (cursor);

    expect(chunks.join("")).toBe("# Emoji\n\n🙂🙂");
  });
});
