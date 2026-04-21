# Scenario: Docs-To-Implementation From Provider Docs

This is one example scenario for the provider-agnostic benchmark. The docs subject happens to be a
fictional product called Northstar CRM, but the same pattern can benchmark any framework, SDK, API,
or product docs.

Codex starts in the provider's concrete project under `benchmark/codex/<provider>`. Each provider
has its own docs dependency and package metadata, but the starting implementation app, missing
feature, and acceptance script are equivalent.

Codex receives only a docs base URL and this task:

1. Discover the docs surface from `<DOCS_BASE_URL>/docs.md`.
2. Implement the documented agent-prompting contract in the artifact workspace.
3. Run `node scripts/acceptance.mjs`.

## Required Implementation

The completed artifact must:

- Add `lib/agent-prompt.ts` with the documented prompt constants, tools, and prompt builder.
- Add `app/api/agent/route.ts` with a POST endpoint that returns the built prompt.
- Update `app/page.tsx` to mention the agent prompting endpoint.
- Preserve the existing Next.js app.

## What Is Measured

- Time to full implementation.
- Errors during the session and aggregate error rates across repeated attempts.
- Cost proxies: tokens, docs bytes, and fetch count.
- Whether Codex fetched the right docs page before implementing.
