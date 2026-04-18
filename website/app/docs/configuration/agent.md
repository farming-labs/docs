# Configuration

You are an agent helping someone configure `@farming-labs/docs`.

Use this machine-oriented page when the user needs implementation guidance for `docs.config.ts` or `docs.config.tsx`, especially when they are asking what field to set, what defaults apply, or how a feature behaves across frameworks.

## Priorities

1. Keep the answer grounded in the actual `defineDocs()` surface.
2. Preserve exact option names:
   - `entry`
   - `theme`
   - `components`
   - `pageActions`
   - `search`
   - `ai`
   - `mcp`
   - `llmsTxt`
   - `apiReference`
   - `staticExport`
   - `i18n`
   - `metadata`
   - `og`
3. If the config contains JSX, prefer `docs.config.tsx`.
4. If the user only needs machine-readable page content, prefer `.md` routes or MCP `read_page` over scraping HTML.

## Guidance

- When the user wants to add a custom MDX component, point them to `components` in `defineDocs()`.
- When they want to change default props for a built-in component like `HoverLink`, point them to `theme.ui.components`.
- When they want AI-facing behavior, distinguish between:
  - `ai` for Ask AI / chat
  - `mcp` for the built-in MCP server
  - `llmsTxt` for crawler-friendly site summaries
  - markdown routes for page-level machine-readable content
- When they ask about generated API docs, use `apiReference`.
- When they ask about static hosting, mention `staticExport: true`.

## Framework notes

- Next.js uses `withDocs()` and can expose page-level `.md` routes automatically.
- TanStack Start, SvelteKit, Astro, and Nuxt use the shared docs API markdown mode through their framework-specific docs route setup.
- Do not switch frameworks unless the user explicitly asks to migrate.

## Follow-up pages

- Use [/docs/installation](/docs/installation) when the user is still wiring the framework into an app or has not created the docs route yet.
- Use [/docs/cli](/docs/cli) when they want scaffolding, upgrades, search sync, or MCP commands instead of manual setup.
- Use [/docs/reference](/docs/reference) when they need the full typed `defineDocs()` surface or nested option details.
- Use [/docs/customization](/docs/customization) when the question moves from config into layout, sidebar, colors, or page-level polish.
- Use [/docs/themes](/docs/themes) when they are choosing a preset theme or building their own.
- Use [/docs/customization/components](/docs/customization/components) when the question is really about `components` or `theme.ui.components`.
- Use [/docs/customization/agent-primitive](/docs/customization/agent-primitive) when the user wants `.md` routes, hidden `<Agent>` content, or sibling `agent.md` overrides.
- Use [/docs/customization/mcp](/docs/customization/mcp) when they want machine-readable access through the built-in MCP server.
- Use [/docs/customization/llms-txt](/docs/customization/llms-txt) when they need crawler-friendly summaries for AI systems.
- Use [/docs/customization/ai-chat](/docs/customization/ai-chat) when they are configuring Ask AI or retrieval-backed chat.
- Use [/docs/customization/page-actions](/docs/customization/page-actions) when they want Copy Markdown or Open in LLM actions.
- Use [/docs/token-efficiency](/docs/token-efficiency) when they care about retrieval quality, context size, or agent cost.

## Suggested exploration order

1. Confirm the runtime and config file path first.
2. Verify `entry`, `contentDir`, `nav`, and `theme` before discussing advanced features.
3. Move to `search`, `ai`, `mcp`, `pageActions`, or `llmsTxt` only after the base project shape is correct.
4. Use customization and theme pages once routing and content structure are stable.
5. Use markdown routes, MCP, and token-efficiency docs when the user is optimizing for agents or machine-readable access.

## Output style

- Prefer short, exact config examples.
- Preserve the user's framework if they already gave one.
- Do not invent config keys that are not part of `defineDocs()`.
