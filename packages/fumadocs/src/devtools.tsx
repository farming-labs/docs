"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type MdxBlock =
  | { id: string; type: "heading"; level: number; text: string }
  | { id: string; type: "paragraph"; content: string }
  | { id: string; type: "callout"; variant: string; title: string; content: string }
  | { id: string; type: "code"; language: string; title: string; code: string }
  | { id: string; type: "tabs"; tabs: Array<{ label: string; content: string }> }
  | {
      id: string;
      type: "hoverlink";
      href: string;
      title: string;
      description: string;
      label: string;
    }
  | { id: string; type: "prompt"; title: string; content: string }
  | { id: string; type: "raw"; content: string };

interface ParsedMdxDocument {
  prefix: string;
  blocks: MdxBlock[];
}

interface DevToolsPagePayload {
  requestedPath: string;
  relativePath: string;
  content: string;
  lastModified: string;
}

interface DocsDevToolsProps {
  api: string;
  pathname: string;
}

// ─── ID generation ────────────────────────────────────────────────────────────

let idCounter = 0;
function createId(prefix = "block"): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

// ─── Parse utilities ──────────────────────────────────────────────────────────

function normalizeSource(s: string) { return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n"); }

function splitPrefix(source: string): { prefix: string; body: string } {
  const lines = normalizeSource(source).split("\n");
  const pre: string[] = [];
  let i = 0;
  if (lines[i]?.trim() === "---") {
    pre.push(lines[i]); i++;
    while (i < lines.length) {
      pre.push(lines[i]);
      const done = lines[i]?.trim() === "---"; i++;
      if (done) break;
    }
  }
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const t = line.trim();
    if (t === "") { pre.push(line); i++; continue; }
    if (/^(import|export)\b/.test(t)) {
      pre.push(line); i++;
      while (i < lines.length && lines[i]?.trim() !== "" && !/[;}]$/.test(lines[i-1]?.trim() ?? "")) {
        pre.push(lines[i] ?? ""); i++;
      }
      continue;
    }
    break;
  }
  return { prefix: pre.join("\n").trimEnd(), body: lines.slice(i).join("\n").trim() };
}

function getAttribute(src: string, name: string): string {
  const m = src.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`));
  return m?.[1] ?? m?.[2] ?? "";
}

function parseStringArray(src: string) {
  return src.split(",").map(v => v.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

function captureUntil(lines: string[], start: number, closing: RegExp) {
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    out.push(lines[i] ?? "");
    if (closing.test(lines[i] ?? "")) return { content: out.join("\n"), end: i + 1 };
  }
  return { content: out.join("\n"), end: lines.length };
}

function isSpecialStart(line: string) {
  const t = line.trim();
  return /^#{1,6}\s+/.test(t) || t.startsWith("```") || /^<[A-Z][\w.:-]*(\s|>|\/>)/.test(t);
}

function parseCodeBlock(lines: string[], start: number): { block: MdxBlock; end: number } {
  const opening = lines[start]?.trim() ?? "```";
  const info = opening.replace(/^```/, "").trim();
  const title = getAttribute(info, "title");
  const language = info.split(/\s+/, 1)[0]?.replace(/title=.*/, "") ?? "";
  const content: string[] = [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if ((lines[i] ?? "").trim().startsWith("```")) { end = i + 1; break; }
    content.push(lines[i] ?? "");
  }
  return { block: { id: createId("code"), type: "code", language, title, code: content.join("\n") }, end };
}

function parseCalloutBlock(raw: string): MdxBlock {
  const op = raw.split("\n", 1)[0] ?? "";
  const inner = raw.replace(/^<Callout\b[^>]*>\s*/s, "").replace(/\s*<\/Callout>\s*$/s, "").trim();
  return { id: createId("callout"), type: "callout", variant: getAttribute(op, "type") || "info", title: getAttribute(op, "title"), content: inner || "Write the callout content here." };
}

function parsePromptBlock(raw: string): MdxBlock {
  const op = raw.split("\n", 1)[0] ?? "";
  const inner = raw.replace(/^<Prompt\b[^>]*>\s*/s, "").replace(/\s*<\/Prompt>\s*$/s, "").trim();
  return { id: createId("prompt"), type: "prompt", title: getAttribute(op, "title") || "Prompt", content: inner || getAttribute(op, "prompt") || "Write the prompt here." };
}

function parseHoverLinkBlock(raw: string): MdxBlock {
  const op = raw.split("\n", 1)[0] ?? "";
  const label = raw.replace(/^<HoverLink\b[^>]*>\s*/s, "").replace(/\s*<\/HoverLink>\s*$/s, "").trim();
  return { id: createId("hoverlink"), type: "hoverlink", href: getAttribute(op, "href") || "#", title: getAttribute(op, "title") || "Linked page", description: getAttribute(op, "description") || "Describe the linked page.", label: label || "Open the linked page" };
}

function parseTabsBlock(raw: string): MdxBlock {
  const op = raw.split("\n", 1)[0] ?? "";
  const im = op.match(/items\s*=\s*\{\s*\[([^\]]*)\]\s*\}/);
  const items = im ? parseStringArray(im[1] ?? "") : [];
  const tabs: Array<{ label: string; content: string }> = [];
  const tp = /<Tab\s+value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/Tab>/g;
  let m: RegExpExecArray | null;
  while ((m = tp.exec(raw)) !== null) tabs.push({ label: m[1] ?? "Tab", content: (m[2] ?? "").trim() || "Tab content" });
  if (tabs.length === 0) for (const item of items.length > 0 ? items : ["First", "Second"]) tabs.push({ label: item, content: "Tab content" });
  return { id: createId("tabs"), type: "tabs", tabs };
}

function parseRawJsxBlock(lines: string[], start: number): { block: MdxBlock; end: number } {
  const firstLine = lines[start] ?? "";
  if (firstLine.trim().endsWith("/>")) return { block: { id: createId("raw"), type: "raw", content: firstLine }, end: start + 1 };
  const tag = firstLine.trim().match(/^<([A-Z][\w.:-]*)\b/)?.[1];
  if (tag) {
    const closing = new RegExp(`</${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}>`);
    const cap = captureUntil(lines, start, closing);
    return { block: { id: createId("raw"), type: "raw", content: cap.content }, end: cap.end };
  }
  return { block: { id: createId("raw"), type: "raw", content: firstLine }, end: start + 1 };
}

