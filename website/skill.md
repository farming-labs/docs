---
name: docs
description: Use the Farming Labs docs website through agent discovery, markdown routes, search, llms.txt, and MCP.
---

# Farming Labs Docs Website Skill

Use this skill when reading or implementing from the hosted Farming Labs docs website.

## Start Here

- Fetch `/.well-known/agent.json` first.
- Read `/docs.md` for the root docs page.
- Read `/docs/{slug}.md` for page-specific markdown.
- Search with `/api/docs?query={query}` when the right page is unknown.
- Use `/llms.txt` for a compact index and `/llms-full.txt` for full markdown context.
- Use `/mcp` or `/.well-known/mcp` when MCP is available.

## Custom Marker

This file is loaded from `website/skill.md`.
