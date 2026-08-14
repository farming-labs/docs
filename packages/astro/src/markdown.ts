/**
 * Server-side markdown rendering with Shiki syntax highlighting.
 *
 * Converts raw markdown content to HTML, supporting:
 *   - Fenced code blocks with dual-theme syntax highlighting
 *   - Copy-to-clipboard buttons on code blocks
 *   - Tabbed code blocks (`<Tabs>` / `<Tab>` syntax)
 *   - Callouts / admonitions (GitHub `[!NOTE]` and `**Note:**` styles)
 *   - Tables, lists, inline formatting, headings with anchor IDs
 */

import { resolveDocsAudienceMdxContent, type DocsTheme } from "@farming-labs/docs";
import {
  createDocsMarkdownBlockPlaceholderAllocator,
  extractDocsMarkdownReferenceDefinitions as extractMarkdownReferenceDefinitions,
  extractDocsRenderedHeadingElements as extractRenderedHeadingElements,
  prepareDocsMarkdownHeadings as prepareMarkdownHeadings,
  replaceDocsMarkdownFencedCodeBlocks as replaceMarkdownFencedCodeBlocks,
  renderDocsMarkdownBlockContent as renderMarkdownBlockContent,
  renderDocsMarkdownHeadings as renderMarkdownHeadings,
  renderDocsMarkdownInline as renderMarkdownInline,
  restoreDocsMarkdownHeadingOpeningTags as restoreMarkdownHeadingOpeningTags,
  stripPreparedDocsMarkdownHeadingTokens as stripPreparedMarkdownHeadingTokens,
  type DocsMarkdownReferenceDefinitions as MarkdownReferenceDefinitions,
} from "@farming-labs/docs/markdown-rendering";
import {
  extractDocsMarkdownPromptBlocks,
  parsePromptStringArray,
  resolvePromptProviderChoices,
  sanitizePromptText,
  type SerializedOpenDocsProvider,
} from "@farming-labs/docs/server";
import { createHighlighter, type Highlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [
        "javascript",
        "typescript",
        "jsx",
        "tsx",
        "json",
        "bash",
        "shellscript",
        "html",
        "css",
        "markdown",
        "yaml",
        "sql",
        "python",
        "dotenv",
      ],
    });
  }
  return highlighterPromise;
}

const hoverLinkDefaults = {
  linkLabel: "Open page",
  showIndicator: false,
  align: "center",
  side: "bottom",
  sideOffset: 12,
} as const;

const promptDefaults = {
  actions: ["copy"],
  copyLabel: "Copy prompt",
  copiedLabel: "Copied",
  openLabel: "Open in",
  copyIcon: "copy",
  copiedIcon: "check",
  openIcon: "arrowUpRight",
} as const;

function slugifyCodeGroupTab(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

const promptActionIcons: Record<string, string> = {
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>',
  check:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>',
  arrowUpRight:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>',
  chevronDown:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9" /></svg>',
};

interface RenderMarkdownOptions {
  theme?: DocsTheme;
  icons?: Record<string, string>;
  openDocsProviders?: SerializedOpenDocsProvider[];
}

interface RenderedMarkdownBlock {
  html: string;
  token: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseJsxAttributes(source: string): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {};
  const pattern = /([A-Za-z_:][-.\w:]*)(?:=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}))?/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const [, name, doubleQuoted, singleQuoted, braced] = match;
    const rawValue = doubleQuoted ?? singleQuoted ?? braced;
    attrs[name] = rawValue === undefined ? true : rawValue.trim();
  }

  return attrs;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
  }
  return fallback;
}

function toStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toNumberValue(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeHoverAlign(value?: string): "start" | "center" | "end" {
  if (value === "start" || value === "end") return value;
  return "center";
}

function normalizeHoverSide(value?: string): "top" | "right" | "bottom" | "left" {
  if (value === "top" || value === "right" || value === "left") return value;
  return "bottom";
}

function resolveHoverLinkOptions(theme?: DocsTheme): Record<string, unknown> {
  const configured = theme?.ui?.components?.HoverLink;
  const base = { ...hoverLinkDefaults } as Record<string, unknown>;

  if (typeof configured === "function") {
    const resolved = configured(base);
    if (resolved && typeof resolved === "object") {
      return { ...base, ...(resolved as Record<string, unknown>) };
    }
    return base;
  }

  if (configured && typeof configured === "object") {
    return { ...base, ...(configured as Record<string, unknown>) };
  }

  return base;
}

function resolvePromptOptions(theme?: DocsTheme): Record<string, unknown> {
  const configured = theme?.ui?.components?.Prompt;
  const base = { ...promptDefaults } as Record<string, unknown>;

  if (typeof configured === "function") {
    const resolved = configured(base);
    if (resolved && typeof resolved === "object") {
      return { ...base, ...(resolved as Record<string, unknown>) };
    }
    return base;
  }

  if (configured && typeof configured === "object") {
    return { ...base, ...(configured as Record<string, unknown>) };
  }

  return base;
}

function renderHoverLink(attrSource: string, children: string, theme?: DocsTheme): string {
  const attrs = parseJsxAttributes(attrSource);
  const defaults = resolveHoverLinkOptions(theme);
  const href = toStringValue(attrs.href);
  const title = toStringValue(attrs.title);
  const description = toStringValue(attrs.description);

  if (!href || !title || !description) return children;

  const linkLabel =
    toStringValue(attrs.linkLabel) ??
    toStringValue(defaults.linkLabel) ??
    hoverLinkDefaults.linkLabel;
  const previewLabel = toStringValue(attrs.previewLabel) ?? toStringValue(defaults.previewLabel);
  const showIndicator =
    attrs.showIndicator !== undefined
      ? toBoolean(attrs.showIndicator, hoverLinkDefaults.showIndicator)
      : toBoolean(defaults.showIndicator, hoverLinkDefaults.showIndicator);
  const external =
    attrs.external !== undefined
      ? toBoolean(attrs.external, false)
      : toBoolean(defaults.external, false);
  const align = normalizeHoverAlign(toStringValue(attrs.align) ?? toStringValue(defaults.align));
  const side = normalizeHoverSide(toStringValue(attrs.side) ?? toStringValue(defaults.side));
  const sideOffset =
    toNumberValue(attrs.sideOffset) ??
    toNumberValue(defaults.sideOffset) ??
    hoverLinkDefaults.sideOffset;

  const targetAttrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
  const triggerHtml = escapeHtml(children.trim()) || escapeHtml(title);
  const indicatorHtml = showIndicator
    ? '<span class="fd-hover-link-indicator" aria-hidden="true">+</span>'
    : "";
  const previewHtml = previewLabel
    ? `<span class="fd-hover-link-preview-label">${escapeHtml(previewLabel)}</span>`
    : "";

  return (
    `<span class="fd-hover-link" data-hover-link data-align="${align}" data-side="${side}" style="--fd-hover-link-side-offset:${sideOffset}px">` +
    `<button type="button" class="fd-hover-link-trigger" aria-haspopup="dialog" aria-expanded="false">${triggerHtml}${indicatorHtml}</button>` +
    `<span class="fd-hover-link-popover" role="dialog" aria-hidden="true">` +
    `<span class="fd-hover-link-card">` +
    `<span class="fd-hover-link-body">` +
    previewHtml +
    `<a href="${escapeHtml(href)}" class="fd-hover-link-title"${targetAttrs}>${escapeHtml(title)}</a>` +
    `<span class="fd-hover-link-description">${escapeHtml(description)}</span>` +
    `</span>` +
    `<span class="fd-hover-link-footer">` +
    `<a href="${escapeHtml(href)}" class="fd-hover-link-cta"${targetAttrs}>${escapeHtml(linkLabel)}<span aria-hidden="true">→</span></a>` +
    `</span>` +
    `</span>` +
    `</span>` +
    `</span>`
  );
}

function resolvePromptIconName(value: unknown): string | false | undefined {
  if (value === false) return false;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === "false") return false;
  return trimmed;
}

function renderPromptIconHtml(
  name: string | false | undefined,
  iconRegistry?: Record<string, string>,
): string {
  if (!name) return "";
  const registryMatch = iconRegistry?.[name];
  if (registryMatch) return registryMatch;
  return promptActionIcons[name] ?? "";
}

