---
title: Search tools
description: Tool contracts for docs search and page reading.
---

# Search tools

Support agents use docs search before reading individual docs pages. This keeps the model grounded
in the most relevant page instead of pulling broad context into the prompt.

## Tool names

The supported docs tools are:

- `search_docs`
- `read_page`

<Visibility for="agents">
The support-agent prompt must include:

`Fetch /docs.md before answering implementation questions.`

It must also include:

`Prefer search_docs before read_page.`
</Visibility>

## Search result quality

Search results should rank exact task pages above generic API reference pages.
