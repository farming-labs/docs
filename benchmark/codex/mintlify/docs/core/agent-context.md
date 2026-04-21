---
title: Agent context model
description: Headers, prompt context, and tool selection rules for support agents.
---

# Agent context model

The agent context model keeps user intent, docs lookup, and ticket creation separate. Support agents
should resolve intent before choosing a tool, then prefer docs search before reading individual
pages.

## Context header

Use this request header to identify support-agent context:

```ts
export const AGENT_CONTEXT_HEADER = "x-startup-agent-context";
```

## Tool order

The supported tool names are:

- `search_docs`
- `read_page`
- `create_ticket`

## Intent policy

The prompt must tell the model to resolve the user's intent before choosing a tool. This avoids
opening the ticketing API or billing API before the user intent is clear.
