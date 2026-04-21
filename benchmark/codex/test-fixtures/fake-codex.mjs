#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function fetchDoc(baseUrl, route) {
  const response = await fetch(`${baseUrl}${route}`);
  await response.text();
}

async function writeSupportPromptingImplementation(workspaceDir) {
  await mkdir(path.join(workspaceDir, "lib"), { recursive: true });
  await mkdir(path.join(workspaceDir, "app", "api", "agent"), { recursive: true });

  await writeFile(
    path.join(workspaceDir, "lib", "agent-prompt.ts"),
    `export const AGENT_PROMPT_VERSION = "agent-prompt-v1";
export const AGENT_CONTEXT_HEADER = "x-startup-agent-context";
export const SUPPORT_AGENT_TOOLS = ["search_docs", "read_page", "create_ticket"] as const;

export type CustomerTier = "free" | "pro" | "enterprise";

type PromptOptions = {
  docsBaseUrl: string;
  customerTier: CustomerTier;
};

export function buildSupportAgentPrompt({ docsBaseUrl, customerTier }: PromptOptions) {
  return [
    "Northstar CRM support agent prompt.",
    \`Docs base URL: \${docsBaseUrl}\`,
    \`Customer tier: \${customerTier}\`,
    "Resolve the user's intent before choosing a tool.",
    "Fetch /docs.md before answering implementation questions.",
    "Prefer search_docs before read_page.",
    "Escalate billing data changes to a human.",
  ].join("\\n");
}
`,
  );

  await writeFile(
    path.join(workspaceDir, "app", "api", "agent", "route.ts"),
    `import {
  AGENT_CONTEXT_HEADER,
  AGENT_PROMPT_VERSION,
  SUPPORT_AGENT_TOOLS,
  buildSupportAgentPrompt,
  type CustomerTier,
} from "@/lib/agent-prompt";

const DEFAULT_DOCS_BASE_URL = "https://docs.northstar.example.com";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const docsBaseUrl =
    typeof body.docsBaseUrl === "string" ? body.docsBaseUrl : DEFAULT_DOCS_BASE_URL;
  const customerTier: CustomerTier =
    body.customerTier === "pro" || body.customerTier === "enterprise"
      ? body.customerTier
      : "free";

  return Response.json({
    version: AGENT_PROMPT_VERSION,
    contextHeader: AGENT_CONTEXT_HEADER,
    tools: SUPPORT_AGENT_TOOLS,
    prompt: buildSupportAgentPrompt({ docsBaseUrl, customerTier }),
  });
}
`,
  );

  await writeFile(
    path.join(workspaceDir, "app", "page.tsx"),
    `export default function Home() {
  return (
    <main>
      <h1>Northstar CRM</h1>
      <p>Customer operations for modern teams.</p>
      <p>Agent prompting endpoint ready.</p>
    </main>
  );
}
`,
  );
}

