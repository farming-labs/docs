<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:2c52ac443f3c9395
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:14aaecb13600c381
generatedAt=2026-07-30T09:43:36.473Z
-->
# Customization

## Customization task

Task: Customization

Expected result: Colors, typography, sidebar, components, analytics, telemetry, observability, agent primitives, robots.txt, OG images, AI chat, and page actions

## Customization verification



## Customization agent guidance

Treat this page as a configuration router. Visual tokens and built-in default props belong under
`theme.ui`, replacement MDX components use top-level `components`, and runtime features use
top-level `ai`, `analytics`, `telemetry`, `observability`, `mcp`, `llmsTxt`, `sitemap`, and
`pageActions` in `docs.config.ts`.

The linked feature page is the source of truth because each option has different defaults and
verification steps. A layout or CSS file is unnecessary for an option documented as config-only. A
committed crawl policy comes from `pnpm exec docs robots generate`; audience-specific page content
follows the Agent Primitive workflow.
