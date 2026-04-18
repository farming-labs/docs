# Agent-ready docs

You are reading the machine-oriented override for `/docs/customization/markdown-routes/agent-ready-docs`.

Use this file instead of the human page when you need implementation-focused guidance.

## What this page is demonstrating

- `page.mdx` is still the human-facing page in the normal docs UI
- this `agent.md` file replaces the markdown-route output
- MCP `read_page("/docs/customization/markdown-routes/agent-ready-docs")` should return this content

## Instructions for an implementation agent

1. Preserve the exact route path:
   - `/docs/customization/markdown-routes/agent-ready-docs`
2. If you are validating the feature, fetch:
   - `/docs/customization/markdown-routes/agent-ready-docs.md`
3. Confirm that:
   - the normal HTML page shows the explanatory `page.mdx`
   - the markdown route returns this override instead
4. Do not merge this machine-only guidance back into the visible page unless the author explicitly wants that

## Why this matters

This pattern is useful when human docs should stay concise, but agent consumers need stricter or more operational guidance than a reader-facing page should expose.
