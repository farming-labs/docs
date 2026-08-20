<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:7473ae5d8120fdfd
settingsHash=fnv1a64:dbac89e9f25094c8
outputHash=fnv1a64:abf1331eb2fcdb2d
generatedAt=2026-08-20T10:20:45.432Z
-->
# From Docusaurus

## From Docusaurus task

Task: Migrate a Docusaurus documentation site into a supported Farming Labs Docs runtime.

Expected result: Docusaurus pages, sidebar order, assets, and supported MDX patterns render in a buildable Farming Labs Docs project.

## From Docusaurus prerequisites

- Preserve docusaurus.config, sidebars, docs, static, versions.json, versioned_docs, and versioned_sidebars.
- Decide which Docusaurus docs versions and locales must remain public.
- Initialize the target runtime in a branch or separate directory.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## From Docusaurus verification

- Build the target and compare every published Docusaurus route, sidebar group, version, and asset. Expected: Required routes resolve, the production build passes, and unsupported components are explicitly tracked.
- Failure: MDX compilation fails on a Docusaurus import or JSX component.
- Recovery: Replace the import with a Farming Labs component or preserve the component as a registered custom MDX component.
- Rollback: Keep the original Docusaurus deployment and restore the migration branch if route or version checks fail.

## From Docusaurus agent guidance

Inventory every active docs plugin instance, sidebar file, docs root, locale, and version before
moving content. Treat docusaurus.config and sidebars as executable input: do not copy them into
docs.config verbatim. Preserve published routes first, then translate components. Docusaurus blog,
pages, custom themes, and non-doc plugins are separate application migrations.