function renderPrompt(
  attrSource: string,
  children: string,
  options: RenderMarkdownOptions,
): string {
  const attrs = parseJsxAttributes(attrSource);
  const defaults = resolvePromptOptions(options.theme);
  const title = toStringValue(attrs.title) ?? toStringValue(defaults.title);
  const description = toStringValue(attrs.description) ?? toStringValue(defaults.description);
  const iconName = toStringValue(attrs.icon) ?? toStringValue(defaults.icon);
  const showTitle =
    attrs.showTitle !== undefined
      ? toBoolean(attrs.showTitle, true)
      : toBoolean(defaults.showTitle, true);
  const showDescription =
    attrs.showDescription !== undefined
      ? toBoolean(attrs.showDescription, true)
      : toBoolean(defaults.showDescription, true);
  const showPrompt =
    attrs.showPrompt !== undefined
      ? toBoolean(attrs.showPrompt, false)
      : toBoolean(defaults.showPrompt, false);
  const actions = parsePromptStringArray(attrs.actions ?? defaults.actions) ?? ["copy"];
  const providers =
    resolvePromptProviderChoices(
      options.openDocsProviders,
      parsePromptStringArray(attrs.providers ?? defaults.providers),
    ) ?? [];
  const copyLabel =
    toStringValue(attrs.copyLabel) ?? toStringValue(defaults.copyLabel) ?? promptDefaults.copyLabel;
  const copiedLabel =
    toStringValue(attrs.copiedLabel) ??
    toStringValue(defaults.copiedLabel) ??
    promptDefaults.copiedLabel;
  const openLabel =
    toStringValue(attrs.openLabel) ?? toStringValue(defaults.openLabel) ?? promptDefaults.openLabel;
  const copyIcon = resolvePromptIconName(attrs.copyIcon ?? defaults.copyIcon);
  const copiedIcon = resolvePromptIconName(attrs.copiedIcon ?? defaults.copiedIcon);
  const openIcon = resolvePromptIconName(attrs.openIcon ?? defaults.openIcon);
  const promptText = sanitizePromptText(dedentCode(children.trim()));

  if (!promptText) return "";

  const cardIconHtml = iconName && options.icons?.[iconName] ? options.icons[iconName] : "";
  const copyIconHtml = renderPromptIconHtml(copyIcon, options.icons);
  const copiedIconHtml = renderPromptIconHtml(copiedIcon, options.icons);
  const openIconHtml = renderPromptIconHtml(openIcon, options.icons);
  const showCopy = actions.includes("copy");
  const showOpen = actions.includes("open") && providers.length > 0;
  const escapedPrompt = escapeHtml(promptText);
  const singleProvider = showOpen && providers.length === 1 ? providers[0] : null;

  let actionsHtml = "";

  if (showCopy || showOpen) {
    actionsHtml += '<div class="fd-prompt-actions">';

    if (showCopy) {
      actionsHtml +=
        `<button type="button" class="fd-prompt-action-btn" data-prompt-copy>` +
        `<span class="fd-prompt-action-icon">${copyIconHtml}</span>` +
        `<span data-prompt-copy-label="${escapeHtml(copiedLabel)}" data-prompt-default-label="${escapeHtml(copyLabel)}">${escapeHtml(copyLabel)}</span>` +
        `<span class="fd-prompt-action-icon fd-prompt-action-icon-copied" hidden>${copiedIconHtml}</span>` +
        `</button>`;
    }

    if (singleProvider) {
      actionsHtml +=
        `<button type="button" class="fd-prompt-action-btn" data-prompt-open-direct data-url-template="${escapeHtml(singleProvider.urlTemplate)}">` +
        `<span class="fd-prompt-action-icon">${openIconHtml}</span>` +
        `<span>${escapeHtml(openLabel)} ${escapeHtml(singleProvider.name)}</span>` +
        `</button>`;
    } else if (showOpen) {
      actionsHtml +=
        `<div class="fd-prompt-dropdown" data-prompt-dropdown>` +
        `<button type="button" class="fd-prompt-action-btn" aria-expanded="false" data-prompt-trigger>` +
        `<span class="fd-prompt-action-icon">${openIconHtml}</span>` +
        `<span>${escapeHtml(openLabel)}</span>` +
        `<span class="fd-prompt-action-chevron">${promptActionIcons.chevronDown}</span>` +
        `</button>` +
        `<div class="fd-prompt-menu" role="menu" hidden data-prompt-menu>`;

      for (const provider of providers) {
        actionsHtml +=
          `<button type="button" role="menuitem" class="fd-prompt-menu-item" data-prompt-open-provider data-url-template="${escapeHtml(provider.urlTemplate)}">` +
          (provider.iconHtml
            ? `<span class="fd-prompt-menu-icon">${provider.iconHtml}</span>`
            : "") +
          `<span class="fd-prompt-menu-label">${escapeHtml(openLabel)} ${escapeHtml(provider.name)}</span>` +
          `</button>`;
      }

      actionsHtml += `</div></div>`;
    }

    actionsHtml += `</div>`;
  }

  return (
    `<div class="fd-prompt" data-prompt-card>` +
    (cardIconHtml || (showTitle && title) || (showDescription && description)
      ? `<div class="fd-prompt-header">` +
        (cardIconHtml ? `<span class="fd-prompt-icon">${cardIconHtml}</span>` : "") +
        `<div class="fd-prompt-copy">` +
        (showTitle && title ? `<p class="fd-prompt-title">${escapeHtml(title)}</p>` : "") +
        (showDescription && description
          ? `<p class="fd-prompt-description">${escapeHtml(description)}</p>`
          : "") +
        `</div></div>`
      : "") +
    `<div data-prompt-text hidden aria-hidden="true">${escapedPrompt}</div>` +
    (showPrompt
      ? `<div class="fd-prompt-body"><pre class="fd-prompt-code">${escapedPrompt}</pre></div>`
      : "") +
    actionsHtml +
    `</div>`
  );
}

