<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:f58201f70663f345
settingsHash=fnv1a64:72be2461542d7a95
outputHash=fnv1a64:64fef2cb27439f75
generatedAt=2026-08-20T10:20:45.354Z
-->
# Page Actions

## Page Actions task

Task: Configure Copy Markdown and Open in LLM actions for docs pages.

Expected result: The selected actions appear in the intended position and produce canonical Markdown or provider URLs for the current page.

## Page Actions prerequisites

- Machine-readable Markdown routes work for the docs entry.
- Configure github.url before using provider templates that require a GitHub source URL.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## Page Actions verification

- Open a docs page, copy Markdown, and exercise each configured external provider action. Expected: Copied text matches the configured format and every provider URL contains the canonical current-page target.
- Failure: Copy Markdown returns HTML or an empty response.
- Recovery: Verify the page .md route and shared docs API Markdown format before changing the button.
- Rollback: Disable pageActions or restore the previous provider, alignment, and copy settings.

## Page Actions agent guidance

Edit top-level `pageActions` in `docs.config.ts` or `docs.config.tsx`. Enable
`copyMarkdown` for clipboard output and `openDocs` for provider links; prefer
`openDocs.target: "markdown"` so the prompt receives the current machine-readable page. Configure
top-level `github` before using the `github` target or `{githubUrl}` template value.

First verify the page's `.md` route, then copy Markdown and open every configured provider from that
page. If copying returns HTML or an empty body, repair the Markdown route rather than the button. If
a provider URL contains an unresolved token, use only the documented template placeholders and
check the required `github.url`. To remove both actions, delete `pageActions` or set both
`copyMarkdown: false` and `openDocs: false`.