function parseMdxDocument(source: string): ParsedMdxDocument {
  const { prefix, body } = splitPrefix(source);
  const lines = body.split("\n");
  const blocks: MdxBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const t = line.trim();
    if (t === "") { i++; continue; }
    const h = t.match(/^(#{1,6})\s+(.+)$/);
    if (h) { blocks.push({ id: createId("heading"), type: "heading", level: h[1]?.length ?? 2, text: h[2] ?? "Heading" }); i++; continue; }
    if (t.startsWith("```")) { const p = parseCodeBlock(lines, i); blocks.push(p.block); i = p.end; continue; }
    if (t.startsWith("<Callout")) { const c = captureUntil(lines, i, /<\/Callout>/); blocks.push(parseCalloutBlock(c.content)); i = c.end; continue; }
    if (t.startsWith("<Tabs")) { const c = captureUntil(lines, i, /<\/Tabs>/); blocks.push(parseTabsBlock(c.content)); i = c.end; continue; }
    if (t.startsWith("<Prompt")) { const c = captureUntil(lines, i, /<\/Prompt>/); blocks.push(parsePromptBlock(c.content)); i = c.end; continue; }
    if (t.startsWith("<HoverLink")) { const c = captureUntil(lines, i, /<\/HoverLink>/); blocks.push(parseHoverLinkBlock(c.content)); i = c.end; continue; }
    if (/^<[A-Z][\w.:-]*(\s|>|\/>)/.test(t)) { const p = parseRawJsxBlock(lines, i); blocks.push(p.block); i = p.end; continue; }
    const para: string[] = [line]; i++;
    while (i < lines.length) { const next = lines[i] ?? ""; if (next.trim() === "" || isSpecialStart(next)) break; para.push(next); i++; }
    blocks.push({ id: createId("paragraph"), type: "paragraph", content: para.join("\n").trim() });
  }
  if (blocks.length === 0) blocks.push({ id: createId("paragraph"), type: "paragraph", content: "Start writing…" });
  return { prefix, blocks };
}

// ─── Serialize ────────────────────────────────────────────────────────────────

function q(v: string) { return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }
function ind(v: string, n = 2) { const p = " ".repeat(n); return v.split("\n").map(l => l.trim() ? `${p}${l}` : l).join("\n"); }

function serializeBlock(block: MdxBlock): string {
  if (block.type === "heading") return `${"#".repeat(Math.min(6, Math.max(1, block.level)))} ${block.text.trim() || "Heading"}`;
  if (block.type === "paragraph") return block.content.trim();
  if (block.type === "callout") { const t = block.title.trim() ? ` title="${q(block.title.trim())}"` : ""; return `<Callout type="${q(block.variant || "info")}"${t}>\n${block.content.trim()}\n</Callout>`; }
  if (block.type === "code") { const t = block.title.trim() ? ` title="${q(block.title.trim())}"` : ""; return `\`\`\`${block.language.trim()}${t}\n${block.code.replace(/\s+$/g, "")}\n\`\`\``; }
  if (block.type === "tabs") {
    const tabs = block.tabs.length > 0 ? block.tabs : [{ label: "First", content: "Tab content" }];
    const items = tabs.map(t => `"${q(t.label || "Tab")}"`).join(", ");
    const rendered = tabs.map(t => `  <Tab value="${q(t.label || "Tab")}">\n${ind(t.content.trim() || "Tab content", 4)}\n  </Tab>`).join("\n\n");
    return `<Tabs items={[${items}]}>\n${rendered}\n</Tabs>`;
  }
  if (block.type === "hoverlink") return `<HoverLink href="${q(block.href || "#")}" title="${q(block.title || "Linked page")}" description="${q(block.description || "")}">\n${ind(block.label || "Open the linked page", 2)}\n</HoverLink>`;
  if (block.type === "prompt") { const t = block.title.trim() ? ` title="${q(block.title.trim())}"` : ""; return `<Prompt${t}>\n${block.content.trim() || "Write the prompt here."}\n</Prompt>`; }
  return block.content.trim();
}

function serializeMdxDocument(doc: ParsedMdxDocument): string {
  const body = doc.blocks.map(serializeBlock).filter(Boolean).join("\n\n");
  return [doc.prefix.trim(), body.trim()].filter(Boolean).join("\n\n").trimEnd() + "\n";
}

function createBlock(type: MdxBlock["type"]): MdxBlock {
  if (type === "heading") return { id: createId("heading"), type, level: 2, text: "New heading" };
  if (type === "callout") return { id: createId("callout"), type, variant: "note", title: "", content: "Write a helpful callout." };
  if (type === "code") return { id: createId("code"), type, language: "ts", title: "example.ts", code: "export const value = true;" };
  if (type === "tabs") return { id: createId("tabs"), type, tabs: [{ label: "npm", content: "```bash\nnpm install my-package\n```" }, { label: "pnpm", content: "```bash\npnpm add my-package\n```" }] };
  if (type === "hoverlink") return { id: createId("hoverlink"), type, href: "/docs", title: "Related guide", description: "A useful related documentation page.", label: "Read the related guide" };
  if (type === "prompt") return { id: createId("prompt"), type, title: "Try this prompt", content: "Use this docs page to implement the feature." };
  if (type === "raw") return { id: createId("raw"), type, content: "<CustomComponent />" };
  return { id: createId("paragraph"), type: "paragraph", content: "Write a paragraph." };
}

function createDevToolsUrl(api: string, mode: "page" | "publish" | "theme" | "nav-item", pathname: string) {
  const url = new URL(api, window.location.origin);
  url.searchParams.set("devtools", mode);
  if (mode === "page") url.searchParams.set("path", pathname);
  return `${url.pathname}${url.search}`;
}

// ─── DOM → block-index map ───────────────────────────────────────────────────
// Built once after the MDX doc is loaded. Each direct child of [data-dt-content]
// is assigned to exactly one parsed block. We use per-type cursors so that:
//   • h1-h6 elements → heading blocks (text match preferred, cursor fallback)
//   • p / ul / ol / hr / blockquote → paragraph blocks  (our parser treats all
//     of these as paragraphs — lists, HR, blockquotes are all parsed as paragraph)
//   • figure → code blocks
//   • div/aside/section → callout / tabs / prompt / hoverlink / raw
//     identified by DOM attributes/classes, never by position alone

function buildDomBlockMap(
  contentEl: HTMLElement,
  blocks: MdxBlock[],
): Map<HTMLElement, number> {
  const children = Array.from(contentEl.children) as HTMLElement[];
  const map = new Map<HTMLElement, number>();

  // Group parser blocks by type, keeping their original index
  const byType: Record<string, Array<{ idx: number; block: MdxBlock }>> = {};
  blocks.forEach((block, idx) => {
    (byType[block.type] ??= []).push({ idx, block });
  });

  const cursors: Record<string, number> = {};
  function next(type: string): number | null {
    const list = byType[type];
    if (!list) return null;
    const c = cursors[type] ?? 0;
    if (c >= list.length) return null;
    cursors[type] = c + 1;
    return list[c]!.idx;
  }

  for (const el of children) {
    const tag = el.tagName.toLowerCase();
    let blockIdx: number | null = null;

    if (/^h[1-6]$/.test(tag)) {
      // Prefer text match so invisible-render components (Agent etc.) don't shift indices
      const headings = byType["heading"];
      const c = cursors["heading"] ?? 0;
      const elText = (el.textContent ?? "").trim();
      const ahead = headings?.slice(c) ?? [];
      const matchOff = ahead.findIndex(
        ({ block }) => (block as Extract<MdxBlock, { type: "heading" }>).text.trim() === elText
      );
      if (matchOff >= 0) {
        blockIdx = ahead[matchOff]!.idx;
        cursors["heading"] = c + matchOff + 1;
      } else {
        blockIdx = next("heading");
      }

    } else if (tag === "p" || tag === "ul" || tag === "ol" || tag === "hr" || tag === "blockquote") {
      // All rendered as paragraph blocks by our parser
      blockIdx = next("paragraph");

    } else if (tag === "figure") {
      blockIdx = next("code");

    } else if (tag === "div" || tag === "aside" || tag === "section" || tag === "nav") {
      // Detect component type from DOM shape
      const role = el.getAttribute("role") ?? "";
      const cls  = el.className ?? "";
      if (role === "note" || cls.includes("callout")) {
        blockIdx = next("callout");
      } else if (el.querySelector("[role=tablist], [data-radix-collection-item]")) {
        blockIdx = next("tabs");
      } else if (el.querySelector(".fd-prompt-header") || cls.includes("fd-prompt")) {
        blockIdx = next("prompt");
      } else if (
        el.querySelector("a[href]") &&
        (byType["hoverlink"]?.length ?? 0) > (cursors["hoverlink"] ?? 0)
      ) {
        blockIdx = next("hoverlink");
      } else {
        blockIdx = next("raw");
      }
    }

    if (blockIdx !== null) map.set(el, blockIdx);
  }

  return map;
}

// ─── Catalogues ───────────────────────────────────────────────────────────────

const BLOCK_CATALOGUE: Array<{ type: MdxBlock["type"]; label: string; icon: string; accent: string; desc: string }> = [
  { type: "paragraph",  label: "Paragraph",  icon: "¶",  accent: "#6366f1", desc: "Plain text"       },
  { type: "heading",    label: "Heading",    icon: "H",  accent: "#7c3aed", desc: "H1 – H6"           },
  { type: "callout",    label: "Callout",    icon: "◈",  accent: "#f59e0b", desc: "Note / warning"    },
  { type: "code",       label: "Code",       icon: "</>", accent: "#10b981", desc: "Fenced block"     },
  { type: "tabs",       label: "Tabs",       icon: "⊟",  accent: "#3b82f6", desc: "Tabbed content"    },
  { type: "hoverlink",  label: "HoverLink",  icon: "↗",  accent: "#ec4899", desc: "Card link"         },
  { type: "prompt",     label: "Prompt",     icon: "◉",  accent: "#06b6d4", desc: "Copyable prompt"   },
  { type: "raw",        label: "Raw MDX",    icon: "{}",  accent: "#64748b", desc: "Custom component" },
];

interface ThemeDef { id: string; label: string; accent: string; bg: string; fg: string; border: string; muted: string; dark: boolean }

const THEMES: ThemeDef[] = [
  { id: "default",       label: "Default",       accent: "#6366f1", bg: "#ffffff", fg: "#0f172a", border: "#e2e8f0", muted: "#f1f5f9", dark: false },
  { id: "darksharp",     label: "Dark Sharp",    accent: "#e2e8f0", bg: "#0a0a0a", fg: "#f8fafc", border: "#1e293b", muted: "#111827", dark: true  },
  { id: "ledger",        label: "Ledger",        accent: "#5f6cf6", bg: "#f6f8fb", fg: "#30364a", border: "#dbe3ef", muted: "#eef3fb", dark: false },
  { id: "concrete",      label: "Concrete",      accent: "#171717", bg: "#f5f5f4", fg: "#171717", border: "#d4d0cb", muted: "#e7e5e4", dark: false },
  { id: "hardline",      label: "Hardline",      accent: "#ef4444", bg: "#fafaf9", fg: "#0c0a09", border: "#e7e5e4", muted: "#f5f5f4", dark: false },
  { id: "greentree",     label: "Green Tree",    accent: "#22c55e", bg: "#f0fdf4", fg: "#052e16", border: "#bbf7d0", muted: "#dcfce7", dark: false },
  { id: "shiny",         label: "Shiny",         accent: "#ec4899", bg: "#0f0a1a", fg: "#f0e6ff", border: "#3b1f5e", muted: "#1a0e30", dark: true  },
  { id: "colorful",      label: "Colorful",      accent: "#f59e0b", bg: "#fffbeb", fg: "#1c1917", border: "#fde68a", muted: "#fef3c7", dark: false },
  { id: "pixel-border",  label: "Pixel Border",  accent: "#3b82f6", bg: "#0f172a", fg: "#f1f5f9", border: "#1e3a5f", muted: "#1e293b", dark: true  },
  { id: "command-grid",  label: "Command Grid",  accent: "#8b5cf6", bg: "#fafafa", fg: "#18181b", border: "#e4e4e7", muted: "#f4f4f5", dark: false },
  { id: "darkbold",      label: "Dark Bold",     accent: "#ffffff", bg: "#0a0a0a", fg: "#ededed", border: "#333333", muted: "#1a1a1a", dark: true  },
];

// Matches the actual Callout component variant styles exactly
const CALLOUT_VARIANTS: Record<string, { iconEl: () => React.ReactElement; iconClass: string; titleClass: string; border: string; bg: string; label: string }> = {
  note:      { iconEl: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,      iconClass: "text-black/50 dark:text-white/50",    titleClass: "text-black/70 dark:text-white/70",    border: "border-black/10 dark:border-white/10 border-l-4 border-l-black/25 dark:border-l-white/25",    bg: "bg-black/[0.03] dark:bg-white/[0.025]",  label: "Note"      },
  warning:   { iconEl: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>,  iconClass: "text-black/55 dark:text-white/55",    titleClass: "text-black/75 dark:text-white/75",    border: "border-black/10 dark:border-white/10 border-l-4 border-l-black/35 dark:border-l-white/35",    bg: "bg-black/[0.04] dark:bg-white/[0.035]",  label: "Warning"   },
  tip:       { iconEl: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>,         iconClass: "text-black/50 dark:text-white/50",    titleClass: "text-black/70 dark:text-white/70",    border: "border-black/10 dark:border-white/10 border-l-4 border-l-black/30 dark:border-l-white/30",    bg: "bg-black/[0.03] dark:bg-white/[0.025]",  label: "Tip"       },
  important: { iconEl: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,                iconClass: "text-black/55 dark:text-white/55",    titleClass: "text-black/75 dark:text-white/75",    border: "border-black/10 dark:border-white/10 border-l-4 border-l-black/35 dark:border-l-white/35",    bg: "bg-black/[0.04] dark:bg-white/[0.035]",  label: "Important" },
  caution:   { iconEl: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,   iconClass: "text-black/60 dark:text-white/60",    titleClass: "text-black/80 dark:text-white/80",    border: "border-black/15 dark:border-white/15 border-l-4 border-l-black/40 dark:border-l-white/40",    bg: "bg-black/[0.05] dark:bg-white/[0.045]",  label: "Caution"   },
  // parser aliases
  info:    { iconEl: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,                                                    iconClass: "text-black/50 dark:text-white/50",    titleClass: "text-black/70 dark:text-white/70",    border: "border-black/10 dark:border-white/10 border-l-4 border-l-black/25 dark:border-l-white/25",    bg: "bg-black/[0.03] dark:bg-white/[0.025]",  label: "Info"      },
  error:   { iconEl: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,            iconClass: "text-black/60 dark:text-white/60",    titleClass: "text-black/80 dark:text-white/80",    border: "border-black/15 dark:border-white/15 border-l-4 border-l-black/40 dark:border-l-white/40",    bg: "bg-black/[0.05] dark:bg-white/[0.045]",  label: "Error"     },
};

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
nextjs-portal{pointer-events:none!important}

/* ─ reset inside devtools ─ */
.dt,.dt *{box-sizing:border-box;-webkit-font-smoothing:antialiased}
.dt button,.dt input,.dt select,.dt textarea{font-family:inherit}

/* ─ trigger ─ */
.dt-trigger{
  position:fixed;left:16px;bottom:16px;z-index:2147483000;
  height:34px;padding:0 13px 0 10px;
  border:1px solid rgba(255,255,255,0.13);border-radius:999px;
  background:rgba(12,12,16,0.93);color:#fff;
  box-shadow:0 8px 28px rgba(0,0,0,0.45);backdrop-filter:blur(16px);
  display:inline-flex;align-items:center;gap:7px;
  font-size:12px;font-weight:700;cursor:pointer;
  transition:transform .12s,box-shadow .12s;
}
.dt-trigger:hover{transform:translateY(-1px);box-shadow:0 12px 36px rgba(0,0,0,0.55)}
.dt-dot{
  width:7px;height:7px;border-radius:50%;
  background:var(--color-fd-primary,#6366f1);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--color-fd-primary,#6366f1) 22%,transparent);
  animation:dtpulse 2.4s ease-in-out infinite;
}
@keyframes dtpulse{0%,100%{opacity:1}50%{opacity:.45}}

/* ─ toolbar ─ */
.dt-bar{
  position:fixed;top:0;left:0;right:0;height:50px;z-index:2147483002;
  border-bottom:1px solid rgba(255,255,255,0.07);
  background:rgba(9,9,13,0.95);backdrop-filter:blur(20px);
  display:flex;align-items:center;gap:0;pointer-events:auto;
}
.dt-bar-logo{
  display:flex;align-items:center;gap:8px;
  padding:0 14px;height:100%;
  border-right:1px solid rgba(255,255,255,0.07);flex-shrink:0;
}
.dt-bar-emblem{
  width:22px;height:22px;border-radius:5px;
  background:linear-gradient(135deg,#6366f1,#8b5cf6);
  display:grid;place-items:center;font-size:10px;font-weight:900;color:#fff;
}
.dt-bar-wordmark{font-size:12.5px;font-weight:750;color:#fff;white-space:nowrap}
.dt-bar-file{
  flex:1;min-width:0;padding:0 14px;
  display:flex;flex-direction:column;gap:1px;
}
.dt-bar-path{font-size:11.5px;color:rgba(255,255,255,0.45);font-family:ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dt-bar-status{font-size:10.5px;color:rgba(255,255,255,0.28);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dt-bar-actions{
  display:flex;align-items:center;gap:5px;
  padding:0 10px;height:100%;
  border-left:1px solid rgba(255,255,255,0.07);flex-shrink:0;
}

/* ─ toolbar buttons ─ */
.dt-btn{
  height:28px;padding:0 10px;
  border:1px solid rgba(255,255,255,0.11);border-radius:6px;
  background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.8);
  font-size:11.5px;font-weight:650;cursor:pointer;
  display:inline-flex;align-items:center;gap:5px;
  transition:border-color .12s,background .12s,color .12s;white-space:nowrap;
}
.dt-btn:hover{border-color:rgba(255,255,255,0.22);background:rgba(255,255,255,0.11);color:#fff}
.dt-btn:disabled{opacity:.32;cursor:not-allowed}
.dt-btn[data-primary]{background:var(--color-fd-primary,#6366f1);border-color:var(--color-fd-primary,#6366f1);color:#fff}
.dt-btn[data-primary]:hover{filter:brightness(1.1)}
.dt-btn[data-active]{background:rgba(255,255,255,0.13);border-color:rgba(255,255,255,0.2);color:#fff}
.dt-btn-sep{width:1px;height:18px;background:rgba(255,255,255,0.08);margin:0 2px;flex-shrink:0}

/* ─ theme popover ─ */
.dt-theme-pop{
  position:fixed;top:54px;right:10px;z-index:2147483003;
  width:220px;
  border:1px solid rgba(255,255,255,0.1);border-radius:10px;
  background:rgba(10,10,14,0.97);backdrop-filter:blur(20px);
  padding:6px;
  box-shadow:0 16px 48px rgba(0,0,0,0.55);
}
.dt-theme-item{
  display:flex;align-items:center;gap:9px;
  padding:7px 9px;border-radius:7px;cursor:pointer;
  transition:background .1s;
}
.dt-theme-item:hover{background:rgba(255,255,255,0.07)}
.dt-theme-item[data-active]{background:rgba(255,255,255,0.1)}
.dt-theme-dots{display:flex;gap:3px;flex-shrink:0}
.dt-theme-dot{width:10px;height:10px;border-radius:50%}
.dt-theme-name{font-size:12px;font-weight:600;color:rgba(255,255,255,0.8);flex:1}
.dt-theme-tick{color:#6366f1;font-size:12px;flex-shrink:0}

/* ─ article editing mode — only outlines, zero layout change ─ */
/* Uses html attribute (not article attribute) to avoid React reconciliation mismatch */
html[data-docs-devtools-open="true"] [data-dt-content] > *:not([data-dt-ui]){
  cursor:pointer;
  outline:2px dashed transparent;
  outline-offset:5px;
  transition:outline-color .12s;
}
html[data-docs-devtools-open="true"] [data-dt-content] > *:not([data-dt-ui]):hover{
  outline-color:color-mix(in srgb,var(--color-fd-primary,#6366f1) 38%,transparent);
}

/* ─ inline mini toolbar (appears above heading / paragraph editors) ─ */
.dt-inline-toolbar{
  position:fixed;z-index:2147483002;
  display:inline-flex;align-items:center;gap:2px;
  background:rgba(9,9,13,0.94);backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,0.1);border-radius:8px;
  padding:3px 5px;box-shadow:0 8px 24px rgba(0,0,0,0.4);
}
.dt-inline-toolbar-group{display:inline-flex;align-items:center;gap:2px}
.dt-inline-tb-btn{
  min-width:22px;height:22px;padding:0 5px;
  border:none;background:transparent;color:rgba(255,255,255,0.75);
  font-size:11px;font-weight:700;cursor:pointer;
  display:grid;place-items:center;border-radius:5px;
  transition:color .1s,background .1s;
}
.dt-inline-tb-btn:hover{color:#fff;background:rgba(255,255,255,0.1)}
.dt-inline-tb-btn:disabled{opacity:.25;cursor:not-allowed}
.dt-inline-tb-btn[data-active]{background:var(--color-fd-primary,#6366f1);color:#fff}
.dt-inline-tb-btn[data-danger]:hover{color:#ef4444;background:rgba(239,68,68,0.12)}
.dt-inline-tb-sep{width:1px;height:14px;background:rgba(255,255,255,0.1);margin:0 2px;flex-shrink:0}

/* ─ sidebar editing mode ─ */
html[data-docs-devtools-open="true"] #nd-sidebar a{
  cursor:pointer;
  position:relative;
}
html[data-docs-devtools-open="true"] #nd-sidebar a::after{
  content:"✎";
  position:absolute;
  right:4px;
  top:50%;
  transform:translateY(-50%);
  font-size:10px;
  opacity:0;
  transition:opacity .1s;
  color:var(--color-fd-primary,#6366f1);
}
html[data-docs-devtools-open="true"] #nd-sidebar a:hover::after{
  opacity:0.5;
}
/* Active block highlight rendered as a React-controlled fixed overlay (no DOM mutation) */
.dt-active-highlight{
  position:fixed;pointer-events:none;z-index:2147483000;
  outline:2px dashed var(--color-fd-primary,#6366f1);
  outline-offset:5px;border-radius:3px;
}

/* Inline editor overlay — sits over the original block for direct text editing */
.dt-inline-cover{
  position:fixed;z-index:2147483001;
  background:var(--color-fd-background,#fff);
  box-sizing:border-box;
}
.dt-inline-input,.dt-inline-ta{
  display:block;width:100%;background:transparent;
  border:none;outline:none;resize:none;
  padding:0;margin:0;
  font:inherit;color:inherit;
}
/* WYSIWYG inline formatting inside the paragraph overlay */
.dt-inline-cover strong{font-weight:bold}
.dt-inline-cover em{font-style:italic}
.dt-inline-cover code{
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
  font-size:0.875em;
  background:rgba(0,0,0,0.07);
  padding:0.1em 0.3em;border-radius:3px;
}
/* Remove figure margin when CodeRenderer is placed inside the inline cover */
.dt-inline-cover .dt-code-fig{margin:0!important}

/* ─ floating block editor (appears near clicked block) ─ */
.dt-float-editor{
  position:fixed;z-index:2147483003;
  background:var(--color-fd-background,#fff);
  border:1.5px solid var(--color-fd-border,#e2e8f0);
  border-radius:12px;
  box-shadow:0 16px 48px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.06);
  width:min(480px,90vw);
  max-height:72vh;
  overflow-y:auto;
  display:flex;flex-direction:column;
}
.dt-float-editor-hdr{
  display:flex;align-items:center;gap:3px;
  padding:8px 10px 6px;
  border-bottom:1px solid var(--color-fd-border,#e2e8f0);
  flex-shrink:0;
  position:sticky;top:0;
  background:var(--color-fd-background,#fff);
  z-index:1;
}
.dt-float-editor-type{
  font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;
  display:inline-flex;align-items:center;gap:3px;flex-shrink:0;
}
.dt-float-editor-body{padding:12px 14px}

/* ─ separator ─ */
.dt-float-sep{width:1px;height:14px;background:var(--color-fd-border,#e2e8f0);margin:0 2px;flex-shrink:0}

/* ─ float action button ─ */
.dt-float-btn{
  width:24px;height:22px;border:none;background:transparent;
  color:var(--color-fd-muted-foreground,#64748b);cursor:pointer;
  display:grid;place-items:center;border-radius:5px;
  transition:color .1s,background .1s;
}
.dt-float-btn:hover{color:var(--color-fd-foreground,#0f172a);background:var(--color-fd-muted,#f1f5f9)}
.dt-float-btn:disabled{opacity:.25;cursor:not-allowed}
.dt-float-btn[data-danger]:hover{color:#ef4444;background:rgba(239,68,68,0.08)}

/* ─ insert (+) button ─ */
.dt-insert-btn{
  width:20px;height:20px;border-radius:50%;
  border:1.5px solid var(--color-fd-border,#e2e8f0);
  background:var(--color-fd-background,#fff);
  color:var(--color-fd-muted-foreground,#94a3b8);
  cursor:pointer;
  display:grid;place-items:center;
  transition:border-color .12s,color .12s,transform .12s,box-shadow .12s;
}
.dt-insert-btn:hover{
  border-color:var(--color-fd-primary,#6366f1);
  color:var(--color-fd-primary,#6366f1);
  transform:scale(1.15);
  box-shadow:0 0 0 4px color-mix(in srgb,var(--color-fd-primary,#6366f1) 12%,transparent);
}

/* ─ insert menu palette ─ */
.dt-palette{
  position:fixed;z-index:2147483004;
  width:260px;
  border:1px solid var(--color-fd-border,#e2e8f0);
  border-radius:10px;
  background:var(--color-fd-background,#fff);
  box-shadow:0 12px 40px rgba(0,0,0,0.15);
  padding:6px;overflow:hidden;
}
.dt-palette-title{
  font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;
  color:var(--color-fd-muted-foreground,#64748b);
  padding:4px 8px 6px;
}
.dt-palette-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px}
.dt-palette-item{
  display:flex;align-items:center;gap:8px;
  padding:8px 9px;border-radius:7px;
  cursor:pointer;border:none;background:transparent;text-align:left;
  transition:background .1s;width:100%;
}
.dt-palette-item:hover{background:var(--color-fd-muted,#f1f5f9)}
.dt-palette-icon{
  width:26px;height:26px;border-radius:6px;
  display:grid;place-items:center;font-size:11px;font-weight:900;
  flex-shrink:0;
}
.dt-palette-label{font-size:11.5px;font-weight:650;color:var(--color-fd-foreground,#0f172a);line-height:1.2}
.dt-palette-desc{font-size:10px;color:var(--color-fd-muted-foreground,#64748b);margin-top:1px}

/* ─ contenteditable prose ─ */
.dt-editable{
  outline:none;white-space:pre-wrap;overflow-wrap:anywhere;
  caret-color:var(--color-fd-primary,#6366f1);
  margin:0;
}
.dt-editable:empty::before{
  content:attr(data-ph);
  color:color-mix(in srgb,var(--color-fd-muted-foreground,#94a3b8) 55%,transparent);
  pointer-events:none;
}
.dt-editable::selection{background:color-mix(in srgb,var(--color-fd-primary,#6366f1) 20%,transparent)}

/* ─ formatting mini-bar ─ */
.dt-fmt-bar{
  display:flex;gap:2px;margin-bottom:5px;
  opacity:0;transition:opacity .13s;height:0;overflow:hidden;
  pointer-events:none;
}
.dt-float-editor-body .dt-fmt-bar{opacity:1;height:auto;pointer-events:auto}
.dt-fmt-btn{
  height:21px;padding:0 7px;
  border:1px solid var(--color-fd-border,#e2e8f0);border-radius:4px;
  background:transparent;color:var(--color-fd-muted-foreground,#64748b);
  font-size:11px;font-weight:700;cursor:pointer;
  transition:color .1s,border-color .1s,background .1s;
}
.dt-fmt-btn:hover{
  color:var(--color-fd-foreground,#0f172a);
  border-color:var(--color-fd-primary,#6366f1);
  background:color-mix(in srgb,var(--color-fd-primary,#6366f1) 6%,transparent);
}

/* ─ heading level row ─ */
.dt-level-row{display:flex;gap:3px;margin-bottom:6px;opacity:0;transition:opacity .13s;pointer-events:none;height:0;overflow:hidden}
.dt-float-editor-body .dt-level-row{opacity:1;pointer-events:auto;height:auto}
.dt-level-btn{
  width:26px;height:21px;border-radius:4px;
  border:1px solid var(--color-fd-border,#e2e8f0);
  background:transparent;color:var(--color-fd-muted-foreground,#64748b);
  font-size:10px;font-weight:800;cursor:pointer;
  display:grid;place-items:center;
  transition:color .1s,background .1s,border-color .1s;
}
.dt-level-btn:hover,.dt-level-btn[data-active]{
  color:var(--color-fd-primary,#6366f1);
  border-color:var(--color-fd-primary,#6366f1);
  background:color-mix(in srgb,var(--color-fd-primary,#6366f1) 8%,transparent);
}

/* ─ callout variant selector ─ */
.dt-variant-row{display:flex;gap:3px;margin-bottom:7px;opacity:0;pointer-events:none;height:0;overflow:hidden;transition:opacity .13s}
.dt-float-editor-body .dt-variant-row{opacity:1;pointer-events:auto;height:auto}
.dt-variant-btn{
  height:20px;padding:0 7px;border-radius:4px;
  border:1px solid var(--color-fd-border,#e2e8f0);
  background:transparent;color:var(--color-fd-muted-foreground,#64748b);
  font-size:10px;font-weight:700;cursor:pointer;
  transition:color .1s,background .1s,border-color .1s;
}
.dt-variant-btn[data-active],.dt-variant-btn:hover{
  color:var(--color-fd-foreground,#0f172a);
  border-color:var(--color-fd-border,#e2e8f0);
  background:var(--color-fd-muted,#f1f5f9);
}

/* ─ hoverlink (inline dashed-link + hover metadata panel) ─ */
.dt-hl-trigger{
  display:inline;border:none;background:transparent;padding:0;margin:0;
  color:var(--color-fd-foreground,currentColor);cursor:text;
  text-decoration:underline;text-decoration-style:dashed;
  text-decoration-thickness:0.08em;text-underline-offset:0.22em;
  text-decoration-color:color-mix(in srgb,var(--color-fd-foreground,currentColor) 46%,transparent);
  font:inherit;line-height:inherit;appearance:none;
}
.dt-hl-meta{
  display:none;flex-direction:column;gap:4px;
  margin-top:8px;padding:7px 10px;
  border-radius:6px;border:1px solid var(--color-fd-border,#e2e8f0);
  background:var(--color-fd-muted,#f1f5f9);
}
.dt-float-editor-body .dt-hl-meta{display:flex}
.dt-hl-row{display:flex;align-items:center;gap:7px}
.dt-hl-lbl{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--color-fd-muted-foreground,#64748b);width:52px;flex-shrink:0}
.dt-hl-inp{background:transparent;border:none;outline:none;font-size:11.5px;color:var(--color-fd-foreground,#0f172a);flex:1;font-family:inherit}

/* ─ prompt (uses fd-prompt classes from base.css, just override editable inputs) ─ */
.fd-prompt input.fd-prompt-title-edit,.fd-prompt textarea.fd-prompt-body-edit{
  background:transparent;border:none;outline:none;font:inherit;color:inherit;
  width:100%;resize:none;padding:0;margin:0;
}

/* ─ raw block ─ */
.dt-raw-shell{
  border-radius:8px;
  border:1.5px dashed color-mix(in srgb,var(--color-fd-border,#e2e8f0) 80%,transparent);
  padding:10px 12px;
  background:color-mix(in srgb,var(--color-fd-muted,#f1f5f9) 40%,transparent);
}

/* ─ code block (matches fumadocs CodeBlock <figure>) ─ */
.dt-code-fig{
  margin:1rem 0;
  background:var(--color-fd-card,#f8fafc);
  border-radius:0.75rem;
  border:1px solid var(--color-fd-border,#e2e8f0);
  box-shadow:0 1px 2px rgba(0,0,0,0.06);
  overflow:hidden;
  font-size:0.875rem;
  position:relative;
}
.dt-code-hdr{
  display:flex;align-items:center;gap:0.5rem;
  height:2.375rem;
  border-bottom:1px solid var(--color-fd-border,#e2e8f0);
  padding:0 1rem;
  color:var(--color-fd-muted-foreground,#64748b);
}
.dt-code-lang{
  background:transparent;border:none;outline:none;
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
  font-size:0.75rem;font-weight:600;
  color:var(--color-fd-muted-foreground,#64748b);
  width:52px;flex-shrink:0;
}
.dt-code-sep-v{width:1px;height:0.75rem;background:var(--color-fd-border,#e2e8f0);flex-shrink:0}
.dt-code-file{
  background:transparent;border:none;outline:none;
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
  font-size:0.75rem;
  color:var(--color-fd-muted-foreground,#64748b);
  flex:1;min-width:0;
}
.dt-code-body{padding:1rem}
.dt-code-fig figcaption{margin-top:0!important;font-size:inherit!important;color:inherit!important;line-height:inherit!important}
.dt-code-ta{
  width:100%;min-height:80px;resize:vertical;
  background:transparent;border:none;outline:none;
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
  font-size:0.875rem;line-height:1.65;
  color:var(--color-fd-foreground,#0f172a);
  display:block;
}

/* ─ source textarea ─ */
.dt-source-ta{
  width:100%;min-height:200px;
  border:1px solid var(--color-fd-border,#e2e8f0);border-radius:9px;
  padding:16px;outline:none;resize:vertical;
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
  font-size:13px;line-height:1.65;
  background:color-mix(in srgb,var(--color-fd-muted,#f1f5f9) 50%,var(--color-fd-background,#fff));
  color:var(--color-fd-foreground,#0f172a);
}

/* ─ empty state ─ */
.dt-empty{
  padding:32px 24px;text-align:center;
  border:1.5px dashed color-mix(in srgb,var(--color-fd-border,#e2e8f0) 70%,transparent);
  border-radius:12px;
}
.dt-empty-title{font-size:14px;font-weight:700;color:var(--color-fd-muted-foreground,#64748b);margin-bottom:4px}
.dt-empty-sub{font-size:12px;color:color-mix(in srgb,var(--color-fd-muted-foreground,#94a3b8) 75%,transparent)}

@media(max-width:780px){
  .dt-bar-wordmark{display:none}
  .dt-btn span{display:none}
}

/* ─ selection toolbar (shows above selected text in any contentEditable) ─ */
.dt-sel-toolbar{
  position:fixed;z-index:2147483010;
  display:inline-flex;align-items:center;gap:1px;
  background:rgba(9,9,13,0.97);backdrop-filter:blur(18px);
  border:1px solid rgba(255,255,255,0.14);border-radius:9px;
  padding:3px 5px;
  box-shadow:0 6px 24px rgba(0,0,0,0.55);
  transform:translateX(-50%);
  pointer-events:auto;
  white-space:nowrap;
}
/* small arrow pointing down */
.dt-sel-toolbar::after{
  content:"";
  position:absolute;top:100%;left:50%;transform:translateX(-50%);
  border:5px solid transparent;
  border-top-color:rgba(9,9,13,0.97);
}
.dt-sel-btn{
  height:26px;padding:0 8px;
  border:none;background:transparent;color:rgba(255,255,255,0.82);
  font-size:12.5px;font-weight:700;cursor:pointer;
  border-radius:6px;
  display:inline-flex;align-items:center;gap:3px;
  transition:color .1s,background .1s;
  font-family:inherit;
}
.dt-sel-btn:hover{color:#fff;background:rgba(255,255,255,0.13)}
.dt-sel-btn[data-active]{background:var(--color-fd-primary,#6366f1);color:#fff}
.dt-sel-sep{width:1px;height:15px;background:rgba(255,255,255,0.14);margin:0 3px;flex-shrink:0}
`;


// ─── ContentEditable helper ───────────────────────────────────────────────────

function getEditText(el: HTMLElement) { return el.innerText.replace(/\n\n$/g, "").replace(/ /g, " "); }

function getEditSel(el: HTMLElement, fallback: number): { start: number; end: number } {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { start: fallback, end: fallback };
  if (!el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) return { start: fallback, end: fallback };
  const range = sel.getRangeAt(0);
  const before = range.cloneRange(); before.selectNodeContents(el); before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return { start, end: start + range.toString().length };
}

function setEditSel(el: HTMLElement, start: number, end: number) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let offset = 0; let sn: Text | null = null; let en: Text | null = null; let so = 0; let eo = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const len = (node.textContent ?? "").length; const next = offset + len;
    if (!sn && start <= next) { sn = node; so = Math.max(0, start - offset); }
    if (!en && end <= next) { en = node; eo = Math.max(0, end - offset); break; }
    offset = next; node = walker.nextNode() as Text | null;
  }
  if (!sn || !en) return;
  const range = document.createRange(); range.setStart(sn, so); range.setEnd(en, eo);
  const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range);
}

// ─── ProseEditor (contentEditable with formatting) ────────────────────────────

function ProseEditor({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const ref = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (getEditText(el) !== value) el.innerText = value;
  }, [value]);

  function fmt(before: string, after: string, fallback: string) {
    const el = ref.current; if (!el) return;
    const cur = getEditText(el); const sel = getEditSel(el, cur.length);
    const selected = cur.slice(sel.start, sel.end) || fallback;
    onChange(`${cur.slice(0, sel.start)}${before}${selected}${after}${cur.slice(sel.end)}`);
    requestAnimationFrame(() => { el.focus(); setEditSel(el, sel.start + before.length, sel.start + before.length + selected.length); });
  }

  return (
    <div>
      <div className="dt-fmt-bar" aria-label="Markdown formatting">
        {([["B","**","**","bold"],["I","_","_","italic"],["`","`","`","code"],["↗","[","](url)","link"],["—","- ","","item"]] as const).map(([label, b, a, f]) => (
          <button key={label} type="button" className="dt-fmt-btn" onMouseDown={e => { e.preventDefault(); fmt(b, a, f); }}>{label}</button>
        ))}
      </div>
      <p
        ref={ref}
        className="dt-editable"
        contentEditable suppressContentEditableWarning
        data-ph={placeholder}
        onInput={e => onChange(getEditText(e.currentTarget))}
        onPaste={e => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); }}
      >{value}</p>
    </div>
  );
}

// ─── md2html / html2md (minimal inline markdown → HTML conversion) ───────────

function md2html(md: string): string {
  // 1. Escape bare HTML entities so literal < > don't become tags
  let s = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // 2. Inline markdown patterns → HTML
  s = s
    .replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>")
    .replace(/__(.+?)__/gs,     "<strong>$1</strong>")
    .replace(/\*(.+?)\*/gs,     "<em>$1</em>")
    .replace(/_(.+?)_/gs,       "<em>$1</em>")
    .replace(/`(.+?)`/g,        "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // 3. Newlines → <br> so the contentEditable shows line breaks
  s = s.replace(/\n/g, "<br>");
  return s;
}

function html2md(html: string): string {
  return html
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi,           "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi,         "_$1_")
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi,           "_$1_")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi,     "`$1`")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<div>/gi, "\n").replace(/<\/div>/gi, "")
    .replace(/<p>/gi,   "").replace(/<\/p>/gi,   "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .trim();
}

// ─── WYSIWYG Paragraph Editor (contentEditable, renders bold/italic/code) ────

function WysiwygParagraphEditor({ initialContent, style, onChange, onClose }: {
  initialContent: string;
  style: React.CSSProperties;
  onChange: (md: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLParagraphElement | null>(null);

  // Set innerHTML only on mount — never overwrite while the user types
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = md2html(initialContent);
    el.focus();
    // Move caret to end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <p
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      style={{ ...style, outline: "none", minHeight: "1em", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      onInput={e => onChange(html2md(e.currentTarget.innerHTML))}
      onPaste={e => {
        e.preventDefault();
        // Paste as plain text to avoid pasting HTML tags
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
      onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }}
    />
  );
}

// ─── Inline-editable input ────────────────────────────────────────────────────

function InlineInput({ value, onChange, className, placeholder, style }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      className={className}
      value={value}
      onChange={e => onChange(e.currentTarget.value)}
      placeholder={placeholder}
      style={style}
    />
  );
}

// ─── Block renderer components ────────────────────────────────────────────────

function HeadingRenderer({ block, onChange }: { block: Extract<MdxBlock, { type: "heading" }>; onChange: (b: MdxBlock) => void }) {
  const level = Math.min(6, Math.max(1, block.level));
  const hRef = (el: HTMLHeadingElement | null) => { if (el && document.activeElement !== el && el.innerText !== block.text) el.innerText = block.text; };
  const hProps = {
    className: "dt-editable",
    contentEditable: true as const,
    suppressContentEditableWarning: true,
    "data-ph": `Heading ${level}`,
    onInput: (e: React.FormEvent<HTMLHeadingElement>) => onChange({ ...block, text: getEditText(e.currentTarget) }),
    onPaste: (e: React.ClipboardEvent<HTMLHeadingElement>) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); },
  };
  return (
    <div>
      <div className="dt-level-row" aria-label="Heading level">
        {[1,2,3,4,5,6].map(l => (
          <button key={l} type="button" className="dt-level-btn" data-active={level === l ? "" : undefined} onClick={() => onChange({ ...block, level: l })}>
            H{l}
          </button>
        ))}
      </div>
      {level === 1 && <h1 ref={hRef} {...hProps} />}
      {level === 2 && <h2 ref={hRef} {...hProps} />}
      {level === 3 && <h3 ref={hRef} {...hProps} />}
      {level === 4 && <h4 ref={hRef} {...hProps} />}
      {level === 5 && <h5 ref={hRef} {...hProps} />}
      {level === 6 && <h6 ref={hRef} {...hProps} />}
    </div>
  );
}

function ParagraphRenderer({ block, onChange }: { block: Extract<MdxBlock, { type: "paragraph" }>; onChange: (b: MdxBlock) => void }) {
  return <ProseEditor value={block.content} onChange={content => onChange({ ...block, content })} placeholder="Write a paragraph…" />;
}

function CalloutRenderer({ block, onChange }: { block: Extract<MdxBlock, { type: "callout" }>; onChange: (b: MdxBlock) => void }) {
  const v = CALLOUT_VARIANTS[block.variant] ?? CALLOUT_VARIANTS.note!;
  const Icon = v.iconEl;
  const primaryVariants = ["note", "warning", "tip", "important", "caution"] as const;
  return (
    <div>
      {/* Variant selector — hidden by default, shows on block hover */}
      <div className="dt-variant-row" aria-label="Callout variant">
        {primaryVariants.map(k => {
          const cv = CALLOUT_VARIANTS[k]!;
          return (
            <button key={k} type="button" className="dt-variant-btn"
              data-active={block.variant === k ? "" : undefined}
              onClick={() => onChange({ ...block, variant: k })}>
              {cv.label}
            </button>
          );
        })}
      </div>

      {/* Exact same structure as website/components/ui/callout.tsx */}
      <div
        role="note"
        className={`callout-custom my-4 flex gap-0 overflow-x-hidden rounded-none border p-4 font-mono ${v.border} ${v.bg}`}
        style={{ fontSize: "9px" }}
      >
        <div className={`shrink-0 -mt-1 ${v.iconClass}`} aria-hidden="true">
          <Icon />
        </div>
        <div className="min-w-0 -mt-6 ml-2 flex-1 space-y-1">
          <input
            className={`font-mono uppercase tracking-tight bg-transparent border-none outline-none w-full p-0 ${v.titleClass}`}
            style={{ fontSize: "9px" }}
            value={block.title}
            onChange={e => onChange({ ...block, title: e.currentTarget.value })}
            placeholder="Optional title…"
          />
          <div className="h-px w-[calc(100%+10rem)] -mt-2 mx-auto ml-[-5rem] bg-black/10 dark:bg-white/10" />
          <div className="text-black/80 pt-2 font-sans dark:text-white/80 [&>p:last-child]:mb-0 [&>p]:my-0">
            <ProseEditor value={block.content} onChange={content => onChange({ ...block, content })} placeholder="Callout body…" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeRenderer({ block, onChange }: { block: Extract<MdxBlock, { type: "code" }>; onChange: (b: MdxBlock) => void }) {
  return (
    <figure className="dt-code-fig not-prose">
      <div className="dt-code-hdr">
        <input
          className="dt-code-lang"
          value={block.language}
          onChange={e => onChange({ ...block, language: e.currentTarget.value })}
          placeholder="ts"
        />
        <div className="dt-code-sep-v" />
        <figcaption style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <input
            className="dt-code-file"
            value={block.title}
            onChange={e => onChange({ ...block, title: e.currentTarget.value })}
            placeholder="filename.ts"
          />
        </figcaption>
      </div>
      <div className="dt-code-body">
        <textarea
          className="dt-code-ta"
          value={block.code}
          onChange={e => onChange({ ...block, code: e.currentTarget.value })}
          spellCheck={false}
          rows={Math.max(4, block.code.split("\n").length + 1)}
        />
      </div>
    </figure>
  );
}

function TabsRenderer({ block, onChange }: { block: Extract<MdxBlock, { type: "tabs" }>; onChange: (b: MdxBlock) => void }) {
  const [activeTab, setActiveTab] = useState(0);
  const tab = block.tabs[activeTab] ?? block.tabs[0];

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-fd-secondary my-4 not-prose">
      <div className="flex items-center overflow-x-auto border-b px-1">
        {block.tabs.map((t, i) => (
          <div
            key={i}
            className={`flex items-center gap-1 px-3 h-9 cursor-pointer shrink-0 border-b-2 transition-colors ${activeTab === i ? "border-fd-primary text-fd-foreground" : "border-transparent text-fd-muted-foreground"}`}
            style={{ marginBottom: "-1px" }}
            onClick={() => setActiveTab(i)}
          >
            <input
              className="bg-transparent border-none outline-none text-xs font-medium cursor-text"
              value={t.label}
              onClick={e => { e.stopPropagation(); setActiveTab(i); }}
              onChange={e => {
                const tabs = [...block.tabs];
                tabs[i] = { ...t, label: e.currentTarget.value };
                onChange({ ...block, tabs });
              }}
              style={{ width: `${Math.max(30, t.label.length * 7.5)}px` }}
            />
            <button
              type="button"
              className="w-4 h-4 rounded flex items-center justify-center text-xs text-fd-muted-foreground hover:text-red-500"
              onClick={e => { e.stopPropagation(); const tabs = block.tabs.filter((_, idx) => idx !== i); onChange({ ...block, tabs }); if (activeTab >= tabs.length) setActiveTab(Math.max(0, tabs.length - 1)); }}
            >×</button>
          </div>
        ))}
        <button
          type="button"
          className="h-7 px-2 mx-1 my-1 text-xs text-fd-muted-foreground border border-dashed border-fd-border rounded shrink-0 hover:border-fd-primary hover:text-fd-primary transition-colors"
          onClick={() => { const tabs = [...block.tabs, { label: "New", content: "Content" }]; onChange({ ...block, tabs }); setActiveTab(tabs.length - 1); }}
        >+ Add</button>
      </div>
      {tab && (
        <div className="p-4 prose">
          <ProseEditor
            key={activeTab}
            value={tab.content}
            onChange={content => { const tabs = [...block.tabs]; tabs[activeTab] = { ...tab, content }; onChange({ ...block, tabs }); }}
            placeholder="Tab content…"
          />
        </div>
      )}
    </div>
  );
}

function HoverLinkRenderer({ block, onChange }: { block: Extract<MdxBlock, { type: "hoverlink" }>; onChange: (b: MdxBlock) => void }) {
  return (
    <div>
      {/* Looks like the actual rendered HoverLink — an inline dashed-underline link */}
      <p style={{ margin: 0 }}>
        <input
          className="dt-hl-trigger"
          value={block.label}
          onChange={e => onChange({ ...block, label: e.currentTarget.value })}
          placeholder="Link label text…"
          style={{ width: `${Math.max(120, block.label.length * 8)}px` }}
        />
      </p>
      {/* Metadata fields — hidden by default, slide in on hover via dt-hl-meta CSS */}
      <div className="dt-hl-meta">
        <div className="dt-hl-row">
          <span className="dt-hl-lbl">href</span>
          <input className="dt-hl-inp" value={block.href} onChange={e => onChange({ ...block, href: e.currentTarget.value })} placeholder="/docs/page" />
        </div>
        <div className="dt-hl-row">
          <span className="dt-hl-lbl">title</span>
          <input className="dt-hl-inp" value={block.title} onChange={e => onChange({ ...block, title: e.currentTarget.value })} placeholder="Hover card title" />
        </div>
        <div className="dt-hl-row">
          <span className="dt-hl-lbl">desc</span>
          <input className="dt-hl-inp" value={block.description} onChange={e => onChange({ ...block, description: e.currentTarget.value })} placeholder="Hover card description" />
        </div>
      </div>
    </div>
  );
}

function PromptRenderer({ block, onChange }: { block: Extract<MdxBlock, { type: "prompt" }>; onChange: (b: MdxBlock) => void }) {
  return (
    // Uses the real fd-prompt CSS classes from packages/fumadocs/styles/base.css
    <div className="fd-prompt not-prose">
      <div className="fd-prompt-header">
        <div className="fd-prompt-copy">
          <input
            className="fd-prompt-title"
            style={{ background: "transparent", border: "none", outline: "none", width: "100%", padding: 0, margin: 0, font: "inherit", color: "inherit" }}
            value={block.title}
            onChange={e => onChange({ ...block, title: e.currentTarget.value })}
            placeholder="Prompt title…"
          />
        </div>
      </div>
      <div className="fd-prompt-body">
        <textarea
          className="fd-prompt-code"
          style={{ width: "100%", resize: "vertical", background: "transparent", border: "none", outline: "none", font: "inherit", color: "inherit", padding: 0 }}
          value={block.content}
          onChange={e => onChange({ ...block, content: e.currentTarget.value })}
          rows={Math.max(3, block.content.split("\n").length + 1)}
          placeholder="Prompt text…"
          spellCheck={false}
        />
      </div>
      <div className="fd-prompt-actions" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="fd-prompt-action-btn" style={{ pointerEvents: "none", opacity: 0.5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>Copy prompt</span>
        </button>
      </div>
    </div>
  );
}

function RawRenderer({ block, onChange }: { block: Extract<MdxBlock, { type: "raw" }>; onChange: (b: MdxBlock) => void }) {
  return (
    <div className="dt-raw-shell">
      <textarea
        className="dt-code-ta"
        value={block.content}
        onChange={e => onChange({ ...block, content: e.currentTarget.value })}
        spellCheck={false}
        rows={Math.max(2, block.content.split("\n").length)}
        placeholder="<CustomComponent />"
      />
    </div>
  );
}

function BlockContent({ block, onChange }: { block: MdxBlock; onChange: (b: MdxBlock) => void }) {
  if (block.type === "heading")   return <HeadingRenderer   block={block} onChange={onChange} />;
  if (block.type === "paragraph") return <ParagraphRenderer block={block} onChange={onChange} />;
  if (block.type === "callout")   return <CalloutRenderer   block={block} onChange={onChange} />;
  if (block.type === "code")      return <CodeRenderer      block={block} onChange={onChange} />;
  if (block.type === "tabs")      return <TabsRenderer      block={block} onChange={onChange} />;
  if (block.type === "hoverlink") return <HoverLinkRenderer block={block} onChange={onChange} />;
  if (block.type === "prompt")    return <PromptRenderer    block={block} onChange={onChange} />;
  if (block.type === "raw")       return <RawRenderer       block={block} onChange={onChange} />;
  return null;
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

function ChevUp() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>; }
function ChevDown() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>; }
function Trash() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>; }
function Copy() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>; }
function Plus() { return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }

// ─── Insert palette ───────────────────────────────────────────────────────────

function InsertPalette({ x, y, onInsert, onClose }: { x: number; y: number; onInsert: (t: MdxBlock["type"]) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    function keyHandler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", keyHandler); };
  }, [onClose]);

  const style: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 280),
    top: Math.min(y, window.innerHeight - 320),
  };

  return (
    <div ref={ref} className="dt-palette dt" style={style} role="menu" aria-label="Insert block">
      <div className="dt-palette-title">Insert block</div>
      <div className="dt-palette-grid">
        {BLOCK_CATALOGUE.map(({ type, label, icon, accent, desc }) => (
          <button key={type} type="button" className="dt-palette-item" role="menuitem"
            onClick={() => { onInsert(type); onClose(); }}>
            <div className="dt-palette-icon" style={{ background: `${accent}20`, color: accent }}>{icon}</div>
            <div>
              <div className="dt-palette-label">{label}</div>
              <div className="dt-palette-desc">{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Inline block editor (overlays directly on heading / paragraph blocks) ────

function InlineBlockEditor({ block, rect, el, onChange, onClose, onMove, onDuplicate, onDelete, index, total }: {
  block: Extract<MdxBlock, { type: "heading" | "paragraph" }>;
  rect: DOMRect;
  el: HTMLElement;
  onChange: (b: MdxBlock) => void;
  onClose: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  index: number;
  total: number;
}) {
  const cs = window.getComputedStyle(el);

  // Cover style: fixed, same bounding box, opaque background so original is hidden
  const cover: React.CSSProperties = {
    top:    rect.top,
    left:   rect.left,
    width:  rect.width,
    // grow with content, start at the element's natural height
    minHeight: rect.height,
    // Copy padding so text sits in the same position
    paddingTop:    cs.paddingTop    || 0,
    paddingBottom: cs.paddingBottom || 0,
    paddingLeft:   cs.paddingLeft   || 0,
    paddingRight:  cs.paddingRight  || 0,
  };

  // Shared text style cloned from the real element
  const text: React.CSSProperties = {
    fontSize:      cs.fontSize,
    fontWeight:    cs.fontWeight,
    lineHeight:    cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    fontFamily:    cs.fontFamily,
    color:         cs.color,
    textDecoration: "none",
    margin: 0,
    padding: 0,
  };

  // Mini action toolbar — appears above the cover
  const toolbarTop = Math.max(54, rect.top - 36);

  return createPortal(
    <>
      {/* Opaque cover that hides the original text and hosts the editor */}
      <div className="dt-inline-cover dt" style={cover}>
        {block.type === "heading" ? (
          <input
            autoFocus
            className="dt-inline-input"
            style={text}
            value={block.text}
            onChange={e => onChange({ ...block, text: e.target.value })}
            onKeyDown={e => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter") { e.preventDefault(); onClose(); }
            }}
          />
        ) : (
          <WysiwygParagraphEditor
            initialContent={block.content}
            style={{ ...text, minHeight: Math.max(rect.height, 48) }}
            onChange={content => onChange({ ...block, content } as MdxBlock)}
            onClose={onClose}
          />
        )}
      </div>

      {/* Mini toolbar above the block */}
      <div className="dt dt-inline-toolbar" style={{ top: toolbarTop, left: rect.left }}>
        {block.type === "heading" && (
          <span className="dt-inline-toolbar-group">
            {([1,2,3,4,5,6] as const).map(l => (
              <button key={l} type="button" className="dt-inline-tb-btn"
                data-active={block.level === l ? "" : undefined}
                onClick={() => onChange({ ...block, level: l })}>
                H{l}
              </button>
            ))}
            <span className="dt-inline-tb-sep" />
          </span>
        )}
        {block.type === "paragraph" && (
          <span className="dt-inline-toolbar-group">
            {([
              ["B", "bold",   () => document.execCommand("bold")],
              ["I", "italic", () => document.execCommand("italic")],
              ["`", "code",   () => {
                // Wrap selection in <code> via execCommand insertHTML, or surroundContents
                const sel = window.getSelection();
                if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
                const range = sel.getRangeAt(0);
                const code = document.createElement("code");
                try { range.surroundContents(code); } catch { document.execCommand("insertText", false, `\`${sel.toString()}\``); }
              }],
            ] as const).map(([lbl, title, fn]) => (
              <button key={lbl} type="button" className="dt-inline-tb-btn"
                title={title}
                onMouseDown={e => { e.preventDefault(); fn(); }}>
                {lbl}
              </button>
            ))}
            <span className="dt-inline-tb-sep" />
          </span>
        )}
        <button type="button" className="dt-inline-tb-btn" disabled={index === 0} onClick={() => onMove(-1)} title="Move up"><ChevUp /></button>
        <button type="button" className="dt-inline-tb-btn" disabled={index === total - 1} onClick={() => onMove(1)} title="Move down"><ChevDown /></button>
        <span className="dt-inline-tb-sep" />
        <button type="button" className="dt-inline-tb-btn" onClick={onDuplicate} title="Duplicate"><Copy /></button>
        <button type="button" className="dt-inline-tb-btn" data-danger="" onClick={() => { onDelete(); onClose(); }} title="Delete"><Trash /></button>
        <span className="dt-inline-tb-sep" />
        <button type="button" className="dt-inline-tb-btn" onClick={onClose} title="Done">✓</button>
      </div>
    </>,
    document.body
  );
}

// ─── Floating block editor (appears near the clicked block) ───────────────────

function FloatingBlockEditor({ block, rect, index, total, onClose, onChange, onMove, onDuplicate, onDelete, onInsertAfter }: {
  block: MdxBlock; rect: DOMRect; index: number; total: number;
  onClose: () => void; onChange: (b: MdxBlock) => void;
  onMove: (dir: -1 | 1) => void; onDuplicate: () => void; onDelete: () => void;
  onInsertAfter: (type: MdxBlock["type"]) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [palette, setPalette] = useState<{ x: number; y: number } | null>(null);
  const meta = BLOCK_CATALOGUE.find(b => b.type === block.type);

  // Position: prefer below the block, fall back to above
  const editorH = 420;
  const editorW = Math.min(480, window.innerWidth * 0.9);
  let top = rect.bottom + 10;
  if (top + editorH > window.innerHeight - 16) top = Math.max(16, rect.top - editorH - 10);
  let left = rect.left;
  if (left + editorW > window.innerWidth - 10) left = Math.max(10, window.innerWidth - editorW - 10);

  useEffect(() => {
    // Delay attaching the outside-click listener so the very click that opened
    // this editor doesn't immediately close it.
    const tid = window.setTimeout(() => {
      function outside(e: MouseEvent) {
        const t = e.target as HTMLElement;
        if (ref.current?.contains(t)) return;
        if (t.closest(".dt-palette")) return;
        onClose();
      }
      function key(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
      document.addEventListener("mousedown", outside);
      document.addEventListener("keydown", key);
      return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", key); };
    }, 120);
    return () => window.clearTimeout(tid);
  }, [onClose]);

  return createPortal(
    <div ref={ref} className="dt-float-editor dt" style={{ top, left }}>
      <div className="dt-float-editor-hdr">
        <span className="dt-float-editor-type" style={{ color: meta?.accent }}>{meta?.icon} {meta?.label ?? block.type}</span>
        <div style={{ flex: 1 }} />
        <button type="button" className="dt-float-btn" disabled={index === 0} onClick={() => onMove(-1)} title="Move up"><ChevUp /></button>
        <button type="button" className="dt-float-btn" disabled={index === total - 1} onClick={() => onMove(1)} title="Move down"><ChevDown /></button>
        <span className="dt-float-sep" />
        <button type="button" className="dt-float-btn" onClick={onDuplicate} title="Duplicate"><Copy /></button>
        <button type="button" className="dt-float-btn" data-danger="" onClick={() => { onDelete(); onClose(); }} title="Delete"><Trash /></button>
        <button type="button" className="dt-float-btn" title="Insert block after"
          onClick={() => { const r = ref.current?.getBoundingClientRect(); if (r) setPalette({ x: r.left, y: r.bottom + 4 }); }}>
          <Plus />
        </button>
        <span className="dt-float-sep" />
        <button type="button" className="dt-float-btn" onClick={onClose} title="Close" style={{ fontSize: 13 }}>✕</button>
      </div>
      <div className="dt-float-editor-body">
        <BlockContent block={block} onChange={onChange} />
      </div>
      {palette && createPortal(
        <InsertPalette x={palette.x} y={palette.y} onInsert={type => { onInsertAfter(type); setPalette(null); onClose(); }} onClose={() => setPalette(null)} />,
        document.body
      )}
    </div>,
    document.body
  );
}

// ─── SelectionToolbar ────────────────────────────────────────────────────────
// Global component — appears above any selected text inside a contentEditable
// within the devtools. Shows B / I / S / ` / Link formatting buttons.

function SelectionToolbar() {
  const [pos, setPos] = useState<{ top: number; centerX: number } | null>(null);

  useEffect(() => {
    function onSel() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setPos(null); return; }
      // Only activate when the selection is anchored inside a contentEditable
      const anchor = sel.anchorNode;
      const host = (
        anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor as Element | null
      )?.closest("[contenteditable]");
      if (!host) { setPos(null); return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (!r.width && !r.height) { setPos(null); return; }
      setPos({ top: r.top - 48, centerX: r.left + r.width / 2 });
    }
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  if (!pos) return null;

  const top  = Math.max(58, pos.top);
  const left = Math.max(60, Math.min((typeof window !== "undefined" ? window.innerWidth : 1200) - 200, pos.centerX));

  function fmt(cmd: string) { document.execCommand(cmd); }

  function wrapCode() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const code  = document.createElement("code");
    try { range.surroundContents(code); }
    catch { document.execCommand("insertText", false, `\`${sel.toString()}\``); }
  }

  function wrapLink() {
    const sel  = window.getSelection();
    const text = sel?.toString() ?? "";
    // eslint-disable-next-line no-alert
    const url  = window.prompt("Link URL:", "https://");
    if (!url) return;
    document.execCommand("insertHTML", false, `<a href="${url}">${text || url}</a>`);
  }

  return createPortal(
    <div className="dt dt-sel-toolbar" style={{ top, left }}>
      <button type="button" className="dt-sel-btn" title="Bold"
        onMouseDown={e => { e.preventDefault(); fmt("bold"); }}>
        <strong>B</strong>
      </button>
      <button type="button" className="dt-sel-btn" title="Italic"
        onMouseDown={e => { e.preventDefault(); fmt("italic"); }}>
        <em style={{ fontStyle: "italic" }}>I</em>
      </button>
      <button type="button" className="dt-sel-btn" title="Strikethrough"
        onMouseDown={e => { e.preventDefault(); fmt("strikeThrough"); }}>
        <s>S</s>
      </button>
      <div className="dt-sel-sep" />
      <button type="button" className="dt-sel-btn" title="Inline code"
        onMouseDown={e => { e.preventDefault(); wrapCode(); }}
        style={{ fontFamily: "ui-monospace,monospace", letterSpacing: 0 }}>
        {"</>"}
      </button>
      <button type="button" className="dt-sel-btn" title="Link"
        onMouseDown={e => { e.preventDefault(); wrapLink(); }}>
        ↗
      </button>
    </div>,
    document.body
  );
}

// ─── InlineCodeEditor ─────────────────────────────────────────────────────────
// Covers the clicked code block with an editable version of the same UI.

function InlineCodeEditor({ block, rect, onChange, onClose, onMove, onDuplicate, onDelete, index, total }: {
  block: Extract<MdxBlock, { type: "code" }>;
  rect: DOMRect;
  onChange: (b: MdxBlock) => void;
  onClose: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  index: number;
  total: number;
}) {
  const toolbarTop = Math.max(54, rect.top - 36);

  const cover: React.CSSProperties = {
    top:       rect.top,
    left:      rect.left,
    width:     rect.width,
    minHeight: rect.height,
  };

  return createPortal(
    <>
      {/* Opaque cover exactly over the code block */}
      <div className="dt-inline-cover dt" style={cover}>
        {/* Re-use the existing CodeRenderer — it renders an editable figure */}
        <div style={{ margin: 0 }}>
          <CodeRenderer block={block} onChange={onChange} />
        </div>
      </div>

      {/* Mini toolbar floating above */}
      <div className="dt dt-inline-toolbar" style={{ top: toolbarTop, left: rect.left }}>
        <button type="button" className="dt-inline-tb-btn" disabled={index === 0}
          onClick={() => onMove(-1)} title="Move up"><ChevUp /></button>
        <button type="button" className="dt-inline-tb-btn" disabled={index === total - 1}
          onClick={() => onMove(1)} title="Move down"><ChevDown /></button>
        <span className="dt-inline-tb-sep" />
        <button type="button" className="dt-inline-tb-btn" onClick={onDuplicate} title="Duplicate"><Copy /></button>
        <button type="button" className="dt-inline-tb-btn" data-danger=""
          onClick={() => { onDelete(); onClose(); }} title="Delete"><Trash /></button>
        <span className="dt-inline-tb-sep" />
        <button type="button" className="dt-inline-tb-btn" onClick={onClose} title="Done">✓</button>
      </div>
    </>,
    document.body
  );
}

// ─── Theme popover ────────────────────────────────────────────────────────────

function ThemePopover({ active, onSelect, onClose }: {
  active: string; onSelect: (t: ThemeDef) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    function k(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [onClose]);

  return (
    <div ref={ref} className="dt-theme-pop dt" role="menu" aria-label="Choose theme">
      {THEMES.map(t => (
        <div key={t.id} className="dt-theme-item" data-active={active === t.id ? "" : undefined}
          role="menuitem" tabIndex={0}
          onClick={() => onSelect(t)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect(t); }}>
          <div className="dt-theme-dots">
            <div className="dt-theme-dot" style={{ background: t.bg, border: `1px solid ${t.border}` }} />
            <div className="dt-theme-dot" style={{ background: t.accent }} />
            <div className="dt-theme-dot" style={{ background: t.muted, border: `1px solid ${t.border}` }} />
          </div>
          <span className="dt-theme-name">{t.label}</span>
          {active === t.id && <span className="dt-theme-tick">✓</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Floating sidebar editor ──────────────────────────────────────────────────

function FloatingSidebarEditor({ item, api, onClose }: {
  item: { href: string; label: string; rect: DOMRect };
  api: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState(item.label);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  // Position near the sidebar item
  const top = Math.min(item.rect.bottom + 6, window.innerHeight - 180);
  const left = item.rect.right + 8;
  const adjustedLeft = left + 300 > window.innerWidth ? Math.max(8, item.rect.left - 316) : left;

  useEffect(() => {
    const tid = window.setTimeout(() => {
      function outside(e: MouseEvent) {
        if (ref.current?.contains(e.target as Node)) return;
        onClose();
      }
      function key(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
      document.addEventListener("mousedown", outside);
      document.addEventListener("keydown", key);
      return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", key); };
    }, 120);
    return () => window.clearTimeout(tid);
  }, [onClose]);

  async function save() {
    setSaving(true); setStatus("Saving…");
    try {
      const res = await fetch(createDevToolsUrl(api, "nav-item", item.href), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ href: item.href, title }),
      });
      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) throw new Error(("error" in payload && payload.error) ? payload.error : "Could not save.");
      setStatus("Saved!");
      setTimeout(() => onClose(), 700);
    } catch (e) { setStatus(e instanceof Error ? e.message : "Could not save."); }
    finally { setSaving(false); }
  }

  return createPortal(
    <div ref={ref} className="dt-float-editor dt" style={{ top: adjustedLeft === left ? item.rect.top : top, left: adjustedLeft, width: 300, maxHeight: "auto" }}>
      <div className="dt-float-editor-hdr">
        <span className="dt-float-editor-type" style={{ color: "#6366f1" }}>≡ Sidebar item</span>
        <div style={{ flex: 1 }} />
        <a href={item.href} style={{ fontSize: 11, color: "var(--color-fd-muted-foreground,#64748b)", textDecoration: "none", marginRight: 6 }}>Go to page ↗</a>
        <button type="button" className="dt-float-btn" onClick={onClose} style={{ fontSize: 13 }}>✕</button>
      </div>
      <div className="dt-float-editor-body">
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--color-fd-muted-foreground,#64748b)", marginBottom: 4 }}>Title</div>
          <input
            style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--color-fd-border,#e2e8f0)", borderRadius: 6, fontSize: 13, background: "var(--color-fd-background,#fff)", color: "var(--color-fd-foreground,#0f172a)", outline: "none", fontFamily: "inherit" }}
            value={title}
            onChange={e => setTitle(e.currentTarget.value)}
            placeholder="Page title"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void save(); } }}
          />
        </div>
        {status && <div style={{ fontSize: 11, color: status.startsWith("Could") ? "#ef4444" : "var(--color-fd-muted-foreground,#64748b)", marginBottom: 6 }}>{status}</div>}
        <button type="button" className="dt-btn" data-primary="" style={{ width: "100%", justifyContent: "center" }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save title"}
        </button>
      </div>
    </div>,
    document.body
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DocsDevTools({ api, pathname }: DocsDevToolsProps) {
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [page, setPage]             = useState<DevToolsPagePayload | null>(null);
  const [doc, setDoc]               = useState<ParsedMdxDocument | null>(null);
  const [draft, setDraft]           = useState("");
  const [status, setStatus]         = useState("");
  // Which block is currently selected for editing, and where the editor floats
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeRect,  setActiveRect]  = useState<DOMRect | null>(null);
  const [themeId, setThemeId]       = useState("default");
  const [savedThemeId, setSavedThemeId] = useState("default");
  const [themeVars, setThemeVars]   = useState<Record<string, string>>({});
  const [showThemes, setShowThemes] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [addPalette, setAddPalette] = useState<{ x: number; y: number } | null>(null);
  const [sidebarItem, setSidebarItem] = useState<{ href: string; label: string; rect: DOMRect } | null>(null);
  const addBtnRef     = useRef<HTMLButtonElement | null>(null);
  const themeStyleRef = useRef<HTMLStyleElement | null>(null);
  // Always-fresh reference to doc so article click handler never captures stale closure
  const docRef = useRef<ParsedMdxDocument | null>(null);
  docRef.current = doc;
  // Reference to the active DOM element — used for scroll-tracking rect updates
  const activeElRef = useRef<HTMLElement | null>(null);
  // Pre-built DOM element → block index map (rebuilt whenever doc loads)
  const domBlockMapRef = useRef<Map<HTMLElement, number>>(new Map());

  // serialized is always derived from the visual doc state
  const serialized = useMemo(() => doc ? serializeMdxDocument(doc) : draft, [doc, draft]);

  async function loadPage() {
    setLoading(true); setStatus("");
    try {
      const res = await fetch(createDevToolsUrl(api, "page", pathname), { headers: { Accept: "application/json" } });
      const payload = (await res.json()) as DevToolsPagePayload | { error?: string };
      if (!res.ok || !("content" in payload)) throw new Error("error" in payload && payload.error ? payload.error : "Could not load page.");
      setPage(payload); setDoc(parseMdxDocument(payload.content)); setDraft(payload.content);
      setStatus(`Loaded ${payload.relativePath}`);
    } catch (e) { setStatus(e instanceof Error ? e.message : "Could not load page."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (!open) return; void loadPage(); }, [open, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rebuild DOM→block map whenever doc reloads ──
  useEffect(() => {
    if (!doc || !open) return;
    // Small delay so React can flush and the DOM matches the newly loaded page
    const tid = window.setTimeout(() => {
      const contentEl = document.querySelector<HTMLElement>("[data-dt-content]");
      if (contentEl) domBlockMapRef.current = buildDomBlockMap(contentEl, doc.blocks);
    }, 50);
    return () => window.clearTimeout(tid);
  }, [doc, open]);

  // ── Set html attribute + wire up content click overlay ──
  useEffect(() => {
    if (!open) return;

    window.document.documentElement.dataset.docsDevtoolsOpen = "true";

    const contentEl = document.querySelector<HTMLElement>("[data-dt-content]");
    if (contentEl) {
      // Single delegated click handler.
      // Block index is read directly from the pre-built map — no heuristics here.
      function handleContentClick(e: MouseEvent) {
        let el = e.target as HTMLElement | null;
        // Walk up to the direct child of the content container
        while (el && el.parentElement !== contentEl) el = el.parentElement;
        if (!el || el.dataset.dtUi) return;

        // Lazily build the map the first time (doc might not have loaded yet
        // when the click effect fires, so we rebuild defensively).
        if (domBlockMapRef.current.size === 0 && docRef.current) {
          domBlockMapRef.current = buildDomBlockMap(contentEl!, docRef.current.blocks);
        }

        // Look up the block index from the map.
        // Fall back to positional if the element isn't mapped (e.g. doc not loaded).
        const mapped = domBlockMapRef.current.get(el);
        const d = docRef.current;
        const domIdx = Array.from(contentEl!.children).indexOf(el);
        const blockIdx = mapped ?? (d ? Math.min(Math.max(0, domIdx), d.blocks.length - 1) : domIdx);

        activeElRef.current = el;
        setActiveIndex(blockIdx);
        setActiveRect(el.getBoundingClientRect());
      }

      contentEl.addEventListener("click", handleContentClick);

      return () => {
        contentEl.removeEventListener("click", handleContentClick);
        delete window.document.documentElement.dataset.docsDevtoolsOpen;
        themeStyleRef.current?.remove();
        themeStyleRef.current = null;
      };
    }

    return () => {
      delete window.document.documentElement.dataset.docsDevtoolsOpen;
      themeStyleRef.current?.remove();
      themeStyleRef.current = null;
    };
  }, [open, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sidebar click interception ──
  useEffect(() => {
    if (!open) return;
    const sidebar = document.getElementById("nd-sidebar");
    if (!sidebar) return;

    function handleSidebarClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      e.preventDefault();
      e.stopPropagation();
      setSidebarItem({
        href: anchor.getAttribute("href") ?? "",
        label: anchor.textContent?.trim() ?? "",
        rect: anchor.getBoundingClientRect(),
      });
    }

    sidebar.addEventListener("click", handleSidebarClick, true);
    return () => sidebar.removeEventListener("click", handleSidebarClick, true);
  }, [open]);

  // ── Scroll / resize → keep active highlight rect in sync with the block ──
  useEffect(() => {
    if (activeIndex === null) return;
    function refresh() {
      if (activeElRef.current) setActiveRect(activeElRef.current.getBoundingClientRect());
    }
    // capture:true catches scroll events on any ancestor, not just window
    window.addEventListener("scroll", refresh, { passive: true, capture: true });
    window.addEventListener("resize", refresh, { passive: true });
    return () => {
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [activeIndex]);

  // ── block mutations ──

  function mutateDoc(fn: (blocks: MdxBlock[]) => MdxBlock[]) {
    setDoc(cur => cur ? { ...cur, blocks: fn(cur.blocks) } : cur);
  }

  function updateBlock(id: string, next: MdxBlock) { mutateDoc(bs => bs.map(b => b.id === id ? next : b)); }
  function deleteBlock(id: string)                   { mutateDoc(bs => bs.filter(b => b.id !== id)); }
  function duplicateBlock(block: MdxBlock)           { mutateDoc(bs => { const i = bs.findIndex(b => b.id === block.id); if (i < 0) return bs; const next = [...bs]; next.splice(i + 1, 0, { ...block, id: createId(block.type) } as MdxBlock); return next; }); }

  function moveBlock(id: string, dir: -1 | 1) {
    mutateDoc(bs => {
      const i = bs.findIndex(b => b.id === id); const ni = i + dir;
      if (i < 0 || ni < 0 || ni >= bs.length) return bs;
      const next = [...bs]; const [b] = next.splice(i, 1); if (!b) return bs;
      next.splice(ni, 0, b); return next;
    });
  }

  function addBlockAt(type: MdxBlock["type"], atIndex: number) {
    mutateDoc(bs => { const next = [...bs]; next.splice(atIndex, 0, createBlock(type)); return next; });
  }

  function appendBlock(type: MdxBlock["type"]) {
    mutateDoc(bs => [...bs, createBlock(type)]);
  }

  function closeEditor() {
    activeElRef.current = null;
    setActiveIndex(null);
    setActiveRect(null);
  }

  // ── persist ──

  async function saveThemeToConfig(newThemeId: string) {
    await fetch(createDevToolsUrl(api, "theme", pathname), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ themeId: newThemeId }),
    });
  }

  async function applyChanges() {
    setSaving(true); setStatus("Saving…");
    try {
      const res = await fetch(createDevToolsUrl(api, "page", pathname), {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ content: serialized }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string; relativePath?: string };
      if (!res.ok || !payload.ok) throw new Error(payload.error || "Could not save.");
      // Also save theme if it changed
      if (themeId !== savedThemeId) {
        await saveThemeToConfig(themeId);
        setSavedThemeId(themeId);
      }
      setStatus(`Saved ${payload.relativePath ?? page?.relativePath ?? "page.mdx"}`);
    } catch (e) { setStatus(e instanceof Error ? e.message : "Could not save."); }
    finally { setSaving(false); }
  }

  async function publishPreview() {
    setStatus("Publishing…");
    try {
      const res = await fetch(createDevToolsUrl(api, "publish", pathname), {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ path: pathname, file: page?.relativePath, content: serialized }),
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not publish.");
      setStatus(payload.url ? `Preview: ${payload.url}` : "Preview published.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Could not publish."); }
  }

  // ── theme ──

  function applyTheme(t: ThemeDef) {
    setThemeId(t.id);
    setThemeVars({ "--color-fd-primary": t.accent, "--color-fd-background": t.bg, "--color-fd-foreground": t.fg, "--color-fd-border": t.border, "--color-fd-muted": t.muted, "--color-fd-muted-foreground": t.dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" });
    setShowThemes(false);
    themeStyleRef.current?.remove();
    themeStyleRef.current = null;
    fetch(`/themes/${t.id}.css`)
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(css => {
        const el = document.createElement("style");
        el.dataset.dtTheme = t.id;
        el.textContent = css;
        document.head.appendChild(el);
        themeStyleRef.current = el;
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (!open || Object.keys(themeVars).length === 0) return;
    const html = document.documentElement;
    const prev: Record<string, string> = {};
    const wasDark = html.classList.contains("dark");
    for (const [key, value] of Object.entries(themeVars)) {
      prev[key] = html.style.getPropertyValue(key);
      html.style.setProperty(key, value);
    }
    const theme = THEMES.find(t => t.id === themeId);
    if (theme?.dark) html.classList.add("dark");
    else html.classList.remove("dark");
    return () => {
      for (const [key, p] of Object.entries(prev)) {
        if (p) html.style.setProperty(key, p);
        else html.style.removeProperty(key);
      }
      if (wasDark) html.classList.add("dark");
      else html.classList.remove("dark");
    };
  }, [open, themeVars, themeId]);

  // ── active block ──
  const activeBlock = doc && activeIndex !== null ? doc.blocks[activeIndex] ?? null : null;

  // Classify the clicked DOM element so we route to the right editor:
  //   h1-h6 / p → InlineBlockEditor  (opaque text overlay)
  //   figure    → InlineCodeEditor   (opaque code overlay with editable fields)
  //   anything else → FloatingBlockEditor (floating panel beside the block)
  const domTag         = (activeElRef.current?.tagName ?? "").toLowerCase();
  const domIsTextBlock = /^h[1-6]$|^p$/.test(domTag);
  const domIsCodeBlock = domTag === "figure";
  const domIsInline    = domIsTextBlock || domIsCodeBlock;

  // ── render ──

  return (
    <>
      <style>{CSS}</style>

      {!open && (
        <button type="button" className="dt-trigger dt" aria-label="Open Docs DevTools" onClick={() => setOpen(true)}>
          <span className="dt-dot" aria-hidden="true" />
          Edit page
        </button>
      )}

      {open && (
        <>
          {/* ── Top toolbar ── */}
          <div role="banner" aria-label="Docs DevTools" className="dt-bar dt">
            <div className="dt-bar-logo">
              <div className="dt-bar-emblem" aria-hidden="true">DT</div>
              <span className="dt-bar-wordmark">DevTools</span>
            </div>
            <div className="dt-bar-file">
              <div className="dt-bar-path">{page?.relativePath ?? pathname}</div>
              {status && <div className="dt-bar-status">{status}</div>}
            </div>
            <div className="dt-bar-actions">
              {/* Theme switcher */}
              <div style={{ position: "relative" }}>
                <button type="button" className="dt-btn" data-active={showThemes ? "" : undefined} onClick={() => setShowThemes(s => !s)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                  <span>Theme</span>
                </button>
                {showThemes && <ThemePopover active={themeId} onSelect={applyTheme} onClose={() => setShowThemes(false)} />}
              </div>

              <div className="dt-btn-sep" />

              {/* Source editor button */}
              <button type="button" className="dt-btn" onClick={() => { setDraft(serialized); setShowSource(s => !s); }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                <span>Source</span>
              </button>

              {/* Add block */}
              <button ref={addBtnRef} type="button" className="dt-btn" disabled={!doc || loading} onClick={() => {
                const rect = addBtnRef.current?.getBoundingClientRect();
                if (rect) setAddPalette({ x: Math.max(6, rect.left - 130), y: rect.bottom + 6 });
              }}>
                <Plus /><span>Add</span>
              </button>

              <div className="dt-btn-sep" />
              <button type="button" className="dt-btn" onClick={loadPage} disabled={loading}>{loading ? "Loading…" : "Reload"}</button>
              <button type="button" className="dt-btn" onClick={publishPreview} disabled={saving || loading}>Preview</button>
              <button type="button" className="dt-btn" data-primary="" onClick={applyChanges} disabled={saving || loading || (!doc && !draft)}>
                {saving ? "Saving…" : "Save"}
              </button>
              <div className="dt-btn-sep" />
              <button type="button" className="dt-btn" onClick={() => { closeEditor(); setOpen(false); }}>✕</button>
            </div>
          </div>

          {/* ── Selection toolbar — appears above any selected text in a contentEditable ── */}
          <SelectionToolbar />

          {/* ── Active block highlight — dashed rect, tracks scroll ──
               Hidden only when an inline opaque cover is showing (InlineBlockEditor
               or InlineCodeEditor), since those already visually replace the block. ── */}
          {activeRect && !domIsInline && (
            <div className="dt-active-highlight dt" style={{
              top:    activeRect.top    - 5,
              left:   activeRect.left   - 5,
              width:  activeRect.width  + 10,
              height: activeRect.height + 10,
            }} />
          )}

          {/* ── InlineBlockEditor — opaque overlay for heading / paragraph ── */}
          {activeBlock && activeRect && activeElRef.current &&
            domIsTextBlock &&
            (activeBlock.type === "heading" || activeBlock.type === "paragraph") && (
            <InlineBlockEditor
              block={activeBlock as Extract<MdxBlock, { type: "heading" | "paragraph" }>}
              rect={activeRect}
              el={activeElRef.current}
              index={activeIndex!}
              total={doc!.blocks.length}
              onChange={next => updateBlock(activeBlock.id, next)}
              onClose={closeEditor}
              onMove={dir => moveBlock(activeBlock.id, dir)}
              onDuplicate={() => duplicateBlock(activeBlock)}
              onDelete={() => { deleteBlock(activeBlock.id); closeEditor(); }}
            />
          )}

          {/* ── InlineCodeEditor — opaque overlay for code blocks (figure) ── */}
          {activeBlock && activeRect && activeElRef.current &&
            domIsCodeBlock && activeBlock.type === "code" && (
            <InlineCodeEditor
              block={activeBlock as Extract<MdxBlock, { type: "code" }>}
              rect={activeRect}
              index={activeIndex!}
              total={doc!.blocks.length}
              onChange={next => updateBlock(activeBlock.id, next)}
              onClose={closeEditor}
              onMove={dir => moveBlock(activeBlock.id, dir)}
              onDuplicate={() => duplicateBlock(activeBlock)}
              onDelete={() => { deleteBlock(activeBlock.id); closeEditor(); }}
            />
          )}

          {/* ── FloatingBlockEditor — for callout / tabs / hoverlink / prompt / raw
               and any DOM element we couldn't classify as inline               ── */}
          {activeBlock && activeRect && !domIsInline && (
            <FloatingBlockEditor
              block={activeBlock}
              rect={activeRect}
              index={activeIndex!}
              total={doc!.blocks.length}
              onClose={closeEditor}
              onChange={next => updateBlock(activeBlock.id, next)}
              onMove={dir => moveBlock(activeBlock.id, dir)}
              onDuplicate={() => duplicateBlock(activeBlock)}
              onDelete={() => { deleteBlock(activeBlock.id); closeEditor(); }}
              onInsertAfter={type => { addBlockAt(type, activeIndex! + 1); closeEditor(); }}
            />
          )}

          {/* ── Source modal ── */}
          {showSource && createPortal(
            <div className="dt-float-editor dt" style={{ top: 70, left: "50%", transform: "translateX(-50%)", width: "min(720px,95vw)", maxHeight: "80vh" }}>
              <div className="dt-float-editor-hdr">
                <span className="dt-float-editor-type">Source MDX</span>
                <div style={{ flex: 1 }} />
                <button type="button" className="dt-btn" data-primary="" onClick={() => { setDoc(parseMdxDocument(draft)); setStatus("Applied source"); setShowSource(false); }}>Apply</button>
                <button type="button" className="dt-float-btn" onClick={() => setShowSource(false)} style={{ fontSize: 13 }}>✕</button>
              </div>
              <div className="dt-float-editor-body" style={{ padding: "10px" }}>
                <textarea
                  className="dt-source-ta"
                  style={{ minHeight: "60vh" }}
                  value={draft}
                  onChange={e => setDraft(e.currentTarget.value)}
                  spellCheck={false}
                />
              </div>
            </div>,
            document.body
          )}

          {/* ── Add block palette ── */}
          {addPalette && createPortal(
            <InsertPalette
              x={addPalette.x}
              y={addPalette.y}
              onInsert={type => { appendBlock(type); setAddPalette(null); }}
              onClose={() => setAddPalette(null)}
            />,
            document.body
          )}

          {/* Loading indicator when no blocks yet */}
          {loading && createPortal(
            <div className="dt" style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(9,9,13,0.92)", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, zIndex: 2147483003, backdropFilter: "blur(12px)" }}>
              Loading editor…
            </div>,
            document.body
          )}

          {/* ── Sidebar item editor ── */}
          {sidebarItem && (
            <FloatingSidebarEditor
              item={sidebarItem}
              api={api}
              onClose={() => setSidebarItem(null)}
            />
          )}
        </>
      )}
    </>
  );
}
