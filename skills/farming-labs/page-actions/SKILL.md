---
name: page-actions
description: Configure page actions in @farming-labs/docs — Copy Markdown and Open in LLM buttons. Use when enabling copyMarkdown, openDocs, provider presets, target markdown/page/source/github, prompts, custom urlTemplate placeholders, alignment, or position (above-title, below-title).
---

# @farming-labs/docs — Page Actions

Page actions are buttons rendered above or below the page title. They let users **copy the page as Markdown** or **open the page in an LLM** (ChatGPT, Claude, Cursor, etc.). Use this skill when configuring these buttons.

**Full docs:** [Page Actions](https://docs.farming-labs.dev/docs/customization/page-actions).

---

## Quick start

```ts title="docs.config.ts"
pageActions: {
  copyMarkdown: { enabled: true },
  openDocs: { enabled: true },
}
```

This adds **Copy Markdown** and an **Open in...** dropdown with default providers.

---

## Configuration reference

All options go inside the `pageActions` object in `docs.config.ts`.

### pageActions.position

Where the buttons appear relative to the page title.

| Type | Default |
| ---- | ------- |
| `"above-title" \| "below-title"` | `"below-title"` |

```ts
pageActions: {
  position: "above-title",
  copyMarkdown: { enabled: true },
  openDocs: { enabled: true },
}
```

---

### pageActions.alignment

Control whether the action row is left- or right-aligned.

| Type | Default |
| ---- | ------- |
| `"left" \| "right"` | `"left"` |

```ts
pageActions: {
  alignment: "right",
  copyMarkdown: true,
  openDocs: true,
}
```

---

## Copy Markdown

### pageActions.copyMarkdown

Show the "Copy Markdown" button. Copies the current page content as Markdown to the clipboard.

| Type | Default |
| ---- | ------- |
| `boolean \| { enabled: boolean }` | `false` |

```ts
pageActions: {
  copyMarkdown: true,
  // or
  copyMarkdown: { enabled: true },
}
```

---

## Open in LLM (Open in...)

The **Open in...** dropdown lets users send the current page to an LLM or tool. Prefer provider strings plus `target: "markdown"` for agent-ready links.

### pageActions.openDocs

Enable the "Open in..." dropdown. Can be a boolean or an object.

| Type | Default |
| ---- | ------- |
| `boolean \| OpenDocsConfig` | `false` |

```ts
pageActions: {
  openDocs: true,
}
```

When `true`, the built-in provider list is **ChatGPT** and **Claude**.

### pageActions.openDocs.providers

Custom list of providers. Overrides the default list. Built-in ids are `"chatgpt"`, `"claude"`, `"cursor"`, `"gemini"`, `"copilot"`, and `"github"`.

```ts
pageActions: {
  openDocs: {
    enabled: true,
    target: "markdown",
    providers: ["chatgpt", "claude", "cursor"],
  },
}
```

### pageActions.openDocs.target

Controls which URL goes into `{url}` for built-in provider prompts:

| Value | Meaning |
| ----- | ------- |
| `"markdown"` | Public `.md` route for the page (default) |
| `"page"` | Rendered docs page URL |
| `"source"` | Source-style `.mdx` URL |
| `"github"` | GitHub edit URL when `github` config exists |

### pageActions.openDocs.prompt

Prompt text sent to built-in providers. Default:

```ts
"Read this documentation: {url}"
```

### URL template placeholders

Use `urlTemplate` only for custom providers or legacy configs.

| Placeholder | Replaced with |
| ----------- | -------------- |
| `{prompt}` | Resolved prompt text |
| `{url}` | Selected target URL |
| `{pageUrl}` | Rendered docs page URL |
| `{markdownUrl}` | Public `.md` route for the page |
| `{sourceUrl}` | Source-style `.mdx` URL |
| `{mdxUrl}` | Alias for `{sourceUrl}` |
| `{githubUrl}` | GitHub **edit** URL for the current page. Requires `github` in config. Use `urlTemplate: "{githubUrl}"` for "Open in GitHub". |

For the built-in `Prompt` MDX component, `promptUrlTemplate` can use:

| Placeholder | Replaced with |
| ----------- | -------------- |
| `{prompt}` | Prompt text from the Prompt card |

`target: "markdown"` uses the public page markdown route. In Next.js, that route can return a sibling
`agent.md` when the page has one. HTTP clients that can send custom headers can also request the
normal page URL with `Accept: text/markdown` for the same markdown response.

### Custom providers example

```ts
pageActions: {
  openDocs: {
    enabled: true,
    target: "markdown",
    prompt: "Use this documentation while editing the codebase: {url}",
    providers: [
      "chatgpt",
      "claude",
      { id: "cursor", mode: "app" },
      {
        name: "Internal AI",
        urlTemplate: "https://internal.example/new?prompt={prompt}",
        prompt: "Read this documentation: {markdownUrl}",
      },
      { id: "github" },
    ],
  },
}
```

For `{githubUrl}` to work, the top-level `github` config must be set (e.g. `github: { url: "https://github.com/owner/repo", directory: "website" }`).

Legacy providers with `name` and `urlTemplate` still work. For those custom URL templates, `{url}` keeps the previous page-URL behavior unless `target` is explicitly set.

---

## Edge cases

1. **No github config** — `{githubUrl}` will be empty or fallback; "Open in GitHub" may not work unless `github` is set in `defineDocs()`.
2. **Custom icon** — Pass a React node (or SVG component) as `icon` for each provider if you want a custom icon.
3. **Alignment** — `pageActions.alignment` controls whether the row is left- or right-aligned.

---

## Resources

- **Full Page Actions docs:** [docs.farming-labs.dev/docs/customization/page-actions](https://docs.farming-labs.dev/docs/customization/page-actions)
- **Configuration:** use the `configuration` skill for `github` and other top-level options.
