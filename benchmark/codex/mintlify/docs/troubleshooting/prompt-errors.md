---
title: Prompt errors
description: Common mistakes when implementing support-agent prompts.
---

# Prompt errors

Prompt errors usually come from missing exact policy lines or returning an object that does not
match the route contract.

## Common failures

- Missing `AGENT_PROMPT_VERSION`.
- Using the wrong context header.
- Forgetting `create_ticket`.
- Returning plain text instead of JSON from the route.

## Recovery

Re-read the support-agent prompting contract, update the prompt helper, and run
`node scripts/acceptance.mjs` again.
