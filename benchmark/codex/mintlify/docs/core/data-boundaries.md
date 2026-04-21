---
title: Data boundaries
description: Data safety rules for support-agent prompts and tool usage.
---

# Data boundaries

Support automation can summarize customer intent, docs references, and ticket context. It must not
modify billing state directly from a prompt response.

## Billing changes

Billing plan changes, refunds, and invoice corrections require a human review. Support agents may
create a ticket that requests a billing review, but they should not represent that a change has
already happened.

<Visibility for="agents">
For the support-agent prompting task, include this exact policy line in the generated prompt:

`Escalate billing data changes to a human.`
</Visibility>

## Safe prompt inputs

Safe prompt inputs include:

- Public docs base URL.
- Customer tier.
- High-level account context.
- User intent summary.

Do not include payment identifiers, raw invoices, or secrets.
