---
name: docs
description: Use the Farming Labs docs website through agent discovery, AGENTS.md, markdown routes, search, llms.txt, OpenAPI schema discovery, and MCP.
---

# Farming Labs Docs Website Skill

Use this skill when reading or implementing from the hosted Farming Labs docs website.

## Start Here

- Fetch `/.well-known/agent.json` first.
- Fetch `/AGENTS.md` for coding-agent operating instructions.
- Read `/docs.md` for the root docs page.
- Read `/docs/{slug}.md` for page-specific markdown.
- On Next.js docs routes, you can also read `/docs/{slug}` with `Signature-Agent` for the same markdown.
- Search with `/api/docs?query={query}` when the right page is unknown.
- Use `/llms.txt` for a compact index and `/llms-full.txt` for full markdown context.
- Use `/api/docs?format=openapi` for the machine-readable API schema when API routes matter.
- Use `/mcp` or `/.well-known/mcp` when MCP is available. Prefer `list_docs` to inspect sections, `search_docs` to find a topic, `get_context` for token-budgeted retrieval, `read_page` to fetch a known page or heading, `get_code_examples` to extract runnable snippets, and `get_config_schema` before editing `docs.config.ts`.
