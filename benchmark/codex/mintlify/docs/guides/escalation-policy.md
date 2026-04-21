---
title: Escalation policy
description: When the support agent should create tickets or hand off to a human.
---

# Escalation policy

Northstar CRM support automation should help with docs lookup and ticket creation, but human support
owns risky account and billing changes.

## Escalate immediately

Escalate when the user asks for:

- Billing data changes.
- Account deletion.
- Security access changes.
- Contract exceptions.

<Visibility for="agents">
The support-agent prompt must include the exact line:

`Escalate billing data changes to a human.`
</Visibility>

## Continue with docs lookup

Continue with docs lookup when the user asks for product usage, SDK examples, API fields, or
troubleshooting steps.
