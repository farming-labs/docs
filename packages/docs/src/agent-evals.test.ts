import { describe, expect, it, vi } from "vitest";
import type { DocsMcpPage } from "./mcp.js";
import { runDocsGoldenTasks, type DocsGoldenTask } from "./agent-evals.js";

function page(
  input: Partial<DocsMcpPage> & Pick<DocsMcpPage, "slug" | "url" | "title">,
): DocsMcpPage {
  return {
    content: input.rawContent ?? input.content ?? `# ${input.title}`,
    ...input,
  };
}

const pages: DocsMcpPage[] = [
  page({
    slug: "auth-v16",
    url: "/docs/auth-v16",
    title: "Authentication for Next.js 16",
    description: "Opt-in authentication with a callback.",
    framework: "nextjs",
    version: "16",
    agent: {
      task: "Configure opt-in authentication for Next.js 16.",
      outcome: "Unauthenticated requests are rejected by the supplied callback.",
      appliesTo: { framework: "nextjs", version: "16" },
      prerequisites: ["A Next.js 16 docs application is running."],
      verification: [{ run: "pnpm test", expect: "Authentication tests pass." }],
      rollback: ["Remove the authenticate callback from docs.config.ts."],
    },
    rawContent: `# Authentication for Next.js 16

Authentication stays public by default.

## Configure authentication

Supply an authenticate callback only when the site needs protected agent access.

\`\`\`ts runnable framework=nextjs packageManager=pnpm title="Configure authentication"
export const docs = defineDocs({
  mcp: {
    security: {
      authenticate: async (request) => verifyBearerToken(request),
    },
  },
});
\`\`\`

Expected result: unauthenticated requests receive an authorization error.
`,
  }),
  page({
    slug: "auth-v15",
    url: "/docs/auth-v15",
    title: "Authentication for Next.js 15",
    framework: "nextjs",
    version: "15",
    rawContent: `# Authentication for Next.js 15

## Configure authentication

Use the legacy middleware integration for authentication callbacks.
`,
  }),
  page({
    slug: "auth-astro",
    url: "/docs/auth-astro",
    title: "Authentication for Astro",
    framework: "astro",
    version: "6",
    rawContent: `# Authentication for Astro

## Configure authentication

Register an Astro middleware callback.
`,
  }),
  page({
    slug: "security-overview",
    url: "/docs/security-overview",
    title: "Security overview",
    rawContent: `# Security overview

Authentication is optional. Select the framework-specific setup before copying code.
`,
  }),
];

const passingTask: DocsGoldenTask = {
  id: "next-16-auth",
  query: "verifyBearerToken authenticate security",
  filters: { framework: "nextjs", version: "16" },
  tokenBudget: 1_300,
  topK: 1,
  expect: {
    relevantSources: ["/docs/auth-v16#configure-authentication"],
    requiredCitations: ["/docs/auth-v16#configure-authentication"],
    forbiddenSources: ["/docs/auth-v15", "/docs/auth-astro"],
    minUsefulByteRatio: 0.5,
    examples: [
      {
        source: "/docs/auth-v16#configure-authentication",
        language: "ts",
        framework: "nextjs",
        packageManager: "pnpm",
        title: "Configure authentication",
        includes: ["authenticate: async", "verifyBearerToken(request)"],
      },
    ],
  },
};

