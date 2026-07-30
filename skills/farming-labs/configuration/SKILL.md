---
name: configuration
description: docs.config.ts options for @farming-labs/docs. Use when configuring entry, contentDir, theme, staticExport, navigation, search, feedback, agent surfaces, MCP, API references, review, metadata, or framework-specific config wiring for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt.
compatibility: Requires a JavaScript or TypeScript project using @farming-labs/docs. Verification commands require Node.js and the project's package manager.
---

# Configure @farming-labs/docs

Edit the existing `docs.config.ts` or `docs.config.tsx` without replacing unrelated settings.
Read only the focused reference that matches the requested option family.

## Workflow

1. Identify the framework, package root, config path, package manager, and installed Farming Labs
   package versions.
2. Read the current config and its imports before editing. Preserve callbacks, theme factories,
   custom adapters, and framework wiring that are outside the request.
3. Select the smallest relevant reference from the routing table below. Do not load every
   reference for a narrow change.
4. Implement the option with `defineDocs()` when the project already uses it. Keep secrets in
   environment variables and keep public agent projections free of private data.
5. Update any adapter forwarder or route that the selected reference says must stay aligned with
   config.
6. Run the project typecheck or build and one focused runtime/CLI check for the changed surface.
7. Report the config path, behavior change, verification, and any deployment requirement.

## Config location

| Framework | Config path | Additional required wiring |
| --- | --- | --- |
| Next.js | `docs.config.ts[x]` at the project root | Wrap Next config with `withDocs()` |
| TanStack Start | `docs.config.ts[x]` at the project root | Pass config to the docs server and keep the public forwarder aligned |
| SvelteKit | `src/lib/docs.config.ts` | Pass config to the docs server and hooks |
| Astro | `src/lib/docs.config.ts` | Pass config to the docs server and middleware |
| Nuxt | `docs.config.ts` at the project root | Pass config to `defineDocsHandler()` and public middleware |

TanStack Start, SvelteKit, Astro, and Nuxt normally need `contentDir` and `nav` in addition to
`entry` and `theme`.

## Minimal shape

```ts
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/theme";

export default defineDocs({
  entry: "docs",
  theme: fumadocs(),
});
```

Add only the requested fields. Do not copy a full reference example into a project unless every
field is required.

## Reference routing

All references are one hop from this file.

| Request | Read |
| --- | --- |
| Core options, review, code validation, Docs Cloud, static export, theme/UI, metadata | [Core configuration](references/core-options.md) |
| Markdown negotiation, audience projections, contracts, llms.txt, sitemaps, robots | [Agent content and discovery](references/agent-content-and-discovery.md) |
| Published skills, A2A cards, golden evaluations, agent compaction | [Agent Skills and evaluations](references/agent-skills-and-evaluations.md) |
| Search providers, audience-aware search, changelog, human or agent feedback | [Search and feedback](references/search-and-feedback.md) |
| MCP routes/auth/security/tools or generated API references | [MCP and API reference](references/mcp-and-api-reference.md) |

## Invariants

- `staticExport: true` disables server-only search and AI behavior. Static Agent Bundles must not
  advertise server capabilities they cannot serve.
- Audience blocks shape representations; they are not access control. Never put secrets in
  `<Agent>`, `<Human>`, `<Audience>`, or `agent.md`.
- MCP HTTP is public by default. Add `mcp.security.authenticate` only when the project explicitly
  needs authentication.
- Keep `mcp.route` synchronized with non-Next public forwarders.
- Keep raw API keys out of config. Store only environment-variable names.
- Use a hosted OpenAPI `specUrl` instead of local route scanning when the API lives elsewhere.
- Preserve custom `components`, `icons`, callbacks, search adapters, and theme options unless the
  request changes them.

## Verification

Use the package manager already selected by the project:

```bash
pnpm typecheck
pnpm build
pnpm exec docs doctor --agent --config docs.config.tsx
```

Run only commands that exist in `package.json`; adapt the config path for the framework. For a
route change, probe the exact affected endpoint. For static outputs, prefer the matching
`--check` command before writing generated files.

## Recovery

- If config evaluation fails, inspect imports and environment access; do not silently replace the
  config with a static approximation.
- If a public route returns 404, check adapter forwarding and the configured route together.
- If a static deployment advertises unavailable features, regenerate the Agent Bundle after the
  config change.
- If typechecking rejects an option, inspect the installed package version before assuming the
  current reference applies.

Full human documentation: [Configuration](https://docs.farming-labs.dev/docs/configuration) and
[API reference](https://docs.farming-labs.dev/docs/reference).
