# Agent skills for @farming-labs/docs

This directory contains [agent skills](https://skills.sh/) that help AI coding assistants get started with **@farming-labs/docs** — installation, CLI, themes, and framework-specific setup.

## Available skills

| Skill | Description |
| ----- | ----------- |
| [farming-labs-docs](./farming-labs-docs/SKILL.md) | Getting started: CLI (`init`, `--template`), manual setup, themes, theme CSS, and docs.config for Next.js, SvelteKit, Astro, and Nuxt. |

## Installing the skill

### With the Skills CLI (skills.sh)

If you use the [Skills CLI](https://skills.sh/) (Cursor, Claude Code, Windsurf, etc.):

```bash
npx skills add farming-labs/docs
```

Then pick the `farming-labs-docs` skill when prompted, or the CLI may install skills from the repo’s `skills/` directory automatically.

### Cursor (project-level)

Copy the skill into your project so the agent uses it in this repo:

```bash
mkdir -p .cursor/skills
cp -r skills/farming-labs-docs .cursor/skills/
```

### Manual

Use [skills/farming-labs-docs/SKILL.md](./farming-labs-docs/SKILL.md) as reference when working with @farming-labs/docs — it summarizes installation, CLI flags, theme CSS, and config.
