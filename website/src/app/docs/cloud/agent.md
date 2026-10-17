<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:ea4599fe0d071f98
settingsHash=fnv1a64:54aabfe997b31e1c
outputHash=fnv1a64:3bbb07e4687e854e
generatedAt=2026-08-20T10:20:45.233Z
-->
# Docs Cloud

## Docs Cloud Sync repository contract task

Task: Connect a Farming Labs docs project to the Docs Cloud repository contract.

Expected result: docs.config and docs.json agree, secrets remain outside source control, and Cloud checks can inspect the project.

Exact implementation:

```bash title="terminal"
pnpm dlx @farming-labs/docs cloud sync
```
## Docs Cloud Sync repository prerequisites

- The repository already contains a working Farming Labs docs project.
- The team has Docs Cloud access and knows which project should own the integration.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## Docs Cloud Sync repository verification

- Run pnpm dlx @farming-labs/docs cloud check --no-network. Expected: The local config loads and docs.json is current with no raw API key value.
- Failure: docs.json is stale after editing docs.config.
- Recovery: Run cloud sync again and review the generated diff before committing it.
- Rollback: Restore the previous docs.config and docs.json from version control.

## Docs Cloud agent guidance

Use this page when the user asks about this topic: Docs Cloud overview, Cloud project shape, Docs Cloud API keys, docs.config.ts cloud config, docs.json, hosted deploys, analytics, and publish defaults.
Keep answers grounded in the pages linked from this overview. Never suggest committing raw API key values to docs.config.ts, docs.json, or source control.
If the request is about hosted preview deploys, point to /docs/cloud/deploy. If the request is about hosted analytics, project identity, or event storage, point to /docs/cloud/analytics.
If the request is about the docs.json contract itself, point to /docs/guides/docs-json. If the request is about every config option, point to /docs/configuration.
## Docs Cloud Sync repository contract command

Run `pnpm dlx @farming-labs/docs cloud sync` to generate the `docs.json` repository contract. Commit `docs.json`, but keep the raw Docs Cloud API key outside source control.

```bash title="terminal"
pnpm dlx @farming-labs/docs cloud sync
```

## Docs Cloud sync prerequisites

Before Cloud sync, confirm the repository has a working docs config and that the Docs Cloud API key is available only through the configured environment variable.

## Docs Cloud sync verification

After Cloud sync, review the generated `docs.json`, run `pnpm dlx @farming-labs/docs cloud check --no-network`, and confirm no raw key was written to source control.
