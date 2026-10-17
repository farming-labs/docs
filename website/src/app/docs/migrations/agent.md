<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:b088d797f0937bf6
settingsHash=fnv1a64:e50e89e221226fc3
outputHash=fnv1a64:16b6b9153ee159ac
generatedAt=2026-08-20T10:20:45.447Z
-->
# Migrations

## Migrations task

Task: Select and execute the correct source-specific migration into a Farming Labs Docs project.

Expected result: The source content, navigation, assets, and supported components are represented in a buildable Farming Labs Docs site, with unsupported behavior listed for review.

## Migrations prerequisites

- Identify the current documentation platform and its content root.
- Choose the target application runtime before moving files.
- Preserve the source project or create a migration branch before editing.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## Migrations verification

- Run the target application's production build and inspect navigation, links, assets, code blocks, search, and Markdown page actions. Expected: The build succeeds and the migrated content is reachable from both its HTML route and matching .md route.
- Failure: A source-specific component prevents MDX compilation.
- Recovery: Replace it with the closest built-in component or plain Markdown, and record the visual behavior that still needs review.
- Rollback: Restore the migration branch or remove the new target directory; do not delete the preserved source project.

## Migrations agent guidance

Use this page only to select a source guide. Do not combine conversion rules from multiple source
platforms unless the repository actually contains more than one docs system. After selecting a
guide, read its `.md` route and preserve its source inventory, URL, navigation, component, asset,
integration, verification, and recovery steps.

The target runtime is independent from the source platform. Detect whether the destination is
Next.js, TanStack Start, SvelteKit, Astro, or Nuxt before choosing file locations. Never remove the
source project until the target production build and route comparison pass.
