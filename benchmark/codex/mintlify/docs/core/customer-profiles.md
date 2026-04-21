---
title: Customer profiles
description: Customer tiers and profile context used by support automation.
---

# Customer profiles

Customer profiles collect the account details that support automation can safely use when deciding
which tool to call.

## Customer tier

Northstar CRM currently recognizes three customer tiers:

- `free`
- `pro`
- `enterprise`

The support-agent prompt builder should include the selected customer tier in the generated prompt
so downstream logic can choose the right escalation threshold.

## Profile fields

Profile fields may include account id, workspace name, owner email, and plan metadata. Do not expose
raw billing data in prompts.
