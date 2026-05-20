export const AGENT_FRIENDLY_DOCS_PROMPT = `Create or update an \`@farming-labs/docs\` documentation site so it is agent-friendly while staying
clear and useful for humans.

Before coding:
- inspect the current project structure, package manager, framework, docs source folder, and
  \`docs.config.ts[x]\`
- preserve the existing product voice, page hierarchy, component conventions, and framework routing
- use the @farming-labs/docs website as implementation context:
- Framework docs: https://docs.farming-labs.dev
- Agent-friendly docs guide: https://docs.farming-labs.dev/docs/guides/agent-friendly-docs
- Agent primitive guide: https://docs.farming-labs.dev/docs/customization/agent-primitive
- llms.txt guide: https://docs.farming-labs.dev/docs/customization/llms-txt
- Sitemaps guide: https://docs.farming-labs.dev/docs/customization/sitemaps
- MCP guide: https://docs.farming-labs.dev/docs/customization/mcp
- CLI guide: https://docs.farming-labs.dev/docs/cli

Then build or update the docs:
- configure or preserve the docs \`entry\` in \`docs.config.ts[x]\`
- use the detected framework conventions
- write clear page frontmatter with \`title\`, \`description\`, and \`related\`
- add hidden \`<Agent>\` blocks where agents need implementation hints, verification steps, or recovery
  guidance
- add sibling \`agent.md\` only when a page needs a separate machine-readable contract
- preserve or enable agent-ready surfaces such as \`.md\` routes, \`llms.txt\`, \`AGENTS.md\`, \`skill.md\`,
  sitemap, \`robots.txt\`, MCP, JSON-LD, OpenAPI schema discovery, and markdown alternate links
- keep the visible docs human-first; do not turn pages into keyword dumps or duplicate machine-only
  context in the article body
- include task contracts for important pages: exact files, commands, success criteria, troubleshooting,
  and related pages

Verification:
- run the docs dev server
- open the docs home page and at least one important task page
- fetch a \`.md\` route and confirm it returns clean markdown
- fetch \`/.well-known/agent.json\` or the fallback agent route when enabled
- check \`llms.txt\`, sitemap, robots, MCP, and page metadata routes according to the project config
- run \`docs doctor --agent\`, \`docs sitemap generate --check\`, and \`docs robots generate --check\`
  where available
- list the files changed and explain which agent-ready surfaces were added or improved`;
