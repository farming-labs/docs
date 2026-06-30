# Fumadocs Cloud Example

Focused Next.js example for the merged Docs Cloud API route.

## Run

```bash
pnpm install
cp examples/fumadocs-cloud/.env.local.example examples/fumadocs-cloud/.env.local
pnpm --filter @farming-labs/docs/example-fumadocs-cloud dev
```

## Docs Cloud Setup

The docs API route creates one server SDK instance and passes it to the normal docs API:

```ts
import { createDocsCloudServer } from "@farming-labs/docs/cloud/server";

const docsCloud = createDocsCloudServer({
  config: docsConfig,
});

export const { GET, POST } = createDocsAPI(docsConfig, docsCloud);
```

Required env:

```bash
DOCS_CLOUD_PROJECT_ID=project_...
DOCS_CLOUD_API_KEY=fl_key_...
NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID=project_...
```

The hosted Docs Cloud analytics endpoint is the default. Only set an analytics endpoint env when
testing a custom or self-hosted Cloud API.
