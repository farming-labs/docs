# Knowledge drift report: June 4-11, 2026

Repository: `farming-labs/docs`

Comparison window:

- Base: `79ee6122d190ff4218de0173386c59e349785661` (`chore: sync version with latest`, 2026-06-02T12:27:52Z)
- Head: `227867e8ef9e004227bd65c6c01cecaa27f7cf4c` (`chore: sync example version`, 2026-06-09T01:33:09Z)
- Default branch: `main`

## Workflow result

The project is registered in Docs Cloud as:

- Project id: `cmpll8u32000004jyk3xfkzk3`
- Framework: `NEXTJS`
- Docs root: `website`
- Cloud config path: `examples/next/docs.json`

The app-backed queue attempt failed before checkout because the GitHub App installation is already connected to another Docs Cloud workspace:

```text
This GitHub App installation is already connected to another Docs Cloud workspace.
Sign in with that workspace, or remove and reinstall the GitHub App before connecting it here.
```

The local analyzer still ran against the exact base/head refs. It found:

- 31 commits
- 65 changed files
- 65 drift signals
- 21 documentation targets
- 10 graph-linked docs pages

Because this window already includes documentation changes under `website/`, the strict knowledge-drift workflow should treat this as "no code-only drift" and avoid opening an automatic drift PR. This report captures the change/evidence detail for review.

## What changed

### Threadline theme

Threadline was added as a new theme surface and documented in the website.

Evidence:

- `packages/fumadocs/src/threadline/index.ts`
- `packages/fumadocs/styles/threadline.css`
- `website/app/docs/themes/threadline/page.mdx`
- `website/app/docs/themes/page.mdx`
- `website/app/themes/page.tsx`
- `website/components/theme-customizer.tsx`
- `website/docs.config.tsx`

### Cloud onboarding and CLI init

The CLI init flow now wires Docs Cloud config paths, cloud onboarding options, and framework-specific scaffolding behavior.

Evidence:

- `packages/docs/src/cli/init.ts`
- `packages/docs/src/cli/init.test.ts`
- `packages/docs/src/cli/index.ts`
- `packages/docs/src/cli/index.test.ts`
- `website/app/docs/cli/page.mdx`
- `website/app/docs/cloud/deploy/page.mdx`

### Docs Cloud API key and v1 dogfooding

The docs app added first-party Docs Cloud configuration and example environment wiring.

Evidence:

- `website/docs.json`
- `website/.env.example`
- `website/public/schema/cloud.json`
- `website/public/schema/docs.json`
- `website/app/docs/cloud/deploy/page.mdx`

### Docs Cloud provider and streaming specs

Ask AI support was extended with Docs Cloud provider client wiring, stream compatibility work, and related API surface changes.

Evidence:

- `packages/fumadocs/src/docs-cloud-ai-client.ts`
- `packages/fumadocs/src/docs-cloud-ai-client.test.ts`
- `packages/fumadocs/src/docs-api.ts`
- `packages/fumadocs/src/docs-api.test.ts`
- `packages/fumadocs/src/ai-search-dialog.tsx`
- `website/app/docs/customization/ai-chat/page.mdx`

### Doctor CLI and cloud checks

The CLI gained richer cloud/doctor checks, flags, and log-buffer support.

Evidence:

- `packages/docs/src/cli/cloud.ts`
- `packages/docs/src/cli/cloud.test.ts`
- `packages/docs/src/cli/index.ts`
- `skills/farming-labs/cli/SKILL.md`
- `website/app/docs/cli/page.mdx`

### Knowledge and Docs Cloud endpoint CORS/proxy support

The API layer changed around knowledge and Docs Cloud endpoint proxy behavior, including Ask AI CORS fallback handling.

Evidence:

- `packages/fumadocs/src/docs-api.ts`
- `packages/fumadocs/src/docs-page-client.tsx`
- `website/app/docs/cloud/deploy/page.mdx`

### Streaming markdown rendering

AI response rendering gained markdown prose formatting and a dedicated renderer.

Evidence:

- `packages/fumadocs/src/ai-markdown.ts`
- `packages/fumadocs/src/ai-markdown.test.ts`
- `packages/fumadocs/src/ai-search-dialog.tsx`
- `packages/fumadocs/styles/ai.css`
- `website/app/docs/customization/ai-chat/page.mdx`

### Analytics callback and payload detail

Analytics behavior gained richer callback and payload fields across runtime types, implementation, docs, and schemas.

Evidence:

- `packages/docs/src/cloud-analytics.ts`
- `packages/docs/src/types.ts`
- `packages/docs/src/analytics.test.ts`
- `packages/fumadocs/src/docs-api.ts`
- `website/app/docs/cloud/analytics/page.mdx`
- `website/public/schema/cloud.json`
- `website/public/schema/docs.json`

### Version and example synchronization

Multiple release and sync commits updated package versions, examples, and lockfile state.

Evidence:

- `packages/*/package.json`
- `examples/*/package.json`
- `pnpm-lock.yaml`
- `examples/next/docs.config.tsx`
- `examples/next/next.config.ts`

## Documentation targets selected by the analyzer

High-priority targets that already changed in this comparison range:

- `website/app/docs/cli/page.mdx`
- `website/app/docs/cloud/deploy/page.mdx`
- `website/.env.example`
- `website/app/docs/cloud/analytics/page.mdx`
- `website/app/docs/customization/ai-chat/page.mdx`
- `website/app/docs/themes/page.mdx`
- `website/app/docs/themes/threadline/page.mdx`
- `website/app/themes/page.tsx`
- `website/components/theme-customizer.tsx`
- `website/docs.config.tsx`
- `website/docs.json`
- `website/public/schema/cloud.json`
- `website/public/schema/docs.json`

Additional graph-linked targets:

- `website/app/docs/api/cli/usage/page.mdx`
- `website/app/docs/api/cli/page.mdx`
- `website/app/docs/quickstart/page.mdx`
- `website/app/docs/customization/analytics/page.mdx`
- `website/app/docs/guides/library-core-usage/page.mdx`
- `website/app/docs/installation/page.mdx`
- `website/app/docs/configuration/environment/page.mdx`
- `website/app/docs/page.mdx`

## Recommendation

Do not treat this window as unresolved code-only drift. The code changes and docs changes moved together. The system should record the head SHA as checked/synced for the drift baseline, and only draft a knowledge-drift PR for a future window where code changes land without matching docs changes.
