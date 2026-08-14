<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:3cd93ebac6b64e23
settingsHash=fnv1a64:0a67cd1f3384201a
outputHash=fnv1a64:3255515be7b4e3ee
generatedAt=2026-08-14T12:45:38.649Z
-->
# Sitemaps

## Sitemaps task

Task: Generate and verify XML and Markdown sitemaps for runtime and static docs deployments.

Expected result: Canonical sitemap routes or generated files list the expected docs pages with valid links and configured freshness metadata.

Exact implementation:

```bash title="terminal"
pnpm exec docs sitemap generate
pnpm exec docs robots generate
```
## Sitemaps prerequisites

- The docs content tree and public base URL are configured.
- Decide whether the deployment serves runtime routes or needs generated public files.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## Sitemaps verification

- Run pnpm exec docs sitemap generate --check. Expected: Generated sitemap artifacts match the current docs tree.
- Fetch sitemap.xml, sitemap.md, /docs/sitemap.md, and /.well-known/sitemap.md from a running site. Expected: Each route returns the configured format and links to known canonical docs pages.
- Failure: The check reports stale generated files.
- Recovery: Regenerate from the same docs config and commit the manifest and public output together.
- Rollback: Restore the previous sitemap config and regenerate or remove only the sitemap artifacts it owned.

## Sitemaps agent guidance

Use this page when the task is to customize or troubleshoot generated sitemaps. Runtime sitemap
routes are enabled by default; use `sitemap: false` only when a project must opt out.

Default public routes:
- `/sitemap.xml`
- `/sitemap.md`
- `/docs/sitemap.md`
- `/.well-known/sitemap.md`

Static export command:
- `pnpm exec docs sitemap generate`

Pair with `pnpm exec docs robots generate` when the static host should also publish an explicit
crawler and AI-agent access policy at `/robots.txt`.

The command writes `.farming-labs/sitemap-manifest.json` plus public sitemap files unless
`--manifest-only` is used. Lastmod dates come from `git log -1` for each page source path first,
then filesystem mtime as a fallback. Preloaded adapters also use the manifest as the stable source
for JSON-LD `dateModified`.
