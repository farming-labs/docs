---
title: Ticketing API
description: Ticket creation fields used after support-agent escalation.
---

# Ticketing API

The ticketing API creates support tickets after an agent decides a human should handle the request.

## Tool name

The support-agent tool list includes:

```ts
"create_ticket"
```

## Minimum fields

- `title`
- `description`
- `customerTier`
- `priority`
