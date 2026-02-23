/**
 * Markdown renderer for AI chat responses.
 *
 * Uses sugar-high for syntax highlighting in fenced code blocks.
 * Supports: fenced code blocks, tables, inline code, bold, italic,
 * links, headings, bullet lists, numbered lists.
 */
import { highlight } from "sugar-high";

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

export function renderMarkdown(text) {
  if (!text) return "";

  const codeBlocks = [];

  let processed = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    codeBlocks.push(buildCodeBlock(lang, code));
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  processed = processed.replace(/```(\w*)\n([\s\S]*)$/, (_match, lang, code) => {
    codeBlocks.push(buildCodeBlock(lang, code));
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  const lines = processed.split("\n");
  const output = [];
  let i = 0;

  while (i < lines.length) {
    if (isTableRow(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const tableLines = [lines[i]];
      i++;
      i++;
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
      '<div style="display:flex;gap:8px;padding:2px 0"><span style="opacity:0.5">\u2022</span><span>$1</span></div>',
    )
    .replace(
      /^(\d+)\. (.*$)/gm,
      '<div style="display:flex;gap:8px;padding:2px 0"><span style="opacity:0.5">$1.</span><span>$2</span></div>',
    )
    .replace(/\n\n/g, '<div style="height:8px"></div>')
    .replace(/\n/g, "<br>");

  result = result.replace(/\x00CB(\d+)\x00/g, (_m, idx) => codeBlocks[Number(idx)]);

  return result;
}