const calloutIcons: Record<string, string> = {
  note: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  warning:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  tip: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 019 14"/></svg>',
  important:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  caution:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
};

const calloutTypeAliases: Record<string, string> = {
  danger: "caution",
  error: "caution",
  info: "note",
  success: "tip",
  warn: "warning",
};

const calloutLabels: Record<string, string> = {
  caution: "Caution",
  important: "Important",
  note: "Note",
  tip: "Tip",
  warning: "Warning",
};

function normalizeCalloutType(type: string): string {
  const normalized = type.trim().toLowerCase();
  const aliased = calloutTypeAliases[normalized] ?? normalized;
  return calloutIcons[aliased] ? aliased : "note";
}

function renderCallout(
  type: string,
  content: string,
  title: string | null | undefined,
  definitions: MarkdownReferenceDefinitions,
): string {
  const normalizedType = normalizeCalloutType(type);
  const icon = calloutIcons[normalizedType] || calloutIcons.note;
  const label = title?.trim() || calloutLabels[normalizedType] || "Note";
  const renderedContent = renderMarkdownBlockContent(content, definitions);
  return `<div class="fd-callout fd-callout-${normalizedType}" role="note"><div class="fd-callout-indicator" role="none"></div><div class="fd-callout-icon">${icon}</div><div class="fd-callout-content"><p class="fd-callout-title">${escapeHtml(label)}</p>${renderedContent}</div></div>`;
}

function highlightCode(hl: Highlighter, code: string, lang: string): { html: string; raw: string } {
  if (lang === "sh" || lang === "shell") lang = "bash";
  if (lang === "env") lang = "dotenv";

  const supported = hl.getLoadedLanguages();
  if (!supported.includes(lang)) lang = "text";

  const trimmedCode = code.replace(/\n$/, "");

  try {
    return {
      html: hl.codeToHtml(trimmedCode, {
        lang,
        themes: { light: "github-light", dark: "github-dark" },
      }),
      raw: trimmedCode,
    };
  } catch {
    const escaped = trimmedCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return {
      html: `<pre class="shiki"><code>${escaped}</code></pre>`,
      raw: trimmedCode,
    };
  }
}

const ignoredCodeGroupBareTitleTokens = new Set([
  "copy",
  "no-copy",
  "nocopy",
  "line-numbers",
  "linenumbers",
  "runnable",
  "show-line-numbers",
  "showlinenumbers",
  "wrap",
]);

