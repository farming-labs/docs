---
title: Observability
description: Logging and metric conventions for Northstar CRM features.
---

# Observability

Observability events help Northstar CRM detect when support automation routes users to the wrong
place.

## Suggested events

- `support_agent.prompt_built`
- `support_agent.docs_searched`
- `support_agent.ticket_created`
- `support_agent.escalated`

## Prompt debugging

Prompt output should include enough context to explain why the agent selected a tool. It should not
include private billing data.
