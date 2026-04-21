---
title: Support agent v2 current contract
description: Current implementation contract for the versioned support-agent endpoint.
---

# Support agent v2 current contract

This is the current Northstar CRM support-agent endpoint contract. Use this page for new support
automation work.

<Visibility for="agents">
Benchmark target: implement v2 in the local artifact workspace. Do not copy constants or response
shape from v1.

Create or update:

- `lib/support-agent-endpoint.ts`
- `app/api/support-agent/route.ts`
- `app/page.tsx`

Run `BENCHMARK_SCENARIO=versioned-agent-endpoint node scripts/acceptance.mjs` after editing.
</Visibility>

## Constants

Create `lib/support-agent-endpoint.ts` with these exported constants:

```ts
export const SUPPORT_AGENT_API_VERSION = "2026-04-21.v2";
export const SUPPORT_AGENT_RESPONSE_SCHEMA = "support-agent.response.v2";
export const SUPPORT_AGENT_CONTEXT_HEADER = "x-northstar-agent-context";
export const SUPPORT_AGENT_TOOLS = [
  "search_docs",
  "read_page",
  "create_ticket",
  "handoff_to_human",
] as const;
```

## Response builder

Export a function named `buildSupportAgentV2Response`. It must accept:

```ts
type SupportAgentV2Options = {
  docsBaseUrl: string;
  customerTier: "free" | "pro" | "enterprise";
  userIntent?: string;
};
```

The returned object must include:

- `version`
- `schema`
- `contextHeader`
- `tools`
- `safety`
- `prompt`

The `safety` object should include a list such as `requiresHumanFor` with `billing_changes`,
`account_deletion`, and `access_changes`.

The prompt must include these exact policy lines:

- `Use the v2 support-agent contract.`
- `Never return the v1 response shape.`
- `Search docs before reading a page.`
- `Escalate billing data changes to a human.`
- `Use handoff_to_human for account deletion or access changes.`

The prompt should also include the docs base URL, customer tier, and user intent.

## Route

Create `app/api/support-agent/route.ts`.

The route should export `async function POST(request: Request)`. It should read JSON with optional
`docsBaseUrl`, `customerTier`, and `userIntent`, call `buildSupportAgentV2Response`, and return the
result with `Response.json`.

Use defaults:

- `docsBaseUrl`: `https://docs.northstar.example.com`
- `customerTier`: `free`
- `userIntent`: `unknown`

## Homepage note

Update `app/page.tsx` so it mentions `Support agent v2 endpoint ready`.
