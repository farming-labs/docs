<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:71b392aaea120dba
settingsHash=fnv1a64:063b4c9a14696a17
outputHash=fnv1a64:c156b3ca29676945
generatedAt=2026-08-14T12:45:38.462Z
-->
# Deploy

## Deploy task

Task: Configure a repository and deploy a hosted Docs Cloud preview.

Expected result: Docs Cloud accepts the synchronized contract and returns a preview deployment URL.

Exact implementation:

```bash title="terminal"
pnpm dlx @farming-labs/docs deploy --json
```
## Deploy prerequisites

- The workspace has Docs Cloud access and a connected project.
- DOCS_CLOUD_API_KEY is available through the shell, .env.local, or CI secrets.
- The cloud deploy setting is enabled in docs.config.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## Deploy verification

- Run pnpm dlx @farming-labs/docs cloud check --deploy. Expected: Config, docs.json freshness, API key, deploy scopes, and hosted API checks pass.
- Confirm the JSON deploy response includes the expected project and preview URL.
- Failure: The CLI reports a missing or invalid API key.
- Recovery: Set the environment variable named by cloud.apiKey.env and never put the raw value in committed config.
- Rollback: Restore the previous docs.json and docs.config cloud block from version control.

## Deploy agent guidance

Use this page when the user asks about this topic: Docs Cloud deploys, hosted preview docs, Docs Cloud API keys, docs.config.ts cloud config, docs.json sync, publish modes, and deploy troubleshooting.
Keep answers technical and grounded in the commands and config on this page. Never suggest committing raw API key values to docs.config.ts, docs.json, or source control.
If the request is about hosted analytics, project identity, or event storage, point to /docs/cloud/analytics. If the request is about the docs.json contract itself, point to /docs/guides/docs-json.
