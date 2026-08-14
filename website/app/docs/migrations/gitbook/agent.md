<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:b8008eca9537395e
settingsHash=fnv1a64:cd874ef828c34e2e
outputHash=fnv1a64:1d89b214573ca5cb
generatedAt=2026-08-14T12:45:38.831Z
-->
# From GitBook

## From GitBook task

Task: Export a GitBook site through Git Sync and migrate it into Farming Labs Docs.

Expected result: GitBook pages, table of contents, assets, and representable blocks render in a buildable Farming Labs Docs project, with hosted-only behavior tracked.

## From GitBook prerequisites

- Create or obtain a complete GitHub or GitLab Git Sync export for every published GitBook space.
- Preserve .gitbook.yaml, SUMMARY.md, README files, assets, redirects, and site structure.
- Record dashboard-only domains, authentication, variants, search, analytics, and OpenAPI blocks.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## From GitBook verification

- Build the target and compare every GitBook space, SUMMARY entry, redirect, asset, custom block, and access boundary. Expected: The build passes and every required public page is migrated or redirected.
- Failure: Git Sync export is missing pages or spaces.
- Recovery: Export each published space separately and verify its SUMMARY before migrating.
- Rollback: Keep GitBook published and Git Sync connected until the new site and redirects pass verification.

## From GitBook agent guidance

Require a Git Sync export for every published space. Read .gitbook.yaml to resolve root, readme,
summary, and redirects, then parse SUMMARY.md as the navigation source of truth. Site sections,
variants, permissions, domains, analytics, and other dashboard settings require a separate
inventory because they may not exist in Git.