function parseMeta(meta: string): { lang: string; title: string | null } {
  const trimmed = meta.trim();
  const firstToken = trimmed.split(/\s+/, 1)[0] ?? "";
  const hasLanguage = Boolean(
    firstToken && !firstToken.includes("=") && !firstToken.startsWith("{"),
  );
  const lang = hasLanguage ? firstToken.toLowerCase() : "text";
  const titleMatch = trimmed.match(/\b(?:title|filename|file|name|label)=["']([^"']+)["']/);

  if (titleMatch) return { lang, title: titleMatch[1] };

  const bareTitle = trimmed
    .slice(hasLanguage ? firstToken.length : 0)
    .trim()
    .replace(/\{[^}]*\}/g, " ")
    .split(/\s+/)
    .find(
      (part) =>
        part && !part.includes("=") && !ignoredCodeGroupBareTitleTokens.has(part.toLowerCase()),
    );

  return {
    lang,
    title: bareTitle ? bareTitle.replace(/^["']|["']$/g, "") : null,
  };
}

function parseCodeGroupMeta(meta: string): { lang: string; title: string | null } {
  const parsed = parseMeta(meta);
  if (parsed.title) return parsed;

  const trimmed = meta.trim();
  const language = trimmed.split(/\s+/, 1)[0] ?? "";
  const bareTitle = trimmed
    .slice(language.length)
    .trim()
    .replace(/\{[^}]*\}/g, " ")
    .split(/\s+/)
    .find(
      (part) =>
        part && !part.includes("=") && !ignoredCodeGroupBareTitleTokens.has(part.toLowerCase()),
    );

  return {
    ...parsed,
    title: bareTitle ? bareTitle.replace(/^["']|["']$/g, "") : null,
  };
}

function createCodeGroupTabValue(label: string, used: Set<string>): string {
  const slug = slugifyCodeGroupTab(label) || `code-${used.size + 1}`;
  let value = slug;
  let suffix = 2;

  while (used.has(value)) {
    value = `${slug}-${suffix}`;
    suffix += 1;
  }

  used.add(value);
  return value;
}

const terminalCodeLanguages = new Set([
  "bash",
  "console",
  "sh",
  "shell",
  "shellscript",
  "terminal",
]);
const fileCodeBlockIcon =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';
const terminalCodeBlockIcon =
  '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="m 4,4 a 1,1 0 0 0 -0.7070312,0.2929687 1,1 0 0 0 0,1.4140625 L 8.5859375,11 3.2929688,16.292969 a 1,1 0 0 0 0,1.414062 1,1 0 0 0 1.4140624,0 l 5.9999998,-6 a 1.0001,1.0001 0 0 0 0,-1.414062 L 4.7070312,4.2929687 A 1,1 0 0 0 4,4 Z m 8,14 a 1,1 0 0 0 -1,1 1,1 0 0 0 1,1 h 8 a 1,1 0 0 0 1,-1 1,1 0 0 0 -1,-1 z" fill="currentColor"/></svg>';
const copyCodeBlockIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>';

function renderCodeBlockTitleIcon(title?: string | null, language?: string | null): string {
  const normalizedTitle = title?.trim().toLowerCase() ?? "";
  const normalizedLanguage = language?.trim().toLowerCase() ?? "";
  if (normalizedTitle.includes("terminal") || terminalCodeLanguages.has(normalizedLanguage)) {
    return terminalCodeBlockIcon;
  }
  return fileCodeBlockIcon;
}

function wrapCodeWithCopy(
  html: string,
  rawCode: string,
  title?: string | null,
  language?: string | null,
): string {
  const escapedRaw = rawCode
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const dataLang = language ? ` data-language="${escapeHtml(String(language))}"` : "";
  const copyBtn = `<button type="button" class="fd-copy-btn" data-code="${escapedRaw}" title="Copy code" aria-label="Copy code">${copyCodeBlockIcon}</button>`;
  if (title) {
    return `<figure class="fd-codeblock fd-codeblock--titled shiki not-prose" dir="ltr" tabindex="-1"${dataLang}><div class="fd-codeblock-title" data-title>${renderCodeBlockTitleIcon(title, language)}<span class="fd-codeblock-title-text">${escapeHtml(title)}</span><div class="fd-codeblock-actions">${copyBtn}</div></div><div class="fd-codeblock-content fd-scroll-container" role="region" tabindex="0">${html}</div></figure>`;
  }
  return `<figure class="fd-codeblock shiki not-prose" dir="ltr" tabindex="-1"${dataLang}><div class="fd-codeblock-actions fd-codeblock-actions-floating">${copyBtn}</div><div class="fd-codeblock-content fd-scroll-container" role="region" tabindex="0">${html}</div></figure>`;
}

function dedentCode(raw: string): string {
  const lines = raw.replace(/\n$/, "").split("\n");
  const indent = lines.reduce((min, l) => {
    if (!l.trim()) return min;
    const spaces = l.match(/^(\s*)/)?.[1].length ?? 0;
    return Math.min(min, spaces);
  }, Infinity);
  if (indent > 0 && indent < Infinity) {
    return lines.map((l) => l.slice(indent)).join("\n");
  }
  return raw;
}

/**
 * Render a markdown string to HTML with full syntax highlighting,
 * callouts, tables, tabs, and copy-to-clipboard support.
 *
 * Designed for server-side use in Astro page loaders.
 */
export async function renderMarkdown(
  content: string,
  options: RenderMarkdownOptions = {},
): Promise<string> {
  if (!content) return "";

  const hl = await getHighlighter();
  // Prompt children are literal copyable text, not renderable Markdown. Protect
  // them before audience projection, reference collection, and heading
  // preparation so none of those document-level passes can consume or interpret
  // Prompt-only syntax.
  const extractedPrompts = extractDocsMarkdownPromptBlocks(content);
  const promptBlocks = extractedPrompts.blocks;
  let result = extractedPrompts.markdown;
  result = resolveDocsAudienceMdxContent(result, "human");
  const allocateBlockPlaceholder = createDocsMarkdownBlockPlaceholderAllocator(result);
  const extractedReferences = extractMarkdownReferenceDefinitions(result);
  const referenceDefinitions = extractedReferences.definitions;
  const preparedHeadings = prepareMarkdownHeadings(result);
  const preparedWithoutReferences = extractMarkdownReferenceDefinitions(
    preparedHeadings.markdown,
  ).markdown;
  const renderedHeadings = renderMarkdownHeadings(
    preparedWithoutReferences,
    preparedHeadings.headings,
  );
  result = renderedHeadings.markdown;
  const headingOpeningTags = renderedHeadings.openingTags;

  // ── Mintlify-style code groups: <CodeGroup> fenced code blocks </CodeGroup> ──
  const tabsBlocks: RenderedMarkdownBlock[] = [];
  result = result.replace(
    /<CodeGroup(?:\s+([^>]*?))?>([\s\S]*?)<\/CodeGroup>/g,
    (_: string, attrSource: string | undefined, body: string) => {
      const attrs = parseJsxAttributes(attrSource ?? "");
      const dropdown = toBoolean(attrs.dropdown, false);
      const usedValues = new Set<string>();
      const panels: { label: string; value: string; html: string }[] = [];
      replaceMarkdownFencedCodeBlocks(body, ({ code, info }) => {
        const { lang, title } = parseCodeGroupMeta(info);
        const label = title || lang || `Code ${panels.length + 1}`;
        const value = createCodeGroupTabValue(label, usedValues);
        const dedented = dedentCode(code);
        const { html, raw } = highlightCode(hl, dedented, lang);
        panels.push({
          label,
          value,
          html: wrapCodeWithCopy(html, raw, null, lang),
        });
        return "";
      });

      if (panels.length === 0) return body;
      const extractedHeadings = extractRenderedHeadingElements(
        body,
        referenceDefinitions,
        false,
        headingOpeningTags,
      );

      let tabsHtml =
        extractedHeadings.headingsHtml +
        `<div class="fd-tabs fd-code-group" data-tabs data-code-group data-fd-code-group${dropdown ? ' data-dropdown="true"' : ""}>`;
      tabsHtml += `<div class="fd-tabs-list fd-code-group-list" role="tablist">`;
      for (let i = 0; i < panels.length; i++) {
        const state = i === 0 ? "active" : "inactive";
        tabsHtml += `<button type="button" role="tab" class="fd-tab-trigger${i === 0 ? " fd-tab-active" : ""}" data-tab-value="${escapeHtml(panels[i].value)}" data-state="${state}" aria-selected="${i === 0}" tabindex="${i === 0 ? "0" : "-1"}">${escapeHtml(panels[i].label)}</button>`;
      }
      tabsHtml += `</div>`;
      for (let i = 0; i < panels.length; i++) {
        const state = i === 0 ? "active" : "inactive";
        tabsHtml += `<div class="fd-tab-panel fd-code-group-panel${i === 0 ? " fd-tab-panel-active" : ""}" data-tab-panel="${escapeHtml(panels[i].value)}" data-state="${state}" role="tabpanel">${panels[i].html}</div>`;
      }
      tabsHtml += `</div>`;

      const placeholder = allocateBlockPlaceholder("TABS");
      tabsBlocks.push({ html: tabsHtml, token: placeholder });
      return placeholder;
    },
  );

  // ── Tabs blocks: <Tabs items={[...]}> ... </Tabs> ──
  result = result.replace(
    /<Tabs\s+items=\{?\[([^\]]+)\]\}?>([\s\S]*?)<\/Tabs>/g,
    (_: string, itemsStr: string, body: string) => {
      const items = itemsStr.split(",").map((s: string) => s.trim().replace(/^["']|["']$/g, ""));
      const panels: { value: string; html: string }[] = [];
      const tabRegex = /<Tab\s+value=["']([^"']+)["']>([\s\S]*?)<\/Tab>/g;
      let tabMatch: RegExpExecArray | null;
      while ((tabMatch = tabRegex.exec(body)) !== null) {
        const tabValue = tabMatch[1];
        const extractedHeadings = extractRenderedHeadingElements(
          tabMatch[2].trim(),
          referenceDefinitions,
          false,
          headingOpeningTags,
        );
        let renderedCode: string | undefined;
        replaceMarkdownFencedCodeBlocks(extractedHeadings.content, ({ code, info }) => {
          if (renderedCode !== undefined) return "";
          const { lang, title } = parseMeta(info);
          const dedented = dedentCode(code);
          const { html, raw } = highlightCode(hl, dedented, lang);
          renderedCode = wrapCodeWithCopy(html, raw, title, lang);
          return "";
        });
        if (renderedCode !== undefined) {
          panels.push({
            value: tabValue,
            html: extractedHeadings.headingsHtml + renderedCode,
          });
        } else {
          panels.push({
            value: tabValue,
            html:
              extractedHeadings.headingsHtml +
              renderMarkdownBlockContent(extractedHeadings.content, referenceDefinitions),
          });
        }
      }

      let tabsHtml = `<div class="fd-tabs" data-tabs>`;
      tabsHtml += `<div class="fd-tabs-list" role="tablist">`;
      for (let i = 0; i < items.length; i++) {
        const state = i === 0 ? "active" : "inactive";
        tabsHtml += `<button type="button" role="tab" class="fd-tab-trigger${i === 0 ? " fd-tab-active" : ""}" data-tab-value="${escapeHtml(items[i])}" data-state="${state}" aria-selected="${i === 0}" tabindex="${i === 0 ? "0" : "-1"}">${escapeHtml(items[i])}</button>`;
      }
      tabsHtml += `</div>`;
      for (let i = 0; i < panels.length; i++) {
        const state = i === 0 ? "active" : "inactive";
        tabsHtml += `<div class="fd-tab-panel${i === 0 ? " fd-tab-panel-active" : ""}" data-tab-panel="${escapeHtml(panels[i].value)}" data-state="${state}" role="tabpanel">${panels[i].html}</div>`;
      }
      tabsHtml += `</div>`;

      const placeholder = allocateBlockPlaceholder("TABS");
      tabsBlocks.push({ html: tabsHtml, token: placeholder });
      return placeholder;
    },
  );

  const hoverLinkBlocks: RenderedMarkdownBlock[] = [];
  result = result.replace(
    /<HoverLink\s+([^>]*?)>([\s\S]*?)<\/HoverLink>/g,
    (_: string, attrSource: string, children: string) => {
      const placeholder = allocateBlockPlaceholder("HOVERLINK");
      const extractedHeadings = extractRenderedHeadingElements(
        children,
        referenceDefinitions,
        false,
        headingOpeningTags,
      );
      hoverLinkBlocks.push({
        html:
          extractedHeadings.headingsHtml +
          renderHoverLink(attrSource, extractedHeadings.content, options.theme),
        token: placeholder,
      });
      return placeholder;
    },
  );

  // ── Fenced code blocks ──
  const codeBlocks: RenderedMarkdownBlock[] = [];
  result = replaceMarkdownFencedCodeBlocks(result, ({ code, info }) => {
    const { lang, title } = parseMeta(info);
    const { html, raw } = highlightCode(hl, code, lang);
    const placeholder = allocateBlockPlaceholder("CODEBLOCK");
    codeBlocks.push({ html: wrapCodeWithCopy(html, raw, title, lang), token: placeholder });
    return placeholder;
  });

  const calloutBlocks: RenderedMarkdownBlock[] = [];
  result = result.replace(
    /<Callout(?:\s+([^>]*?))?>([\s\S]*?)<\/Callout>/g,
    (_: string, attrSource: string | undefined, children: string) => {
      const attrs = parseJsxAttributes(attrSource ?? "");
      const type = toStringValue(attrs.type) ?? toStringValue(attrs.kind) ?? "note";
      const title = toStringValue(attrs.title);
      const placeholder = allocateBlockPlaceholder("CALLOUT");
      calloutBlocks.push({
        html: renderCallout(
          type,
          restoreMarkdownHeadingOpeningTags(children, headingOpeningTags),
          title,
          referenceDefinitions,
        ),
        token: placeholder,
      });
      return placeholder;
    },
  );

  // ── Callouts / blockquotes (before inline formatting) ──
  result = result.replace(/(?:^>\s*.+\n?)+/gm, (block: string) => {
    const lines = block.split("\n").filter(Boolean);
    const inner = restoreMarkdownHeadingOpeningTags(
      lines.map((l: string) => l.replace(/^>\s?/, "")).join("\n"),
      headingOpeningTags,
    );

    const ghMatch = inner.match(/^\[!(NOTE|WARNING|TIP|IMPORTANT|CAUTION)\]\s*\n?([\s\S]*)/i);
    if (ghMatch) {
      const type = ghMatch[1].toLowerCase();
      const calloutContent = ghMatch[2].trim();
      const placeholder = allocateBlockPlaceholder("CALLOUT");
      calloutBlocks.push({
        html: renderCallout(type, calloutContent, undefined, referenceDefinitions),
        token: placeholder,
      });
      return placeholder;
    }

    const boldMatch = inner.match(/^\*\*(Note|Warning|Tip|Important|Caution):\*\*\s*([\s\S]*)/i);
    if (boldMatch) {
      const type = boldMatch[1].toLowerCase();
      const calloutContent = boldMatch[2].trim();
      const placeholder = allocateBlockPlaceholder("CALLOUT");
      calloutBlocks.push({
        html: renderCallout(type, calloutContent, undefined, referenceDefinitions),
        token: placeholder,
      });
      return placeholder;
    }

    const placeholder = allocateBlockPlaceholder("CALLOUT");
    calloutBlocks.push({
      html: `<blockquote>${renderMarkdownBlockContent(inner, referenceDefinitions)}</blockquote>`,
      token: placeholder,
    });
    return placeholder;
  });

  result = renderMarkdownInline(result, referenceDefinitions);

  // Horizontal rules
  result = result.replace(/^---$/gm, "<hr />");

  // Tables
  result = result.replace(
    /^\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/gm,
    (_: string, headerRow: string, bodyRows: string) => {
      const headers = headerRow
        .split("|")
        .map((h: string) => h.trim())
        .filter(Boolean);
      const rows = bodyRows
        .trim()
        .split("\n")
        .map((row: string) =>
          row
            .split("|")
            .map((c: string) => c.trim())
            .filter(Boolean),
        );
      const headerHtml = headers.map((h: string) => `<th>${h}</th>`).join("");
      const rowsHtml = rows
        .map((row: string[]) => `<tr>${row.map((c: string) => `<td>${c}</td>`).join("")}</tr>`)
        .join("");
      return `<div class="fd-table-wrapper relative overflow-auto prose-no-margin my-6"><table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
    },
  );

  // Unordered lists
  result = result.replace(
    /(?:^[-+*] [^\r\n]+(?:\r?\n(?:(?: {2,}|\t)[^\r\n]+))*(?:\r?\n|$))+/gm,
    (block: string) => {
      const items: string[] = [];
      for (const line of block.trimEnd().split(/\r?\n/)) {
        if (/^[-+*] /.test(line)) {
          items.push(line.slice(2));
          continue;
        }
        if (items.length > 0) {
          items[items.length - 1] += `\n${line.replace(/^(?: {2}|\t)/, "")}`;
        }
      }
      return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
    },
  );

  // Ordered lists
  result = result.replace(
    /(?:^\d{1,9}[.)] [^\r\n]+(?:\r?\n(?:(?: {3,}|\t)[^\r\n]+))*(?:\r?\n|$))+/gm,
    (block: string) => {
      const items: string[] = [];
      let continuationIndent = 0;
      for (const line of block.trimEnd().split(/\r?\n/)) {
        const marker = /^(\d{1,9}[.)]) (.*)$/.exec(line);
        if (marker) {
          items.push(marker[2]);
          continuationIndent = marker[1].length + 1;
          continue;
        }
        if (items.length > 0) {
          const content =
            line[0] === "\t"
              ? line.slice(1)
              : line.slice(Math.min(continuationIndent, /^ */.exec(line)?.[0].length ?? 0));
          items[items.length - 1] += `\n${content}`;
        }
      }
      return `<ol>${items.map((item) => `<li>${item}</li>`).join("")}</ol>`;
    },
  );

  // Wrap remaining bare text in <p> tags
  result = result
    .split("\n\n")
    .map((block: string) => {
      block = block.trim();
      if (!block) return "";
      if (/^<(h[1-6]|pre|ul|ol|blockquote|hr|table|div)/.test(block)) return block;
      if (/^%%FARMINGLABS_DOCS_HEADING_OPEN_\d+%%/.test(block)) return block;
      if (/^%%(?:CODEBLOCK|CALLOUT|TABS|PROMPT|HOVERLINK)_\d+%%/.test(block)) {
        return block;
      }
      return `<p>${block}</p>`;
    })
    .join("\n");

  // Restore placeholders
  for (const block of calloutBlocks) {
    result = result.replace(block.token, () => block.html);
  }
  for (const block of tabsBlocks) {
    result = result.replace(block.token, () => block.html);
  }
  for (const block of hoverLinkBlocks) {
    result = result.replace(block.token, () => block.html);
  }
  for (const block of codeBlocks) {
    result = result.replace(block.token, () => block.html);
  }

  result = restoreMarkdownHeadingOpeningTags(
    stripPreparedMarkdownHeadingTokens(result),
    headingOpeningTags,
  );
  for (const block of promptBlocks) {
    result = result.replace(block.token, () =>
      renderPrompt(block.attributes, block.children, options),
    );
  }
  return result;
}
