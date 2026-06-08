import { highlight } from "sugar-high";

type CodeFence = {
  markerChar: "`" | "~";
  markerLength: number;
  lang: string;
};

const codeBlockTokenBoundary = String.fromCharCode(0);

function buildCodeBlock(lang: string, code: string): string {
  const trimmed = code.replace(/\n$/, "");
  // Strip newlines between sh__line spans. <pre> preserves whitespace and
  // display:block spans already break lines, so raw newlines double them.
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

function getCodeFenceOpening(line: string): CodeFence | null {
  const match = /^(?: {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) return null;

  const marker = match[1];
  const rawInfo = match[2] ?? "";
  if (!marker) return null;
  if (marker.startsWith("`") && rawInfo.includes("`")) return null;

  return {
    markerChar: marker[0] as "`" | "~",
    markerLength: marker.length,
    lang: extractCodeFenceLanguage(rawInfo),
  };
}

function isCodeFenceClosing(line: string, fence: CodeFence): boolean {
  const trimmed = line.trim();
  if (trimmed.length < fence.markerLength) return false;

  for (const char of trimmed) {
    if (char !== fence.markerChar) return false;
  }

  return true;
}

function extractCodeFenceLanguage(rawInfo: string): string {
  const firstToken = rawInfo.trim().split(/\s+/, 1)[0] ?? "";
  return firstToken
    .replace(/^\{\.?/, "")
    .replace(/^\./, "")
    .replace(/[},].*$/, "");
}

function replaceFencedCodeBlocks(
  text: string,
  codeBlocks: string[],
  tokenBoundary: string,
): string {
  const lines = text.split("\n");
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const fence = getCodeFenceOpening(lines[i]);
    if (!fence) {
      output.push(lines[i]);
      i += 1;
      continue;
    }

    const codeLines: string[] = [];
    i += 1;

    while (i < lines.length && !isCodeFenceClosing(lines[i], fence)) {
      codeLines.push(lines[i]);
      i += 1;
    }

    if (i < lines.length) i += 1;

    codeBlocks.push(buildCodeBlock(fence.lang, codeLines.join("\n")));
    output.push(`${tokenBoundary}CB${codeBlocks.length - 1}${tokenBoundary}`);
  }

  return output.join("\n");
}

export function renderAIResponseMarkdown(text: string): string {
  const codeBlocks: string[] = [];
  const processed = replaceFencedCodeBlocks(text, codeBlocks, codeBlockTokenBoundary);

  return renderMarkdownBlocks(processed, codeBlocks);
}

function renderMarkdownBlocks(text: string, codeBlocks: string[]): string {
  const lines = text.split("\n");
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const codeBlockIndex = getCodeBlockTokenIndex(trimmed);
    if (codeBlockIndex !== null) {
      output.push(codeBlocks[codeBlockIndex] ?? "");
      i++;
      continue;
    }

    if (isHorizontalRule(trimmed)) {
      output.push('<hr class="fd-ai-hr" />');
      i++;
      continue;
    }

    const heading = getHeading(trimmed);
    if (heading) {
      output.push(`<h${heading.level}>${renderInlineMarkdown(heading.text)}</h${heading.level}>`);
      i++;
      continue;
    }

    if (isTableRow(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const tableLines: string[] = [lines[i]];
      i++; // separator
      i++; // move past separator
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
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

    const paragraphLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !isMarkdownBlockStart(lines, i)) {
      paragraphLines.push(lines[i].trim());
      i++;
    }

    output.push(
      `<p>${paragraphLines.map((paragraphLine) => renderInlineMarkdown(paragraphLine)).join("<br>")}</p>`,
    );
  }

  return output.join("");
}

function getCodeBlockTokenIndex(line: string): number | null {
  const prefix = `${codeBlockTokenBoundary}CB`;
  if (!line.startsWith(prefix) || !line.endsWith(codeBlockTokenBoundary)) return null;

  const rawIndex = line.slice(prefix.length, -codeBlockTokenBoundary.length);
  if (!/^\d+$/.test(rawIndex)) return null;

  return Number(rawIndex);
}

function getHeading(line: string): { level: number; text: string } | null {
  const match = /^(#{1,4})\s+(.+)$/.exec(line);
  if (!match) return null;

  return {
    level: match[1].length + 1,
    text: match[2],
  };
}

function collectListItems(
  lines: string[],
  startIndex: number,
  type: "ordered" | "unordered",
): { items: string[]; nextIndex: number } | null {
  const pattern = type === "ordered" ? /^(?: {0,3})\d+\.\s+(.+)$/ : /^(?: {0,3})[-*+]\s+(.+)$/;
  const items: string[] = [];
  let i = startIndex;

  while (i < lines.length) {
    const match = pattern.exec(lines[i]);
    if (!match) break;

    items.push(match[1]);
    i++;
  }

  return items.length > 0 ? { items, nextIndex: i } : null;
}

function isMarkdownBlockStart(lines: string[], index: number): boolean {
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

function renderInlineMarkdown(text: string): string {
  const inlineCodeTokens: string[] = [];
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function isHorizontalRule(line: string): boolean {
  return /^(?:-{3,}|\*{3,}|_{3,})$/.test(line);
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|");
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|$/.test(line.trim());
}

function renderTable(rows: string[]): string {
  const parseRow = (row: string) =>
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

  return `<table>${thead}<tbody>${bodyRows}</tbody></table>`;
}
