<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:3117c6f7dc584337
settingsHash=fnv1a64:ab89fb28872d1850
outputHash=fnv1a64:ceb94ed92d52e0d2
generatedAt=2026-07-30T09:43:36.503Z
-->
# From Fumadocs

## From Fumadocs task

Task: Simplify a Fumadocs project into a Farming Labs Docs configuration while preserving its content and routes.

Expected result: Existing Fumadocs Markdown or MDX content and navigation run through the selected Farming Labs adapter with equivalent routes and components.

## From Fumadocs prerequisites

- Preserve source.config, content collections, meta files, source loaders, layouts, search routes, and MDX components.
- Record the existing loader baseUrl and published route tree.
- Initialize the target runtime in a migration branch.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## From Fumadocs verification

- Build the target and compare the source page tree, base URL, meta ordering, components, search, and API routes. Expected: Existing content routes build and render without duplicated source loaders or catch-all routes.
- Failure: Pages are duplicated or route generation conflicts.
- Recovery: Remove overlapping Fumadocs loaders or catch-all routes only after the Farming Labs route works.
- Rollback: Restore source.config, source loader, layout, and route files from version control.

## From Fumadocs agent guidance

Read source.config.ts, every collection definition, lib/source loader options, meta files, and the
docs catch-all route before editing. Migrate only the documentation collection. Blog, changelog, or
custom collections may need to remain on their current Fumadocs source.
