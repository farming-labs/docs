import { describe, expect, it } from "vitest";
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
    expect(result.examples).toMatchObject({ expected: 1, matched: 1, executable: 1, passed: true });
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
      "Retrieved context is ambiguous or does not explicitly match the requested framework/version.",
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
});
