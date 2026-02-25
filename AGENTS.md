# Guidance for AI agents

This repo is **@farming-labs/docs** — an MDX-based documentation framework for Next.js, SvelteKit, Astro, and Nuxt.

## Skill: getting started

Use the **farming-labs-docs** skill when helping users set up docs, run the CLI, choose themes, or edit `docs.config`.

- **Skill path:** [skills/farming-labs-docs/SKILL.md](./skills/farming-labs-docs/SKILL.md)
- **Install (Skills CLI):** `npx skills add farming-labs/docs`

The skill covers:

- CLI: `npx @farming-labs/docs init` and `--template next|nuxt|sveltekit|astro`
- Flags: `--theme`, `--entry`
- Theme CSS: must be imported in global CSS for each framework
- Packages and config per framework (Next, SvelteKit, Astro, Nuxt)
- Path aliases and common gotchas

For full installation steps and examples, see the [README](./README.md) and the docs site (e.g. `/docs` routes in the repo).
