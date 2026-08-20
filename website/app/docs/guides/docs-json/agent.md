<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:e4672a145ab7496a
settingsHash=fnv1a64:1b5212557ba75927
outputHash=fnv1a64:1e47ea690d0acfae
generatedAt=2026-08-20T10:20:45.420Z
-->
# docs.json

## docs.json task

Task: docs.json

Expected result: How the shared docs.json contract separates docs structure from Docs Cloud services

## docs.json verification



## docs.json agent guidance

Treat `docs.json` as a serializable repository contract. Keep `$schema`, `version`, `docs.mode`,
`docs.runtime`, and `docs.root` explicit; use `content.docsRoot` and `content.apiReferenceRoot` for
content locations. Only JSON-safe Cloud settings such as `cloud.analytics`, `cloud.publish`,
`cloud.ai`, and hosted publication state belong here. Keep theme helpers and callbacks such as
`analytics.onEvent` in `docs.config.ts`, CSS imports in the framework stylesheet, and secret values
in environment variables. `docs.json` may name an environment variable but must not contain its
secret value.

For a config-backed Cloud project, `pnpm dlx @farming-labs/docs cloud sync` materializes the
generated `docs.json`, which should describe the intended framework or frameworkless root without a
raw API key. For SvelteKit or Astro, the command needs `--config src/lib/docs.config.ts`.
`cloud.enabled: false` retains the local contract while disabling Cloud operations; otherwise the
field is normally omitted. If the JSON drifts from executable config, regenerate and review it
rather than hand-copying function-valued options. A frameworkless `pnpm exec docs dev` preview
currently uses the Next.js runtime even though `docs.runtime` remains explicit for future runtimes.
