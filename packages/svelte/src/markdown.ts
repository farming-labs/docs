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

import { createHighlighter, type Highlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | undefined;

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
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

function renderCallout(type: string, content: string): string {
  const icon = calloutIcons[type] || calloutIcons.note;
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return `<div class="fd-callout fd-callout-${type}" role="note"><div class="fd-callout-indicator" role="none"></div><div class="fd-callout-icon">${icon}</div><div class="fd-callout-content"><p class="fd-callout-title">${label}</p><p>${content}</p></div></div>`;
}

function highlightCode(
  hl: Highlighter,
  code: string,
  lang: string,
): { html: string; raw: string } {
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
    const escaped = trimmedCode
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return {
      html: `<pre class="shiki"><code>${escaped}</code></pre>`,
      raw: trimmedCode,
    };
  }
}

function parseMeta(meta: string): { lang: string; title: string | null } {
  const lang = (meta.split(/\s/)[0] || "text").toLowerCase();
  const titleMatch = meta.match(/title=["']([^"']+)["']/);
  return { lang, title: titleMatch ? titleMatch[1] : null };
}

function wrapCodeWithCopy(html: string, rawCode: string, title?: string | null): string {
  const escapedRaw = rawCode
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const copyBtn = `<button class="fd-copy-btn" data-code="${escapedRaw}" title="Copy code"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>`;
  if (title) {
    return `<div class="fd-codeblock fd-codeblock--titled"><div class="fd-codeblock-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg><span class="fd-codeblock-title-text">${title}</span>${copyBtn}</div><div class="fd-codeblock-content">${html}</div></div>`;
  }
  return `<div class="fd-codeblock">${copyBtn}<div class="fd-codeblock-content">${html}</div></div>`;
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
 * Designed for server-side use in SvelteKit `+page.server` loaders.
 */
export async function renderMarkdown(content: string): Promise<string> {
  if (!content) return "";

  const hl = await getHighlighter();
  let result = content;

  // ── Tabs blocks: <Tabs items={[...]}> ... </Tabs> ──
  const tabsBlocks: string[] = [];
  result = result.replace(
    /<Tabs\s+items=\{?\[([^\]]+)\]\}?>([\s\S]*?)<\/Tabs>/g,
    (_: string, itemsStr: string, body: string) => {
      const items = itemsStr
        .split(",")
        .map((s: string) => s.trim().replace(/^["']|["']$/g, ""));
      const panels: { value: string; html: string }[] = [];
      const tabRegex = /<Tab\s+value=["']([^"']+)["']>([\s\S]*?)<\/Tab>/g;
      let tabMatch: RegExpExecArray | null;
      while ((tabMatch = tabRegex.exec(body)) !== null) {
        const tabValue = tabMatch[1];
        const tabContent = tabMatch[2].trim();
        const codeMatch = tabContent.match(/```([^\n]*)\n([\s\S]*?)```/);
        if (codeMatch) {
          const { lang, title } = parseMeta(codeMatch[1]);
          const dedented = dedentCode(codeMatch[2]);
          const { html, raw } = highlightCode(hl, dedented, lang);
          panels.push({ value: tabValue, html: wrapCodeWithCopy(html, raw, title) });
        } else {
          panels.push({ value: tabValue, html: `<p>${tabContent}</p>` });
        }
      }

      let tabsHtml = `<div class="fd-tabs" data-tabs>`;
      tabsHtml += `<div class="fd-tabs-list" role="tablist">`;
      for (let i = 0; i < items.length; i++) {
        tabsHtml += `<button role="tab" class="fd-tab-trigger${i === 0 ? " fd-tab-active" : ""}" data-tab-value="${items[i]}" aria-selected="${i === 0}">${items[i]}</button>`;
      }
      tabsHtml += `</div>`;
      for (let i = 0; i < panels.length; i++) {
        tabsHtml += `<div class="fd-tab-panel${i === 0 ? " fd-tab-panel-active" : ""}" data-tab-panel="${panels[i].value}" role="tabpanel">${panels[i].html}</div>`;
      }
      tabsHtml += `</div>`;

      const placeholder = `%%TABS_${tabsBlocks.length}%%`;
      tabsBlocks.push(tabsHtml);
      return placeholder;
    },
  );

  // ── Fenced code blocks ──
  const codeBlocks: string[] = [];
  result = result.replace(
    /```([^\n]*)\n([\s\S]*?)```/g,
    (_: string, meta: string, code: string) => {
      const { lang, title } = parseMeta(meta);
      const { html, raw } = highlightCode(hl, code, lang);
      const placeholder = `%%CODEBLOCK_${codeBlocks.length}%%`;
      codeBlocks.push(wrapCodeWithCopy(html, raw, title));
      return placeholder;
    },
  );

  // Inline code
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings (h4 → h1 order to avoid prefix collisions)
  result = result.replace(/^#### (.+)$/gm, (_: string, text: string) => {
    return `<h4 id="${slugify(text)}">${text}</h4>`;
  });
  result = result.replace(/^### (.+)$/gm, (_: string, text: string) => {
    return `<h3 id="${slugify(text)}">${text}</h3>`;
  });
  result = result.replace(/^## (.+)$/gm, (_: string, text: string) => {
    return `<h2 id="${slugify(text)}">${text}</h2>`;
  });
  result = result.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // ── Callouts / blockquotes (before inline formatting) ──
  const calloutBlocks: string[] = [];
  result = result.replace(
    /(?:^>\s*.+\n?)+/gm,
    (block: string) => {
      const lines = block.split("\n").filter(Boolean);
      const inner = lines.map((l: string) => l.replace(/^>\s?/, "")).join("\n");

      const ghMatch = inner.match(
        /^\[!(NOTE|WARNING|TIP|IMPORTANT|CAUTION)\]\s*\n?([\s\S]*)/i,
      );
      if (ghMatch) {
        const type = ghMatch[1].toLowerCase();
        const calloutContent = ghMatch[2].trim();
        const placeholder = `%%CALLOUT_${calloutBlocks.length}%%`;
        calloutBlocks.push(renderCallout(type, calloutContent));
        return placeholder;
      }

      const boldMatch = inner.match(
        /^\*\*(Note|Warning|Tip|Important|Caution):\*\*\s*([\s\S]*)/i,
      );
      if (boldMatch) {
        const type = boldMatch[1].toLowerCase();
        const calloutContent = boldMatch[2].trim();
        const placeholder = `%%CALLOUT_${calloutBlocks.length}%%`;
        calloutBlocks.push(renderCallout(type, calloutContent));
        return placeholder;
      }

      return `<blockquote><p>${inner}</p></blockquote>`;
    },
  );

  // Inline formatting
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Links
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>',
  );

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
        .map(
          (row: string[]) =>
            `<tr>${row.map((c: string) => `<td>${c}</td>`).join("")}</tr>`,
        )
        .join("");
      return `<div class="fd-table-wrapper"><table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
    },
  );

  // Unordered lists
  result = result.replace(/(?:^- .+\n?)+/gm, (block: string) => {
    const items = block
      .split("\n")
      .filter((l: string) => l.startsWith("- "))
      .map((l: string) => `<li>${l.slice(2)}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  result = result.replace(/(?:^\d+\. .+\n?)+/gm, (block: string) => {
    const items = block
      .split("\n")
      .filter((l: string) => /^\d+\. /.test(l))
      .map((l: string) => `<li>${l.replace(/^\d+\. /, "")}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  // Wrap remaining bare text in <p> tags
  result = result
    .split("\n\n")
    .map((block: string) => {
      block = block.trim();
      if (!block) return "";
      if (/^<(h[1-6]|pre|ul|ol|blockquote|hr|table|div)/.test(block))
        return block;
      if (/^%%(CODEBLOCK|CALLOUT|TABS)_\d+%%$/.test(block)) return block;
      return `<p>${block}</p>`;
    })
    .join("\n");

  // Restore placeholders
  for (let i = 0; i < codeBlocks.length; i++) {
    result = result.replace(`%%CODEBLOCK_${i}%%`, codeBlocks[i]);
  }
  for (let i = 0; i < calloutBlocks.length; i++) {
    result = result.replace(`%%CALLOUT_${i}%%`, calloutBlocks[i]);
  }
  for (let i = 0; i < tabsBlocks.length; i++) {
    result = result.replace(`%%TABS_${i}%%`, tabsBlocks[i]);
  }

  return result;
}
