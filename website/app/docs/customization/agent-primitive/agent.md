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

## Feedback Contract

If agent feedback is enabled for the site, use these default endpoints:

- schema: `/api/docs/agent/feedback/schema`
- submit: `/api/docs/agent/feedback`

The shared docs API also accepts the same feature through query parameters:

- schema: `/api/docs?feedback=agent&schema=1`
- submit: `/api/docs?feedback=agent`

Read the schema first, then submit a body shaped like:

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
