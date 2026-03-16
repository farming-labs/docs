# Agent skills for @farming-labs/docs

This directory contains [Agent Skills](https://skills.sh/) (conforming to the [Agent Skills specification](https://agentskills.io/specification)) that help AI coding assistants work with **@farming-labs/docs** — an MDX-based documentation framework for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt.

Skills are organized under **`farming-labs/`** and divided by topic. Use the skill that matches the task.

---

## Skills (under farming-labs/)

| Skill | Path | When to use |
| ----- | ---- | ----------- |
| **Getting started** | [farming-labs/getting-started](./farming-labs/getting-started/SKILL.md) | Setup, init, manual install, theme CSS, defineDocs, packages by framework. |
| **CLI** | [farming-labs/cli](./farming-labs/cli/SKILL.md) | Scaffolding: `init`, `upgrade`, `--template`, `--name`, `--theme`, `--framework`, package manager commands. |
| **Creating themes** | [farming-labs/creating-themes](./farming-labs/creating-themes/SKILL.md) | Build and share themes: `createTheme()`, `extendTheme()`, publish as npm, CSS overrides. |
| **Ask AI** | [farming-labs/ask-ai](./farming-labs/ask-ai/SKILL.md) | RAG-powered AI chat: mode, floatingStyle, providers, models, suggestedQuestions, apiKey. |
| **Page actions** | [farming-labs/page-actions](./farming-labs/page-actions/SKILL.md) | Copy Markdown and Open in LLM: copyMarkdown, openDocs, providers, urlTemplate. |
| **Configuration** | [farming-labs/configuration](./farming-labs/configuration/SKILL.md) | docs.config.ts: entry, theme, staticExport, sidebar, github, metadata, og, etc. |

Full index and per-skill install paths: **[farming-labs/README.md](./farming-labs/README.md)**.

---

## Installing with Skills CLI (skills.sh)

From the [Agent Skills Directory](https://skills.sh/), install skills from this repo and **pick your preferred skill(s)** when prompted.

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

If the CLI lists skills under `skills/farming-labs/`, choose the one you need (e.g. `getting-started`, `cli`, `creating-themes`, `ask-ai`, `page-actions`, `configuration`).

**Install a specific skill by path** (if your CLI supports it):

```bash
npx skills add farming-labs/docs/skills/farming-labs/getting-started
npx skills add farming-labs/docs/skills/farming-labs/cli
npx skills add farming-labs/docs/skills/farming-labs/creating-themes
npx skills add farming-labs/docs/skills/farming-labs/ask-ai
npx skills add farming-labs/docs/skills/farming-labs/page-actions
npx skills add farming-labs/docs/skills/farming-labs/configuration
```

---

## Cursor (project-level)

Copy the skill(s) you need:

```bash
mkdir -p .cursor/skills
cp -r skills/farming-labs/getting-started .cursor/skills/
cp -r skills/farming-labs/cli .cursor/skills/
# Add others: creating-themes, ask-ai, page-actions, configuration
```

Or copy all farming-labs skills:

```bash
mkdir -p .cursor/skills
cp -r skills/farming-labs/getting-started skills/farming-labs/cli skills/farming-labs/creating-themes \
      skills/farming-labs/ask-ai skills/farming-labs/page-actions skills/farming-labs/configuration \
      .cursor/skills/
```

---

## Validation

Skills follow the [Agent Skills specification](https://agentskills.io/specification): each `SKILL.md` has required frontmatter (`name`, `description`) and `name` matches the parent directory. Validate with [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref):

```bash
skills-ref validate ./skills/farming-labs/getting-started
```

---

## Resources

- **Farming Labs skills index:** [skills/farming-labs/README.md](./farming-labs/README.md)
- **Docs site:** [docs.farming-labs.dev](https://docs.farming-labs.dev)
- **Repo:** [github.com/farming-labs/docs](https://github.com/farming-labs/docs)
- **Skills spec:** [agentskills.io/specification](https://agentskills.io/specification)
