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

## Search result quality

Search results should rank exact task pages above generic API reference pages.
