# MCP and API reference

Use this reference for the built-in MCP server, opt-in HTTP authentication/security, MCP tools, or
generated API reference pages.

## Contents

- [MCP defaults](#mcp-defaults)
- [Opt-in authentication](#opt-in-authentication)
- [HTTP transport security](#http-transport-security)
- [Built-in tools](#built-in-tools)
- [Built-in prompts](#built-in-prompts)
- [Framework routing](#framework-routing)
- [API reference](#api-reference)

## MCP defaults

MCP is enabled and public by default.

```ts
mcp: {
  route: "/api/docs/mcp",
}
```

Default routes:

- public `/mcp`
- well-known `/.well-known/mcp`
- canonical `/api/docs/mcp`
- stdio `pnpx @farming-labs/docs mcp`

Set `mcp: { enabled: false }` to opt out.

## Opt-in authentication

Add `security.authenticate` only for private docs. Return a principal to continue, `null` for a
generated 401, or a Web `Response` for a fully custom rejection.

```ts
mcp: {
  security: {
    async authenticate({ request }) {
      const user = await authenticateRequest(request);
      return user ? { id: user.id, scopes: ["docs:read"] } : null;
    },
  },
}
```

For OAuth-aware clients, add RFC 9728 protected-resource metadata:

```ts
mcp: {
  security: {
    protectedResource: {
      authorizationServers: ["https://auth.example.com"],
      scopesSupported: ["docs:read", "docs:search"],
      requiredScopes: ["docs:read"],
      resourceName: "Private product docs",
      resourceDocumentation: "https://docs.example.com/auth/mcp",
    },
    async authenticate({ request, resource }) {
      const token = await verifyAccessToken(request);
      if (token && !token.audiences.includes(resource)) return null;
      return token
        ? { id: token.subject, scopes: token.scopes }
        : null;
    },
  },
}
```

The callback must validate signature, issuer, expiry, exact resource audience, and scopes. The
framework does not issue or validate tokens. `authorizationServers` must contain HTTPS issuer URLs
outside loopback development.

- Unauthenticated requests receive a Bearer challenge with `resource_metadata` and required scope.
- Missing required principal scopes return 403 `insufficient_scope`.
- A returned Web `Response` remains authoritative and must include its own challenge when needed.
- Thrown callback errors become sanitized 500 responses.
- Protected metadata remains inactive without `authenticate`.
- Each MCP alias is a distinct resource identifier; prefer `/mcp` for clients.

Metadata routes mirror each resource path:

- `/.well-known/oauth-protected-resource/mcp`
- `/.well-known/oauth-protected-resource/.well-known/mcp`
- `/.well-known/oauth-protected-resource/api/docs/mcp`

Next.js protected MCP cannot use `basePath`. Imported or shorthand config should be passed as
`withDocs(nextConfig, docsConfig)` so resolved security settings control rewrites.

## HTTP transport security

The transport:

- enforces same-origin for supplied Origin headers
- accepts origin-less non-browser clients
- limits POST bodies to 1 MiB by default before callbacks
- supports `security.allowedOrigins`
- supports `security.maxBodyBytes`
- returns exact-origin CORS for accepted browser origins
- exposes unauthenticated `OPTIONS` preflight
- supports extra headers under `security.cors.allowedHeaders`
- requires `security.cors.allowCredentials: true` for cookies

These settings do not affect stdio.

## Built-in tools

Core tools include:

- `list_docs`, `list_pages`, `list_tasks`
- `read_task`, `read_page`
- `get_navigation`, `search_docs`
- `get_code_examples`
- `get_config_schema`
- `get_context`

`list_docs` groups page summaries by section. `list_tasks` returns contract-bearing pages and
supports query/framework/version/package filters. `read_task` returns the complete task contract.

`get_code_examples` parses fence metadata including `title`, `framework`, `packageManager`, and
`runnable`. It supports query, path, framework, package manager, language, runnable, locale, and
limit filters.

`get_config_schema` accepts an exact option path or query and returns structured config metadata.

`get_context` accepts a query, optional framework/version/locale, and `tokenBudget` from 256 to
32,000 (default 4,000). It returns deterministic section chunks, source anchors, and conservative
UTF-8 accounting without exceeding the budget. General pages without scope remain eligible;
conflicting scopes are excluded.

`read_page` accepts optional `section` and `maxChars`. Successful tools expose validated
`structuredContent` while retaining text output for older clients.

## Built-in prompts

Actionable page contracts are exposed through MCP `prompts/list` and `prompts/get` by default.
Select specific contract pages, disable them, or publish selected golden tasks by ID:

```ts
mcp: {
  prompts: {
    contracts: [
      "/docs/installation",
      "/docs/configuration",
      "/docs/migrations/mintlify",
      "/docs/themes/creating-themes",
    ],
    goldenTasks: ["install-existing-nextjs", "create-reusable-theme"],
  },
}
```

Use `prompts: false` to disable the built-in prompt projection. Contract prompts embed only the
compact structured contract and accept validated scope arguments. Golden prompts expose the task
query, retrieval filters, and token budget; evaluator expectations, expected/forbidden sources,
answer assertions, and safety canaries remain private.

## Framework routing

- Next.js `withDocs()` generates the canonical route and public aliases.
- TanStack Start, SvelteKit, Astro, and Nuxt use their single public forwarder.
- Protected non-Next forwarders must pass `config.mcp` to `isDocsMcpRequest`.
- A custom `mcp.route` must be changed in both config and the public forwarder.

Verify locally:

```bash
pnpm --dir examples/next dev
```

Point a client or inspector at `http://127.0.0.1:3000/mcp`.

## API reference

Use local route scanning for an API in the same project; use `specUrl` for an externally hosted
OpenAPI document.

```ts
apiReference: {
  enabled: true,
  path: "api-reference",
  routeRoot: "api",
  exclude: ["/api/internal/health", "internal/debug"],
}
```

```ts
apiReference: {
  enabled: true,
  path: "api-reference",
  specUrl: "https://petstore3.swagger.io/api/v3/openapi.json",
}
```

Supported local conventions:

| Framework | Routes |
| --- | --- |
| Next.js | `app/api/**/route.ts`, including `src/app` |
| TanStack Start | `src/routes/api.*.ts` and nested route files |
| SvelteKit | `src/routes/api/**/+server.ts` or `.js` |
| Astro | `src/pages/api/**/*.ts` or `.js` |
| Nuxt | `server/api/**/*.ts` or `.js` |

Next.js creates the `/{path}` route with `withDocs()`. Other adapters need the handler files
generated by `init --api-reference`. Install only the Farming Labs packages; renderer dependencies
are bundled.

When `specUrl` is set, local `routeRoot` and `exclude` are ignored. The shared API exposes
`GET /api/docs?format=openapi`; discovery, llms, AGENTS.md, and skill.md advertise it. Static Next
export skips the generated API route.
