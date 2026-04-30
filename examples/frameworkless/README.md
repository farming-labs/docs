# Frameworkless Example

This example is intentionally minimal:

- `docs.cloud.json`
- `docs/`
- `api-reference/`

Run the local frameworkless dev server from this folder after building the CLI:

```bash
pnpm --filter @farming-labs/docs build
cd examples/frameworkless
node ../../packages/docs/dist/cli/index.mjs dev
```

The command generates a hidden runtime under `.docs-cloud/site` and serves:

- `/docs`
- `/docs/installation`
- `/api-reference`
- `/api-reference/authentication`
