/**
 * Markdown renderer for AI chat.
 *
 * Uses sugar-high for syntax highlighting in code blocks.
 * Supports fenced and streaming code blocks, loose language labels emitted by
 * models, tables, inline code, emphasis, links, headings, and lists.
 */
import { highlight } from "sugar-high";

const codeBlockTokenBoundary = String.fromCharCode(0);

const looseCodeLanguageAliases = new Map([
  ["bash", "bash"],
  ["shell", "bash"],
  ["sh", "bash"],
  ["zsh", "bash"],
  ["curl", "bash"],
  ["javascript", "js"],
  ["js", "js"],
  ["typescript", "ts"],
  ["ts", "ts"],
  ["json", "json"],
  ["python", "python"],
  ["py", "python"],
  ["http", "http"],
]);

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function buildCodeBlock(lang, code) {
  const trimmed = code.replace(/\n$/, "");
  const highlighted = highlight(trimmed).replace(/<\/span>\n<span/g, "</span><span");
  const langLabel = lang ? `<div class="fd-ai-code-lang">${escapeHtml(lang)}</div>` : "";
  const copyBtn = `<button class="fd-ai-code-copy" onclick="(function(btn){var code=btn.closest('.fd-ai-code-block').querySelector('code').textContent;navigator.clipboard.writeText(code).then(function(){btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy'},1500)})})(this)">Copy</button>`;
  return (
    `<div class="fd-ai-code-block">` +
    `<div class="fd-ai-code-header">${langLabel}${copyBtn}</div>` +
    `<pre><code>${highlighted}</code></pre>` +
    `</div>`
  );
}

