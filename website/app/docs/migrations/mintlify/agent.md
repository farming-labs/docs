<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:d754ee9cd3292bb8
settingsHash=fnv1a64:f146078e2605e9a5
outputHash=fnv1a64:0c1d2236f001482f
generatedAt=2026-08-14T12:45:38.847Z
-->
# From Mintlify

## From Mintlify task

Task: Migrate a Mintlify documentation repository into Farming Labs Docs.

Expected result: Mintlify MDX, navigation, assets, and supported components render in a buildable Farming Labs Docs project.

## From Mintlify prerequisites

- Obtain the Git repository containing docs.json or mint.json, all MDX pages, assets, snippets, and OpenAPI files.
- Record hosted redirects, authentication, analytics, custom domains, and dashboard-only settings.
- Initialize the target runtime separately from the source deployment.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## From Mintlify verification

- Build the target and compare navigation, components, assets, API pages, redirects, and protected content. Expected: The build passes and all required public routes and Markdown routes resolve.
- Failure: A Mintlify component is undefined during MDX compilation.
- Recovery: Replace it with the mapped Farming Labs component or register an equivalent custom component.
- Rollback: Leave the Mintlify production project connected until the new deployment and redirects pass verification.

## From Mintlify agent guidance

Read docs.json or mint.json before moving pages. Preserve the exact navigation arrays, page paths,
OpenAPI sources, redirects, and integrations in a migration inventory. Do not assume a dashboard
setting exists in the repository; require the user to confirm authentication, custom domains,
analytics, preview behavior, and protected content before cutover.