async function writeVersionedImplementation(workspaceDir) {
  await mkdir(path.join(workspaceDir, "lib"), { recursive: true });
  await mkdir(path.join(workspaceDir, "app", "api", "support-agent"), { recursive: true });

  await writeFile(
    path.join(workspaceDir, "lib", "support-agent-endpoint.ts"),
    `export const SUPPORT_AGENT_API_VERSION = "2026-04-21.v2";
export const SUPPORT_AGENT_RESPONSE_SCHEMA = "support-agent.response.v2";
export const SUPPORT_AGENT_CONTEXT_HEADER = "x-northstar-agent-context";
export const SUPPORT_AGENT_TOOLS = [
  "search_docs",
  "read_page",
  "create_ticket",
  "handoff_to_human",
] as const;

export type CustomerTier = "free" | "pro" | "enterprise";

type SupportAgentV2Options = {
  docsBaseUrl: string;
  customerTier: CustomerTier;
  userIntent?: string;
};

export function buildSupportAgentV2Response({
  docsBaseUrl,
  customerTier,
  userIntent = "unknown",
}: SupportAgentV2Options) {
  return {
    version: SUPPORT_AGENT_API_VERSION,
    schema: SUPPORT_AGENT_RESPONSE_SCHEMA,
    contextHeader: SUPPORT_AGENT_CONTEXT_HEADER,
    tools: SUPPORT_AGENT_TOOLS,
    safety: {
      requiresHumanFor: ["billing_changes", "account_deletion", "access_changes"],
    },
    prompt: [
      "Use the v2 support-agent contract.",
      "Never return the v1 response shape.",
      "Search docs before reading a page.",
      "Escalate billing data changes to a human.",
      "Use handoff_to_human for account deletion or access changes.",
      \`Docs base URL: \${docsBaseUrl}\`,
      \`Customer tier: \${customerTier}\`,
      \`User intent: \${userIntent}\`,
    ].join("\\n"),
  };
}
`,
  );

  await writeFile(
    path.join(workspaceDir, "app", "api", "support-agent", "route.ts"),
    `import {
  buildSupportAgentV2Response,
  type CustomerTier,
} from "@/lib/support-agent-endpoint";

const DEFAULT_DOCS_BASE_URL = "https://docs.northstar.example.com";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const docsBaseUrl =
    typeof body.docsBaseUrl === "string" ? body.docsBaseUrl : DEFAULT_DOCS_BASE_URL;
  const customerTier: CustomerTier =
    body.customerTier === "pro" || body.customerTier === "enterprise"
      ? body.customerTier
      : "free";
  const userIntent = typeof body.userIntent === "string" ? body.userIntent : "unknown";

  return Response.json(
    buildSupportAgentV2Response({
      docsBaseUrl,
      customerTier,
      userIntent,
    }),
  );
}
`,
  );

  await writeFile(
    path.join(workspaceDir, "app", "page.tsx"),
    `export default function Home() {
  return (
    <main>
      <h1>Northstar CRM</h1>
      <p>Customer operations for modern teams.</p>
      <p>Support agent v2 endpoint ready.</p>
    </main>
  );
}
`,
  );
}

const outputFile = argValue("-o");
const workspaceDir = process.cwd();
const prompt = process.argv.at(-1) ?? "";
const baseUrl = prompt.match(/Docs base URL: (\S+)/)?.[1];
const packageFile = path.join(workspaceDir, "package.json");
const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
const provider = packageJson.benchmark?.docsProvider;
const scenario = process.env.BENCHMARK_SCENARIO ?? "support-agent-prompting";

if (!baseUrl) {
  console.error("Fake Codex could not find docs base URL.");
  process.exit(1);
}

if (scenario === "versioned-agent-endpoint" && provider === "farming-labs") {
  await fetchDoc(baseUrl, "/docs.md");
} else if (scenario === "versioned-agent-endpoint") {
  await fetchDoc(baseUrl, "/docs.md");
  await fetchDoc(baseUrl, "/llms.txt");
  await fetchDoc(baseUrl, "/docs/core/support-agent-v2.md");
} else if (provider === "farming-labs") {
  await fetchDoc(baseUrl, "/docs.md");
} else {
  await fetchDoc(baseUrl, "/docs.md");
  await fetchDoc(baseUrl, "/llms.txt");
  await fetchDoc(baseUrl, "/docs/core/support-agent-prompting.md");
}

if (scenario === "versioned-agent-endpoint") {
  await writeVersionedImplementation(workspaceDir);
} else {
  await writeSupportPromptingImplementation(workspaceDir);
}

if (outputFile) {
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(
    outputFile,
    [
      "Fake Codex smoke run.",
      "",
      `Scenario: ${scenario}`,
      provider === "farming-labs"
        ? `Fetched ${baseUrl}/docs.md first.`
        : `Fetched ${baseUrl}/docs.md, ${baseUrl}/llms.txt, and the target support-agent page.`,
    ].join("\n"),
  );
}

console.log(
  JSON.stringify({
    type: "turn.completed",
    usage: {
      input_tokens: provider === "farming-labs" ? 1200 : 1900,
      cached_input_tokens: 0,
      output_tokens: provider === "farming-labs" ? 350 : 420,
    },
  }),
);

const expectedRoute =
  scenario === "versioned-agent-endpoint"
    ? path.join(workspaceDir, "app", "api", "support-agent", "route.ts")
    : path.join(workspaceDir, "app", "api", "agent", "route.ts");

if (!existsSync(expectedRoute)) {
  process.exit(1);
}
