# Farming Labs — Agent Skills for @farming-labs/docs

This folder contains [Agent Skills](https://skills.sh/) (conforming to the [Agent Skills specification](https://agentskills.io/specification)) for **@farming-labs/docs** — an MDX-based documentation framework for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt.

Each skill is a separate directory with a `SKILL.md` file. Use the skill that matches the task (getting started, CLI, creating themes, Ask AI, page actions, or configuration, including search adapters, changelog setup, human page feedback, agent discovery/spec routes, `skill.md`, agent feedback endpoints, API reference, MCP, `llms.txt`, and machine-readable markdown routes with embedded `Agent` blocks, `agent.md` overrides, or `Accept: text/markdown` negotiation).

The repo also includes a runnable Next example for testing MCP plus external search providers:

```bash
pnpm --dir examples/next dev
```

Useful routes:

- Agent discovery spec: `http://127.0.0.1:3000/api/docs/agent/spec`
- Site skill: `http://127.0.0.1:3000/skill.md` or `http://127.0.0.1:3000/.well-known/skill.md`
- MCP: `http://127.0.0.1:3000/mcp` or `http://127.0.0.1:3000/.well-known/mcp`
- Search API: `http://127.0.0.1:3000/api/docs?query=session`
- Docs API markdown: `http://127.0.0.1:3000/api/docs?format=markdown&path=quickstart`
- Agent feedback schema: `http://127.0.0.1:3000/api/docs/agent/feedback/schema`
- Public markdown page with embedded `Agent` block (Next.js): `http://127.0.0.1:3000/docs/quickstart.md`
- Header-negotiated markdown page (Next.js): `curl http://127.0.0.1:3000/docs/quickstart -H "Accept: text/markdown"`
- Agent override example (Next.js): `http://127.0.0.1:3000/docs/getting-started/agent-ready-docs.md`

The agent discovery spec also advertises the root `skill.md` route, this Skills pack through
`npx skills add farming-labs/docs`, and recommends the `getting-started` skill for first-run setup.

---

## Available skills

| Skill | Path | When to use |
| ----- | ---- | ----------- |
| **Getting started** | [getting-started](./getting-started/SKILL.md) | Setting up docs, init, manual install, theme CSS, docs.config, packages by framework, generated changelog pages in Next.js, machine-readable markdown routes with `Agent` blocks or `agent.md` overrides, and API reference wiring from local routes or a hosted OpenAPI JSON. |
| **CLI** | [cli](./cli/SKILL.md) | Scaffolding and commands: init flow (existing vs fresh), Create your own theme, optional defaults (Enter to accept), `init` / `upgrade` / `mcp`, `--template`, `--name`, `--theme`, `--entry`, `--api-reference`, `--framework`, `--config`, package manager commands. |
| **Creating themes** | [creating-themes](./creating-themes/SKILL.md) | Building a custom theme with `createTheme()`, `extendTheme()`, `ui.components` defaults like `HoverLink`, publishing as npm, CSS overrides. |
| **Ask AI** | [ask-ai](./ask-ai/SKILL.md) | Enabling and configuring the RAG-powered AI chat: mode, floatingStyle, providers, models, suggestedQuestions, apiKey. |
| **Page actions** | [page-actions](./page-actions/SKILL.md) | Copy Markdown and Open in LLM buttons: copyMarkdown, openDocs, providers, urlTemplate, `{url}.md` markdown route patterns, position, alignment, and provider defaults. |
| **Configuration** | [configuration](./configuration/SKILL.md) | docs.config.ts options: entry, theme, staticExport, sidebar, breadcrumb, github, components, `search`, `changelog`, human page feedback, agent feedback endpoints, metadata, og, `mcp`, built-in markdown routes with `Agent` blocks or `agent.md`, and `apiReference` including remote `specUrl` support. |

---

## Installing with Skills CLI (skills.sh)

From the [Agent Skills Directory](https://skills.sh/), add skills from this repo and **pick your preferred skill(s)** when prompted.

**Install (use your preferred package manager):**

```bash
# npm
npx skills add farming-labs/docs

# pnpm
pnpm dlx skills add farming-labs/docs

# yarn
yarn dlx skills add farming-labs/docs

# bun
bunx skills add farming-labs/docs
```

The CLI will list skills under `skills/farming-labs/`. Choose the one(s) you need (e.g. `getting-started`, `cli`, `creating-themes`, `ask-ai`, `page-actions`, `configuration`). You can install multiple skills or add more later.

**Install a specific skill by path** (if your CLI supports it):

```bash
pnpm dlx skills add farming-labs/docs/skills/farming-labs/getting-started
pnpm dlx skills add farming-labs/docs/skills/farming-labs/cli
pnpm dlx skills add farming-labs/docs/skills/farming-labs/creating-themes
pnpm dlx skills add farming-labs/docs/skills/farming-labs/ask-ai
pnpm dlx skills add farming-labs/docs/skills/farming-labs/page-actions
pnpm dlx skills add farming-labs/docs/skills/farming-labs/configuration
```

---

## Cursor (project-level)

Copy the skill(s) you need into your project:

```bash
mkdir -p .cursor/skills
cp -r skills/farming-labs/getting-started .cursor/skills/
cp -r skills/farming-labs/cli .cursor/skills/
# ... repeat for creating-themes, ask-ai, page-actions, configuration
```

Or copy the whole farming-labs folder and let the agent use any of the skills:

```bash
mkdir -p .cursor/skills
cp -r skills/farming-labs/* .cursor/skills/
```

---

## Validation

Skills follow the [Agent Skills specification](https://agentskills.io/specification): each `SKILL.md` has required frontmatter (`name`, `description`) with `name` matching the parent directory. You can validate with [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref):

```bash
skills-ref validate ./skills/farming-labs/getting-started
```

---

## Resources

- **Docs site:** [docs.farming-labs.dev](https://docs.farming-labs.dev)
- **Repo:** [github.com/farming-labs/docs](https://github.com/farming-labs/docs)
- **Skills spec:** [agentskills.io/specification](https://agentskills.io/specification)
