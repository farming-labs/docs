<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:bfd4f31e7ea9964f
settingsHash=fnv1a64:4b53757ce3e12a9b
outputHash=fnv1a64:bf8874a303153bea
generatedAt=2026-07-30T09:43:36.508Z
-->
# From Material for MkDocs

## From Material for MkDocs task

Task: Migrate a Material for MkDocs site into Farming Labs Docs.

Expected result: MkDocs pages, nav order, assets, code, and converted Python Markdown extensions render in a buildable Farming Labs Docs project.

## From Material for MkDocs prerequisites

- Preserve mkdocs.yml, docs, theme overrides, plugins, hooks, macros, includes, and dependency lock files.
- Record site_url, site_dir, use_directory_urls, nav, extra, and all Markdown extensions.
- Initialize the target runtime separately.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## From Material for MkDocs verification

- Build the target and compare mkdocs nav, routes, extensions, assets, macros, redirects, and search. Expected: Required routes resolve and no unconverted Python Markdown or Jinja syntax breaks MDX.
- Failure: Indented extension syntax renders as plain text.
- Recovery: Convert that Python Markdown extension family into supported Markdown or MDX across the corpus.
- Rollback: Keep the MkDocs build and deployment available until route and extension verification passes.

## From Material for MkDocs agent guidance

Treat mkdocs.yml and its inherited config as the migration source of truth. Inventory docs_dir,
site_url, use_directory_urls, nav, markdown_extensions, plugins, hooks, theme.custom_dir, extra_css,
and extra_javascript. Search content for every enabled syntax before converting files.
