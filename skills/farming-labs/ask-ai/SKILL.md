---
name: ask-ai
description: Configure the Ask AI (RAG-powered AI chat) in @farming-labs/docs. Use when enabling AI chat, setting mode (search vs floating), floatingStyle (panel, modal, popover, full-modal), position, providers, models, suggestedQuestions, apiKey, systemPrompt, or maxResults. Covers Next.js, TanStack Start, SvelteKit, Astro, Nuxt, and env vars.
---

# @farming-labs/docs — Ask AI (AI Chat)

Add a built-in AI chat that answers questions using your documentation. The AI searches relevant pages, builds context, and streams a response from an OpenAI-compatible LLM. Use this skill when configuring the **Ask AI** / **DocsBot** feature.

**Full docs:** [Ask AI](https://docs.farming-labs.dev/docs/customization/ai-chat).

---

## Quick start

```ts title="docs.config.ts"
ai: {
  enabled: true,
}
```

The AI reads `process.env.OPENAI_API_KEY` and uses `gpt-4o-mini` by default. Add `OPENAI_API_KEY` to your `.env` file. For SvelteKit/Astro, pass the API key into the docs server config (see below).

---

## Configuration reference

All options go inside the `ai` object in `docs.config.ts`.

### enabled

| Type | Default |
| ---- | ------- |
| `boolean` | `false` |

```ts
ai: { enabled: true }
```

### mode

How the AI chat UI is presented.

| Type | Default |
| ---- | ------- |
| `"search" \| "floating"` | `"search"` |

- **`"search"`** — AI tab inside the Cmd+K search dialog. Users switch between "Search" and "AI" tabs.
- **`"floating"`** — Floating chat widget with a button; opens as panel, modal, popover, or full-modal.

```ts
ai: { enabled: true, mode: "floating" }
```

### position

Position of the floating button. Only when `mode` is `"floating"`.

| Type | Default |
| ---- | ------- |
| `"bottom-right" \| "bottom-left" \| "bottom-center"` | `"bottom-right"` |

### floatingStyle

Visual style when the floating chat is opened. Only when `mode` is `"floating"`.

| Type | Default |
| ---- | ------- |
| `"panel" \| "modal" \| "popover" \| "full-modal"` | `"panel"` |

- **`"panel"`** — Tall panel sliding up from the button; no full backdrop.
- **`"modal"`** — Centered modal with backdrop (like Cmd+K).
- **`"popover"`** — Compact popover near the button.
- **`"full-modal"`** — Full-screen overlay; messages in center, input at bottom, suggested questions as pills.

```ts
ai: { enabled: true, mode: "floating", floatingStyle: "full-modal" }
```

### model

Single model (string) or multiple models with UI dropdown (object).

**Single model:** `model: "gpt-4o-mini"` (default) or `"gpt-4o"`, etc.

**Multiple models:**

```ts
ai: {
  enabled: true,
  model: {
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini (fast)", provider: "openai" },
      { id: "gpt-4o", label: "GPT-4o (quality)", provider: "openai" },
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", provider: "groq" },
    ],
    defaultModel: "gpt-4o-mini",
  },
}
```

Each model: `id` (API model id), `label` (UI name), `provider` (optional, key in `providers`). If `provider` is omitted, the default `baseUrl` and `apiKey` are used.

### providers

Named provider configs so multiple backends (OpenAI, Groq, etc.) can coexist.

```ts
ai: {
  enabled: true,
  providers: {
    openai: {
      baseUrl: "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY,
    },
    groq: {
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
    },
  },
  model: {
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "openai" },
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", provider: "groq" },
    ],
    defaultModel: "gpt-4o-mini",
  },
}
```

All providers must be OpenAI Chat Completions API compatible.

### baseUrl and apiKey

Default base URL and API key when no per-model `provider` is set. Defaults: `baseUrl` = OpenAI v1, `apiKey` = `process.env.OPENAI_API_KEY`. Never hardcode API keys; use env vars.

### suggestedQuestions

Pre-filled questions shown when the chat is empty. Clicking one submits it.

| Type | Default |
| ---- | ------- |
| `string[]` | `[]` |

```ts
ai: {
  enabled: true,
  suggestedQuestions: [
    "How do I get started?",
    "What themes are available?",
    "How do I create a custom component?",
  ],
}
```

### systemPrompt

Custom system prompt prepended to the conversation. Doc context is appended automatically.

```ts
ai: {
  enabled: true,
  systemPrompt: "You are a friendly assistant for Acme Corp. Always mention our support email for complex issues.",
}
```

### maxResults

Number of search results used as context for the AI. More = more context, higher token usage.

| Type | Default |
| ---- | ------- |
| `number` | `5` |

### aiLabel

Label for the AI button (e.g. "DocsBot", "Ask AI").

---

## Framework-specific: API key

- **Next.js:** Set `OPENAI_API_KEY` in `.env`; read via `process.env.OPENAI_API_KEY`.
- **TanStack Start:** Set in `.env`; pass it through `createDocsServer` in `src/lib/docs.server.ts`: `ai: { apiKey: process.env.OPENAI_API_KEY, ...docsConfig.ai }`.
- **SvelteKit:** Set in `.env`; pass into `createDocsServer` in `src/lib/docs.server.ts`: `ai: { apiKey: env.OPENAI_API_KEY, ...config.ai }` (use `$env/dynamic/private`).
- **Astro:** Set in `.env`; pass in docs server: `ai: { apiKey: import.meta.env.OPENAI_API_KEY, ...config.ai }`.
- **Nuxt:** Set in `.env`; Nitro/runtime config exposes it; `defineDocsHandler` reads `process.env.OPENAI_API_KEY` on the server.

---

## Edge cases

1. **Static export** — If `staticExport: true`, AI chat is hidden; no API route is deployed.
2. **Multiple models** — Always specify `provider` for each model when using multiple providers so the correct `baseUrl` and `apiKey` are used.
3. **CORS / custom baseUrl** — When using a proxy or custom endpoint, set `baseUrl` (or per-provider `baseUrl`) accordingly.

---

## Resources

- **Full Ask AI docs:** [docs.farming-labs.dev/docs/customization/ai-chat](https://docs.farming-labs.dev/docs/customization/ai-chat)
- **Configuration:** use the `configuration` skill for `staticExport` and top-level config.
