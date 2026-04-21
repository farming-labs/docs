#!/usr/bin/env node
import http from "node:http";
import { spawn } from "node:child_process";
import { appendFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const benchmarkRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(benchmarkRoot, "../..");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const codexBin = process.env.CODEX_BIN ?? "/Applications/Codex.app/Contents/Resources/codex";
const providers = (process.env.BENCHMARK_PROVIDERS ?? "farming-labs,mintlify")
  .split(",")
  .map((provider) => provider.trim())
  .filter(Boolean);
const repeats = Math.max(1, Number.parseInt(process.env.BENCHMARK_REPEATS ?? "1", 10) || 1);
const invalidRetries = Math.max(
  0,
  Number.parseInt(process.env.BENCHMARK_INVALID_RETRIES ?? "2", 10) || 0,
);
const inputUsdPerMillion = Number.parseFloat(process.env.CODEX_INPUT_USD_PER_1M ?? "0");
const outputUsdPerMillion = Number.parseFloat(process.env.CODEX_OUTPUT_USD_PER_1M ?? "0");
const scenarioId = process.env.BENCHMARK_SCENARIO ?? "support-agent-prompting";

const supportedProviders = new Set(["farming-labs", "mintlify"]);

function json(data) {
  return JSON.stringify(data, null, 2);
}

function now() {
  return new Date().toISOString();
}

function providerRoot(provider) {
  return path.join(benchmarkRoot, provider);
}

function providerProjectRoot(provider) {
  return providerRoot(provider);
}

function providerFile(provider, relativePath, context) {
  const file = path.join(providerProjectRoot(provider), relativePath);
  if (!existsSync(file)) return null;
  return readFileSync(file, "utf8")
    .replaceAll("{{BASE_URL}}", context.baseUrl)
    .replaceAll("__BASE_URL__", context.baseUrl);
}

function docSlugForPath(urlPath) {
  if (urlPath === "/" || urlPath === "/docs" || urlPath === "/docs.md") {
    return "";
  }

  if (!urlPath.startsWith("/docs/")) return null;
  const withoutPrefix = decodeURIComponent(urlPath.slice("/docs/".length));
  return withoutPrefix.endsWith(".md") ? withoutPrefix.slice(0, -".md".length) : withoutPrefix;
}

function docFileForPath(provider, urlPath) {
  const slug = docSlugForPath(urlPath);
  if (slug == null) return null;

  if (provider === "farming-labs") {
    return slug ? `app/docs/${slug}/page.mdx` : "app/docs/page.mdx";
  }

  return slug ? `docs/${slug}.md` : "docs/index.md";
}

const baseDocsCatalog = [
  {
    title: "Installation",
    slug: "getting-started/installation",
    relevance: "neutral",
    keywords: ["install", "setup", "scaffold"],
  },
  {
    title: "Environments",
    slug: "getting-started/environments",
    relevance: "supporting",
    keywords: ["environment", "docs base url", "default"],
  },
  {
    title: "Support agent prompting contract",
    slug: "core/support-agent-prompting",
    keywords: ["support", "agent", "prompt", "contract", "implementation"],
  },
  {
    title: "Support agent v1 deprecated contract",
    slug: "core/support-agent-v1",
    keywords: ["support", "agent", "v1", "deprecated", "legacy"],
  },
  {
    title: "Support agent v2 current contract",
    slug: "core/support-agent-v2",
    keywords: ["support", "agent", "v2", "current", "versioned", "endpoint"],
  },
  {
    title: "Agent context model",
    slug: "core/agent-context",
    relevance: "supporting",
    keywords: ["agent", "context", "header", "tools"],
  },
  {
    title: "Customer profiles",
    slug: "core/customer-profiles",
    relevance: "supporting",
    keywords: ["customer", "tier", "free", "pro", "enterprise"],
  },
  {
    title: "Data boundaries",
    slug: "core/data-boundaries",
    relevance: "supporting",
    keywords: ["billing", "data", "escalate", "safe"],
  },
  {
    title: "Escalation policy",
    slug: "guides/escalation-policy",
    relevance: "supporting",
    keywords: ["escalation", "human", "billing"],
  },
  {
    title: "Deployment checklist",
    slug: "guides/deployment",
    relevance: "neutral",
    keywords: ["deploy", "production", "checklist"],
  },
  {
    title: "Observability",
    slug: "guides/observability",
    relevance: "neutral",
    keywords: ["logging", "metrics", "observability"],
  },
  {
    title: "Migrate support agent v1 to v2",
    slug: "migration/v1-to-v2",
    keywords: ["migration", "v1", "v2", "deprecated", "current"],
  },
  {
    title: "Slack integration",
    slug: "integrations/slack",
    relevance: "noisy",
    keywords: ["slack", "notifications"],
  },
  {
    title: "Webhooks",
    slug: "integrations/webhooks",
    relevance: "noisy",
    keywords: ["webhooks", "events", "delivery"],
  },
  {
    title: "Search tools",
    slug: "reference/search-tools",
    relevance: "supporting",
    keywords: ["search_docs", "read_page", "docs search"],
  },
  {
    title: "Ticketing API",
    slug: "reference/ticketing-api",
    relevance: "supporting",
    keywords: ["create_ticket", "ticket", "escalation"],
  },
  {
    title: "Billing API reference",
    slug: "reference/billing-api",
    relevance: "noisy",
    keywords: ["billing", "invoice", "refund"],
  },
  {
    title: "Theme and branding",
    slug: "reference/theme-branding",
    relevance: "noisy",
    keywords: ["theme", "branding", "colors"],
  },
  {
    title: "Prompt errors",
    slug: "troubleshooting/prompt-errors",
    relevance: "supporting",
    keywords: ["prompt", "error", "acceptance", "missing"],
  },
  {
    title: "Rate limits",
    slug: "troubleshooting/rate-limits",
    relevance: "noisy",
    keywords: ["rate limit", "quota", "headers"],
  },
];

function docsCatalogForScenario(id) {
  const relevanceBySlug =
    id === "versioned-agent-endpoint"
      ? {
          "getting-started/installation": "neutral",
          "getting-started/environments": "supporting",
          "core/support-agent-prompting": "noisy",
          "core/support-agent-v1": "noisy",
          "core/support-agent-v2": "target",
          "core/agent-context": "supporting",
          "core/customer-profiles": "supporting",
          "core/data-boundaries": "supporting",
          "guides/escalation-policy": "supporting",
          "guides/deployment": "neutral",
          "guides/observability": "neutral",
          "migration/v1-to-v2": "supporting",
          "integrations/slack": "noisy",
          "integrations/webhooks": "noisy",
          "reference/search-tools": "supporting",
          "reference/ticketing-api": "supporting",
          "reference/billing-api": "noisy",
          "reference/theme-branding": "noisy",
          "troubleshooting/prompt-errors": "supporting",
          "troubleshooting/rate-limits": "noisy",
        }
      : {
          "getting-started/installation": "neutral",
          "getting-started/environments": "supporting",
          "core/support-agent-prompting": "target",
          "core/support-agent-v1": "noisy",
          "core/support-agent-v2": "noisy",
          "core/agent-context": "supporting",
          "core/customer-profiles": "supporting",
          "core/data-boundaries": "supporting",
          "guides/escalation-policy": "supporting",
          "guides/deployment": "neutral",
          "guides/observability": "neutral",
          "migration/v1-to-v2": "neutral",
          "integrations/slack": "noisy",
          "integrations/webhooks": "noisy",
          "reference/search-tools": "supporting",
          "reference/ticketing-api": "supporting",
          "reference/billing-api": "noisy",
          "reference/theme-branding": "noisy",
          "troubleshooting/prompt-errors": "supporting",
          "troubleshooting/rate-limits": "noisy",
        };

  return baseDocsCatalog.map((page) => ({
    ...page,
    relevance: relevanceBySlug[page.slug] ?? "neutral",
  }));
}

const scenarioDefinitions = {
  "support-agent-prompting": {
    id: "support-agent-prompting",
    label: "Support agent prompting",
    targetTask: "Implement Northstar CRM's support-agent prompting contract.",
    recommendedQuery: "support agent prompting contract",
    targetKeywords: ["support", "agent", "prompt", "contract"],
    acceptanceCommand: "node scripts/acceptance.mjs",
    promptTask:
      "Implement Northstar CRM's support-agent prompting contract in this Next.js artifact workspace.",
    avoid: [
      "full-site dumps before targeted search",
      "guessing prompt policy from memory",
      "opening Billing API or Theme docs for this task",
      "installing packages",
    ],
  },
  "versioned-agent-endpoint": {
    id: "versioned-agent-endpoint",
    label: "Versioned support-agent endpoint",
    targetTask: "Implement Northstar CRM's current v2 support-agent endpoint.",
    recommendedQuery: "current support agent v2 endpoint contract",
    targetKeywords: ["current", "support", "agent", "v2", "versioned", "endpoint"],
    acceptanceCommand: "BENCHMARK_SCENARIO=versioned-agent-endpoint node scripts/acceptance.mjs",
    promptTask:
      "Implement Northstar CRM's current v2 support-agent endpoint in this Next.js artifact workspace. The docs include a deprecated v1 contract; do not implement v1.",
    avoid: [
      "implementing the deprecated v1 contract",
      "using support-agent.response.v1",
      "opening Billing API or Theme docs for this task",
      "installing packages",
    ],
  },
};

const activeScenario = scenarioDefinitions[scenarioId];
if (!activeScenario) {
  throw new Error(`Unsupported benchmark scenario: ${scenarioId}`);
}
activeScenario.docsCatalog = docsCatalogForScenario(scenarioId);

function docsList(context) {
  return activeScenario.docsCatalog.map((page) => ({
    ...page,
    url: `${context.baseUrl}/docs/${page.slug}`,
    markdownUrl: `${context.baseUrl}/docs/${page.slug}.md`,
  }));
}

function searchScore(query, page) {
  const normalized = query.toLowerCase();
  const looksLikeTargetTask = activeScenario.targetKeywords.some((word) =>
    normalized.includes(word),
  );
  const baseScore = {
    target: looksLikeTargetTask ? 0.99 : 0.78,
    supporting: looksLikeTargetTask ? 0.62 : 0.48,
    neutral: looksLikeTargetTask ? 0.18 : 0.35,
    noisy: looksLikeTargetTask ? 0.04 : 0.2,
  }[page.relevance];
  const keywordBoost = page.keywords.some((keyword) => normalized.includes(keyword)) ? 0.12 : 0;
  return Number(Math.min(1, baseScore + keywordBoost).toFixed(2));
}

function farmingLabsTaskSpec(context) {
  if (activeScenario.id === "versioned-agent-endpoint") {
    return {
      id: activeScenario.id,
      task: activeScenario.targetTask,
      readingOrder: [
        "/docs.md",
        "/docs/core/support-agent-v2.md",
        "/docs/migration/v1-to-v2.md only if comparing old and new behavior",
      ],
      canonicalPages: ["/docs/core/support-agent-v2.md"],
      deprecatedPages: ["/docs/core/support-agent-v1.md"],
      requiredFiles: [
        "lib/support-agent-endpoint.ts",
        "app/api/support-agent/route.ts",
        "app/page.tsx",
      ],
      requiredExports: ["buildSupportAgentV2Response"],
      requiredConstants: {
        SUPPORT_AGENT_API_VERSION: "2026-04-21.v2",
        SUPPORT_AGENT_RESPONSE_SCHEMA: "support-agent.response.v2",
        SUPPORT_AGENT_CONTEXT_HEADER: "x-northstar-agent-context",
        SUPPORT_AGENT_TOOLS: ["search_docs", "read_page", "create_ticket", "handoff_to_human"],
      },
      responseFields: ["version", "schema", "contextHeader", "tools", "safety", "prompt"],
      safety: {
        requiresHumanFor: ["billing_changes", "account_deletion", "access_changes"],
      },
      requiredPolicyLines: [
        "Use the v2 support-agent contract.",
        "Never return the v1 response shape.",
        "Search docs before reading a page.",
        "Escalate billing data changes to a human.",
        "Use handoff_to_human for account deletion or access changes.",
      ],
      forbidden: [
        "support-agent.response.v1",
        "2025-11-01.v1",
        "x-startup-agent-context",
        "agent-prompt-v1",
      ],
      acceptanceCommand: activeScenario.acceptanceCommand,
      docsBaseUrl: context.baseUrl,
    };
  }

  return {
    id: activeScenario.id,
    task: activeScenario.targetTask,
    readingOrder: ["/docs.md", "/docs/core/support-agent-prompting.md if more detail is needed"],
    canonicalPages: ["/docs/core/support-agent-prompting.md"],
    deprecatedPages: [],
    requiredFiles: ["lib/agent-prompt.ts", "app/api/agent/route.ts", "app/page.tsx"],
    requiredExports: ["buildSupportAgentPrompt"],
    requiredConstants: {
      AGENT_PROMPT_VERSION: "agent-prompt-v1",
      AGENT_CONTEXT_HEADER: "x-startup-agent-context",
      SUPPORT_AGENT_TOOLS: ["search_docs", "read_page", "create_ticket"],
    },
    requiredPolicyLines: [
      "Resolve the user's intent before choosing a tool.",
      "Fetch /docs.md before answering implementation questions.",
      "Prefer search_docs before read_page.",
      "Escalate billing data changes to a human.",
    ],
    forbidden: ["package installation", "docs edits", "billing API implementation", "theme edits"],
    acceptanceCommand: activeScenario.acceptanceCommand,
    docsBaseUrl: context.baseUrl,
  };
}

function farmingLabsAgentSpec(context) {
  return {
    version: "1",
    name: "Northstar CRM Developer Docs",
    scenario: activeScenario.id,
    site: {
      title: "Northstar CRM Developer Docs",
      baseUrl: context.baseUrl,
      entry: "docs",
    },
    capabilities: {
      markdownRoutes: true,
      acceptTextMarkdown: true,
      agentBlocks: true,
      agentMdOverrides: true,
      llms: true,
      skills: true,
      mcp: true,
      search: true,
      agentFeedback: true,
    },
    api: {
      docs: "/api/docs",
      agentSpec: "/api/docs/agent/spec",
      feedbackSchema: "/api/docs/agent/feedback/schema",
      feedbackSubmit: "/api/docs/agent/feedback",
      mcp: "/api/docs/mcp",
    },
    markdown: {
      root: "/docs.md",
      pagePattern: "/docs/{slug}.md",
      acceptHeader: "text/markdown",
      apiPattern: "/api/docs?format=markdown&path={slug}",
    },
    search: {
      endpoint: "/api/docs?query={query}",
      queryParam: "query",
      recommendedQuery: activeScenario.recommendedQuery,
    },
    instructions: {
      firstStep: "Read /docs.md, then use this spec and targeted search.",
      targetTask: activeScenario.targetTask,
      avoid: activeScenario.avoid,
    },
    tasks: {
      [activeScenario.id]: farmingLabsTaskSpec(context),
    },
  };
}

async function startDocsServer(provider, logFile) {
  const context = { baseUrl: "" };
  await mkdir(path.dirname(logFile), { recursive: true });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const accept = String(req.headers.accept ?? "");
    const headers = { "Cache-Control": "no-store" };
    if (provider === "mintlify") {
      headers.Link = '</llms.txt>; rel="llms-txt"';
      headers["X-Llms-Txt"] = "/llms.txt";
    }

    async function send(status, body, extraHeaders = {}) {
      const text = typeof body === "string" ? body : json(body);
      const responseHeaders = {
        ...headers,
        "Content-Type":
          typeof body === "string"
            ? "text/markdown; charset=utf-8"
            : "application/json; charset=utf-8",
        ...extraHeaders,
      };
      await appendFile(
        logFile,
        `${JSON.stringify({
          timestamp: now(),
          provider,
          method: req.method,
          url: url.pathname + url.search,
          accept,
          status,
          responseBytes: Buffer.byteLength(text),
          contentType: responseHeaders["Content-Type"],
        })}\n`,
      );
      res.writeHead(status, responseHeaders);
      res.end(text);
    }

    if (provider === "mintlify" && url.pathname === "/llms.txt") {
      const body = providerFile(provider, "llms.txt", context);
      return send(body ? 200 : 404, body ?? "Not found");
    }

    if (provider === "mintlify" && url.pathname === "/skill.md") {
      return send(
        200,
        `# Northstar CRM Docs Benchmark Skill

Use ${context.baseUrl}/llms.txt to find the targeted implementation page.

Scenario: ${activeScenario.id}

Task: ${activeScenario.targetTask}

Run ${activeScenario.acceptanceCommand} after editing.
`,
      );
    }

    if (provider === "farming-labs" && url.pathname === "/api/docs/agent/spec") {
      return send(200, farmingLabsAgentSpec(context));
    }

    if (provider === "farming-labs" && url.pathname === "/api/docs") {
      const format = url.searchParams.get("format");
      const pagePath = url.searchParams.get("path");
      const query = url.searchParams.get("query");

      if (format === "markdown" && pagePath) {
        const docFile = docFileForPath(provider, `/docs/${pagePath}.md`);
        const body = docFile ? providerFile(provider, docFile, context) : null;
        return send(body ? 200 : 404, body ?? "Not found");
      }

      if (format === "llms" || format === "llms-full") {
        const pages = docsList(context)
          .map((page) => `- [${page.title}](${page.markdownUrl})`)
          .join("\n");
        return send(200, `# Northstar CRM Developer Docs\n\n${pages}\n`);
      }

      if (query) {
        const results = docsList(context)
          .map((page) => ({
            ...page,
            score: searchScore(query, page),
          }))
          .sort((a, b) => b.score - a.score);
        return send(200, { query, results });
      }
    }

    const docFile = docFileForPath(provider, url.pathname);
    if (docFile) {
      const body = providerFile(provider, docFile, context);
      if (body) return send(200, body);
    }

    return send(404, "Not found");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start docs server");
  context.baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl: context.baseUrl };
}

