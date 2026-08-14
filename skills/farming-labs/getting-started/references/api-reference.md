# API reference setup

Use this reference when `apiReference` should generate an API reference from framework route
handlers or a hosted OpenAPI document.

## Local route scanning

```ts
export default defineDocs({
  entry: "docs",
  apiReference: {
    enabled: true,
    path: "api-reference",
    routeRoot: "api",
  },
  theme: fumadocs(),
});
```

- **Next.js:** `withDocs()` generates the `/{path}` route when `apiReference` is enabled.
- **TanStack Start, SvelteKit, Astro, Nuxt:** `docs.config` controls scanning and theming, but the
  app still needs the `/{path}` route handler.
- **CLI:** `init --api-reference` writes the config and scaffolds required handler files.
- **Agents:** `GET /api/docs?format=openapi` serves the schema and is advertised through agent
  discovery, generated `llms.txt`, `AGENTS.md`, and `skill.md`.

Route scanning conventions:

- **Next.js:** `app/api/**/route.ts` or `src/app/api/**/route.ts`
- **TanStack Start:** `src/routes/api.*.ts` and nested route files under the route root
- **SvelteKit:** `src/routes/api/**/+server.ts` or `+server.js`
- **Astro:** `src/pages/api/**/*.ts` or `.js`
- **Nuxt:** `server/api/**/*.ts` or `.js`

## Hosted OpenAPI

```ts
export default defineDocs({
  entry: "docs",
  apiReference: {
    enabled: true,
    path: "api-reference",
    specUrl: "https://petstore3.swagger.io/api/v3/openapi.json",
  },
  theme: fumadocs(),
});
```

`specUrl` disables local route scanning. TanStack Start, SvelteKit, Astro, and Nuxt still need the
`/{path}` handler because it serves the generated page.

Minimal non-Next handler files:

- **TanStack Start:** `src/routes/api-reference.index.ts` and
  `src/routes/api-reference.$.ts` using `createTanstackApiReference(config)`
- **SvelteKit:** `src/routes/api-reference/+server.ts` and
  `src/routes/api-reference/[...slug]/+server.ts` using `createSvelteApiReference(config)`
- **Astro:** `src/pages/api-reference/index.ts` and
  `src/pages/api-reference/[...slug].ts` using `createAstroApiReference(config)`
- **Nuxt:** `server/routes/api-reference/index.ts` and
  `server/routes/api-reference/[...slug].ts` using `defineApiReferenceHandler(config)`

For `path`, `specUrl`, `routeRoot`, and `exclude`, use the `configuration` skill.
