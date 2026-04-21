---
title: Support agent prompting contract
description: Exact implementation contract for the support-agent prompt endpoint.
---

# Support agent prompting contract

This page is the source of truth for Northstar CRM's support-agent prompting feature.

## Prompt constants

Create `lib/agent-prompt.ts` with these exported constants:

```ts
export const AGENT_PROMPT_VERSION = "agent-prompt-v1";
export const AGENT_CONTEXT_HEADER = "x-startup-agent-context";
export const SUPPORT_AGENT_TOOLS = ["search_docs", "read_page", "create_ticket"] as const;
```

## Prompt builder

Export a function named `buildSupportAgentPrompt`. It must accept:

```ts
type PromptOptions = {
  docsBaseUrl: string;
  customerTier: "free" | "pro" | "enterprise";
};
```

The returned prompt must include these exact policy lines:

- `Resolve the user's intent before choosing a tool.`
- `Fetch /docs.md before answering implementation questions.`
- `Prefer search_docs before read_page.`
- `Escalate billing data changes to a human.`

The prompt should also include the docs base URL and customer tier.

## Route

Create `app/api/agent/route.ts`.

The route should export `async function POST(request: Request)`. It should read JSON with optional
`docsBaseUrl` and `customerTier`, call `buildSupportAgentPrompt`, and return JSON containing:

- `version`
- `contextHeader`
- `tools`
- `prompt`

Use defaults:

- `docsBaseUrl`: `https://docs.northstar.example.com`
- `customerTier`: `free`

## Homepage note

Update `app/page.tsx` so it mentions `Agent prompting endpoint ready`.