describe("runDocsGoldenTasks", () => {
  it("reports unmeasured instead of passing when no golden tasks are configured", async () => {
    await expect(runDocsGoldenTasks(pages, [])).resolves.toEqual({
      status: "unmeasured",
      passed: null,
      score: null,
      taskCount: 0,
      passedTaskCount: 0,
      failedTaskCount: 0,
      tasks: [],
    });
  });

  it("measures retrieval, citations, version selection, runnable examples, and usage", async () => {
    const report = await runDocsGoldenTasks(pages, [passingTask]);
    const result = report.tasks[0];

    expect(report.status).toBe("passed");
    expect(report.passed).toBe(true);
    expect(result.retrieval).toMatchObject({
      recallAtK: 1,
      firstRelevantRank: 1,
      reciprocalRank: 1,
      forbiddenSources: [],
      passed: true,
    });
    expect(result.citations).toMatchObject({
      actual: ["/docs/auth-v16#configure-authentication"],
      missing: [],
      unexpected: [],
      precision: 1,
      recall: 1,
      integrity: true,
      passed: true,
    });
    expect(result.selection).toMatchObject({
      firstFrameworkMatchRank: 1,
      firstVersionMatchRank: 1,
      conflictingSources: [],
      ambiguousSources: [],
      passed: true,
    });
    expect(result.examples).toMatchObject({
      expected: 1,
      matched: 1,
      syntaxValid: 1,
      executed: 0,
      executable: 1,
      passed: true,
    });
    expect(result.examples.results[0]).toMatchObject({
      verification: "syntax",
      status: "passed",
      syntaxValid: true,
      executed: false,
    });
    expect(result).toMatchObject({ surface: "mcp-context", provider: "simple" });
    expect(result.citations.evidence).toBe("context");
    expect(result.usage.usedUtf8Bytes).toBe(Buffer.byteLength(result.context, "utf8"));
    expect(result.usage.conservativeTokenUpperBound).toBe(result.usage.usedUtf8Bytes);
    expect(result.usage.usedUtf8Bytes).toBeLessThanOrEqual(result.usage.tokenBudget);
    expect(result.score).toBe(100);
  });

  it("fails explicit version selection when the retrieved page is version-ambiguous", async () => {
    const ambiguousPage = page({
      slug: "install",
      url: "/docs/install",
      title: "Install",
      rawContent: `# Install

## Install the package

Run pnpm add docs.
`,
    });
    const report = await runDocsGoldenTasks(
      [ambiguousPage],
      [
        {
          id: "versioned-install",
          query: "install the package",
          filters: { version: "16" },
          topK: 1,
          expect: { relevantSources: ["/docs/install#install-the-package"] },
        },
      ],
    );

    expect(report.status).toBe("failed");
    expect(report.tasks[0].retrieval.passed).toBe(true);
    expect(report.tasks[0].selection).toMatchObject({
      requestedVersion: "16",
      firstVersionMatchRank: null,
      passed: false,
    });
    expect(report.tasks[0].issues).toContain(
      "Retrieved sources are ambiguous or do not explicitly match the expected framework/version/locale.",
    );
  });

  it("treats unscoped ranked sources as ambiguous even when another source matches", async () => {
    const unscopedPage = page({
      slug: "unscoped-install",
      url: "/docs/unscoped-install",
      title: "Install package",
      rawContent: `# Install package

Use the package installation command.
`,
    });
    const scopedSupportPage = page({
      slug: "version-support",
      url: "/docs/version-support",
      title: "Install package version support",
      version: "16",
      rawContent: `# Install package version support

Version 16 supports the package installation command.
`,
    });
    const report = await runDocsGoldenTasks(
      [unscopedPage, scopedSupportPage],
      [
        {
          id: "mixed-version-scope",
          query: "install package version support",
          filters: { version: "16" },
          topK: 2,
          expect: { relevantSources: ["/docs/unscoped-install"] },
        },
      ],
    );

    expect(report.status).toBe("failed");
    expect(report.tasks[0].selection.firstVersionMatchRank).not.toBeNull();
    expect(report.tasks[0].selection.ambiguousSources).toContain(
      "/docs/unscoped-install#install-package",
    );
    expect(report.tasks[0].selection.passed).toBe(false);
  });

  it("enforces the byte ceiling without splitting Unicode and is input-order deterministic", async () => {
    const unicodePage = page({
      slug: "unicode",
      url: "/docs/unicode",
      title: "Café setup 🚜",
      rawContent: `# Café setup 🚜

## Configure café

${"Useful café guidance 🚜. ".repeat(60)}
`,
    });
    const task: DocsGoldenTask = {
      id: "unicode-budget",
      query: "configure café",
      tokenBudget: 220,
      topK: 1,
      expect: { relevantSources: ["/docs/unicode#configure-caf"] },
    };

    const forward = await runDocsGoldenTasks([...pages, unicodePage], [task]);
    const reverse = await runDocsGoldenTasks([unicodePage, ...pages.slice().reverse()], [task]);
    const result = forward.tasks[0];

    expect(forward).toEqual(reverse);
    expect(result.usage.truncated).toBe(true);
    expect(result.usage.usedUtf8Bytes).toBe(Buffer.byteLength(result.context, "utf8"));
    expect(result.usage.usedUtf8Bytes).toBeLessThanOrEqual(220);
    expect(result.context).not.toContain("�");
  });

  it("does not count a source when the budget can render only its header", async () => {
    const headerOnlyPage = page({
      slug: "header-only",
      url: "/docs/header-only",
      title: "Header only",
      rawContent: `# Header only

## Answer

This content must be present for the answer to be useful.
`,
    });
    const header = "## Answer\nSource: /docs/header-only#answer\n\n";
    const report = await runDocsGoldenTasks(
      [headerOnlyPage],
      [
        {
          id: "header-only-budget",
          query: "answer",
          tokenBudget: Buffer.byteLength(header, "utf8"),
          topK: 1,
          expect: { relevantSources: ["/docs/header-only#answer"] },
        },
      ],
    );
    const result = report.tasks[0];

    expect(result).toMatchObject({ status: "failed", passed: false, context: "", sources: [] });
    expect(result.retrieval.passed).toBe(true);
    expect(result.usage).toMatchObject({ usedUtf8Bytes: 0, usefulUtf8Bytes: 0 });
    expect(result.score).toBeLessThan(100);
  });

  it("matches examples only when the complete fence is present in rendered context", async () => {
    const truncatedExamplePage = page({
      slug: "truncated-example",
      url: "/docs/truncated-example",
      title: "Truncated example",
      rawContent: `# Truncated example

## Configure safely

${"Required setup guidance comes first. ".repeat(20)}

\`\`\`js runnable title="Late example"
export const configured = true;
\`\`\`
`,
    });
    const report = await runDocsGoldenTasks(
      [truncatedExamplePage],
      [
        {
          id: "truncated-code",
          query: "configure safely",
          tokenBudget: 220,
          topK: 1,
          expect: {
            relevantSources: ["/docs/truncated-example#configure-safely"],
            examples: [
              {
                source: "/docs/truncated-example#configure-safely",
                language: "js",
                title: "Late example",
                includes: ["configured = true"],
              },
            ],
          },
        },
      ],
    );
    const result = report.tasks[0];

    expect(result.context).not.toContain("configured = true");
    expect(result.usage.truncated).toBe(true);
    expect(result.examples).toMatchObject({ expected: 1, matched: 0, passed: false });
    expect(result.status).toBe("failed");
  });

  it("uses safe planning and syntax parsing before calling a runnable fence executable", async () => {
    const invalidJsonPage = page({
      slug: "invalid-json",
      url: "/docs/invalid-json",
      title: "Invalid JSON",
      rawContent: `# Invalid JSON

## Configure JSON

\`\`\`json runnable title="Broken JSON"
{"enabled": }
\`\`\`
`,
    });
    const report = await runDocsGoldenTasks(
      [invalidJsonPage],
      [
        {
          id: "json-syntax",
          query: "configure json",
          topK: 1,
          expect: {
            relevantSources: ["/docs/invalid-json#configure-json"],
            examples: [
              {
                source: "/docs/invalid-json#configure-json",
                language: "json",
                title: "Broken JSON",
                includes: ["enabled"],
              },
            ],
          },
        },
      ],
    );

    expect(report.tasks[0].examples).toMatchObject({ matched: 0, executable: 0, passed: false });
    expect(report.status).toBe("failed");
  });

  it("returns failed reports instead of throwing on malformed runtime task shapes", async () => {
    const malformed = [
      {
        id: "malformed",
        query: "authentication",
        expect: {
          relevantSources: "/docs/auth-v16",
          allowedSources: ["/docs/auth-v16", 42],
          examples: { source: "/docs/auth-v16" },
        },
      },
      null,
    ] as unknown as DocsGoldenTask[];

    const report = await runDocsGoldenTasks(pages, malformed);
    const nonArrayReport = await runDocsGoldenTasks(pages, {
      tasks: "not-an-array",
    } as unknown as DocsGoldenTask[]);

    expect(report).toMatchObject({ status: "failed", passed: false, taskCount: 2, score: 0 });
    expect(report.tasks.every((task) => task.status === "failed" && task.score === 0)).toBe(true);
    expect(report.tasks.flatMap((task) => task.issues).join(" ")).toContain(
      "Invalid golden task configuration",
    );
    expect(nonArrayReport).toMatchObject({ status: "failed", passed: false, taskCount: 1 });
    expect(nonArrayReport.tasks[0].issues.join(" ")).toContain(
      "agent.evaluations.tasks must be an array",
    );
  });

  it("uses shared framework and version-range semantics", async () => {
    const rangedPage = page({
      slug: "range",
      url: "/docs/range",
      title: "Version range",
      framework: "TanStack Start",
      version: ">=16 <17",
      rawContent: `# Version range

## Configure range

Use the version 16 integration.
`,
    });
    const report = await runDocsGoldenTasks(
      [rangedPage],
      [
        {
          id: "shared-range",
          query: "configure range",
          filters: { framework: "start", version: "16.2" },
          topK: 1,
          expect: { relevantSources: ["/docs/range#configure-range"] },
        },
      ],
    );

    expect(report.status).toBe("passed");
    expect(report.tasks[0].selection).toMatchObject({
      firstFrameworkMatchRank: 1,
      firstVersionMatchRank: 1,
      passed: true,
    });
  });

  it("uses the production context pipeline for structured-contract-only retrieval", async () => {
    const contractPage = page({
      slug: "contract-only",
      url: "/docs/contract-only",
      title: "Credential maintenance",
      agent: {
        task: "Rotate the orchard credential.",
        outcome: "The new credential is active.",
      },
      rawContent: `# Credential maintenance

This overview intentionally keeps the task wording in structured metadata.
`,
    });
    const report = await runDocsGoldenTasks(
      [contractPage],
      [
        {
          id: "contract-search",
          query: "rotate orchard credential",
          topK: 1,
          expect: { relevantSources: ["/docs/contract-only"] },
        },
      ],
    );

    expect(report.status).toBe("passed");
    expect(report.tasks[0].sources).toHaveLength(1);
    expect(report.tasks[0].sources[0].url).not.toContain("#agent-contract");
    expect(report.tasks[0].citations.actual).toEqual(
      report.tasks[0].sources.map((source) => source.url),
    );
  });

  it("parses citations only from production-emitted context headers", async () => {
    const sourceExamplePage = page({
      slug: "source-example",
      url: "/docs/source-example",
      title: "Generated manifest",
      rawContent: `# Generated manifest

## Inspect output

The generated text includes a source-shaped value.

\`\`\`txt
Source: /generated/local-file
\`\`\`
`,
    });
    const report = await runDocsGoldenTasks(
      [sourceExamplePage],
      [
        {
          id: "source-shaped-content",
          query: "generated text source-shaped value",
          topK: 1,
          expect: { relevantSources: ["/docs/source-example#inspect-output"] },
        },
      ],
    );

    expect(report.status).toBe("passed");
    expect(report.tasks[0].citations).toMatchObject({
      actual: ["/docs/source-example#inspect-output"],
      unexpected: [],
      integrity: true,
      passed: true,
    });
  });

  it("rejects expectations that overlap forbidden sources and cannot award a failed 100", async () => {
    const conflictingTask = {
      ...passingTask,
      id: "contradictory-sources",
      expect: {
        ...passingTask.expect,
        forbiddenSources: ["/docs/auth-v16"],
      },
    } satisfies DocsGoldenTask;
    const report = await runDocsGoldenTasks(pages, [conflictingTask]);

    expect(report).toMatchObject({ status: "failed", passed: false, score: 0 });
    expect(report.tasks[0]).toMatchObject({ status: "failed", passed: false, score: 0 });
    expect(report.tasks[0].issues.join(" ")).toContain("must not overlap");
  });

  it("measures top-K retrieval before applying the context byte budget", async () => {
    const noisePage = page({
      slug: "noise",
      url: "/docs/noise",
      title: "Configure widgets",
      rawContent: `# Configure widgets

## Overview

${"Configure widgets noise. ".repeat(100)}
`,
    });
    const answerPage = page({
      slug: "widget-answer",
      url: "/docs/widget-answer",
      title: "Widget answer",
      rawContent: `# Widget answer

## Install

Configure widgets correctly.
`,
    });
    const report = await runDocsGoldenTasks(
      [noisePage, answerPage],
      [
        {
          id: "retrieval-before-budget",
          query: "configure widgets",
          topK: 2,
          tokenBudget: 130,
          expect: { relevantSources: ["/docs/widget-answer#install"] },
        },
      ],
    );

    expect(report.tasks[0].sources.map((source) => source.url)).not.toContain(
      "/docs/widget-answer#install",
    );
    expect(report.tasks[0].retrieval).toMatchObject({
      retrievedRelevant: 1,
      recallAtK: 1,
      firstRelevantRank: 2,
      passed: true,
    });
  });

  it("counts complete rendered blocks as useful when every source is relevant", async () => {
    const alphaPage = page({
      slug: "useful-alpha",
      url: "/docs/useful-alpha",
      title: "Shared alpha",
      rawContent: `# Shared alpha

Agent budget coverage for alpha.
`,
    });
    const betaPage = page({
      slug: "useful-beta",
      url: "/docs/useful-beta",
      title: "Shared beta",
      rawContent: `# Shared beta

Agent budget coverage for beta.
`,
    });
    const report = await runDocsGoldenTasks(
      [alphaPage, betaPage],
      [
        {
          id: "all-useful-context",
          query: "shared agent budget coverage",
          topK: 2,
          expect: {
            relevantSources: ["/docs/useful-alpha", "/docs/useful-beta"],
            minUsefulByteRatio: 1,
          },
        },
      ],
    );

    expect(report.status).toBe("passed");
    expect(report.tasks[0].usage).toMatchObject({ usefulByteRatio: 1, passed: true });
    expect(report.tasks[0].usage.usefulUtf8Bytes).toBe(report.tasks[0].usage.usedUtf8Bytes);
  });

  it("rejects malformed TypeScript and TSX without executing either snippet", async () => {
    const invalidTypescriptPage = page({
      slug: "invalid-typescript",
      url: "/docs/invalid-typescript",
      title: "Broken examples",
      rawContent: `# Broken examples

## Configure examples

\`\`\`ts runnable title="Broken TypeScript"
const = ;
\`\`\`

\`\`\`tsx runnable title="Broken TSX"
export const Broken = () => <div>;
\`\`\`
`,
    });
    const report = await runDocsGoldenTasks(
      [invalidTypescriptPage],
      [
        {
          id: "typescript-syntax",
          query: "configure broken examples",
          topK: 1,
          expect: {
            relevantSources: ["/docs/invalid-typescript#configure-examples"],
            examples: [
              { language: "ts", title: "Broken TypeScript", includes: ["const ="] },
              { language: "tsx", title: "Broken TSX", includes: ["<div>"] },
            ],
          },
        },
      ],
    );

    expect(report.status).toBe("failed");
    expect(report.tasks[0].examples).toMatchObject({ matched: 0, executable: 0, passed: false });
  });

  it("normalizes locale separators and treats equivalent version constraints symmetrically", async () => {
    const scopedPage = page({
      slug: "scoped",
      url: "/docs/scoped",
      title: "Scoped setup",
      locale: "en_US",
      version: ">=16 <17",
      agent: { appliesTo: { version: "16.2.x" } },
      rawContent: `# Scoped setup

## Configure scoped setup

Use the scoped integration.
`,
    });
    const report = await runDocsGoldenTasks(
      [scopedPage],
      [
        {
          id: "normalized-scope",
          query: "configure scoped setup",
          filters: { locale: "en-US", version: "16.2.4" },
          topK: 1,
          expect: { relevantSources: ["/docs/scoped#configure-scoped-setup"] },
        },
      ],
    );

    expect(report.status).toBe("passed");
    expect(report.tasks[0].selection).toMatchObject({ ambiguousSources: [], passed: true });
  });

  it("uses configured search results instead of silently evaluating local MCP retrieval", async () => {
    let calls = 0;
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          id: "configured-search",
          query: "legacy middleware authentication",
          surface: "configured-search",
          topK: 1,
          expect: { relevantSources: ["/docs/auth-v15"] },
        },
      ],
      {
        allowNetwork: true,
        search: {
          provider: "custom",
          adapter: {
            name: "fixture-search",
            async search() {
              calls += 1;
              return [
                {
                  id: "remote-v15",
                  url: "/docs/auth-v15",
                  content: "Remote legacy authentication result",
                  type: "page" as const,
                },
              ];
            },
          },
        },
      },
    );

    expect(calls).toBe(1);
    expect(report.status).toBe("passed");
    expect(report.tasks[0]).toMatchObject({
      surface: "configured-search",
      provider: "custom",
      sources: [{ url: "/docs/auth-v15" }],
      citations: {
        evidence: "results",
        actual: ["/docs/auth-v15"],
        passed: true,
      },
    });
  });

  it("does not supplement an empty configured provider with local results", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          id: "empty-provider",
          query: "verifyBearerToken authenticate security",
          surface: "configured-search",
          expect: { relevantSources: ["/docs/auth-v16"] },
        },
      ],
      {
        allowNetwork: true,
        search: {
          provider: "custom",
          adapter: {
            name: "empty",
            async search() {
              return [];
            },
          },
        },
      },
    );

    expect(report.status).toBe("failed");
    expect(report.tasks[0]).toMatchObject({ provider: "custom", sources: [] });
    expect(report.tasks[0].retrieval.recallAtK).toBe(0);
  });

  it("sanitizes semantic provider hits from the full agent projection without lexical overlap", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          id: "semantic-provider",
          query: "opaque-semantic-intent-without-page-terms",
          surface: "configured-search",
          topK: 1,
          expect: { relevantSources: ["/docs/auth-v16#configure-authentication"] },
        },
      ],
      {
        allowNetwork: true,
        search: {
          provider: "custom",
          adapter: {
            name: "semantic",
            async search() {
              return [
                {
                  id: "semantic-auth",
                  url: "/docs/auth-v16#configure-authentication",
                  content: "Human-only provider snippet",
                  type: "heading" as const,
                  section: "Configure authentication",
                },
              ];
            },
          },
        },
      },
    );

    expect(report.status).toBe("passed");
    expect(report.tasks[0].sources[0]).toMatchObject({
      url: "/docs/auth-v16#configure-authentication",
    });
    expect(report.tasks[0].context).not.toContain("Human-only provider snippet");
  });

  it("preserves configured provider ranking without local literal reranking", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          id: "provider-order",
          query: "verifyBearerToken",
          surface: "configured-search",
          topK: 2,
          expect: {
            relevantSources: ["/docs/auth-v15"],
            maxFirstRelevantRank: 1,
          },
        },
      ],
      {
        allowNetwork: true,
        search: {
          provider: "custom",
          adapter: {
            name: "ranked",
            async search() {
              return [
                { id: "first", url: "/docs/auth-v15", content: "Legacy", type: "page" as const },
                {
                  id: "literal-second",
                  url: "/docs/auth-v16",
                  content: "verifyBearerToken",
                  type: "page" as const,
                },
              ];
            },
          },
        },
      },
    );

    expect(report.tasks[0].sources.map((source) => source.url)).toEqual([
      "/docs/auth-v15",
      "/docs/auth-v16",
    ]);
    expect(report.tasks[0].retrieval.firstRelevantRank).toBe(1);
  });

  it("fails configured provider errors instead of falling back to simple search", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          id: "strict-provider",
          query: "verifyBearerToken authenticate security",
          surface: "configured-search",
          expect: { relevantSources: ["/docs/auth-v16"] },
        },
      ],
      {
        allowNetwork: true,
        search: {
          provider: "custom",
          adapter: {
            name: "broken-search",
            async search() {
              throw new Error("fixture provider unavailable");
            },
          },
        },
      },
    );

    expect(report.status).toBe("failed");
    expect(report.tasks[0]).toMatchObject({ provider: "unavailable", sources: [] });
    expect(report.tasks[0].issues.join(" ")).toContain("fixture provider unavailable");
  });

  it("fails closed on malformed runtime search provider values", async () => {
    const unknown = await runDocsGoldenTasks(
      pages,
      [{ ...passingTask, surface: "configured-search" }],
      {
        allowNetwork: true,
        search: { provider: "mystery" } as never,
      },
    );
    const primitive = await runDocsGoldenTasks(
      pages,
      [{ ...passingTask, surface: "configured-search" }],
      {
        allowNetwork: true,
        search: 42 as never,
      },
    );

    expect(unknown.status).toBe("failed");
    expect(unknown.tasks[0].sources).toEqual([]);
    expect(unknown.tasks[0].issues.join(" ")).toContain("Unsupported configured search provider");
    expect(primitive.status).toBe("failed");
    expect(primitive.tasks[0].issues.join(" ")).toContain("boolean or provider object");
  });

  it("does not map non-HTTP provider URLs onto local docs paths", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [{ ...passingTask, surface: "configured-search" }],
      {
        allowNetwork: true,
        search: {
          provider: "custom",
          adapter: {
            name: "unsafe-scheme",
            async search() {
              return [
                {
                  id: "unsafe",
                  url: "javascript:/docs/auth-v16#configure-authentication",
                  content: "Spoofed local path",
                  type: "heading" as const,
                },
              ];
            },
          },
        },
      },
    );

    expect(report.status).toBe("failed");
    expect(report.tasks[0].sources).toEqual([]);
    expect(report.tasks[0].retrieval.recallAtK).toBe(0);
  });

  it("times out configured providers and aborts their adapter context", async () => {
    let observedSignal: AbortSignal | undefined;
    const report = await runDocsGoldenTasks(
      pages,
      [{ ...passingTask, surface: "configured-search" }],
      {
        allowNetwork: true,
        searchTimeoutMs: 10,
        search: {
          provider: "custom",
          adapter: {
            name: "stalled",
            search(_query, context) {
              observedSignal = context.signal;
              return new Promise(() => undefined);
            },
          },
        },
      },
    );

    expect(observedSignal?.aborted).toBe(true);
    expect(report.status).toBe("failed");
    expect(report.tasks[0].issues.join(" ")).toContain("timed out after 10ms");
  });

  it("blocks external evaluation surfaces offline instead of substituting local results", async () => {
    let called = false;
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          id: "offline-provider",
          query: "authentication",
          surface: "configured-search",
          expect: { relevantSources: ["/docs/auth-v16"] },
        },
      ],
      {
        search: {
          provider: "custom",
          adapter: {
            name: "should-not-run",
            async search() {
              called = true;
              return [];
            },
          },
        },
      },
    );

    expect(called).toBe(false);
    expect(report.status).toBe("failed");
    expect(report.tasks[0].issues.join(" ")).toContain("allowNetwork: true");
  });

  it("asserts expected scope against unfiltered returned sources", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          id: "scope-selection",
          query: "legacy middleware authentication",
          surface: "configured-search",
          topK: 1,
          expect: {
            relevantSources: ["/docs/auth-v15"],
            scope: { framework: "nextjs", version: "16" },
          },
        },
      ],
      {
        allowNetwork: true,
        search: {
          provider: "custom",
          adapter: {
            name: "version-order",
            async search() {
              return [
                {
                  id: "v15",
                  url: "/docs/auth-v15",
                  content: "Next.js 15 authentication",
                  type: "page" as const,
                },
                {
                  id: "v16",
                  url: "/docs/auth-v16",
                  content: "Next.js 16 authentication",
                  type: "page" as const,
                },
              ];
            },
          },
        },
      },
    );

    expect(report.tasks[0].retrieval.passed).toBe(true);
    expect(report.tasks[0].selection).toMatchObject({
      requestedVersion: undefined,
      expectedVersion: "16",
      firstVersionMatchRank: null,
      conflictingSources: ["/docs/auth-v15"],
      passed: false,
    });
    expect(report.status).toBe("failed");
  });

  it("keeps context citations distinct from actual answer citation evidence", async () => {
    const task: DocsGoldenTask = {
      ...passingTask,
      expect: {
        ...passingTask.expect,
        answer: {
          includes: ["Use the callback"],
          requiredCitations: ["/docs/auth-v16#configure-authentication"],
          forbiddenCitations: ["/docs/auth-v15"],
        },
      },
    };
    const report = await runDocsGoldenTasks(pages, [task], {
      answer: {
        provider: "callback",
        async run() {
          return {
            text: "Use the callback described in [legacy setup](/docs/auth-v15).",
            citations: ["/docs/auth-v15"],
          };
        },
      },
    });

    expect(report.tasks[0].citations).toMatchObject({ evidence: "context", passed: true });
    expect(report.tasks[0].answer).toMatchObject({
      evidence: "answer",
      provided: true,
      missingCitations: ["/docs/auth-v16#configure-authentication"],
      forbiddenCitations: ["/docs/auth-v15"],
      passed: false,
    });
    expect(report.status).toBe("failed");
  });

  it("validates successful actual answer citations from an explicit callback", async () => {
    let receivedTask: unknown;
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          ...passingTask,
          expect: {
            ...passingTask.expect,
            answer: { includes: ["Use the callback"] },
          },
        },
      ],
      {
        answer: {
          provider: "callback",
          run: (input) => {
            receivedTask = input.task;
            return {
              text: "Use the callback in [the Next.js 16 guide](/docs/auth-v16#configure-authentication).",
            };
          },
        },
      },
    );

    expect(report.status).toBe("passed");
    expect(receivedTask).toEqual({
      id: "next-16-auth",
      query: "verifyBearerToken authenticate security",
      filters: { framework: "nextjs", version: "16" },
    });
    expect(receivedTask).not.toHaveProperty("expect");
    expect(report.tasks[0].answer).toMatchObject({
      evidence: "answer",
      citations: ["/docs/auth-v16#configure-authentication"],
      passed: true,
    });
  });

  it("evaluates the production Ask AI context headers and labels the surface honestly", async () => {
    const report = await runDocsGoldenTasks(pages, [
      { ...passingTask, surface: "ask-ai-context", tokenBudget: 1_300 },
    ]);

    expect(report.status).toBe("passed");
    expect(report.tasks[0]).toMatchObject({
      surface: "ask-ai-context",
      provider: "simple",
      citations: {
        evidence: "context",
        actual: ["/docs/auth-v16#configure-authentication"],
        integrity: true,
      },
    });
    expect(report.tasks[0].context).toContain("URL: /docs/auth-v16#configure-authentication");
    expect(report.tasks[0].usage.usefulUtf8Bytes).toBeGreaterThan(0);
  });

  it("does not mislabel an Ask AI character ceiling as a UTF-8 byte budget", async () => {
    const unicodePage = page({
      slug: "ask-unicode",
      url: "/docs/ask-unicode",
      title: "Unicode answer",
      rawContent: `# Unicode answer\n\n## Configure\n\n${"🚜 café guidance. ".repeat(80)}`,
    });
    const report = await runDocsGoldenTasks(
      [unicodePage],
      [
        {
          id: "ask-unicode-budget",
          query: "configure café guidance",
          surface: "ask-ai-context",
          tokenBudget: 500,
          topK: 1,
          expect: { relevantSources: ["/docs/ask-unicode#configure"] },
        },
      ],
    );

    expect(report.tasks[0].usage.usedUtf8Bytes).toBe(
      Buffer.byteLength(report.tasks[0].context, "utf8"),
    );
    expect(report.tasks[0].usage.withinBudget).toBe(false);
    expect(report.tasks[0].usage.usedUtf8Bytes).toBeGreaterThan(500);
    expect(report.status).toBe("failed");
  });

  it("never auto-passes unsupported syntax verification", async () => {
    const pythonPage = page({
      slug: "python-example",
      url: "/docs/python-example",
      title: "Python example",
      rawContent: `# Python example\n\n## Run\n\n\`\`\`python runnable\nprint("ready")\n\`\`\``,
    });
    const report = await runDocsGoldenTasks(
      [pythonPage],
      [
        {
          id: "python-syntax",
          query: "run python ready",
          topK: 1,
          expect: {
            relevantSources: ["/docs/python-example#run"],
            examples: [{ language: "python", includes: ["ready"] }],
          },
        },
      ],
    );

    expect(report.tasks[0].examples.results[0]).toMatchObject({
      verification: "syntax",
      status: "skipped",
      syntaxValid: false,
      executed: false,
      passed: false,
    });
    expect(report.tasks[0].examples.matched).toBe(0);
    expect(report.tasks[0].score).toBeLessThan(90);
    expect(report.status).toBe("failed");
  });

  it("executes examples only after an explicit execute expectation and validator opt-in", async () => {
    const executablePage = page({
      slug: "execute-example",
      url: "/docs/execute-example",
      title: "Execute example",
      rawContent: `# Execute example\n\n## Verify\n\n\`\`\`js runnable\nconsole.log("verified");\n\`\`\``,
    });
    const task: DocsGoldenTask = {
      id: "execute-js",
      query: "verify console verified",
      topK: 1,
      expect: {
        relevantSources: ["/docs/execute-example#verify"],
        examples: [{ language: "js", verification: "execute", includes: ["verified"] }],
      },
    };
    const withoutOptIn = await runDocsGoldenTasks([executablePage], [task]);
    const executed = await runDocsGoldenTasks([executablePage], [task], {
      rootDir: process.cwd(),
      codeBlocksValidate: true,
      allowNetwork: true,
    });

    expect(withoutOptIn.tasks[0].examples.results[0]).toMatchObject({
      status: "skipped",
      executed: false,
      passed: false,
    });
    expect(withoutOptIn.tasks[0].examples.results[0].reason).toContain("allowNetwork: true");
    expect(executed.tasks[0].examples).toMatchObject({
      matched: 1,
      executed: 1,
      executable: 1,
      passed: true,
    });
    expect(executed.tasks[0].examples.results[0]).toMatchObject({
      verification: "execute",
      executionStatus: "PASS",
      executed: true,
      passed: true,
    });
    expect(executed.status).toBe("passed");
  });

  it("does not invoke a global answer provider for tasks without answer expectations", async () => {
    let calls = 0;
    const report = await runDocsGoldenTasks(pages, [passingTask], {
      answer: {
        provider: "callback",
        run() {
          calls += 1;
          throw new Error("must not run");
        },
      },
    });

    expect(calls).toBe(0);
    expect(report.status).toBe("passed");
    expect(report.tasks[0].answer).toMatchObject({
      expected: false,
      provided: false,
      passed: true,
    });
  });

  it("does not run search, answer, or example execution for invalid duplicate tasks", async () => {
    let searchCalls = 0;
    let answerCalls = 0;
    const duplicate: DocsGoldenTask = {
      ...passingTask,
      id: "duplicate-side-effects",
      surface: "configured-search",
      expect: {
        ...passingTask.expect,
        answer: { includes: ["answer"] },
        examples: [{ language: "js", verification: "execute" }],
      },
    };
    const report = await runDocsGoldenTasks(pages, [duplicate, duplicate], {
      allowNetwork: true,
      rootDir: process.cwd(),
      codeBlocksValidate: true,
      search: {
        provider: "custom",
        adapter: {
          name: "must-not-run",
          async search() {
            searchCalls += 1;
            return [];
          },
        },
      },
      answer: {
        provider: "callback",
        run() {
          answerCalls += 1;
          return { text: "answer" };
        },
      },
    });

    expect(searchCalls).toBe(0);
    expect(answerCalls).toBe(0);
    expect(report.status).toBe("failed");
    expect(report.tasks.every((task) => task.provider === "unavailable")).toBe(true);
    expect(report.tasks.every((task) => task.examples.executed === 0)).toBe(true);
    expect(report.tasks[0].issues.join(" ")).toContain("duplicated");
  });

  it("fails closed on malformed answer providers without calling unknown values", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          ...passingTask,
          expect: { ...passingTask.expect, answer: { includes: ["callback"] } },
        },
      ],
      {
        answer: { provider: "calback", run: "not-a-function" } as never,
      },
    );

    expect(report.status).toBe("failed");
    expect(report.tasks[0].issues.join(" ")).toContain('provider to "callback" or "http"');
    expect(JSON.stringify(report)).not.toContain("not-a-function");
  });

  it("aborts callback answer evaluation at the configured timeout", async () => {
    let observedSignal: AbortSignal | undefined;
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          ...passingTask,
          expect: { ...passingTask.expect, answer: { includes: ["never"] } },
        },
      ],
      {
        answer: {
          provider: "callback",
          timeoutMs: 10,
          run(input) {
            observedSignal = input.signal;
            return new Promise(() => undefined);
          },
        },
      },
    );

    expect(observedSignal?.aborted).toBe(true);
    expect(report.status).toBe("failed");
    expect(report.tasks[0].issues.join(" ")).toContain("timed out after 10ms");
  });

  it("preserves answer citation origins and rejects a same-path citation from another site", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          ...passingTask,
          expect: {
            ...passingTask.expect,
            answer: { requiredCitations: ["/docs/auth-v16#configure-authentication"] },
          },
        },
      ],
      {
        baseUrl: "https://docs.example.com",
        answer: {
          provider: "callback",
          run: () => ({
            text: "See [the guide](//evil.example/docs/auth-v16#configure-authentication).",
          }),
        },
      },
    );

    expect(report.tasks[0].answer).toMatchObject({
      citations: ["https://evil.example/docs/auth-v16#configure-authentication"],
      missingCitations: ["/docs/auth-v16#configure-authentication"],
      unexpectedCitations: ["https://evil.example/docs/auth-v16#configure-authentication"],
      passed: false,
    });
  });

  it("preserves explicit citation origins when the configured base URL is invalid", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          ...passingTask,
          expect: {
            ...passingTask.expect,
            answer: { requiredCitations: ["/docs/auth-v16#configure-authentication"] },
          },
        },
      ],
      {
        baseUrl: "not a valid base URL",
        answer: {
          provider: "callback",
          run: () => ({
            text: "See [the guide](https://evil.example/docs/auth-v16#configure-authentication).",
          }),
        },
      },
    );

    expect(report.status).toBe("failed");
    expect(report.tasks[0].answer).toMatchObject({
      citations: ["https://evil.example/docs/auth-v16#configure-authentication"],
      missingCitations: ["/docs/auth-v16#configure-authentication"],
    });
  });

  it("preserves foreign origins in whitespace and backslash URL spellings", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          ...passingTask,
          expect: {
            ...passingTask.expect,
            answer: { requiredCitations: ["/docs/auth-v16#configure-authentication"] },
          },
        },
      ],
      {
        baseUrl: "https://trusted.example",
        answer: {
          provider: "callback",
          run: () => ({
            text: "Foreign references",
            citations: [
              String.raw`https:\\evil.example\docs\auth-v16#configure-authentication`,
              String.raw`\\evil.example\docs\auth-v16#configure-authentication`,
              "  https://evil.example/docs/auth-v16#configure-authentication",
            ],
          }),
        },
      },
    );

    expect(report.status).toBe("failed");
    expect(report.tasks[0].answer.citations).toEqual([
      "https://evil.example/docs/auth-v16#configure-authentication",
    ]);
    expect(report.tasks[0].answer.missingCitations).toEqual([
      "/docs/auth-v16#configure-authentication",
    ]);
  });

  it("normalizes same-origin absolute answer citations with the configured base URL", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          ...passingTask,
          expect: { ...passingTask.expect, answer: {} },
        },
      ],
      {
        baseUrl: "https://docs.example.com",
        answer: {
          provider: "callback",
          run: () => ({
            text: "See [the guide](https://docs.example.com/docs/auth-v16#configure-authentication).",
          }),
        },
      },
    );

    expect(report.status).toBe("passed");
    expect(report.tasks[0].answer.citations).toEqual(["/docs/auth-v16#configure-authentication"]);
  });

  it("uses structured Ask AI blocks when page markdown contains a horizontal rule", async () => {
    const horizontalRulePage = page({
      slug: "horizontal-rule",
      url: "/docs/horizontal-rule",
      title: "Horizontal rule context",
      rawContent: `# Horizontal rule context\n\n## Configure\n\nFirst orchard step.\n\n---\n\nSecond orchard step.`,
    });
    const report = await runDocsGoldenTasks(
      [horizontalRulePage],
      [
        {
          id: "horizontal-rule",
          query: "first second orchard step",
          surface: "ask-ai-context",
          topK: 1,
          expect: { relevantSources: ["/docs/horizontal-rule#configure"] },
        },
      ],
    );

    expect(report.status).toBe("passed");
    expect(report.tasks[0].sources).toHaveLength(1);
    expect(report.tasks[0].citations).toMatchObject({ integrity: true, passed: true });
    expect(report.tasks[0].context).toContain("\n\n---\n\n");
  });

  it("keeps internal execution targets unique while preserving public fence IDs", async () => {
    const multiSectionPage = page({
      slug: "multi-section",
      url: "/docs/multi-section",
      title: "Multi section execution",
      rawContent: `# Multi section execution\n\n## Alpha orchard verify\n\n\`\`\`js runnable title="Alpha"\nconsole.log("alpha orchard verify");\n\`\`\`\n\n## Beta orchard verify\n\n\`\`\`js runnable title="Beta"\nconsole.log("beta orchard verify");\n\`\`\``,
    });
    const report = await runDocsGoldenTasks(
      [multiSectionPage],
      [
        {
          id: "multi-section-execute",
          query: "orchard verify",
          topK: 2,
          expect: {
            relevantSources: [
              "/docs/multi-section#alpha-orchard-verify",
              "/docs/multi-section#beta-orchard-verify",
            ],
            examples: [
              { title: "Alpha", verification: "execute" },
              { title: "Beta", verification: "execute" },
            ],
          },
        },
      ],
      {
        rootDir: process.cwd(),
        codeBlocksValidate: true,
        allowNetwork: true,
      },
    );

    expect(report.status).toBe("passed");
    expect(report.tasks[0].examples).toMatchObject({ executed: 2, passed: true });
    expect(report.tasks[0].examples.results.map((result) => result.matchedId)).toEqual([
      "multi-section#code-1",
      "multi-section#code-1",
    ]);
  });

  it("resolves relative MCP evaluation endpoints from baseUrl before network gating", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          id: "relative-mcp",
          query: "authentication",
          surface: "configured-search",
          expect: { relevantSources: ["/docs/auth-v16"] },
        },
      ],
      {
        baseUrl: "https://docs.example.com",
        search: { provider: "mcp", endpoint: "/mcp" },
      },
    );

    expect(report.status).toBe("failed");
    expect(report.tasks[0].issues.join(" ")).toContain("allowNetwork: true");
    expect(report.tasks[0].issues.join(" ")).not.toContain("relative MCP");
  });

  it("fails Ask AI MCP evaluation clearly when the configured endpoint cannot be resolved", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          id: "unresolved-ask-mcp",
          query: "authentication",
          surface: "ask-ai-context",
          expect: { relevantSources: ["/docs/auth-v16"] },
        },
      ],
      {
        allowNetwork: true,
        askAISearch: { provider: "mcp", endpoint: "/api/docs/mcp" },
      },
    );

    expect(report.status).toBe("failed");
    expect(report.tasks[0].issues.join(" ")).toContain("canonical docs baseUrl");
  });

  it("fails configured-search clearly when the configured provider is disabled", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          id: "disabled-search",
          query: "authentication",
          surface: "configured-search",
          expect: { relevantSources: ["/docs/auth-v16"] },
        },
      ],
      { search: { enabled: false } },
    );

    expect(report.status).toBe("failed");
    expect(report.tasks[0].provider).toBe("unavailable");
    expect(report.tasks[0].issues.join(" ")).toContain("Configured search is disabled");
  });

  it("mirrors Ask AI's built-in simple fallback when top-level search is disabled", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [{ ...passingTask, surface: "ask-ai-context" }],
      { search: { enabled: false } },
    );

    expect(report.status).toBe("passed");
    expect(report.tasks[0]).toMatchObject({ surface: "ask-ai-context", provider: "simple" });
  });

  it("extracts angle-bracket and balanced-parenthesis Markdown answer citations", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          ...passingTask,
          expect: {
            ...passingTask.expect,
            answer: { requiredCitations: ["/api/foo_(bar)"] },
          },
        },
      ],
      {
        answer: {
          provider: "callback",
          run: () => ({ text: "Use [the operation](</api/foo_(bar)>)." }),
        },
      },
    );

    expect(report.status).toBe("passed");
    expect(report.tasks[0].answer.citations).toEqual(["/api/foo_(bar)"]);
  });

  it("does not treat images or malformed Markdown as answer citations", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          ...passingTask,
          expect: {
            ...passingTask.expect,
            answer: { requiredCitations: [] },
          },
        },
      ],
      {
        answer: {
          provider: "callback",
          run: () => ({
            text: [
              "![Architecture](/docs/auth-v16)",
              "not-a-link](/docs/auth-v16)",
              "[unclosed](</docs/auth-v16>",
              "`[inline code](/docs/auth-v16)`",
              "<!-- [comment](/docs/auth-v16) -->",
              "```md\n[fenced code](/docs/auth-v16)\n```",
            ].join("\n"),
          }),
        },
      },
    );

    expect(report.status).toBe("passed");
    expect(report.tasks[0].answer.citations).toEqual([]);
  });

  it("keeps unsupported citation schemes distinct from local docs paths", async () => {
    const report = await runDocsGoldenTasks(
      pages,
      [
        {
          ...passingTask,
          expect: {
            ...passingTask.expect,
            answer: { requiredCitations: ["/docs/auth-v16"] },
          },
        },
      ],
      {
        baseUrl: "https://trusted.example",
        answer: {
          provider: "callback",
          run: () => ({
            text: "Unsafe references",
            citations: [
              "javascript:/docs/auth-v16",
              "ftp://evil.example/docs/auth-v16",
              "file:///docs/auth-v16",
            ],
          }),
        },
      },
    );

    expect(report.status).toBe("failed");
    expect(report.tasks[0].answer.missingCitations).toEqual(["/docs/auth-v16"]);
    expect(report.tasks[0].answer.citations).toEqual([
      "javascript:///docs/auth-v16",
      "ftp://evil.example/docs/auth-v16",
      "file:///docs/auth-v16",
    ]);
  });

  it("gates HTTP answers, validates config, keeps inputs blind, and never reports headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const answerTask: DocsGoldenTask = {
      ...passingTask,
      expect: { ...passingTask.expect, answer: { includes: ["Use the callback"] } },
    };
    try {
      const offline = await runDocsGoldenTasks(pages, [answerTask], {
        answer: {
          provider: "http",
          endpoint: "https://answers.example/evaluate",
          headers: { Authorization: "Bearer super-secret" },
        },
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(offline.tasks[0].issues.join(" ")).toContain("allowNetwork: true");
      expect(JSON.stringify(offline)).not.toContain("super-secret");

      const invalidEndpoint = await runDocsGoldenTasks(pages, [answerTask], {
        allowNetwork: true,
        answer: { provider: "http", endpoint: "file:///tmp/answer" },
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(invalidEndpoint.tasks[0].issues.join(" ")).toContain("HTTP or HTTPS");

      const invalidHeaders = await runDocsGoldenTasks(pages, [answerTask], {
        allowNetwork: true,
        answer: {
          provider: "http",
          endpoint: "https://answers.example/evaluate",
          headers: { Authorization: 42 } as never,
        },
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(invalidHeaders.tasks[0].issues.join(" ")).toContain("string values");

      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            text: "Use the callback in the guide.",
            citations: ["/docs/auth-v16#configure-authentication"],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
      const measured = await runDocsGoldenTasks(pages, [answerTask], {
        allowNetwork: true,
        answer: {
          provider: "http",
          endpoint: "https://answers.example/evaluate",
          headers: { Authorization: "Bearer super-secret" },
        },
      });
      expect(measured.status).toBe("passed");
      const requestBody = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
      expect(requestBody.task).toEqual({
        id: "next-16-auth",
        query: "verifyBearerToken authenticate security",
        filters: { framework: "nextjs", version: "16" },
      });
      expect(requestBody.task).not.toHaveProperty("expect");
      expect(JSON.stringify(measured)).not.toContain("super-secret");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("aborts oversized and timed-out HTTP answer responses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const answerTask: DocsGoldenTask = {
      ...passingTask,
      expect: { ...passingTask.expect, answer: { includes: ["answer"] } },
    };
    try {
      fetchMock.mockResolvedValueOnce(
        new Response("x".repeat(1_000_001), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      const oversized = await runDocsGoldenTasks(pages, [answerTask], {
        allowNetwork: true,
        answer: { provider: "http", endpoint: "https://answers.example/evaluate" },
      });
      expect(oversized.status).toBe("failed");
      expect(oversized.tasks[0].issues.join(" ")).toContain("exceeds the 1 MB limit");

      let aborted = false;
      fetchMock.mockImplementationOnce((_input, init) => {
        init?.signal?.addEventListener("abort", () => {
          aborted = true;
        });
        return new Promise(() => undefined);
      });
      const timedOut = await runDocsGoldenTasks(pages, [answerTask], {
        allowNetwork: true,
        answer: {
          provider: "http",
          endpoint: "https://answers.example/evaluate",
          timeoutMs: 10,
        },
      });
      expect(aborted).toBe(true);
      expect(timedOut.tasks[0].issues.join(" ")).toContain("timed out after 10ms");

      fetchMock.mockImplementationOnce((_input, init) => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"text":"partial'));
            init?.signal?.addEventListener("abort", () => {
              controller.error(new DOMException("Aborted", "AbortError"));
            });
          },
        });
        return Promise.resolve(
          new Response(body, { status: 200, headers: { "content-type": "application/json" } }),
        );
      });
      const stalledBody = await runDocsGoldenTasks(pages, [answerTask], {
        allowNetwork: true,
        answer: {
          provider: "http",
          endpoint: "https://answers.example/evaluate",
          timeoutMs: 10,
        },
      });
      expect(stalledBody.status).toBe("failed");
      expect(stalledBody.tasks[0].issues.join(" ")).toContain("timed out after 10ms");
      expect(stalledBody.tasks[0].issues.join(" ")).not.toContain("AbortError");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("preserves external MCP result origins and collapses only configured same-origin URLs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const initialize = () =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            serverInfo: { name: "fixture", version: "1.0.0" },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    const searchResponse = (url: string) =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  results: [{ slug: "remote", url, title: "Remote", excerpt: "orchard remote" }],
                }),
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    try {
      fetchMock
        .mockResolvedValueOnce(initialize())
        .mockResolvedValueOnce(searchResponse("https://evil.example/docs/remote"));
      const noBaseCollision = await runDocsGoldenTasks(
        pages,
        [
          {
            id: "origin-collision-without-base",
            query: "orchard remote",
            surface: "configured-search",
            topK: 1,
            expect: { relevantSources: ["/docs/remote"] },
          },
        ],
        {
          allowNetwork: true,
          search: { provider: "mcp", endpoint: "https://search.example/mcp" },
        },
      );
      expect(noBaseCollision.status).toBe("failed");
      expect(noBaseCollision.tasks[0].sources[0]?.url).toBe("https://evil.example/docs/remote");

      fetchMock
        .mockResolvedValueOnce(initialize())
        .mockResolvedValueOnce(searchResponse("https://evil.example/docs/remote"));
      const noBaseAskAI = await runDocsGoldenTasks(
        pages,
        [
          {
            id: "ask-origin-collision-without-base",
            query: "orchard remote",
            surface: "ask-ai-context",
            topK: 1,
            expect: { relevantSources: ["/docs/remote"] },
          },
        ],
        {
          allowNetwork: true,
          askAISearch: { provider: "mcp", endpoint: "https://search.example/mcp" },
        },
      );
      expect(noBaseAskAI.status).toBe("failed");
      expect(noBaseAskAI.tasks[0].sources[0]?.url).toBe("https://evil.example/docs/remote");

      fetchMock
        .mockResolvedValueOnce(initialize())
        .mockResolvedValueOnce(searchResponse(String.raw`https:\\evil.example\docs\remote`));
      const backslashCollision = await runDocsGoldenTasks(
        pages,
        [
          {
            id: "backslash-origin-collision",
            query: "orchard remote",
            surface: "configured-search",
            topK: 1,
            expect: { relevantSources: ["/docs/remote"] },
          },
        ],
        {
          allowNetwork: true,
          baseUrl: "https://trusted.example",
          search: { provider: "mcp", endpoint: "https://search.example/mcp" },
        },
      );
      expect(backslashCollision.status).toBe("failed");
      expect(backslashCollision.tasks[0].sources[0]?.url).toBe("https://evil.example/docs/remote");

      fetchMock
        .mockResolvedValueOnce(initialize())
        .mockResolvedValueOnce(searchResponse("javascript:/docs/remote"));
      const unsupportedProtocol = await runDocsGoldenTasks(
        pages,
        [
          {
            id: "unsupported-protocol",
            query: "orchard remote",
            surface: "configured-search",
            topK: 1,
            expect: { relevantSources: ["/docs/remote"] },
          },
        ],
        {
          allowNetwork: true,
          baseUrl: "https://trusted.example",
          search: { provider: "mcp", endpoint: "https://search.example/mcp" },
        },
      );
      expect(unsupportedProtocol.status).toBe("failed");
      expect(unsupportedProtocol.tasks[0].sources).toEqual([]);

      fetchMock
        .mockResolvedValueOnce(initialize())
        .mockResolvedValueOnce(searchResponse("https://evil.example/docs/remote"));
      const collision = await runDocsGoldenTasks(
        pages,
        [
          {
            id: "origin-collision",
            query: "orchard remote",
            surface: "configured-search",
            topK: 1,
            expect: { relevantSources: ["https://trusted.example/docs/remote"] },
          },
        ],
        {
          allowNetwork: true,
          baseUrl: "https://trusted.example",
          search: { provider: "mcp", endpoint: "https://search.example/mcp" },
        },
      );
      expect(collision.status).toBe("failed");
      expect(collision.tasks[0].sources[0]?.url).toBe("https://evil.example/docs/remote");
      expect(collision.tasks[0].retrieval.recallAtK).toBe(0);

      fetchMock
        .mockResolvedValueOnce(initialize())
        .mockResolvedValueOnce(searchResponse("https://trusted.example/docs/remote"));
      const sameOrigin = await runDocsGoldenTasks(
        pages,
        [
          {
            id: "same-origin",
            query: "orchard remote",
            surface: "configured-search",
            topK: 1,
            expect: { relevantSources: ["https://trusted.example/docs/remote"] },
          },
        ],
        {
          allowNetwork: true,
          baseUrl: "https://trusted.example",
          search: { provider: "mcp", endpoint: "https://search.example/mcp" },
        },
      );
      expect(sameOrigin.status).toBe("passed");
      expect(sameOrigin.tasks[0].sources[0]?.url).toBe("/docs/remote");
    } finally {
      fetchMock.mockRestore();
    }
  });
});
