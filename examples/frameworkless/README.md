# Frameworkless Example

This example is intentionally minimal:

- `docs.cloud.json`
- `docs/`
- a remote OpenAPI URL in `docs.cloud.json`

This checked-in example is wired to a remote OpenAPI document so you can test the frameworkless remote flow immediately.

Frameworkless projects support either:

- a checked-in local spec file like `api/openapi.yaml`
- a remote spec URL in `docs.cloud.json`, such as `https://example.com/openapi.json`

Run the local frameworkless dev server from this folder after building the CLI:

```bash
pnpm --filter @farming-labs/docs build
cd examples/frameworkless
node ../../packages/docs/dist/cli/index.mjs dev
```

The command generates a hidden runtime under `.docs/site` and serves:

- `/docs`
- `/docs/installation`
- `/api-reference`
- `/api-reference/pet/findByStatus`

Current example config:

```json
{
  "$schema": "https://docs.farming-labs.dev/schema/cloud.json",
  "version": 1,
  "docs": {
    "mode": "frameworkless",
    "runtime": "nextjs",
    "root": ".docs/site"
  },
  "content": {
    "docsRoot": "docs",
    "openapi": [
      {
        "name": "Remote API",
        "path": "https://petstore3.swagger.io/api/v3/openapi.json",
        "route": "/api-reference"
      }
    ]
  },
  "cloud": {
    "enabled": false
  }
}
```
