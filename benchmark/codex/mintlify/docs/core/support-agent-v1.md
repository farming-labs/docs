---
title: Support agent v1 deprecated contract
description: Legacy support-agent endpoint retained for older Northstar CRM integrations.
---

# Support agent v1 deprecated contract

The v1 support-agent endpoint is retained for older customer integrations. New implementation work
must not use this contract unless the task explicitly asks for legacy behavior.

## Legacy constants

```ts
export const SUPPORT_AGENT_API_VERSION = "2025-11-01.v1";
export const SUPPORT_AGENT_RESPONSE_SCHEMA = "support-agent.response.v1";
export const SUPPORT_AGENT_CONTEXT_HEADER = "x-startup-agent-context";
export const SUPPORT_AGENT_TOOLS = ["search_docs", "read_page", "create_ticket"] as const;
```

## Legacy response shape

The v1 endpoint returned:

- `version`
- `contextHeader`
- `tools`
- `prompt`

It did not include a `schema` field, a `safety` object, or the `handoff_to_human` tool.

## Migration note

Use v2 for new work. The v2 contract lives at
[Support agent v2 current contract](__BASE_URL__/docs/core/support-agent-v2.md).
