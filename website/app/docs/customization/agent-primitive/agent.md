# Agent Primitive

You are reading the machine-oriented override for `/docs/customization/agent-primitive`.

Use this page when you need the page-level authoring contract for agent-facing docs in
`@farming-labs/docs`.

## The Two Primitives

1. `Agent`
   - Embed `<Agent>...</Agent>` inside `page.mdx`
   - Hidden in the normal docs UI
   - Included in `.md` output and MCP fallback when there is no sibling `agent.md`

2. `agent.md`
   - Place a sibling `agent.md` beside `page.mdx`
   - Becomes the full machine-readable output for that page
   - Preferred by MCP `read_page("/docs/customization/agent-primitive")`

## When To Choose Which

- Choose `Agent` when the human page should stay canonical and only needs extra machine context
- Choose `agent.md` when agents need a shorter, stricter, or more operational document

## Validation

- Human page: `/docs/customization/agent-primitive`
- Markdown route: `/docs/customization/agent-primitive.md`
- API route: `/api/docs?format=markdown&path=customization/agent-primitive`
- MCP read target: `/docs/customization/agent-primitive`

## Let Agents Discover The Spec

Fetch `GET /api/docs/agent/spec` before choosing how to read or report on the docs.

The spec is generated from `docs.config` and includes:

- site title, description, docs entry, and base URL
- configured locales and the `lang`/`locale` query parameters
- capability flags for markdown, MCP, search, feedback, skills, and `llms.txt`
- shared docs API route
- search endpoint and query parameter
- markdown route patterns
- `llms.txt` and `llms-full.txt` routes
- Skills CLI install command and recommended skill metadata
- MCP enabled state, endpoint, server name, version, and tool toggles
- agent feedback enabled state, schema route, and submit route

Use the returned routes instead of hard-coding defaults when the project customizes MCP or feedback.

## Bootstrap Prompt Pattern

Add this block to the docs landing page or another route that agents are likely to read first:

```mdx
<Agent>
You are reading this docs site as an implementation agent.

Before implementing from these docs, fetch `/api/docs/agent/spec` from the same origin. Use that
JSON as the source of truth for the docs entry path, markdown route pattern, search endpoint, MCP
endpoint, `llms.txt` routes, skills install command, locale handling, and feedback endpoints.

Recommended bootstrap flow:

1. Fetch `/api/docs/agent/spec`.
2. Use `spec.markdown.pagePattern` or `spec.markdown.acceptHeader` to read relevant docs pages as markdown.
3. Use `spec.search.endpoint` when you need to find the right page first.
4. Use `spec.mcp.wellKnownEndpoint`, `spec.mcp.publicEndpoint`, or `spec.mcp.endpoint` when MCP is enabled and your environment supports MCP.
5. If feedback is enabled, fetch `spec.feedback.schema` before submitting to `spec.feedback.submit`.

Do not scrape the HTML page when markdown, search, MCP, or `llms.txt` routes are available in the
spec.
</Agent>
```

## Feedback Contract

If agent feedback is enabled for the site, use these default endpoints:

- schema: `/api/docs/agent/feedback/schema`
- submit: `/api/docs/agent/feedback`

The shared docs API also accepts the same feature through query parameters:

- schema: `/api/docs?feedback=agent&schema=1`
- submit: `/api/docs?feedback=agent`

Fetch the schema endpoint first and use the returned schema as the source of truth for the body you
submit. Do not assume the payload fields are fixed, because the site can customize
`feedback.agent.schema`.

For the default schema, the body looks like:

```json
{
  "context": {
    "page": "/docs/customization/agent-primitive",
    "source": "md-route"
  },
  "payload": {
    "task": "understand page-level agent docs",
    "outcome": "implemented"
  }
}
```

If the project customizes `feedback.agent.route` or `feedback.agent.schemaRoute`, use those
configured paths instead of the defaults.

## Skills

This repo also ships reusable Agent Skills for broader workflows that are larger than one page.

Install them with:

```bash
npx skills add farming-labs/docs
```

Use the page-level primitives in this doc when the context belongs to a single route.
Use a skill when the task spans multiple pages or product areas such as:

- setup and installation
- CLI onboarding
- docs configuration
- page actions
- theme creation

Relevant skills in this repo include `getting-started`, `cli`, `configuration`, `page-actions`,
`ask-ai`, and `creating-themes`.

## Authoring Reminder

Do not duplicate whole pages into `<Agent>` blocks. Keep `Agent` additive and concise.
Use `agent.md` when the machine-readable page needs to diverge substantially.