async function createProviderWorkspace(provider, workspaceDir) {
  const projectDir = providerProjectRoot(provider);
  if (!existsSync(projectDir)) {
    throw new Error(
      `Missing project for provider "${provider}": ${projectDir}`,
    );
  }

  const ignoredWorkspaceDirs = new Set([
    "artifacts",
    "node_modules",
    ".next",
    ".next-build",
    ".turbo",
    "dist",
    "out",
  ]);

  await cp(projectDir, workspaceDir, {
    recursive: true,
    force: true,
    filter(source) {
      const relativePath = path.relative(projectDir, source);
      if (!relativePath) return true;

      return !relativePath
        .split(path.sep)
        .some((segment) => ignoredWorkspaceDirs.has(segment));
    },
  });
}

function buildPrompt(baseUrl) {
  return `You are benchmarking how easy a documentation framework is for implementation agents.

Docs base URL: ${baseUrl}
Scenario: ${activeScenario.id}

Use only the documentation at that base URL. Do not use the public internet and do not rely on prior
knowledge of this documented subject's APIs. Start by fetching ${baseUrl}/docs.md and follow the provider's
machine-readable discovery instructions from there.

Task:
${activeScenario.promptTask}

Constraints:
- Update only the local artifact workspace files.
- Do not install packages.
- Keep the existing homepage content intact.
- Run ${activeScenario.acceptanceCommand}.
- Finish only after acceptance passes or you are truly blocked.

At the end, summarize:
- Which docs URLs you fetched.
- Which docs page was the first truly relevant page.
- What files you changed.
- Any wrong pages, command errors, or confusing docs.
- Whether acceptance passed.
`;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function parseJsonLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function secondsBetween(start, end) {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Number(((endMs - startMs) / 1000).toFixed(3));
}

function formatSeconds(value) {
  return typeof value === "number" ? `${value}s` : "n/a";
}

function scoreDocs(provider, requests) {
  const docsRequests = requests.filter((event) => event.url && event.status !== 404);
  const catalogBySlug = new Map(activeScenario.docsCatalog.map((page) => [page.slug, page]));

  function classifyRequest(event) {
    const url = new URL(event.url, "http://benchmark.local");
    const isAgentSpec = provider === "farming-labs" && url.pathname === "/api/docs/agent/spec";
    const isSearch =
      provider === "farming-labs" &&
      url.pathname === "/api/docs" &&
      url.searchParams.has("query");
    const isLlms = url.pathname === "/llms.txt";
    const isSkill = url.pathname === "/skill.md";
    const slug =
      url.pathname === "/api/docs" && url.searchParams.get("path")
        ? url.searchParams.get("path")
        : docSlugForPath(url.pathname);
    const catalogPage = slug ? catalogBySlug.get(slug) : null;
    const isFullDump = url.searchParams.get("format") === "llms-full";

    if (isAgentSpec) {
      return {
        event,
        slug: null,
        kind: "target",
        resourceId: "agent-spec",
        agentInstruction: true,
        targetSource: "agent-spec",
      };
    }

    if (slug === "" && provider === "farming-labs") {
      return {
        event,
        slug,
        kind: "target",
        resourceId: "root-docs",
        agentInstruction: true,
        targetSource: "root-agent-runbook",
      };
    }

    if (isSearch) {
      return {
        event,
        slug: null,
        kind: "search",
        resourceId: `search:${url.searchParams.get("query") ?? ""}`,
        agentInstruction: false,
        targetSource: null,
      };
    }

    if (isLlms || isSkill || slug === "") {
      return {
        event,
        slug,
        kind: "discovery",
        resourceId: isLlms ? "llms" : isSkill ? "skill" : "root-docs",
        agentInstruction: false,
        targetSource: null,
      };
    }

    return {
      event,
      slug,
      kind:
        catalogPage?.relevance ??
        (isFullDump || url.pathname.includes("llms-full") ? "noisy" : "discovery"),
      resourceId: slug ? `page:${slug}` : url.pathname,
      agentInstruction: false,
      targetSource: catalogPage?.relevance === "target" ? "target-page" : null,
    };
  }

  const classified = docsRequests.map((event) => {
    return classifyRequest(event);
  });
  const relevant = classified.filter((entry) => entry.kind === "target").map((entry) => entry.event);
  const supporting = classified
    .filter((entry) => entry.kind === "supporting")
    .map((entry) => entry.event);
  const neutral = classified.filter((entry) => entry.kind === "neutral").map((entry) => entry.event);
  const noisy = classified.filter((entry) => entry.kind === "noisy").map((entry) => entry.event);
  const discovery = classified
    .filter((entry) => entry.kind === "discovery")
    .map((entry) => entry.event);
  const search = classified.filter((entry) => entry.kind === "search").map((entry) => entry.event);
  const agentInstruction = classified
    .filter((entry) => entry.agentInstruction)
    .map((entry) => entry.event);
  const uniqueResources = new Set(classified.map((entry) => entry.resourceId));
  const discoveryUsed =
    provider === "farming-labs"
      ? agentInstruction.length > 0 ||
        docsRequests.some((event) => event.url.includes("/api/docs?query="))
      : docsRequests.some(
          (event) =>
            event.url === "/docs.md" ||
            event.url.includes("/llms.txt") ||
            event.url.includes("/skill.md"),
        );
  const firstRelevant = relevant[0] ?? null;
  const firstRelevantIndex = firstRelevant ? docsRequests.indexOf(firstRelevant) : -1;
  const normalizedRetrievalSteps = firstRelevantIndex >= 0 ? firstRelevantIndex + 1 : null;
  const noisyBeforeRelevant =
    firstRelevantIndex >= 0
      ? docsRequests.slice(0, firstRelevantIndex).filter((event) => noisy.includes(event)).length
      : noisy.length;
  const neutralBeforeRelevant =
    firstRelevantIndex >= 0
      ? docsRequests.slice(0, firstRelevantIndex).filter((event) => neutral.includes(event)).length
      : neutral.length;
  const supportingBeforeRelevant =
    firstRelevantIndex >= 0
      ? docsRequests
          .slice(0, firstRelevantIndex)
          .filter((event) => supporting.includes(event)).length
      : supporting.length;
  const offTargetBeforeRelevant = noisyBeforeRelevant + neutralBeforeRelevant;

  return {
    docsFetches: docsRequests.length,
    rawDocsFetches: docsRequests.length,
    uniqueDocsResources: uniqueResources.size,
    totalDocsBytes: docsRequests.reduce((sum, event) => sum + (event.responseBytes ?? 0), 0),
    relevantFetches: relevant.length,
    targetFetches: relevant.length,
    discoveryFetches: discovery.length,
    searchFetches: search.length,
    agentInstructionFetches: agentInstruction.length,
    supportingFetches: supporting.length,
    neutralFetches: neutral.length,
    wrongOrNoisyFetches: noisy.length,
    normalizedRetrievalSteps,
    noisyBeforeRelevant,
    neutralBeforeRelevant,
    supportingBeforeRelevant,
    offTargetBeforeRelevant,
    firstDocsFetchAt: docsRequests[0]?.timestamp ?? null,
    firstRelevantAt: firstRelevant?.timestamp ?? null,
    firstRelevantUrl: firstRelevant?.url ?? null,
    firstRelevantSource:
      classified.find((entry) => entry.event === firstRelevant)?.targetSource ?? null,
    discoveryUsed,
    requestBreakdown: {
      discovery: discovery.length,
      search: search.length,
      agentInstruction: agentInstruction.length,
      target: relevant.length,
      supporting: supporting.length,
      neutral: neutral.length,
      noisy: noisy.length,
    },
    pageTimingScore: Math.max(
      0,
      Math.min(
        100,
        100 +
          (discoveryUsed ? 10 : 0) -
          noisyBeforeRelevant * 8 -
          neutralBeforeRelevant * 4 -
          (firstRelevant ? 0 : 25),
      ),
    ),
  };
}

function commandErrors(events) {
  return events.filter((event) => {
    if (event.type !== "item.completed") return false;
    if (event.item?.type !== "command_execution") return false;
    if (typeof event.item.exit_code !== "number") return false;
    return event.item.exit_code !== 0;
  });
}

function isInfrastructureFailure({ codex, usage, finalMessage }) {
  const totalTokens =
    (usage.input_tokens ?? 0) + (usage.cached_input_tokens ?? 0) + (usage.output_tokens ?? 0);

  return codex.code !== 0 && totalTokens === 0 && !existsSync(finalMessage);
}

function readSupportPromptingWorkspaceSummary(workspaceDir) {
  const prompt = existsSync(path.join(workspaceDir, "lib", "agent-prompt.ts"))
    ? readFileSync(path.join(workspaceDir, "lib", "agent-prompt.ts"), "utf8")
    : "";
  const route = existsSync(path.join(workspaceDir, "app", "api", "agent", "route.ts"))
    ? readFileSync(path.join(workspaceDir, "app", "api", "agent", "route.ts"), "utf8")
    : "";
  const page = existsSync(path.join(workspaceDir, "app", "page.tsx"))
    ? readFileSync(path.join(workspaceDir, "app", "page.tsx"), "utf8")
    : "";

  return {
    promptVersion: prompt.includes('AGENT_PROMPT_VERSION = "agent-prompt-v1"'),
    contextHeader: prompt.includes('AGENT_CONTEXT_HEADER = "x-startup-agent-context"'),
    tools: ["search_docs", "read_page", "create_ticket"].every((tool) => prompt.includes(tool)),
    promptBuilder: prompt.includes("buildSupportAgentPrompt"),
    policyLines: [
      "Resolve the user's intent before choosing a tool.",
      "Fetch /docs.md before answering implementation questions.",
      "Prefer search_docs before read_page.",
      "Escalate billing data changes to a human.",
    ].every((line) => prompt.includes(line)),
    route: route.includes("POST") && route.includes("buildSupportAgentPrompt"),
    homepage: page.includes("Northstar CRM") && page.includes("Agent prompting endpoint ready"),
  };
}

function readVersionedEndpointWorkspaceSummary(workspaceDir) {
  const helper = existsSync(path.join(workspaceDir, "lib", "support-agent-endpoint.ts"))
    ? readFileSync(path.join(workspaceDir, "lib", "support-agent-endpoint.ts"), "utf8")
    : "";
  const route = existsSync(path.join(workspaceDir, "app", "api", "support-agent", "route.ts"))
    ? readFileSync(path.join(workspaceDir, "app", "api", "support-agent", "route.ts"), "utf8")
    : "";
  const page = existsSync(path.join(workspaceDir, "app", "page.tsx"))
    ? readFileSync(path.join(workspaceDir, "app", "page.tsx"), "utf8")
    : "";
  const combined = `${helper}\n${route}`;

  return {
    apiVersion: helper.includes('SUPPORT_AGENT_API_VERSION = "2026-04-21.v2"'),
    schema: helper.includes('SUPPORT_AGENT_RESPONSE_SCHEMA = "support-agent.response.v2"'),
    contextHeader: helper.includes('SUPPORT_AGENT_CONTEXT_HEADER = "x-northstar-agent-context"'),
    tools: ["search_docs", "read_page", "create_ticket", "handoff_to_human"].every((tool) =>
      helper.includes(tool),
    ),
    responseBuilder: helper.includes("buildSupportAgentV2Response"),
    safety: ["billing_changes", "account_deletion", "access_changes"].every((item) =>
      helper.includes(item),
    ),
    policyLines: [
      "Use the v2 support-agent contract.",
      "Never return the v1 response shape.",
      "Search docs before reading a page.",
      "Escalate billing data changes to a human.",
      "Use handoff_to_human for account deletion or access changes.",
    ].every((line) => helper.includes(line)),
    route: route.includes("POST") && route.includes("buildSupportAgentV2Response"),
    noDeprecatedV1:
      !combined.includes("support-agent.response.v1") &&
      !combined.includes("2025-11-01.v1") &&
      !combined.includes("agent-prompt-v1"),
    homepage: page.includes("Northstar CRM") && page.includes("Support agent v2 endpoint ready"),
  };
}

function readWorkspaceSummary(workspaceDir) {
  if (activeScenario.id === "versioned-agent-endpoint") {
    return readVersionedEndpointWorkspaceSummary(workspaceDir);
  }

  return readSupportPromptingWorkspaceSummary(workspaceDir);
}

function readWorkspacePackage(workspaceDir) {
  const packageFile = path.join(workspaceDir, "package.json");
  if (!existsSync(packageFile)) return null;

  const packageJson = JSON.parse(readFileSync(packageFile, "utf8"));
  return {
    name: packageJson.name ?? null,
    docsProvider: packageJson.benchmark?.docsProvider ?? null,
    docsFrameworkPackages: packageJson.benchmark?.docsFrameworkPackages ?? [],
    scaffoldCommand: packageJson.benchmark?.scaffoldCommand ?? null,
    implementationFramework: packageJson.benchmark?.implementationFramework ?? null,
  };
}

async function writeResultMarkdown(artifactDir, result, requests) {
  const requestRows = requests.map(
    (event) =>
      `| ${event.timestamp} | ${event.method} | \`${event.url}\` | ${event.status} | ${event.responseBytes} |`,
  );
  const lines = [
    `# ${result.provider} Codex Result`,
    "",
    "## Outcome",
    "",
    `- Attempt: ${result.attempt}`,
    `- Implementation framework: ${result.implementation_framework}`,
    `- Project: ${result.project_dir}`,
    `- Docs base URL given to Codex: ${result.docs_base_url}`,
    `- Valid attempt: ${result.valid_attempt}`,
    `- Infrastructure failure: ${result.infrastructure_failure}`,
    `- Success: ${result.success}`,
    `- Error-free run: ${result.error_free}`,
    `- Acceptance passed: ${result.acceptance_passed}`,
    `- Implementation ease score: ${result.implementation_ease_score}`,
    `- Weighted errors: ${result.weighted_errors}`,
    `- Time to first docs fetch: ${formatSeconds(result.time.time_to_first_docs_fetch_seconds)}`,
    `- Time to first relevant page: ${formatSeconds(result.time.time_to_first_relevant_page_seconds)}`,
    `- Time to full implementation: ${formatSeconds(result.time.time_to_full_implementation_seconds)}`,
    "",
    "## Cost Proxies",
    "",
    `- Input tokens: ${result.usage.input_tokens}`,
    `- Cached input tokens: ${result.usage.cached_input_tokens}`,
    `- Output tokens: ${result.usage.output_tokens}`,
    `- Raw docs fetches: ${result.docs.rawDocsFetches}`,
    `- Unique docs resources: ${result.docs.uniqueDocsResources}`,
    `- Normalized retrieval steps: ${result.docs.normalizedRetrievalSteps ?? "none"}`,
    `- Docs bytes: ${result.docs.totalDocsBytes}`,
    `- Estimated model cost: ${result.estimated_model_cost_usd ?? "not configured"}`,
    "",
    "## Error Metrics",
    "",
    `- Infrastructure failure: ${result.errors.infrastructureFailure}`,
    `- Acceptance failure: ${result.errors.acceptanceFailure}`,
    `- Command errors: ${result.errors.commandErrors}`,
    `- Missing artifact checks: ${result.errors.missingArtifactChecks}`,
    `- Wrong/noisy docs fetches: ${result.errors.wrongOrNoisyFetches}`,
    `- Noisy docs fetches before first relevant page: ${result.errors.noisyBeforeRelevant}`,
    `- Neutral docs fetches before first relevant page: ${result.errors.neutralBeforeRelevant}`,
    `- Off-target docs fetches before first relevant page: ${result.errors.offTargetBeforeRelevant}`,
    "",
    "## Retrieval",
    "",
    `- Discovery used: ${result.docs.discoveryUsed}`,
    `- First relevant URL: ${result.docs.firstRelevantUrl ?? "none"}`,
    `- First relevant source: ${result.docs.firstRelevantSource ?? "none"}`,
    `- Relevant fetches: ${result.docs.relevantFetches}`,
    `- Agent instruction fetches: ${result.docs.agentInstructionFetches}`,
    `- Discovery fetches: ${result.docs.discoveryFetches}`,
    `- Search fetches: ${result.docs.searchFetches}`,
    `- Supporting fetches: ${result.docs.supportingFetches}`,
    `- Neutral fetches: ${result.docs.neutralFetches}`,
    `- Wrong/noisy fetches: ${result.docs.wrongOrNoisyFetches}`,
    `- Supporting fetches before first relevant: ${result.docs.supportingBeforeRelevant}`,
    `- Neutral fetches before first relevant: ${result.docs.neutralBeforeRelevant}`,
    `- Noisy fetches before first relevant: ${result.docs.noisyBeforeRelevant}`,
    `- Off-target fetches before first relevant: ${result.docs.offTargetBeforeRelevant}`,
    `- Page timing score: ${result.docs.pageTimingScore}`,
    "",
    "## Artifact Checks",
    "",
    ...Object.entries(result.workspace).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Request Log",
    "",
    "| Time | Method | URL | Status | Bytes |",
    "| ---- | ------ | --- | ------ | ----- |",
    ...requestRows,
    "",
  ];
  await writeFile(path.join(artifactDir, "result.md"), lines.join("\n"));
}

async function runProvider(provider, attempt) {
  const projectDir = providerProjectRoot(provider);
  const artifactDir = path.join(benchmarkRoot, "artifacts", runId, provider, `attempt-${attempt}`);
  const workspaceDir = path.join(artifactDir, "workspace");
  const docsLog = path.join(artifactDir, "docs-requests.jsonl");
  const eventsLog = path.join(artifactDir, "codex-events.jsonl");
  const stderrLog = path.join(artifactDir, "codex-stderr.log");
  const finalMessage = path.join(artifactDir, "codex-final.md");

  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(workspaceDir, { recursive: true });
  await createProviderWorkspace(provider, workspaceDir);

  const { server, baseUrl } = await startDocsServer(provider, docsLog);
  const startedAt = now();

  try {
    const prompt = buildPrompt(baseUrl);
    await writeFile(path.join(artifactDir, "prompt.txt"), prompt);

    const codex = await runCommand(
      codexBin,
      [
        "exec",
        "--json",
        "--ephemeral",
        "--skip-git-repo-check",
        "-s",
        "danger-full-access",
        "-C",
        workspaceDir,
        "-o",
        finalMessage,
        prompt,
      ],
      { cwd: workspaceDir, env: { ...process.env, BENCHMARK_SCENARIO: activeScenario.id } },
    );
    await writeFile(eventsLog, codex.stdout);
    await writeFile(stderrLog, codex.stderr);

    const acceptance = await runCommand("node", ["scripts/acceptance.mjs"], {
      cwd: workspaceDir,
      env: { ...process.env, BENCHMARK_SCENARIO: activeScenario.id },
    });
    const completedAt = now();
    await writeFile(path.join(artifactDir, "acceptance.stdout.log"), acceptance.stdout);
    await writeFile(path.join(artifactDir, "acceptance.stderr.log"), acceptance.stderr);

    const events = parseJsonLines(codex.stdout);
    const usage = events
      .filter((event) => event.type === "turn.completed" && event.usage)
      .reduce(
        (sum, event) => ({
          input_tokens: sum.input_tokens + (event.usage.input_tokens ?? 0),
          cached_input_tokens: sum.cached_input_tokens + (event.usage.cached_input_tokens ?? 0),
          output_tokens: sum.output_tokens + (event.usage.output_tokens ?? 0),
        }),
        { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
      );
    const requests = existsSync(docsLog) ? parseJsonLines(await readFile(docsLog, "utf8")) : [];
    const docs = scoreDocs(provider, requests);
    const workspace = readWorkspaceSummary(workspaceDir);
    const workspacePackage = readWorkspacePackage(workspaceDir);
    const cmdErrors = commandErrors(events);
    const acceptancePassed = acceptance.code === 0;
    const infrastructureFailure = isInfrastructureFailure({ codex, usage, finalMessage });
    const validAttempt = !infrastructureFailure;
    const success =
      validAttempt && acceptancePassed && docs.relevantFetches > 0 && docs.discoveryUsed;
    const missingArtifactChecks = Object.values(workspace).filter((value) => value !== true).length;
    const weightedErrors =
      (validAttempt && !acceptancePassed ? 10 : 0) +
      (docs.relevantFetches > 0 ? 0 : 8) +
      (docs.discoveryUsed ? 0 : 3) +
      docs.noisyBeforeRelevant +
      docs.neutralBeforeRelevant * 0.5 +
      cmdErrors.length * 2 +
      (validAttempt ? missingArtifactChecks * 2 : 0);
    const implementationEaseScore = validAttempt
      ? Math.max(0, Math.min(100, docs.pageTimingScore - weightedErrors * 6 + (success ? 5 : 0)))
      : 0;
    const errorFree =
      validAttempt &&
      success &&
      cmdErrors.length === 0 &&
      docs.offTargetBeforeRelevant === 0 &&
      missingArtifactChecks === 0;
    const estimatedModelCostUsd =
      (usage.input_tokens / 1_000_000) * inputUsdPerMillion +
      (usage.output_tokens / 1_000_000) * outputUsdPerMillion;

    const result = {
      run_id: runId,
      scenario: activeScenario.id,
      provider,
      agent: "codex",
      attempt,
      docs_base_url: baseUrl,
      implementation_framework:
        workspacePackage?.implementationFramework ?? "nextjs-app-router",
      project_dir: path.relative(repoRoot, projectDir),
      artifact_dir: path.relative(repoRoot, artifactDir),
      workspace_dir: path.relative(repoRoot, workspaceDir),
      started_at: startedAt,
      completed_at: completedAt,
      valid_attempt: validAttempt,
      infrastructure_failure: infrastructureFailure,
      codex_exit_code: codex.code,
      acceptance_exit_code: acceptance.code,
      acceptance_passed: acceptancePassed,
      success,
      error_free: errorFree,
      implementation_ease_score: implementationEaseScore,
      weighted_errors: weightedErrors,
      command_error_count: cmdErrors.length,
      missing_artifact_checks: missingArtifactChecks,
      usage,
      estimated_model_cost_usd:
        inputUsdPerMillion || outputUsdPerMillion ? Number(estimatedModelCostUsd.toFixed(6)) : null,
      time: {
        time_to_first_docs_fetch_seconds: secondsBetween(startedAt, docs.firstDocsFetchAt),
        time_to_first_relevant_page_seconds: secondsBetween(startedAt, docs.firstRelevantAt),
        time_to_full_implementation_seconds: secondsBetween(startedAt, completedAt),
      },
      docs,
      errors: {
        infrastructureFailure,
        acceptanceFailure: !acceptancePassed,
        commandErrors: cmdErrors.length,
        missingArtifactChecks,
        wrongOrNoisyFetches: docs.wrongOrNoisyFetches,
        noisyBeforeRelevant: docs.noisyBeforeRelevant,
        neutralBeforeRelevant: docs.neutralBeforeRelevant,
        offTargetBeforeRelevant: docs.offTargetBeforeRelevant,
        weightedErrors,
      },
      workspace,
      package: workspacePackage,
      files: {
        prompt: path.relative(repoRoot, path.join(artifactDir, "prompt.txt")),
        final_message: path.relative(repoRoot, finalMessage),
        events: path.relative(repoRoot, eventsLog),
        docs_requests: path.relative(repoRoot, docsLog),
        result: path.relative(repoRoot, path.join(artifactDir, "result.md")),
      },
    };

    await writeFile(path.join(artifactDir, "result.json"), json(result));
    await writeResultMarkdown(artifactDir, result, requests);
    return result;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

for (const provider of providers) {
  if (!supportedProviders.has(provider)) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

const results = [];
for (const provider of providers) {
  let validAttempts = 0;
  let startedAttempts = 0;

  while (validAttempts < repeats && startedAttempts < repeats + invalidRetries) {
    startedAttempts += 1;
    const result = await runProvider(provider, startedAttempts);
    results.push(result);

    if (result.valid_attempt) {
      validAttempts += 1;
    }
  }
}

function average(values) {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function median(values) {
  const sorted = values.filter((value) => typeof value === "number").sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(3));
}

function rate(count, total) {
  if (total === 0) return 0;
  return Number((count / total).toFixed(3));
}

const comparisonMetrics = [
  { key: "success_rate", label: "Success rate", better: "higher" },
  { key: "task_error_rate", label: "Task error rate", better: "lower" },
  { key: "acceptance_error_rate", label: "Acceptance error rate", better: "lower" },
  { key: "session_error_rate", label: "Session error rate", better: "lower" },
  { key: "docs_error_rate", label: "Docs error rate", better: "lower" },
  { key: "error_free_rate", label: "Error-free rate", better: "higher" },
  { key: "median_full_time_seconds", label: "Time to full implementation", better: "lower" },
  { key: "median_first_relevant_seconds", label: "Time to first relevant page", better: "lower" },
  { key: "mean_weighted_errors", label: "Mean weighted errors", better: "lower" },
  { key: "mean_command_errors", label: "Mean command errors", better: "lower" },
  { key: "mean_wrong_or_noisy_fetches", label: "Mean noisy docs fetches", better: "lower" },
  {
    key: "mean_off_target_before_relevant",
    label: "Mean off-target before relevant",
    better: "lower",
  },
  { key: "mean_docs_fetches", label: "Mean raw docs fetches", better: "lower" },
  { key: "mean_unique_docs_resources", label: "Mean unique docs resources", better: "lower" },
  { key: "mean_discovery_fetches", label: "Mean discovery fetches", better: "lower" },
  {
    key: "mean_agent_instruction_fetches",
    label: "Mean agent instruction fetches",
    better: "higher",
  },
  {
    key: "mean_normalized_retrieval_steps",
    label: "Mean normalized retrieval steps",
    better: "lower",
  },
  { key: "mean_docs_bytes", label: "Mean docs bytes", better: "lower" },
  { key: "mean_input_tokens", label: "Mean input tokens", better: "lower" },
  { key: "mean_output_tokens", label: "Mean output tokens", better: "lower" },
];

function formatMetricValue(value) {
  if (typeof value !== "number") return "n/a";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 3,
  });
}

function compareAggregate(aggregate) {
  return comparisonMetrics.map((metric) => {
    const values = aggregate.map((result) => ({
      provider: result.provider,
      value: result[metric.key],
    }));
    const numericValues = values.filter((entry) => typeof entry.value === "number");

    if (numericValues.length === 0) {
      return { ...metric, winner: "tie", values };
    }

    const bestValue =
      metric.better === "higher"
        ? Math.max(...numericValues.map((entry) => entry.value))
        : Math.min(...numericValues.map((entry) => entry.value));
    const tiedProviders = numericValues.filter((entry) => Math.abs(entry.value - bestValue) < 0.001);

    return {
      ...metric,
      winner: tiedProviders.length > 1 ? "tie" : tiedProviders[0].provider,
      values,
    };
  });
}

function providerNamesFromComparison(comparison) {
  return comparison[0]?.values.map((entry) => entry.provider) ?? [];
}

function comparisonTable(comparison) {
  const providerNames = providerNamesFromComparison(comparison);
  return [
    `| Metric | Better | ${providerNames.join(" | ")} | Winner |`,
    `| ------ | ------ | ${providerNames.map(() => "------").join(" | ")} | ------ |`,
    ...comparison.map((result) => {
      const providerValues = providerNames.map((provider) => {
        const entry = result.values.find((value) => value.provider === provider);
        return formatMetricValue(entry?.value);
      });
      return `| ${result.label} | ${result.better} | ${providerValues.join(" | ")} | ${result.winner} |`;
    }),
  ];
}

function summaryMarkdown(runId, repeats, analysisDir, aggregate, comparison, results) {
  return [
    `# Codex Benchmark Summary ${runId}`,
    "",
    "## Run",
    "",
    `- Scenario: \`${activeScenario.id}\``,
    `- Provider layout: \`benchmark/codex/<provider>\``,
    `- Target valid attempts per provider: \`${repeats}\``,
    `- Invalid attempt retry budget: \`${invalidRetries}\``,
    `- Analysis output: \`${path.relative(repoRoot, analysisDir)}\``,
    "",
    "## Outcome",
    "",
    "| Provider | Started | Valid | Invalid | Success | Error-Free | Task Error | Acceptance Error | Session Error | Docs Error |",
    "| -------- | ------- | ----- | ------- | ------- | ---------- | ---------- | ---------------- | ------------- | ---------- |",
    ...aggregate.map(
      (result) =>
        `| ${result.provider} | ${result.attempts_started} | ${result.valid_attempts} | ${result.invalid_attempts} | ${formatMetricValue(result.success_rate)} | ${formatMetricValue(result.error_free_rate)} | ${formatMetricValue(result.task_error_rate)} | ${formatMetricValue(result.acceptance_error_rate)} | ${formatMetricValue(result.session_error_rate)} | ${formatMetricValue(result.docs_error_rate)} |`,
    ),
    "",
    "## Speed And Retrieval",
    "",
    "| Provider | Median Full Time | Median First Relevant | Raw Fetches | Unique Resources | Discovery Fetches | Agent Instruction Fetches | Target/Fact Fetches | Docs Bytes | Input Tokens | Output Tokens |",
    "| -------- | ---------------- | --------------------- | ----------- | ---------------- | ----------------- | ------------------------- | ------------------- | ---------- | ------------ | ------------- |",
    ...aggregate.map(
      (result) =>
        `| ${result.provider} | ${formatMetricValue(result.median_full_time_seconds)}s | ${formatMetricValue(result.median_first_relevant_seconds)}s | ${formatMetricValue(result.mean_docs_fetches)} | ${formatMetricValue(result.mean_unique_docs_resources)} | ${formatMetricValue(result.mean_discovery_fetches)} | ${formatMetricValue(result.mean_agent_instruction_fetches)} | ${formatMetricValue(result.mean_target_fetches)} | ${formatMetricValue(result.mean_docs_bytes)} | ${formatMetricValue(result.mean_input_tokens)} | ${formatMetricValue(result.mean_output_tokens)} |`,
    ),
    "",
    "## Wins And Ties",
    "",
    ...comparisonTable(comparison),
    "",
    "## Attempts",
    "",
    "| Provider | Attempt | Valid | Infra Failure | Success | Error-Free | Full Time | First Relevant | Raw Fetches | Unique Resources | Target Source | Input Tokens | Output Tokens | Weighted Errors |",
    "| -------- | ------- | ----- | ------------- | ------- | ---------- | --------- | -------------- | ----------- | ---------------- | ------------- | ------------ | ------------- | --------------- |",
    ...results.map(
      (result) =>
        `| ${result.provider} | ${result.attempt} | ${result.valid_attempt} | ${result.infrastructure_failure} | ${result.success} | ${result.error_free} | ${formatMetricValue(result.time.time_to_full_implementation_seconds)}s | ${formatMetricValue(result.time.time_to_first_relevant_page_seconds)}s | ${formatMetricValue(result.docs.rawDocsFetches)} | ${formatMetricValue(result.docs.uniqueDocsResources)} | ${result.docs.firstRelevantSource ?? "none"} | ${formatMetricValue(result.usage.input_tokens)} | ${formatMetricValue(result.usage.output_tokens)} | ${formatMetricValue(result.weighted_errors)} |`,
    ),
    "",
    "Use `BENCHMARK_REPEATS=3` or higher before claiming an error-rate win.",
    "",
  ].join("\n");
}

function aggregateProviderResults(provider, providerResults) {
  const attemptsStarted = providerResults.length;
  const validResults = providerResults.filter((result) => result.valid_attempt !== false);
  const attempts = validResults.length;
  const invalidAttempts = attemptsStarted - attempts;
  const successes = validResults.filter((result) => result.success).length;
  const errorFreeRuns = validResults.filter((result) => result.error_free).length;
  const acceptanceFailures = validResults.filter((result) => !result.acceptance_passed).length;
  const sessionErrorRuns = validResults.filter(
    (result) =>
      !result.acceptance_passed ||
      result.command_error_count > 0 ||
      result.missing_artifact_checks > 0,
  ).length;
  const docsErrorRuns = validResults.filter(
    (result) => !result.docs.firstRelevantUrl || result.docs.offTargetBeforeRelevant > 0,
  ).length;

  return {
    provider,
    attempts_started: attemptsStarted,
    attempts,
    valid_attempts: attempts,
    invalid_attempts: invalidAttempts,
    invalid_attempt_rate: rate(invalidAttempts, attemptsStarted),
    success_rate: rate(successes, attempts),
    task_error_rate: rate(attempts - successes, attempts),
    error_free_rate: rate(errorFreeRuns, attempts),
    acceptance_error_rate: rate(acceptanceFailures, attempts),
    session_error_rate: rate(sessionErrorRuns, attempts),
    docs_error_rate: rate(docsErrorRuns, attempts),
    median_full_time_seconds: median(
      validResults.map((result) => result.time.time_to_full_implementation_seconds),
    ),
    median_first_relevant_seconds: median(
      validResults.map((result) => result.time.time_to_first_relevant_page_seconds),
    ),
    mean_weighted_errors: average(validResults.map((result) => result.weighted_errors)),
    mean_command_errors: average(validResults.map((result) => result.command_error_count)),
    mean_wrong_or_noisy_fetches: average(
      validResults.map((result) => result.docs.wrongOrNoisyFetches),
    ),
    mean_docs_fetches: average(validResults.map((result) => result.docs.docsFetches)),
    mean_unique_docs_resources: average(
      validResults.map((result) => result.docs.uniqueDocsResources),
    ),
    mean_discovery_fetches: average(validResults.map((result) => result.docs.discoveryFetches)),
    mean_agent_instruction_fetches: average(
      validResults.map((result) => result.docs.agentInstructionFetches),
    ),
    mean_target_fetches: average(validResults.map((result) => result.docs.targetFetches)),
    mean_normalized_retrieval_steps: average(
      validResults
        .map((result) => result.docs.normalizedRetrievalSteps)
        .filter((value) => typeof value === "number"),
    ),
    mean_docs_bytes: average(validResults.map((result) => result.docs.totalDocsBytes)),
    mean_supporting_fetches: average(validResults.map((result) => result.docs.supportingFetches)),
    mean_neutral_fetches: average(validResults.map((result) => result.docs.neutralFetches)),
    mean_off_target_before_relevant: average(
      validResults.map((result) => result.docs.offTargetBeforeRelevant),
    ),
    mean_input_tokens: average(validResults.map((result) => result.usage.input_tokens)),
    mean_output_tokens: average(validResults.map((result) => result.usage.output_tokens)),
  };
}

function metricLogEntry(result) {
  return {
    run_id: result.run_id,
    agent: result.agent,
    scenario: result.scenario,
    provider: result.provider,
    attempt: result.attempt,
    valid_attempt: result.valid_attempt,
    infrastructure_failure: result.infrastructure_failure,
    success: result.success,
    error_free: result.error_free,
    acceptance_passed: result.acceptance_passed,
    weighted_errors: result.weighted_errors,
    command_error_count: result.command_error_count,
    missing_artifact_checks: result.missing_artifact_checks,
    docs_fetches: result.docs.docsFetches,
    raw_docs_fetches: result.docs.rawDocsFetches,
    unique_docs_resources: result.docs.uniqueDocsResources,
    docs_bytes: result.docs.totalDocsBytes,
    relevant_fetches: result.docs.relevantFetches,
    target_fetches: result.docs.targetFetches,
    discovery_fetches: result.docs.discoveryFetches,
    search_fetches: result.docs.searchFetches,
    agent_instruction_fetches: result.docs.agentInstructionFetches,
    supporting_fetches: result.docs.supportingFetches,
    neutral_fetches: result.docs.neutralFetches,
    wrong_or_noisy_fetches: result.docs.wrongOrNoisyFetches,
    normalized_retrieval_steps: result.docs.normalizedRetrievalSteps,
    supporting_before_relevant: result.docs.supportingBeforeRelevant,
    neutral_before_relevant: result.docs.neutralBeforeRelevant,
    noisy_before_relevant: result.docs.noisyBeforeRelevant,
    off_target_before_relevant: result.docs.offTargetBeforeRelevant,
    first_relevant_url: result.docs.firstRelevantUrl,
    first_relevant_source: result.docs.firstRelevantSource,
    discovery_used: result.docs.discoveryUsed,
    input_tokens: result.usage.input_tokens,
    cached_input_tokens: result.usage.cached_input_tokens,
    output_tokens: result.usage.output_tokens,
    estimated_model_cost_usd: result.estimated_model_cost_usd,
    time_to_first_docs_fetch_seconds: result.time.time_to_first_docs_fetch_seconds,
    time_to_first_relevant_page_seconds: result.time.time_to_first_relevant_page_seconds,
    time_to_full_implementation_seconds: result.time.time_to_full_implementation_seconds,
    project_dir: result.project_dir,
    artifact_dir: result.artifact_dir,
    workspace_dir: result.workspace_dir,
  };
}

async function writeAnalysisOutputs(runId, aggregate, results) {
  const analysisDir = path.join(benchmarkRoot, "analysis", runId);
  await mkdir(analysisDir, { recursive: true });

  const metricRows = results.map(metricLogEntry);
  const comparison = compareAggregate(aggregate);
  await writeFile(
    path.join(analysisDir, "metric-log.jsonl"),
    `${metricRows.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
  );
  await writeFile(path.join(analysisDir, "aggregate.json"), json(aggregate));
  await writeFile(path.join(analysisDir, "comparison.json"), json(comparison));
  await writeFile(
    path.join(analysisDir, "report.md"),
    [
      `# Benchmark Analysis ${runId}`,
      "",
      "| Provider | Started | Valid | Invalid | Task Error Rate | Acceptance Error Rate | Session Error Rate | Docs Error Rate | Error-Free Rate | Median Full Time (s) | Mean Weighted Errors |",
      "| -------- | ------- | ----- | ------- | --------------- | --------------------- | ------------------ | --------------- | --------------- | -------------------- | -------------------- |",
      ...aggregate.map(
        (result) =>
          `| ${result.provider} | ${result.attempts_started} | ${result.valid_attempts} | ${result.invalid_attempts} | ${result.task_error_rate} | ${result.acceptance_error_rate} | ${result.session_error_rate} | ${result.docs_error_rate} | ${result.error_free_rate} | ${result.median_full_time_seconds ?? "n/a"} | ${result.mean_weighted_errors ?? "n/a"} |`,
      ),
      "",
      "## Metric Comparison",
      "",
      ...comparisonTable(comparison),
      "",
      "Raw per-attempt metrics are available in `metric-log.jsonl`.",
      "",
    ].join("\n"),
  );

  return analysisDir;
}

const aggregate = providers.map((provider) =>
  aggregateProviderResults(
    provider,
    results.filter((result) => result.provider === provider),
  ),
);
const comparison = compareAggregate(aggregate);

const summaryDir = path.join(benchmarkRoot, "artifacts", runId);
const analysisDir = await writeAnalysisOutputs(runId, aggregate, results);
await mkdir(summaryDir, { recursive: true });
await writeFile(
  path.join(summaryDir, "summary.json"),
  json({
    run_id: runId,
    agent: "codex",
    scenario: activeScenario.id,
    project_layout: "benchmark/codex/<provider>",
    repeats,
    invalid_retries: invalidRetries,
    analysis_dir: path.relative(repoRoot, analysisDir),
    aggregate,
    comparison,
    results,
  }),
);
await writeFile(
  path.join(summaryDir, "summary.md"),
  summaryMarkdown(runId, repeats, analysisDir, aggregate, comparison, results),
);

console.log(`Wrote summary: ${path.relative(process.cwd(), path.join(summaryDir, "summary.md"))}`);
