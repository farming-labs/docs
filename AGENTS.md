# Guidance for AI agents

This repo is **@farming-labs/docs** — an MDX-based documentation framework for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt.

## Skills (skills.sh / Agent Skills specification)

Skills are under **`skills/farming-labs/`** and divided by topic. Use the skill that matches the task.

| Task | Skill |
| ---- | ----- |
| Setup, init, theme CSS, docs.config | [getting-started](./skills/farming-labs/getting-started/SKILL.md) |
| CLI: init, upgrade, flags (--template, --name, --theme, etc.) | [cli](./skills/farming-labs/cli/SKILL.md) |
| Create or share a theme (createTheme, extendTheme, npm) | [creating-themes](./skills/farming-labs/creating-themes/SKILL.md) |
| Ask AI / AI chat configuration | [ask-ai](./skills/farming-labs/ask-ai/SKILL.md) |
| Page actions (Copy Markdown, Open in LLM) | [page-actions](./skills/farming-labs/page-actions/SKILL.md) |
| docs.config options (entry, theme, staticExport, sidebar, etc.) | [configuration](./skills/farming-labs/configuration/SKILL.md) |

- **Skills index:** [skills/farming-labs/README.md](./skills/farming-labs/README.md)
- **Install (Skills CLI):** `npx skills add farming-labs/docs` or `pnpm dlx skills add farming-labs/docs` (yarn/bun: `yarn dlx` / `bunx`) — then pick your preferred skill(s) when prompted.

Skills conform to the [Agent Skills specification](https://agentskills.io/specification) (frontmatter `name` matches parent directory, `description` under 1024 chars).

For full installation steps and examples, see the [README](./README.md) and the docs site (e.g. `/docs` routes in the repo).
