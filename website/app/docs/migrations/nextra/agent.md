<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:98c1103ca8dabe1b
settingsHash=fnv1a64:156231f9a09bd12a
outputHash=fnv1a64:37de327de919bc44
generatedAt=2026-07-30T09:43:36.510Z
-->
# From Nextra

## From Nextra task

Task: Migrate a Nextra documentation site into Farming Labs Docs.

Expected result: Nextra MDX, routes, navigation order, and supported components run through the Farming Labs Next.js adapter or another selected target runtime.

## From Nextra prerequisites

- Identify whether Nextra content uses content, pages, app page.mdx files, or a mixed layout.
- Preserve _meta files, next.config, theme config, mdx-components, public assets, and custom components.
- Initialize the target runtime in a migration branch.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## From Nextra verification

- Build the target and compare Nextra routes, sidebar order, imported components, assets, and metadata. Expected: The production build passes and required routes resolve as HTML and Markdown.
- Failure: The same content is discovered twice.
- Recovery: Choose one Nextra source layout, move it once, and remove duplicate catch-all routes only after the target works.
- Rollback: Restore the previous Next.js configuration and Nextra route files from the migration branch.

## From Nextra agent guidance

Detect the Nextra content convention before changing routes: root or src content directory, Pages
Router files, App Router page.mdx files, or a mixed setup. Snapshot the page map and published
routes. Never keep both the old Nextra catch-all and the new Farming Labs route active at the same
URL.
