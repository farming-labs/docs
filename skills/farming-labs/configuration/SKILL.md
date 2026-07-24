---
name: configuration
description: docs.config.ts options for @farming-labs/docs. Use when configuring entry, contentDir, theme, staticExport, nav, github, themeToggle, breadcrumb, sidebar, icons, components, search, changelog, feedback, telemetry, readingTime, agent.compact, agent.evaluations, agent.skills, agent.a2a, review, metadata, og, apiReference, MCP, llmsTxt, sitemap, robots, codeBlocks.validate, onCopyClick, pageActions, or ai. Covers Next.js, TanStack Start, SvelteKit, Astro, Nuxt config file location.
---

# @farming-labs/docs — Configuration

All configuration lives in a single **docs.config.ts** (or **docs.config.tsx**) file. Use this skill when editing or explaining config options.

**Full docs:** [Configuration](https://docs.farming-labs.dev/docs/configuration), [API Reference](https://docs.farming-labs.dev/docs/reference).

---

## Config file location by framework

| Framework | Config path |
| --------- | ----------- |
| Next.js | Project root: `docs.config.ts` |
| TanStack Start | Project root: `docs.config.ts` or `docs.config.tsx` |
| SvelteKit | `src/lib/docs.config.ts` |
| Astro | `src/lib/docs.config.ts` |
| Nuxt | Project root: `docs.config.ts` |

TanStack Start, SvelteKit, Astro, and Nuxt require `contentDir` (path to markdown files) and `nav` (sidebar title and base URL) in addition to `entry` and `theme`.

---

## Main config options

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `entry` | `string` | `"docs"` | URL path prefix for docs (e.g. `"docs"` → `/docs`) |
| `contentDir` | `string` | same as `entry` | Path to content files (TanStack Start, SvelteKit, Astro, Nuxt) |
| `staticExport` | `boolean` | `false` | Set `true` for full static builds; hides search and AI |
| `theme` | `DocsTheme` | — | Theme from a theme factory (e.g. `fumadocs()`, `pixelBorder()`) |
| `nav` | `{ title, url }` | — | Sidebar title and base URL (required for TanStack Start, SvelteKit, Astro, Nuxt) |
| `github` | `string \| GithubConfig` | — | GitHub repo for "Edit on GitHub" and `{githubUrl}` in page actions |
| `themeToggle` | `boolean \| ThemeToggleConfig` | `true` | Light/dark mode toggle |
| `breadcrumb` | `boolean \| BreadcrumbConfig` | `true` | Breadcrumb navigation |
| `sidebar` | `boolean \| SidebarConfig` | `true` | Sidebar visibility and style |
| `icons` | `Record<string, Component>` | — | Shared icon registry for frontmatter `icon` fields and built-ins like `Prompt` |
| `components` | `Record<string, Component>` | — | Custom MDX components and built-in overrides like `HoverLink` and `Prompt` |
| `onCopyClick` | `(data: CodeBlockCopyData) => void` | — | Callback when user copies a code block (title, content, url, language) |
| `codeBlocks` | `DocsCodeBlocksConfig` | — | Validate fenced MDX code blocks with metadata planning and optional sandbox execution |
| `feedback` | `boolean \| FeedbackConfig` | `false` for UI | Human page feedback UI; agent feedback endpoints are default-on unless opted out |
| `telemetry` | `boolean \| DocsTelemetryConfig` | production-only enabled | Farming Labs maintainer telemetry for package adoption and coarse agent-surface usage |
| `readingTime` | `boolean \| ReadingTimeConfig` | `false` | Opt-in estimated read-time label with per-page overrides |
| `agent` | `DocsAgentConfig` | — | Compaction, golden evaluations, reusable skill publication, and optional A2A metadata |
| `review` | `boolean \| DocsReviewConfig` | `true` | Docs Review scoring, GitHub Actions workflow generation, and rule severities |
| `pageActions` | `PageActionsConfig` | — | Copy Markdown, Open in LLM (see `page-actions` skill) |
| `ai` | `AIConfig` | — | RAG-powered AI chat (see `ask-ai` skill) |
| `search` | `boolean \| DocsSearchConfig` | `true` | Built-in simple search, Typesense, Algolia, or a custom adapter |
| `cloud` | `DocsCloudConfig` | — | Docs Cloud API key env, preview, and publish defaults mirrored into `docs.json` by cloud CLI commands |
| `llmsTxt` | `boolean \| LlmsTxtConfig` | `true` | Generated `/llms.txt`, `/llms-full.txt`, and optional section-level llms files |
| `changelog` | `boolean \| ChangelogConfig` | `false` | Generated changelog feed and entry pages from dated MDX entries (Next.js) |
| `mcp` | `boolean \| DocsMcpConfig` | enabled | Built-in MCP server over stdio, `/mcp`, and `/.well-known/mcp` |
| `apiReference` | `boolean \| ApiReferenceConfig` | `false` | Generated API reference pages from supported framework route conventions or a hosted OpenAPI JSON document |
| `sitemap` | `boolean \| DocsSitemapConfig` | `true` | Generated `sitemap.xml`, `sitemap.md`, `/docs/sitemap.md`, and `/.well-known/sitemap.md` |
| `robots` | `boolean \| DocsRobotsConfig` | `true` | Runtime/generated `robots.txt` policy for docs routes, agent-readable files, and common AI crawler user agents |
| `metadata` | `DocsMetadata` | — | SEO and JSON-LD inputs: titleTemplate, description, etc. |
| `og` | `OGConfig` | — | Dynamic Open Graph images |

Telemetry ignores local development origins such as `localhost`, `*.localhost`, IPv4 loopback, and
IPv6 loopback or wildcard binding addresses even when `telemetry: true` is configured.

---

## Docs Review CI

`review` is enabled by default. The generated GitHub Actions workflow is a tiny wrapper around
`farming-labs/docs/.github/workflows/docs-review-reusable.yml@main`. Use `review.ci.name` to customize
the job/check name; it defaults to `docs-review`.

```ts
review: {
  ci: {
    name: "agent-docs-review",
    mode: "warn",
  },
  rules: {
    agentContext: "warn",
    commandHealth: "warn",
    relatedCoverage: "suggestion",
    configConfidence: "warn",
    agentSurfaceDrift: "error",
    goldenTasks: "warn",
  },
}
```

The `agentContext` rule validates structured page-level `agent` contracts and performs corpus-wide
duplicate, boilerplate, generic-context, task-completeness, and applicability checks.
`commandHealth` statically checks package managers, scripts, working directories, and known docs
CLI commands without executing documentation snippets. `relatedCoverage`, `configConfidence`,
`agentSurfaceDrift`, and `goldenTasks` cover related routes, evaluated-vs-static config loading,
public-surface/schema parity, and configured task evaluation respectively.

---

## Code block validation

Use `codeBlocks.validate` when docs code fences should be planned and checked by the CLI.
Runner providers can be `local`, `vercel-sandbox`, `e2b`, `daytona`, or reserved `cloud`.
E2B expects the `e2b` package, and Daytona expects `@daytona/sdk`, to be available to the CLI.

```ts
codeBlocks: {
  validate: {
    planner: {
      provider: "openai",
      model: "gpt-4.1-mini",
      apiKeyEnv: "OPENAI_API_KEY",
    },
    runner: {
      provider: "vercel-sandbox",
      tokenEnv: "VERCEL_TOKEN",
    },
    envFile: [".env.local", ".env.test", ".env"],
    env: {
      OPENAI_API_KEY: "OPENAI_TEST_API_KEY",
    },
    missingEnv: "skip",
  },
}
```

Fence metadata example:

````md
```ts title="app/api/chat/route.ts" framework="nextjs" packageManager="pnpm" env="OPENAI_API_KEY" runnable
const apiKey = process.env.OPENAI_API_KEY;
```
````

Useful commands:

```bash
pnpm exec docs codeblocks validate --plan
pnpm exec docs codeblocks validate
```

Do not put actual API keys in `docs.config.ts`. Use env variable names and map runtime names to test keys with `env`.

---

## Docs Cloud

Cloud-aware CLI commands read a serializable `cloud` block from `docs.config.ts` and mirror it into
`docs.json` automatically.

```ts
cloud: {
  apiKey: { env: "DOCS_CLOUD_API_KEY" },
  deploy: { enabled: true },
  publish: { mode: "draft-pr", baseBranch: "main" },
}
```

Run `docs cloud sync` to only update `docs.json`, or `docs deploy` to sync, validate the API key,
and deploy hosted preview docs. The API key value belongs in `.env.local`, CI secrets, or the shell,
never directly in `docs.config.ts` or `docs.json`.

---

## Static export

For fully static builds (e.g. Cloudflare Pages, no server):

```ts
export default defineDocs({
  entry: "docs",
  staticExport: true,
  theme: fumadocs(),
});
```

- Search (Cmd+K) and AI chat are hidden in the layout.
- Next.js: with `output: "export"` in `next.config`, the `/api/docs` route is not generated.
- Do not deploy the docs API route when using static export.
- `docs agent export --public` always emits a statically truthful discovery document, even if this
  flag is omitted: server-only search, MCP, feedback, API reference, and OpenAPI are not advertised.
- Static Agent Bundles always include the hashed Agent Skills index and its exact artifact. They
  intentionally omit the RFC 9727 API catalog and remove it from generated `llms.txt`, `skill.md`,
  `AGENTS.md`, and `robots.txt` discovery lists because a generic public directory cannot guarantee
  the required profiled response type.
- Dynamic adapters set the RFC media type and discovery `Link` headers automatically. For a purely
  static deployment that needs an API catalog, publish `/.well-known/api-catalog` separately
  through host-specific routing configured to serve
  `application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"`.

---

## Machine-readable markdown routes

No separate `docs.config` flag is required for page-level markdown delivery.

Default behavior:

- the shared docs API supports `GET /api/docs?format=markdown&path=<slug>`
- **Next.js:** `withDocs()` also serves `/docs.md` and `/docs/<slug>.md`
- **TanStack Start:** current `init` scaffolds one `src/routes/$.ts` public forwarder for `/docs.md` and `/docs/<slug>.md`
- **SvelteKit:** current `init` scaffolds one `src/hooks.server.ts` public forwarder for `/docs.md` and `/docs/<slug>.md`
- **Astro:** current `init` scaffolds one `src/middleware.ts` public forwarder for `/docs.md` and `/docs/<slug>.md`
- **Nuxt:** current `init` scaffolds one `server/middleware/docs-public.ts` public forwarder for `/docs.md` and `/docs/<slug>.md`
- **Next.js:** an unambiguous `Accept: text/markdown` on `/docs/<slug>` returns the same markdown response; mixed headers containing `text/html`, `text/*`, or `*/*` stay HTML, so use the exact `.md` URL or API format route for those requests
- Requests with `Signature-Agent` on normal docs URLs return the same markdown response, so agent fetchers can read canonical URLs without appending `.md`
- Next.js also auto-serves markdown on normal docs URLs for known AI user agents and conservative bot-like agent heuristics
- successful responses include canonical `Link`, `Content-Location`, and `ETag` headers; `Last-Modified` is included only when the adapter has an exact source timestamp, never from date-only frontmatter alone
- markdown responses start with YAML frontmatter for `title`, optional `description`, `canonical_url`, `markdown_url`, and `last_updated` when a page freshness date is known
- successful markdown page responses append a `## Sitemap` footer that links to the configured markdown sitemap routes
- missing markdown pages return actionable markdown with HTTP `404`, closest-match suggestions, recovery instructions, discovery links, and sitemap links
- very high-confidence missing markdown slugs redirect to the closest `.md` page instead of returning a recovery body
- content outside audience wrappers is shared; no `docs.config` flag is required
- embedded `<Agent>...</Agent>` and `<Audience only="agent">...</Audience>` blocks stay hidden in
  rendered HTML and public search, and are included in the agent projection
- embedded `<Human>...</Human>` and `<Audience only="human">...</Audience>` blocks stay in rendered
  HTML and public search, and are removed from the agent projection
- Markdown routes, Ask AI, MCP, `llms-full.txt`, and static agent exports use the agent projection;
  compact `llms.txt` links point to agent-projected Markdown, while sitemaps contain route metadata
  rather than page bodies
- `<Agent>` remains an optional agent-only shorthand and `<Human>` is the human-only shorthand;
  both have a fixed audience, so `docs review` reports and ignores an `only` prop
- use `<Audience only="human">` or `<Audience only="agent">` when you prefer the explicit form
- invalid or missing `Audience.only` values remain shared rather than being silently discarded
- dynamic `Audience.only` expressions and spread props are unsupported because static exports
  cannot resolve them; use a static literal and rely on `docs review` to report dynamic declarations
- audience filtering is representation shaping, not authentication or authorization; never place
  secrets or private data in an audience block or `agent.md`
- if a page folder has `agent.md`, that file becomes the markdown response for that page
- if `agent.md` is missing, the markdown response uses the agent audience projection of shared page content
- page frontmatter `related` is rendered into a comma-separated machine-readable markdown metadata line beside `Description` for normal page markdown and audience-projected fallback
- page frontmatter `agent` can define a structured task contract; valid fields are normalized into markdown frontmatter, a deterministic `## Agent Contract` section, search/Ask AI context, and Schema.org `HowTo` JSON-LD
- structured agent contract fields are `task`, `outcome`, `appliesTo`, `prerequisites`, `files`, `commands`, `sideEffects`, `verification`, `rollback`, and `failureModes`; all are optional and `agent.tokenBudget` remains backward compatible
- `docs review` reports malformed and unknown structured fields (with closest-name suggestions such as `verfication` → `verification`) and suggests missing outcomes, verification, or rollback guidance without breaking runtime page delivery
- MCP `read_page("/docs/<slug>")` uses the same page source and sees the same override
- MCP `list_pages` and `list_docs` keep contract summaries concise (`hasContract`, `task`, `outcome`, `appliesTo`); use `list_tasks` to discover actionable pages and `read_task` or `read_page` for the full contract
- a sibling `agent.md` remains the page-content override; include any `Related:` line manually inside `agent.md` when needed
- `docs agent compact` can generate those sibling `agent.md` files from the resolved page output

Folder example:

```txt
app/docs/quickstart/
  page.mdx

app/docs/getting-started/quickstart/
  page.mdx

app/docs/getting-started/agent-ready-docs/
  page.mdx
  agent.md
```

Embedded audience-context example:

```mdx
# Quickstart

Human-facing instructions.

<Human>
Use the highlighted dashboard control shown below.
</Human>

<Agent>
You are an implementation agent.
Keep the scaffolded paths and commands aligned with the actual project structure.
</Agent>

<Audience only="agent">
Run the verification command and require exit code 0.
</Audience>
```

Related-page frontmatter example:

```mdx
---
title: "Installation"
description: "Install the framework"
related:
  - /docs/configuration
  - /docs/customization/agent-primitive
---
```

Structured agent-contract example:

```md
---
title: "Installation"
description: "Install the framework"
agent:
  tokenBudget: 900
  task: Install the docs framework
  outcome: The docs route renders locally.
  appliesTo:
    framework: nextjs
    version: ">=16"
    package: "@farming-labs/next"
  prerequisites:
    - The app uses the App Router
  files:
    - package.json
    - next.config.ts
  commands:
    - run: pnpm add @farming-labs/docs @farming-labs/next
      description: Install the framework packages
  sideEffects:
    - Updates package.json and the lockfile
  verification:
    - run: pnpm dev
      expect: The docs route returns HTTP 200
  rollback:
    - Remove the packages and restore the previous config
  failureModes:
    - symptom: The route returns 404
      resolution: Confirm withDocs wraps the Next.js config
---
```

Authentication, deployment, and other stateful tasks benefit most from `sideEffects`, `rollback`,
and `failureModes`. Simple reference pages may omit the structured contract entirely.

Useful checks:

```bash
curl "http://127.0.0.1:3000/api/docs?format=markdown&path=quickstart"
curl "http://127.0.0.1:3000/docs/quickstart.md"
curl "http://127.0.0.1:3000/docs/quickstart" -H "Accept: text/markdown" # Next.js
curl "http://127.0.0.1:3000/docs/quickstart" -H "Signature-Agent: https://chatgpt.com"
curl "http://127.0.0.1:3000/docs/quickstart" -H "User-Agent: ClaudeBot/1.0"
curl "http://127.0.0.1:3000/docs/getting-started/agent-ready-docs.md"
```

Call out content negotiation when relevant: in Next.js, `/docs/<slug>` remains the normal HTML page
for browsers, but agents/scripts can send an unambiguous `Accept: text/markdown`, send
`Signature-Agent`, or use a known AI user agent to receive the machine-readable markdown
representation without appending `.md`. Shared and non-Next handlers honor weighted `Accept`
values. The generated Next.js rewrite does not compare arbitrary `q` values: if `text/html`,
`text/*`, or `*/*` is also present, use `/docs/<slug>.md` or the API format route.

---

## llms.txt

`llmsTxt` is enabled by default and serves compact and full machine-readable indexes through the
existing docs API and public aliases.

```ts
llmsTxt: {
  baseUrl: "https://docs.example.com",
  maxChars: {
    mode: "warn",
    chars: 50_000,
  },
  sections: [
    {
      title: "API",
      description: "Endpoint, SDK, and integration reference pages.",
      match: "/docs/api/**",
      maxChars: {
        mode: "warn",
        chars: 25_000,
      },
    },
  ],
},
```

Behavior:

- default routes are `/llms.txt`, `/llms-full.txt`, `/.well-known/llms.txt`, and
  `/.well-known/llms-full.txt`
- native static files at those same routes win automatically (`public/llms.txt` for most
  frameworks, `static/llms.txt` for SvelteKit)
- compact `llms.txt` links point to page markdown routes such as `/docs/install.md`
- `maxChars` defaults to `{ mode: "warn", chars: 50000 }`; `mode: "error"` returns an error for
  an over-budget compact file, and `mode: "off"` disables the check
- `sections` is opt-in and has no UI; it only adds route handling and discovery metadata
- section routes are derived from the first matcher, so `/docs/api/**` creates
  `/docs/api/llms.txt` and `/docs/api/llms-full.txt`
- root `/llms.txt` lists configured sections first and leaves matched pages to their section files
- section `maxChars` inherits the root `llmsTxt.maxChars` when omitted
- set `llmsTxt.apiCatalog: false` when the deployment must not expose or advertise
  `/.well-known/api-catalog`; hashed Agent Skills discovery remains enabled

Use `/docs/customization/llms-txt` for output examples.

---

## Sitemaps

Sitemaps are exposed by default. Use `sitemap` when the project should customize crawler-friendly
XML and agent-friendly Markdown maps of the docs tree.

```ts
sitemap: {
  enabled: true,
  baseUrl: "https://docs.example.com",
},
```

Default routes:

- `/sitemap.xml`
- `/sitemap.md`
- `/docs/sitemap.md`
- `/.well-known/sitemap.md`
- `/api/docs?format=sitemap-xml`
- `/api/docs?format=sitemap-md`

Static generation:

```bash
pnpm exec docs sitemap generate
pnpm exec docs sitemap generate --config src/lib/docs.config.ts
pnpm exec docs sitemap generate --manifest-only
pnpm exec docs sitemap generate --check
```

Behavior:

- `docs sitemap generate` writes `.farming-labs/sitemap-manifest.json` plus public sitemap files by default
- SvelteKit public output goes to `static/`; other adapters use `public/`
- `--manifest-only` writes only the manifest for server-rendered apps that serve routes at runtime
- `--public` is an explicit spelling of the default public-file behavior
- `--check` fails when generated sitemap output is stale
- `lastmod` uses each page source file's last git commit date first, then filesystem mtime
- `routePrefix: "/docs-map"` moves sitemap routes to `/docs-map/sitemap.xml`, `/docs-map/sitemap.md`, and `/docs-map/.well-known/sitemap.md`; the default `/docs/sitemap.md` alias is only emitted when no route prefix is set
- there is no separate well-known route config; the route prefix applies to all sitemap routes together

Useful config:

```ts
sitemap: {
  routePrefix: "/docs-map",
  baseUrl: "https://docs.example.com",
  xml: { includeLastmod: true },
  markdown: {
    includeDescriptions: true,
    includeLastmod: true,
    linkTarget: "both",
  },
},
```

Use `/docs/customization/sitemaps` when the user needs output examples or static export details.
Use the `cli` skill when they ask about command syntax.

---

## Robots.txt

`robots` is served by the runtime by default when no static `robots.txt` exists. Use it when the
project should customize or generate a static `robots.txt` policy for docs and agent-readable
routes.

```ts
robots: {
  enabled: true,
  baseUrl: "https://docs.example.com",
  path: "public/robots.txt",
  ai: "allow",
},
```

Behavior:

- runtime adapters serve `/robots.txt` by default when no static file already owns that route
- `docs robots generate` writes the generated policy for static export or committed files
- default output is `public/robots.txt`, or `static/robots.txt` for SvelteKit
- `path` changes where the CLI reads and writes the file
- existing files are preserved unless the user passes `--append` or `--force`
- generated policy includes docs entry routes, `.md` routes, `llms.txt`, sitemap routes,
  `AGENTS.md`, `skill.md`, the API catalog, Agent Skills discovery, MCP aliases, agent discovery
  routes, and common AI crawler user agents
- the agent discovery JSON advertises `robots.enabled`, `robots.route`, and `robots.defaultRoute`
  as a pointer to the static policy file
- `baseUrl` lets the generator include an absolute `Sitemap:` line
- `docs doctor --agent` validates the resolved robots path and warns when agent routes or common AI
  crawlers are blocked

### Structured data

Every docs page automatically emits Schema.org `TechArticle` JSON-LD with `headline`,
`description`, canonical `url`, `dateModified`, and `BreadcrumbList`. There is no separate config
flag. Absolute URLs reuse `sitemap.baseUrl`, `llmsTxt.baseUrl`, `robots.baseUrl`, or `ai.docsUrl`.
The agent discovery JSON advertises this as `capabilities.structuredData`.

Use the `cli` skill when the user asks about `docs robots generate` flags.

---

## Reusable Agent Skills

Use `agent.skills` to publish reusable skills through the runtime, a Static Agent Bundle, and MCP.
The concise value can be a project-relative path or array; `{ paths }` is the equivalent explicit
form:

```ts
agent: {
  skills: {
    paths: [
      "./skills/getting-started/SKILL.md",
      "./skills/product",
      "./skills/team-skills",
    ],
  },
},
```

Each path may identify a `SKILL.md`, its containing skill directory, or a collection directory.
Collection discovery walks descendants for skill directories. Paths are resolved from the project
root and may refer to another project directory inside the same workspace, but may not escape that
workspace. Configured paths, skill documents, directories, and companion files must be regular,
non-symlink filesystem entries.

For each discovered skill, the runtime publishes `SKILL.md` and safe regular files below only
`references/`, `scripts/`, and `assets/`. A standalone `SKILL.md` is indexed directly as
`skill-md`. A skill with companion files is indexed as a deterministic `.tar.gz` archive; its
SHA-256 digest covers the exact archive bytes. Direct file responses also carry their own hashes,
so progressive-disclosure clients do not need to unpack the archive.

Discovery and access routes are:

- `/.well-known/agent-skills/index.json` — Agent Skills v0.2 index
- `/.well-known/agent-skills/<name>/SKILL.md` and
  `/.well-known/agent-skills/<name>/{references|scripts|assets}/...` — direct files
- `/.well-known/agent-skills/<name>.tar.gz` — indexed artifact when companions exist
- `/.well-known/skills/index.json`, `/.well-known/skills/<name>/skill.md`, and companion paths —
  legacy compatibility
- `docs://skills/<name>/<path>` — MCP resources; text formats use `text`, while binary assets use a
  base64 `blob`

The project-root `skill.md` remains the backwards-compatible site skill and is published alongside
configured skills. `docs agent export --public` writes the same modern and legacy indexes,
artifacts, direct files, and digests as the runtime.

`agent.a2a` is a separate opt-in. Configure it only when the advertised URLs implement A2A—not for
a docs route, Ask AI route, or MCP endpoint. Prefer the ordered `supportedInterfaces` array; its
first entry is the preferred interface. Each entry defaults to A2A protocol `1.0` with the
`HTTP+JSON` binding. The core bindings are `JSONRPC`, `GRPC`, and `HTTP+JSON`; a custom binding must
be an absolute URI. The deprecated `interfaceUrl` shorthand remains available for one interface,
with `protocolVersion` and `protocolBinding` applying only to that shorthand. It retains the
historical protocol `0.3` default so existing services are not silently misadvertised; set
`protocolVersion: "1.0"` explicitly when using the shorthand for a v1 service. Core interfaces and
all HTTP card/authentication metadata use HTTPS outside loopback development. Custom bindings use a
secure binding-appropriate absolute URL such as WSS or MQTTS.

The generated card uses the strict A2A v1 shape: interface metadata lives in
`supportedInterfaces`, not legacy top-level `url`, `protocolVersion`, or `preferredTransport`
fields. Set `capabilities`, default media modes, and `skills` to what the A2A service actually
implements. An A2A `AgentSkill` has `id`, `name`, `description`, and `tags`, but no URL. Published
Agent Skill documents and artifact URLs remain available through the Agent Skills indexes and MCP
resources; they are a separate discovery surface. The preferred `supportedInterfaces` form
requires explicit A2A skills. Published documentation skills are projected only when `a2a.skills`
is omitted from the deprecated shorthand, preserving its previous behavior. Use optional
`securitySchemes` and `securityRequirements` when the A2A service requires authentication.

When configured, the runtime and static export publish `/.well-known/agent-card.json`; when
omitted, that route is not advertised or generated.

```ts
agent: {
  skills: "./skills",
  a2a: {
    name: "Product docs agent",
    description: "Answers implementation questions from the product documentation.",
    supportedInterfaces: [
      {
        url: "https://agent.example.com/a2a",
        protocolBinding: "HTTP+JSON",
        protocolVersion: "1.0",
      },
      {
        url: "https://agent.example.com/a2a/rpc",
        protocolBinding: "JSONRPC",
        protocolVersion: "1.0",
      },
    ],
    documentationUrl: "https://docs.example.com/docs",
    provider: {
      organization: "Example, Inc.",
      url: "https://example.com",
    },
    version: "1.0.0",
    capabilities: {
      streaming: true,
      pushNotifications: false,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [
      {
        id: "answer-docs",
        name: "Answer documentation questions",
        description: "Answers implementation questions using the product documentation.",
        tags: ["documentation", "implementation"],
        examples: ["How do I configure the Next.js adapter?"],
      },
    ],
  },
},
```

---

## Golden agent evaluations

Use `agent.evaluations.tasks` when doctor and review should measure actual retrieval usefulness.
Evaluation defaults to the local `mcp-context` surface, with no implicit model, network request, or
command execution. It checks ranked retrieval, canonical citations, framework/version/locale
selection, answer evidence, verified examples, and exact UTF-8 context usage.

```ts
agent: {
  evaluations: {
    tokenBudget: 4_000,
    topK: 3,
    searchTimeoutMs: 30_000,
    surface: "mcp-context",
    tasks: [{
      id: "next-16-install",
      query: "Install the docs framework in Next.js 16",
      filters: { framework: "nextjs", version: "16" },
      expect: {
        scope: { framework: "nextjs", version: "16" },
        relevantSources: ["/docs/installation"],
        forbiddenSources: ["/docs/legacy-installation"],
        maxFirstRelevantRank: 1,
        examples: [{
          source: "/docs/installation",
          language: "bash",
          packageManager: "pnpm",
          runnable: true,
          verification: "present",
          includes: ["pnpm add @farming-labs/docs"],
        }],
        minUsefulByteRatio: 0.7,
      },
    }],
  },
},
```

`tokenBudget` and `topK` can be set globally or per task. `requiredCitations` defaults to
`relevantSources`; `allowedSources`, `minRecallAtK`, and `maxFirstRelevantRank` tighten retrieval
expectations. `filters` narrow retrieval; `expect.scope` asserts the returned framework, version,
or locale without narrowing first.

Surfaces:

- `mcp-context` — default, local MCP context construction
- `configured-search` — the actual configured search provider and ranked results
- `ask-ai-context` — the production Ask AI retrieval and context assembly path

Non-simple search providers require `allowNetwork: true`, and provider errors or the per-task
`searchTimeoutMs` timeout fail rather than silently falling back. Configured-search preserves the
provider's returned order and does not supplement it with local hits. Actual-answer scoring additionally requires `expect.answer` and an explicit
`answer` provider. A callback provider invokes user-owned `run(input)` code. An HTTP provider POSTs
the task id, query, filters, surface, context, and retrieved sources—never the expected answer—and
expects `{ text, citations? }`; it requires
`allowNetwork: true`. HTTP auth is optional through `headers`, whose values never appear in reports.
No model is selected automatically.

Expected examples accept `verification: "present" | "syntax" | "execute"`. Runnable examples
default to syntax and non-runnable examples default to presence. Execution requires
`allowNetwork: true`, an explicit execute expectation, and enabled `codeBlocks.validate` in
`report` mode; skipped validation never passes. No configured tasks means `unmeasured`, never a
passing score.

## Agent compaction

Use `agent.compact` to configure defaults for `docs agent compact`, which writes sibling `agent.md`
files from resolved docs pages.

```ts
agent: {
  compact: {
    apiKeyEnv: "DOCS_CLOUD_API_KEY",
    model: "docs-cloud-compress-v1",
    aggressiveness: 0.3,
    protectJson: true,
  },
},
```

Supported fields:

- `apiKey`
- `apiKeyEnv`
- `baseUrl`
- `model`
- `aggressiveness`
- `maxOutputTokens`
- `minOutputTokens`
- `protectJson`

Notes:

- `.env` and `.env.local` are loaded before the CLI resolves the key
- `apiKey: process.env.DOCS_CLOUD_API_KEY` is supported in `docs.config.tsx`
- the command creates missing `agent.md` files and overwrites existing ones
- generated `agent.md` becomes the machine-readable source for `.md` routes,
  `GET /api/docs?format=markdown&path=...`, and MCP `read_page()`
- the human docs UI still renders the normal page
- page frontmatter `agent.tokenBudget` overrides `maxOutputTokens` for that page
- if no sibling `agent.md` exists, the command compacts the generated machine-readable page output
  first and then writes a new `agent.md`
- `docs agent compact --changed` only processes docs pages changed in the current git working
  tree, including staged, unstaged, and untracked docs changes
- if inherited `minOutputTokens` is greater than the page budget, the CLI clamps it down to the
  page budget before calling the compression API

Common commands:

```bash
pnpm exec docs agent compact installation configuration
pnpm exec docs agent compact installation --dry-run
pnpm exec docs agent compact --all
pnpm exec docs agent compact --changed
```

Per-page override example:

```md
---
title: "Installation"
agent:
  tokenBudget: 777
---
```

Use the `cli` skill or `/docs/cli` when the user needs the full command syntax instead of the
config shape.

---

## Reading time

Use `readingTime` when the user wants a small `5 min read` label on docs pages.

```ts
readingTime: {
  enabled: true,
  wordsPerMinute: 220,
},
```

Key points:

- it is **disabled by default**
- code blocks, inline code, links, images, HTML, and URLs are stripped before counting words
- page frontmatter can override it with `readingTime: false`, `readingTime: true`, or `readingTime: 8`
- page frontmatter wins even when the global `readingTime` config is off
- the label follows the page-actions slot: `above-title` keeps it directly under the actions row, and `below-title` keeps it in the below-title metadata area

---

## GitHub (Edit on GitHub and openDocs)

```ts
github: {
  url: "https://github.com/owner/repo",
  directory: "website",  // optional: subdirectory where docs content lives
}
```

Enables "Edit on GitHub" links and allows `{githubUrl}` in `pageActions.openDocs.providers`.

---

## Components and built-ins

`components` is merged into the default MDX component map, so you can both add your own
components and override built-ins such as `Callout`, `Tabs`, `HoverLink`, or `Prompt`.

Use `theme.ui.components` when you want to keep a built-in like `HoverLink` or `Prompt` but change its default
props globally (for example `linkLabel`, `showIndicator`, or `align`).

---

## Search

Search is enabled by default. If the user does nothing, the framework uses the built-in simple
adapter with section-based chunking.

```ts
search: true,
```

The HTTP search route is audience-aware while remaining backward compatible:

- `GET /api/docs?query=<query>` returns the human projection (shared content plus `Human` content)
- `GET /api/docs?query=<query>&audience=agent` opts into the agent projection (shared content plus
  `Agent` content)
- `audience=human`, an omitted value, or any value other than the exact lowercase `agent` stays on
  the human projection

Audience selection shapes public search content; it is not authentication or authorization. Never
put secrets or private data in an audience block.

Built-in provider options:

- `simple` — zero-config docs search
- `typesense` — external Typesense backend with optional hybrid mode
- `algolia` — external Algolia backend
- `mcp` — use an MCP `search_docs` tool over Streamable HTTP
- `custom` — user-supplied adapter

Typesense example:

```ts
search: {
  provider: "typesense",
  baseUrl: process.env.TYPESENSE_URL!,
  collection: "docs",
  apiKey: process.env.TYPESENSE_SEARCH_API_KEY!,
  adminApiKey: process.env.TYPESENSE_ADMIN_API_KEY,
  mode: "hybrid",
  embeddings: {
    provider: "ollama",
    model: "embeddinggemma",
  },
},
```

Algolia example:

```ts
search: {
  provider: "algolia",
  appId: process.env.ALGOLIA_APP_ID!,
  indexName: "docs",
  searchApiKey: process.env.ALGOLIA_SEARCH_API_KEY!,
  adminApiKey: process.env.ALGOLIA_ADMIN_API_KEY,
},
```

MCP example:

```ts
search: {
  provider: "mcp",
  endpoint: "/mcp",
},
mcp: {
  enabled: true,
},
```

Custom adapter example:

```ts
import { createCustomSearchAdapter, defineDocs } from "@farming-labs/docs";

search: createCustomSearchAdapter({
  name: "my-search",
  async search(query, context) {
    return context.documents.slice(0, query.limit ?? 10).map((doc) => ({
      id: doc.id,
      url: doc.url,
      content: doc.section ? `${doc.title} — ${doc.section}` : doc.title,
      description: doc.description,
      type: doc.type,
      section: doc.section,
    }));
  },
}),
```

Important notes:

- `chunking.strategy` defaults to `"section"` and can be changed to `"page"`
- custom adapters receive the resolved projection as `query.audience` and `context.audience`; the
  `context.documents` supplied to the request use that same projection
- custom adapters should apply `query.audience` while filtering and ranking provider results
- Typesense and Algolia can sync the index on first request when `adminApiKey` is present
- hosted Typesense and Algolia index sync remains human-projected; agent searches are projected at
  request time and do not replace the public index with agent-only text
- `provider: "mcp"` supports relative endpoints like `/mcp` or `/.well-known/mcp` and absolute remote endpoints
- same-origin MCP `search_docs` routes receive the resolved `audience`; remote endpoints and custom
  tool names must set `forwardAudience: true` after their input schema supports that argument;
  human-projection requests fall back to local search until then
- if `provider: "mcp"` points at the same relative MCP route, the built-in `search_docs` tool falls back to simple search internally so the route does not recurse forever
- On custom/manual Next routes, pass the full config into `createDocsAPI(docsConfig)`
- Use `pnpm dlx @farming-labs/docs search sync --typesense` or `--algolia` when you want to push external indexes from the CLI instead of waiting for the first request
- Search is hidden when `staticExport: true` because there is no docs API route

Testing tip:

- The Next example under `examples/next` is the easiest place to verify provider-backed search.
- Set `DOCS_SEARCH_PROVIDER=typesense`, `algolia`, or `mcp`, restart the app, and query
  `/api/docs?query=...` to confirm the active backend.
- Query `/api/docs?query=...&audience=agent` to verify the agent projection without changing the
  human-default search contract.

---

## Changelog

Use `changelog` to render a docs-native release feed from dated MDX entries.

```ts
changelog: {
  enabled: true,
  path: "changelogs",
  contentDir: "changelog",
  title: "Changelog",
  description: "Latest product updates and release notes.",
  search: true,
},
```

Important notes:

- Today, the turn-key generated changelog pages are wired in **Next.js** when you use `withDocs()`
- Source entries default to `app/docs/changelog/YYYY-MM-DD/page.mdx`
- Public pages render at `/docs/changelogs` and `/docs/changelogs/YYYY-MM-DD`
- No separate `__changelog.generated.tsx` file is required; the generated route files inline the dated entry imports
- Use `docs.config.tsx` if you pass a JSX `actionsComponent`

Useful entry frontmatter:

- `title`
- `description`
- `image`
- `authors`
- `version`
- `tags`
- `pinned`
- `draft`

---

## Page feedback

```ts
feedback: {
  enabled: true,
  onFeedback(data) {
    console.log(data.value, data.slug, data.url);
  },
}
```

- Use `feedback: true` to show the UI with no callback.
- **Next.js / TanStack Start / SvelteKit / Nuxt:** `feedback.onFeedback` runs from the built-in UI with no extra client bridge file.
- **Astro:** the built-in UI still works with `feedback: true`; optional analytics hooks can listen to `window.__fdOnFeedback__` or the `fd:feedback` event.

## Agent feedback endpoints

Agent feedback endpoints are enabled by default so agents or automation can report docs
understanding or implementation outcomes back through the shared docs API. Use `feedback.agent` to
customize the callback, route, or payload schema.

```ts
feedback: {
  agent: {
    async onFeedback(data) {
      console.log(data.context?.page, data.payload);
    },
  },
}
```

Default behavior:

- `GET` and `HEAD` on `/.well-known/api-catalog` serve an RFC 9727 JSON linkset; the catalog only
  advertises enabled API and metadata resources
- `GET` and `HEAD` on `/.well-known/agent-skills/index.json` serve the modern Agent Skills index;
  indexed artifacts and safe direct files are hashed, and `/.well-known/skills/index.json` remains
  available for legacy clients
- `GET /.well-known/agent.json` is the preferred public agent discovery document, with `/.well-known/agent` as fallback and `/api/docs/agent/spec` as the canonical framework route
- the manifest is a Farming Labs documentation-discovery extension identified by
  `$schema: "https://docs.farming-labs.dev/schema/agent-manifest.v1.json"` and
  `format: "farming-labs-agent-manifest.v1"`; dynamic responses associate the Draft 2020-12 schema
  with `rel="describedby"` and `type="application/schema+json"`
- do not treat the Farming Labs manifest as A2A; `/.well-known/agent-card.json` remains a separate,
  opt-in A2A v1 document
- the existing discovery document remains available and now cross-lists the API catalog and Agent
  Skills index alongside site identity, locale config, capability flags, search, markdown routes,
  `llms.txt`, OpenAPI, sitemap, robots, `AGENTS.md`, `skill.md`, MCP, and feedback metadata
- public discovery responses expose useful HTTP `Link` headers for the RFC 9727 catalog, existing
  agent manifest, and Agent Skills index
- `GET /AGENTS.md` serves the root `AGENTS.md` or `AGENT.md` file when present, `GET /.well-known/AGENTS.md` is the fallback alias, and `GET /api/docs?format=agents` is the shared API format
- `GET /skill.md` serves the root `skill.md` file when present, `GET /.well-known/skill.md` is the fallback alias, and `GET /api/docs?format=skill` is the shared API format
- `GET /api/docs/agent/feedback/schema` returns the machine-readable schema
- `POST /api/docs/agent/feedback` accepts `{ context?, payload }`; without `onFeedback` it returns `{ ok: true, handled: false }`
- the shared `/api/docs` handler remains the source of truth
- **Next.js:** `withDocs()` adds the public rewrites automatically
- **TanStack Start / SvelteKit / Astro / Nuxt:** the shared `/api/docs?feedback=agent` query route is advertised and handled by the existing server wrapper
- **TanStack Start:** current `init` scaffolds one `src/routes/$.ts` public forwarder for well-known routes, `/AGENTS.md`, and `/skill.md`
- **SvelteKit:** current `init` scaffolds one `src/hooks.server.ts` public forwarder for well-known routes, `/AGENTS.md`, and `/skill.md`
- **Astro:** current `init` scaffolds one `src/middleware.ts` public forwarder for well-known routes, `/AGENTS.md`, and `/skill.md`
- **Nuxt:** current `init` scaffolds one `server/middleware/docs-public.ts` public forwarder for well-known routes, `/AGENTS.md`, and `/skill.md`
- `feedback.agent` alone does not enable the human footer UI
- set `feedback: false` or `feedback: { agent: false }` to opt out of the agent feedback routes

Default payload shape:

```json
{
  "context": {
    "page": "/docs/installation",
    "source": "md-route"
  },
  "payload": {
    "task": "install docs in an existing Next.js app",
    "understanding": "partial",
    "outcome": "implemented",
    "confidence": 0.78,
    "neededCodeReading": true,
    "missingContext": ["how the markdown route is resolved"],
    "docIssues": ["command example was unclear"],
    "suggestedImprovement": "Add one sentence about rewrite behavior."
  }
}
```

Customize the route or payload schema when needed:

```ts
feedback: {
  agent: {
    route: "/internal/docs/agent-feedback",
    schemaRoute: "/internal/docs/agent-feedback/schema",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        task: { type: "string" },
        outcome: { type: "string" },
      },
      required: ["task", "outcome"],
    },
  },
}
```

---

## MCP Server

MCP is enabled by default. Use `mcp` when you want to customize the built-in MCP server for local
agents and remote HTTP clients, or set `enabled: false` to opt out.

```ts
mcp: {
  route: "/api/docs/mcp",
}
```

HTTP MCP is public by default. Add `security.authenticate` only when the docs need access control;
return a principal to continue, `null` for a framework-generated 401, or a Web `Response` to control
the rejection yourself. Callback-only authentication remains supported. Add
`security.protectedResource` alongside `authenticate` when OAuth-aware clients also need RFC 9728
discovery and Bearer challenges.

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

OAuth protected-resource example:

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

Protected-resource behavior:

- the framework acts as the OAuth resource server but does not issue or validate tokens;
  `authenticate` must validate signature, issuer, expiry, the exact callback `resource` audience,
  and derive scopes from the verified token without token passthrough; the callback `request`
  retains the real incoming URL and query string
- `authorizationServers` is required and must contain at least one HTTPS authorization-server
  issuer URL without query or fragment; loopback HTTP is accepted for development
- `scopesSupported` is advertised as `scopes_supported`; `requiredScopes` is enforced against the
  principal returned by `authenticate`
- returning `null` produces `401` with a Bearer `WWW-Authenticate` challenge containing
  `resource_metadata` and the required `scope`
- a valid principal missing any required scope receives `403` with `error="insufficient_scope"`
- a Web `Response` returned by `authenticate` remains authoritative; its status, body, and headers
  are preserved, so a custom OAuth rejection must provide its own `WWW-Authenticate` header
- throwing produces a sanitized `500`; provider details are not exposed
- protected-resource discovery is inactive without `authenticate`, so the endpoint remains public
  and its metadata routes return `404`
- TanStack Start, SvelteKit, and Astro forwarders must pass `config.mcp` as the second argument to
  `isDocsMcpRequest`; update older generated forwarders before enabling protected auth
- stdio is unaffected

Public RFC 9728 metadata routes:

- `/.well-known/oauth-protected-resource/mcp` for `/mcp`
- `/.well-known/oauth-protected-resource/.well-known/mcp` for `/.well-known/mcp`
- `/.well-known/oauth-protected-resource/api/docs/mcp` for the default canonical route; when
  `mcp.route` changes, this path follows the configured route

Each metadata document identifies its corresponding public resource URL and advertises
`authorization_servers`, optional `scopes_supported`, `resource_name`, and optional
`resource_documentation`. Metadata accepts unauthenticated `GET` and `HEAD` requests so clients can
discover how to authenticate. Use absolute HTTPS URLs for hosted authorization servers and
authentication documentation, and serve hosted MCP over HTTPS; reserve HTTP for loopback
development.
Each MCP alias is a distinct OAuth resource identifier. Token audience validation must accept the
exact endpoint used by the client; prefer `/mcp` as the shared public endpoint.
Next.js protected MCP cannot use `basePath`; host it at the origin root or publish the MCP and RFC
9728 routes at an edge proxy. Inline MCP objects are detected automatically. When MCP configuration
is imported, spread, or shorthand, pass the live config as `withDocs(nextConfig, docsConfig)` so
protected rewrites and the `basePath` check use the resolved object.

The HTTP transport validates supplied Origin headers as same-origin and limits POST bodies to 1 MiB
by default, including when authentication is omitted. Use `security.allowedOrigins` for explicit
browser origins and `security.maxBodyBytes` for a different limit. Origin-less non-browser clients
remain supported. Bodies are capped before either callback runs. Accepted browser Origins receive
exact-Origin CORS and an unauthenticated `OPTIONS` preflight path; custom request headers go in
`security.cors.allowedHeaders`, and cookie credentials require
`security.cors.allowCredentials: true`. Generated forwarders include `OPTIONS`. These settings do
not affect `docs mcp` over stdio.

Opt out explicitly:

```ts
mcp: {
  enabled: false,
}
```

Default behavior:

- **Public HTTP route:** `/mcp`
- **Well-known HTTP route:** `/.well-known/mcp`
- **Canonical HTTP route:** `/api/docs/mcp`
- **stdio command:** `pnpx @farming-labs/docs mcp`
- **Built-in tools:** `list_docs`, `list_pages`, `list_tasks`, `read_task`, `get_navigation`, `search_docs`, `read_page`, `get_code_examples`, `get_config_schema`, `get_context`

`list_docs` returns docs page summaries grouped by section. Call it with no arguments for the whole
docs tree, or pass `section` to narrow results before calling `read_page`.

`list_tasks` returns only pages with structured task contracts and supports `query`, `framework`,
`version`, and `package` filters. Its summaries contain task, outcome, and applicability; call
`read_task` for the full prerequisites/files/commands/effects/verification/rollback/failure contract.

```json
{
  "name": "list_docs",
  "arguments": {
    "section": "getting-started"
  }
}
```

`get_code_examples` returns fenced code blocks as structured JSON. It parses code-fence metadata
such as `title`, `framework`, `packageManager`, and `runnable` from raw markdown/MDX and does not
change the rendered code block UI.

Authoring example:

````md
```ts title="docs.config.ts" framework="nextjs" packageManager="pnpm" runnable
export default defineDocs({
  entry: "docs",
});
```
````

MCP call example:

```json
{
  "name": "get_code_examples",
  "arguments": {
    "path": "getting-started/quickstart",
    "framework": "nextjs",
    "packageManager": "pnpm",
    "runnable": true
  }
}
```

Supported filters: `query`, `path`, `framework`, `packageManager`, `language`, `runnable`, `limit`, and `locale`.

`get_config_schema` returns structured `docs.config.ts` option metadata for agents that need to
write or update config safely. Call it with no arguments for the full schema, `option` for a
specific top-level or nested path, or `query` for keyword filtering.

```json
{
  "name": "get_config_schema",
  "arguments": {
    "option": "mcp.tools.getConfigSchema"
  }
}
```

`get_context` returns deterministic section-level context for a query. It accepts optional
`framework`, `version`, and `locale` scopes plus `tokenBudget` (default `4000`, minimum `256`,
maximum `32000`) and reports source anchors plus conservative UTF-8 byte accounting. Pages with
conflicting framework/version/locale metadata are excluded; pages that omit a scope field remain
eligible as general docs. Equal-score results use source URL ordering. The complete assembled
context never exceeds `tokenBudget` UTF-8 bytes, and `conservativeTokenUpperBound` exposes that
dependency-free upper bound. `read_page` also accepts optional `section` and `maxChars` arguments;
the limit applies to section-not-found output and its available-heading list too.
Successful built-in tool calls expose validated `structuredContent` while retaining their text
response for older MCP clients.

Set optional page scopes with top-level frontmatter such as `framework: "nextjs"`, `version: "16"`,
and `locale: "en"`. Quote numeric versions so the metadata remains a string.

Framework notes:
- **Next.js:** `withDocs()` auto-generates the default `/api/docs/mcp` route and public `/mcp` plus `/.well-known/mcp` rewrites
- **TanStack Start:** current `init` scaffolds one `src/routes/$.ts` public forwarder for `/api/docs/mcp`, `/mcp`, and `/.well-known/mcp`
- **SvelteKit:** current `init` scaffolds one `src/hooks.server.ts` public forwarder for `/api/docs/mcp`, `/mcp`, and `/.well-known/mcp`
- **Astro:** current `init` scaffolds one `src/middleware.ts` public forwarder for `/api/docs/mcp`, `/mcp`, and `/.well-known/mcp`
- **Nuxt:** current `init` scaffolds one `server/middleware/docs-public.ts` public forwarder for `/api/docs/mcp`, `/mcp`, and `/.well-known/mcp`
- **Custom routes:** set `mcp.route` in `docs.config` and update the framework public forwarder so the configured path and the actual endpoint stay aligned

Testing tip:

```bash
pnpm --dir examples/next dev
```

Then point an MCP client or inspector at `http://127.0.0.1:3000/mcp` or
`http://127.0.0.1:3000/.well-known/mcp` to verify the default route.

Hosted example:

- The docs site itself exposes MCP at `https://docs.farming-labs.dev/mcp` and
  `https://docs.farming-labs.dev/.well-known/mcp`
- Cursor can install it from a deeplink:
  `cursor://anysphere.cursor-deeplink/mcp/install?name=farming-labs-docs&config=eyJ1cmwiOiJodHRwczovL2RvY3MuZmFybWluZy1sYWJzLmRldi8ud2VsbC1rbm93bi9tY3AifQ==`

See the full guide: [docs.farming-labs.dev/docs/customization/mcp](https://docs.farming-labs.dev/docs/customization/mcp)

---

## API Reference

`apiReference` generates an API reference from framework route conventions or a hosted OpenAPI
JSON document.

Use local route scanning when your API routes live in the same project. Use `specUrl` when your
backend is hosted elsewhere and already exposes an `openapi.json`.

Current support:
- **Next.js:** `app/api/**/route.ts` and `src/app/api/**/route.ts`
- **TanStack Start:** `src/routes/api.*.ts` and nested route files inside the configured route root
- **SvelteKit:** `src/routes/api/**/+server.ts` or `+server.js`
- **Astro:** `src/pages/api/**/*.ts` or `.js`
- **Nuxt:** `server/api/**/*.ts` or `.js`

```ts
apiReference: {
  enabled: true,
  path: "api-reference",
  routeRoot: "api",
  exclude: ["/api/internal/health", "internal/debug"],
}
```

Remote spec example:

```ts
apiReference: {
  enabled: true,
  path: "api-reference",
  specUrl: "https://petstore3.swagger.io/api/v3/openapi.json",
}
```

Notes:
- **Next.js:** `withDocs()` auto-generates the `/{path}` route when `apiReference` is enabled
- **TanStack Start / SvelteKit / Astro / Nuxt:** `docs.config` controls scanning, remote spec rendering, and styling, but the app must still add the framework route handler for `/{path}`
- **CLI:** `init --api-reference` writes the `apiReference` block and scaffolds the non-Next route handler files automatically
- **Packages:** install the Farming Labs docs packages for the framework only. Do not ask users to install `fumadocs-openapi`, `fumadocs-ui`, `fumadocs-core`, `@scalar/core`, or `@scalar/nextjs-api-reference` directly; those renderer dependencies are bundled by `@farming-labs/docs` and the adapters
- `path` controls the public URL for the generated reference
- `GET /api/docs?format=openapi` returns the machine-readable OpenAPI schema when `apiReference` is enabled
- agent discovery, generated `llms.txt`, generated `AGENTS.md`, and generated `skill.md` advertise the OpenAPI schema route so agents can fetch schemas before scraping API pages
- `specUrl` points to a hosted OpenAPI JSON document; when set, local route scanning is skipped
- `routeRoot` controls the filesystem route root to scan
- `exclude` accepts either URL-style paths (`"/api/hello"`) or route-root-relative entries (`"hello"` / `"hello/route.ts"`)
- on Next.js static export (`output: "export"`), the generated API reference route is skipped automatically

When `specUrl` is set:

- `routeRoot` and `exclude` are ignored
- the API reference is rendered from the hosted OpenAPI JSON
- non-Next frameworks still need the `/{path}` handler files because they are what serve the generated API reference page

Minimal handler files for non-Next frameworks:

- **TanStack Start:** `src/routes/api-reference.index.ts` and `src/routes/api-reference.$.ts` using `createTanstackApiReference(config)`
- **SvelteKit:** `src/routes/api-reference/+server.ts` and `src/routes/api-reference/[...slug]/+server.ts` using `createSvelteApiReference(config)`
- **Astro:** `src/pages/api-reference/index.ts` and `src/pages/api-reference/[...slug].ts` using `createAstroApiReference(config)`
- **Nuxt:** `server/routes/api-reference/index.ts` and `server/routes/api-reference/[...slug].ts` using `defineApiReferenceHandler(config)`

---

## Theme toggle

```ts
themeToggle: {
  enabled: true,   // show toggle (default)
  default: "light" | "dark" | "system",
}
```

Set `enabled: false` to hide the toggle or force a single mode.

---

## Sidebar and breadcrumb

- **sidebar:** `true` (default) or `SidebarConfig` (style, banner, footer, `folderIndexBehavior`, etc.). Use `folderIndexBehavior: "toggle"` when all folder parents should only expand/collapse instead of navigating to their landing page. Use `folderIndexBehavior: "hidden"` when the folder landing-page route should stop acting like a standalone page: the sidebar renders that folder as a plain label with child links only, direct visits to the parent route redirect to the first visible child, and the hidden parent stays out of markdown/search indexing. Use `folderIndexBehaviorOverrides` to do that selectively for specific folder landing-page URLs such as `"/docs/components"`. A folder landing page can also override both with frontmatter:
  ```mdx
  ---
  sidebar:
    folderIndexBehavior: "hidden"
  ---
  ```
- **breadcrumb:** `true` (default) or `BreadcrumbConfig` to show/hide or configure breadcrumb.

---

## Metadata and OG

- **metadata:** `titleTemplate`, `description`, `twitterCard`, etc. for SEO.
- **og:** `enabled`, `type` ("dynamic" | "static"), `endpoint` for dynamic OG image generation. See API reference and OG Images docs.

---

## Ordering (sidebar)

Use `ordering: "numeric"` (default) so sidebar order follows frontmatter `order` (numbers). Doc pages can set `order: 1`, `order: 2`, etc. in frontmatter to control order.

---

## Edge cases

1. **Next.js:** Must wrap config with `withDocs()` from `@farming-labs/next/config` in `next.config.ts`.
2. **TanStack Start:** `docs.config.ts` stays at project root; wire it into `createDocsServer()` and keep the theme CSS import in your global stylesheet aligned with the theme name in config.
3. **SvelteKit/Astro:** Server-side docs loader must receive config and (for AI) env vars; see framework docs.
4. **Nuxt:** `defineDocsHandler(config, useStorage)` in `server/api/docs.ts`; config is imported from root `docs.config.ts`.
5. **Feedback callbacks:** Astro cannot serialize config functions into client scripts; use the built-in custom event hooks if you need analytics there.
6. **MCP custom routes:** The defaults are `/api/docs/mcp`, `/mcp`, and `/.well-known/mcp`. If the user sets `mcp.route`, keep that path in config and update the framework public forwarder so aliases still reach the same handler when MCP is enabled.

---

## Resources

- **Configuration docs:** [docs.farming-labs.dev/docs/configuration](https://docs.farming-labs.dev/docs/configuration)
- **API Reference:** [docs.farming-labs.dev/docs/reference](https://docs.farming-labs.dev/docs/reference)
- **MCP Server:** [docs.farming-labs.dev/docs/customization/mcp](https://docs.farming-labs.dev/docs/customization/mcp)
- **Related skills:** `ask-ai`, `page-actions`, `getting-started`, `creating-themes`.