function getCodeFenceOpening(line) {
  const match = /^(?: {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) return null;

  const marker = match[1];
  const rawInfo = match[2] ?? "";
  if (!marker) return null;
  if (marker.startsWith("`") && rawInfo.includes("`")) return null;

  return {
    markerChar: marker[0],
    markerLength: marker.length,
    lang: extractCodeFenceLanguage(rawInfo),
  };
}

function isCodeFenceClosing(line, fence) {
  const trimmed = line.trim();
  if (trimmed.length < fence.markerLength) return false;

  for (const char of trimmed) {
    if (char !== fence.markerChar) return false;
  }

  return true;
}

function extractCodeFenceLanguage(rawInfo) {
  const firstToken = rawInfo.trim().split(/\s+/, 1)[0] ?? "";
  return firstToken
    .replace(/^\{\.?/, "")
    .replace(/^\./, "")
    .replace(/[},].*$/, "");
}

function normalizeLooseCodeBlocks(text) {
  const lines = text.split("\n");
  const output = [];
  let i = 0;

  while (i < lines.length) {
    const lang = getLooseCodeLanguage(lines[i]);
    if (!lang) {
      output.push(lines[i]);
      i += 1;
      continue;
    }

    const start = nextNonEmptyLineIndex(lines, i + 1);
    if (start < 0 || !looksLikeLooseCodeLine(lines[start], lang)) {
      output.push(lines[i]);
      i += 1;
      continue;
    }

    output.push(`\`\`\`${lang}`);
    let j = start;
    while (j < lines.length) {
      if (j > start && isLooseCodeBoundary(lines, j, lang)) break;
      output.push(lines[j]);
      j += 1;
    }
    output.push("```");
    i = j;
  }

  return output.join("\n");
}

function getLooseCodeLanguage(line) {
  const raw = line.trim().toLowerCase();
  if (!/^[a-z][\w#+.-]*$/.test(raw)) return null;
  return looseCodeLanguageAliases.get(raw) ?? null;
}

function nextNonEmptyLineIndex(lines, startIndex) {
  for (let i = startIndex; i < lines.length; i += 1) {
    if (lines[i].trim()) return i;
  }
  return -1;
}

function isLooseCodeBoundary(lines, index, lang) {
  const line = lines[index];
  const trimmed = line.trim();
  if (getHeading(trimmed) || isHorizontalRule(trimmed)) return true;

  if (!trimmed) {
    const next = nextNonEmptyLineIndex(lines, index + 1);
    return next < 0 || !looksLikeLooseCodeLine(lines[next], lang);
  }

  return false;
}

function looksLikeLooseCodeLine(line, lang) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  if (lang === "json") return /^[{[]/.test(trimmed);
  if (lang === "js" || lang === "ts") {
    return /^(?:import|export|const|let|var|function|async|await|class|type|interface|return|console\.|fetch\(|npm|pnpm|yarn|bun)\b/.test(
      trimmed,
    );
  }
  if (lang === "python") {
    return /^(?:from|import|def|class|if|for|while|print\(|python|pip)\b/.test(trimmed);
  }
  if (lang === "http") return /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+/.test(trimmed);

  return /^(?:[$>#]\s*)?(?:claude|opencode|curl|npx|pnpm|npm|yarn|bun|git|node|deno|python|pip|export|cd|cat|echo|mkdir|touch|rm|cp|mv|vercel|docs)\b|^(?:--|\||&&|\\)|^[A-Z_][A-Z0-9_]*=/.test(
    trimmed,
  );
}

function replaceFencedCodeBlocks(text, codeBlocks) {
  const lines = text.split("\n");
  const output = [];
  let i = 0;

  while (i < lines.length) {
    const fence = getCodeFenceOpening(lines[i]);
    if (!fence) {
      output.push(lines[i]);
      i += 1;
      continue;
    }

    const codeLines = [];
    i += 1;

    while (i < lines.length && !isCodeFenceClosing(lines[i], fence)) {
      codeLines.push(lines[i]);
      i += 1;
    }

    if (i < lines.length) i += 1;

    codeBlocks.push(buildCodeBlock(fence.lang, codeLines.join("\n")));
    output.push(`${codeBlockTokenBoundary}CB${codeBlocks.length - 1}${codeBlockTokenBoundary}`);
  }

  return output.join("\n");
}

export function renderMarkdown(text) {
  if (!text) return "";

  const codeBlocks = [];
  const processed = replaceFencedCodeBlocks(normalizeLooseCodeBlocks(text), codeBlocks);

  return renderMarkdownBlocks(processed, codeBlocks);
}

function renderMarkdownBlocks(text, codeBlocks) {
  const lines = text.split("\n");
  const output = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const codeBlockIndex = getCodeBlockTokenIndex(trimmed);
    if (codeBlockIndex !== null) {
      output.push(codeBlocks[codeBlockIndex] ?? "");
      i += 1;
      continue;
    }

    if (isHorizontalRule(trimmed)) {
      output.push('<hr class="fd-ai-hr" />');
      i += 1;
      continue;
    }

    const heading = getHeading(trimmed);
    if (heading) {
      output.push(`<h${heading.level}>${renderInlineMarkdown(heading.text)}</h${heading.level}>`);
      i += 1;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const tableLines = [line];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i += 1;
      }
      output.push(renderTable(tableLines));
      continue;
    }

    const unorderedItems = collectListItems(lines, i, "unordered");
    if (unorderedItems) {
      output.push(
        `<ul>${unorderedItems.items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`,
      );
      i = unorderedItems.nextIndex;
      continue;
    }

    const orderedItems = collectListItems(lines, i, "ordered");
    if (orderedItems) {
      output.push(
        `<ol>${orderedItems.items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ol>`,
      );
      i = orderedItems.nextIndex;
      continue;
    }

    const paragraphLines = [];
    while (i < lines.length && lines[i].trim() && !isMarkdownBlockStart(lines, i)) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }

    output.push(
      `<p>${paragraphLines.map((paragraphLine) => renderInlineMarkdown(paragraphLine)).join("<br>")}</p>`,
    );
  }

  return output.join("");
}

function getCodeBlockTokenIndex(line) {
  const prefix = `${codeBlockTokenBoundary}CB`;
  if (!line.startsWith(prefix) || !line.endsWith(codeBlockTokenBoundary)) return null;

  const rawIndex = line.slice(prefix.length, -codeBlockTokenBoundary.length);
  if (!/^\d+$/.test(rawIndex)) return null;

  return Number(rawIndex);
}

function getHeading(line) {
  const match = /^(#{1,6})\s+(.+)$/.exec(line);
  if (!match) return null;

  return {
    level: Math.min(match[1].length + 1, 4),
    text: match[2],
  };
}

function collectListItems(lines, startIndex, type) {
  const pattern = type === "ordered" ? /^(?: {0,3})\d+\.\s+(.+)$/ : /^(?: {0,3})[-*+]\s+(.+)$/;
  const items = [];
  let i = startIndex;

  while (i < lines.length) {
    const match = pattern.exec(lines[i]);
    if (!match) break;

    items.push(match[1]);
    i += 1;
  }

  return items.length > 0 ? { items, nextIndex: i } : null;
}

function isMarkdownBlockStart(lines, index) {
  const line = lines[index];
  const trimmed = line.trim();

  return (
    getCodeBlockTokenIndex(trimmed) !== null ||
    isHorizontalRule(trimmed) ||
    Boolean(getHeading(trimmed)) ||
    (isTableRow(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) ||
    Boolean(collectListItems(lines, index, "unordered")) ||
    Boolean(collectListItems(lines, index, "ordered"))
  );
}

function renderInlineMarkdown(text) {
  const inlineCodeTokens = [];
  let result = escapeHtml(text).replace(/`([^`]+)`/g, (_match, code) => {
    inlineCodeTokens.push(`<code>${code}</code>`);
    return `${codeBlockTokenBoundary}IC${inlineCodeTokens.length - 1}${codeBlockTokenBoundary}`;
  });

  result = result
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      return `<a href="${escapeAttribute(href)}">${label}</a>`;
    });

  return result.replace(
    new RegExp(`${codeBlockTokenBoundary}IC(\\d+)${codeBlockTokenBoundary}`, "g"),
    (_match, idx) => inlineCodeTokens[Number(idx)] ?? "",
  );
}

function isHorizontalRule(line) {
  return /^(?:-{3,}|\*{3,}|_{3,})$/.test(line);
}

function isTableRow(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|");
}

function isTableSeparator(line) {
  return /^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|$/.test(line.trim());
}

function renderTable(rows) {
  const parseRow = (row) =>
    row
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const headerCells = parseRow(rows[0]);
  const thead = `<thead><tr>${headerCells.map((c) => `<th>${renderInlineMarkdown(c)}</th>`).join("")}</tr></thead>`;

  const bodyRows = rows
    .slice(1)
    .map((row) => {
      const cells = parseRow(row);
      return `<tr>${cells.map((c) => `<td>${renderInlineMarkdown(c)}</td>`).join("")}</tr>`;
    })
    .join("");

  return `<div class="fd-table-wrapper relative overflow-auto prose-no-margin my-6"><table>${thead}<tbody>${bodyRows}</tbody></table></div>`;
}
