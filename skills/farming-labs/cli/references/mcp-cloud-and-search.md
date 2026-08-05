# MCP, cloud, and search

Use this reference for local or hosted MCP client setup, Docs Cloud deployment, and external
search-index synchronization.

## Contents

- [Local MCP](#local-mcp)
- [Hosted MCP client setup](#hosted-mcp-client-setup)
- [Docs Cloud](#docs-cloud)
- [Search sync](#search-sync)
- [Verification](#verification)

## Local MCP

Run the built-in MCP server over stdio:

```bash
pnpx @farming-labs/docs mcp
pnpm exec docs mcp
```

It reads `docs.config.ts[x]` at the project root by default and reuses `entry` and `contentDir`.

```bash
pnpm exec docs mcp --config src/lib/docs.config.ts
```

Core tools include page/task listing, navigation, search, section-aware reading, code examples,
config schema, and budgeted context. Use the `configuration` skill for MCP HTTP route,
authentication, or tool configuration.

## Hosted MCP client setup

Generate a direct Streamable HTTP client entry:

```bash
pnpm exec docs mcp setup --deployment <deployment-id> --json
pnpm exec docs mcp setup --deployment <deployment-id> --client cursor --json
pnpm exec docs mcp setup --deployment <deployment-id> --client vscode --json
```

- Default output targets Claude Code and references `${DOCS_CLOUD_API_KEY}`.
- Cursor uses `${env:DOCS_CLOUD_API_KEY}`.
- VS Code uses top-level `servers` plus a secure `${input:docs-cloud-api-key}` prompt.
- Output connects to the deployment; it must not recursively invoke `mcp setup`.
- Raw keys are never embedded.

## Docs Cloud

Use from a docs project root:

```bash
pnpm dlx @farming-labs/docs deploy
pnpm dlx @farming-labs/docs preview
pnpm dlx @farming-labs/docs cloud deploy
pnpm dlx @farming-labs/docs cloud preview
pnpm dlx @farming-labs/docs cloud sync
```

Config:

```ts
cloud: {
  apiKey: { env: "DOCS_CLOUD_API_KEY" },
  deploy: { enabled: true },
  publish: { mode: "draft-pr", baseBranch: "main" },
}
```

- `cloud sync` updates only `docs.json`.
- `deploy` creates/synchronizes `docs.json`, validates the named key, and deploys.
- `preview` and `cloud preview` are compatibility aliases.
- `--config <path>` selects a non-root config.
- `--api-base-url <url>` targets staging or self-hosted cloud APIs.

Keep the key value in the named environment variable, `.env.local`, or CI secrets.

## Search sync

Push docs to Typesense:

```bash
pnpm dlx @farming-labs/docs search sync --typesense
```

Environment:

```bash
TYPESENSE_URL=https://your-cluster.a1.typesense.net
TYPESENSE_API_KEY=your-admin-capable-key
TYPESENSE_COLLECTION=docs
TYPESENSE_MODE=hybrid
TYPESENSE_OLLAMA_MODEL=embeddinggemma
TYPESENSE_OLLAMA_BASE_URL=http://127.0.0.1:11434
```

Push docs to Algolia:

```bash
pnpm dlx @farming-labs/docs search sync --algolia
```

Environment:

```bash
ALGOLIA_APP_ID=your-app-id
ALGOLIA_ADMIN_API_KEY=your-admin-key
ALGOLIA_SEARCH_API_KEY=your-search-key
```

Generic form:

```bash
pnpm dlx @farming-labs/docs search sync --provider typesense
pnpm dlx @farming-labs/docs search sync --provider algolia
```

The command loads `.env` and `.env.local`, resolves docs config, scans the content directory, and
uploads normalized records.

## Verification

Use the Next example to exercise MCP and search providers:

```bash
pnpm --dir examples/next dev
pnpm --dir examples/next exec docs search sync --typesense --config docs.config.tsx
```

Then verify:

- MCP: `http://127.0.0.1:3000/mcp`
- well-known MCP: `http://127.0.0.1:3000/.well-known/mcp`
- search: `http://127.0.0.1:3000/api/docs?query=session`

For failures, confirm the environment variable exists without printing it, confirm config uses the
same provider/endpoint, and rerun the smallest command.
