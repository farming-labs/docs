<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:40480511b9483fbf
settingsHash=fnv1a64:cd874ef828c34e2e
outputHash=fnv1a64:45e7a29e8e2d6424
generatedAt=2026-08-14T12:45:38.909Z
-->
# From VitePress

## From VitePress task

Task: Migrate a VitePress documentation site into Farming Labs Docs.

Expected result: VitePress pages, navigation, assets, and portable Markdown render in a buildable Farming Labs Docs project, with Vue-only behavior explicitly replaced or tracked.

## From VitePress prerequisites

- Preserve the VitePress root, .vitepress config and theme, public assets, Markdown pages, and custom Vue components.
- Record the published base path, rewrites, clean URL behavior, locales, and sidebar variants.
- Initialize the target runtime separately.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## From VitePress verification

- Build the target and compare routes, sidebar variants, containers, code groups, assets, locales, and redirects. Expected: Required routes resolve and no Vue-only syntax remains in content compiled by a non-Vue target.
- Failure: MDX compilation fails on Vue template syntax.
- Recovery: Convert the block to portable Markdown or a component native to the selected target runtime.
- Rollback: Keep the VitePress build and deployment available until the target route and component comparison passes.

## From VitePress agent guidance

Read the resolved VitePress config, not only the root file: configuration can be async, split into
helpers, or overridden per directory. Inventory root, srcDir, base, rewrites, locales, themeConfig
nav and sidebar, markdown plugins, and theme enhancements before moving files.
