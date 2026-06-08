import { highlight } from "sugar-high";

type CodeFence = {
  markerChar: "`" | "~";
  markerLength: number;
  lang: string;
};

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
  const codeBlockTokenBoundary = String.fromCharCode(0);
  const codeBlockTokenPattern = new RegExp(
    `${codeBlockTokenBoundary}CB(\\d+)${codeBlockTokenBoundary}`,
    "g",
  );
  const codeBlocks: string[] = [];
  const processed = replaceFencedCodeBlocks(text, codeBlocks, codeBlockTokenBoundary);

  const lines = processed.split("\n");
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
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
    output.push(lines[i]);
    i++;
  }

  let result = output.join("\n");

  result = result
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^### (.*$)/gm, "<h4>$1</h4>")
    .replace(/^## (.*$)/gm, "<h3>$1</h3>")
    .replace(/^# (.*$)/gm, "<h2>$1</h2>")
    .replace(
      /^[-*] (.*$)/gm,
      '<div style="display:flex;gap:8px;padding:2px 0"><span style="opacity:0.5">•</span><span>$1</span></div>',
    )
    .replace(
      /^(\d+)\. (.*$)/gm,
      '<div style="display:flex;gap:8px;padding:2px 0"><span style="opacity:0.5">$1.</span><span>$2</span></div>',
    )
    .replace(/\n\n/g, '<div style="height:8px"></div>')
    .replace(/\n/g, "<br>");

  result = result.replace(codeBlockTokenPattern, (_m, idx) => codeBlocks[Number(idx)]);

  return result;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  const thead = `<thead><tr>${headerCells.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;

  const bodyRows = rows
    .slice(1)
    .map((row) => {
      const cells = parseRow(row);
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    })
    .join("");

  return `<table>${thead}<tbody>${bodyRows}</tbody></table>`;
}
