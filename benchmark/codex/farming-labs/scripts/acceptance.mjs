import { existsSync, readFileSync } from "node:fs";

function read(file) {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

const scenario = process.env.BENCHMARK_SCENARIO ?? "support-agent-prompting";
const failures = [];

function check(name, condition) {
  if (!condition) failures.push(name);
}

function checkSupportAgentPrompting() {
  const prompt = read("lib/agent-prompt.ts");
  const route = read("app/api/agent/route.ts");
  const page = read("app/page.tsx");

  check("prompt file exists", Boolean(prompt));
  check("version constant", prompt.includes('AGENT_PROMPT_VERSION = "agent-prompt-v1"'));
  check("context header constant", prompt.includes('AGENT_CONTEXT_HEADER = "x-startup-agent-context"'));
  check("tools include search_docs", prompt.includes("search_docs"));
  check("tools include read_page", prompt.includes("read_page"));
  check("tools include create_ticket", prompt.includes("create_ticket"));
  check("prompt builder exported", /export\s+function\s+buildSupportAgentPrompt/.test(prompt));
  check("docsBaseUrl option", prompt.includes("docsBaseUrl"));
  check("customerTier option", prompt.includes("customerTier"));
  check("intent policy", prompt.includes("Resolve the user's intent before choosing a tool."));
  check("docs.md policy", prompt.includes("Fetch /docs.md before answering implementation questions."));
  check("tool ordering policy", prompt.includes("Prefer search_docs before read_page."));
  check("billing escalation policy", prompt.includes("Escalate billing data changes to a human."));
  check("route exists", Boolean(route));
  check("route imports prompt builder", route.includes("buildSupportAgentPrompt"));
  check("route exports POST", /export\s+async\s+function\s+POST\s*\(/.test(route));
  check(
    "route returns prompt json",
    route.includes("prompt") && (route.includes("Response.json") || route.includes("NextResponse.json")),
  );
  check(
    "default docs url",
    route.includes("https://docs.northstar.example.com") ||
      prompt.includes("https://docs.northstar.example.com"),
  );
  check("homepage kept", page.includes("Northstar CRM"));
  check("homepage agent note", page.includes("Agent prompting endpoint ready"));
}

function checkVersionedAgentEndpoint() {
  const helper = read("lib/support-agent-endpoint.ts");
  const route = read("app/api/support-agent/route.ts");
  const page = read("app/page.tsx");
  const combined = `${helper}\n${route}`;

  check("v2 helper file exists", Boolean(helper));
  check("v2 api version", helper.includes('SUPPORT_AGENT_API_VERSION = "2026-04-21.v2"'));
  check("v2 response schema", helper.includes('SUPPORT_AGENT_RESPONSE_SCHEMA = "support-agent.response.v2"'));
  check("v2 context header", helper.includes('SUPPORT_AGENT_CONTEXT_HEADER = "x-northstar-agent-context"'));
  check("tools include search_docs", helper.includes("search_docs"));
  check("tools include read_page", helper.includes("read_page"));
  check("tools include create_ticket", helper.includes("create_ticket"));
  check("tools include handoff_to_human", helper.includes("handoff_to_human"));
  check("v2 response builder exported", /export\s+function\s+buildSupportAgentV2Response/.test(helper));
  check("docsBaseUrl option", helper.includes("docsBaseUrl"));
  check("customerTier option", helper.includes("customerTier"));
  check("userIntent option", helper.includes("userIntent"));
  check("safety object", helper.includes("safety"));
  check("billing safety", helper.includes("billing_changes"));
  check("account deletion safety", helper.includes("account_deletion"));
  check("access changes safety", helper.includes("access_changes"));
  check("v2 policy", helper.includes("Use the v2 support-agent contract."));
  check("not v1 policy", helper.includes("Never return the v1 response shape."));
  check("search policy", helper.includes("Search docs before reading a page."));
  check("billing escalation policy", helper.includes("Escalate billing data changes to a human."));
  check(
    "handoff policy",
    helper.includes("Use handoff_to_human for account deletion or access changes."),
  );
  check("route exists", Boolean(route));
  check("route imports v2 builder", route.includes("buildSupportAgentV2Response"));
  check("route exports POST", /export\s+async\s+function\s+POST\s*\(/.test(route));
  check("route returns json", route.includes("Response.json") || route.includes("NextResponse.json"));
  check(
    "default docs url",
    route.includes("https://docs.northstar.example.com") ||
      helper.includes("https://docs.northstar.example.com"),
  );
  check("does not use deprecated v1 schema", !combined.includes("support-agent.response.v1"));
  check("does not use deprecated v1 version", !combined.includes("2025-11-01.v1"));
  check("does not use prompt v1 constant", !combined.includes("agent-prompt-v1"));
  check("homepage kept", page.includes("Northstar CRM"));
  check("homepage v2 note", page.includes("Support agent v2 endpoint ready"));
}

if (scenario === "versioned-agent-endpoint") {
  checkVersionedAgentEndpoint();
} else {
  checkSupportAgentPrompting();
}

if (failures.length > 0) {
  console.error("Acceptance failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("acceptance passed");
