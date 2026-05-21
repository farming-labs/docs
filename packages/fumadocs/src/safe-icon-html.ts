const SAFE_ICON_TAGS = new Set([
  "circle",
  "clippath",
  "defs",
  "desc",
  "ellipse",
  "g",
  "line",
  "lineargradient",
  "mask",
  "path",
  "polygon",
  "polyline",
  "radialgradient",
  "rect",
  "span",
  "stop",
  "svg",
  "symbol",
  "title",
  "use",
]);

const TAG_PATTERN = /<\/?\s*([a-zA-Z][\w:-]*)\b/g;
const BLOCKED_MARKUP_PATTERN = /<\s*!/;
const BLOCKED_ATTRIBUTE_PATTERN = /\s(?:on[a-z][\w:-]*|srcdoc|style)\s*=/i;
const URL_ATTRIBUTE_PATTERN = /\s(?:href|xlink:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

export function sanitizeIconHtml(html?: string): string | undefined {
  const trimmed = html?.trim();
  if (!trimmed || trimmed.length > 10000) return undefined;
  if (BLOCKED_MARKUP_PATTERN.test(trimmed) || BLOCKED_ATTRIBUTE_PATTERN.test(trimmed)) {
    return undefined;
  }

  let tagMatch: RegExpExecArray | null;
  TAG_PATTERN.lastIndex = 0;
  while ((tagMatch = TAG_PATTERN.exec(trimmed)) !== null) {
    if (!SAFE_ICON_TAGS.has(tagMatch[1]!.toLowerCase())) return undefined;
  }

  let urlMatch: RegExpExecArray | null;
  URL_ATTRIBUTE_PATTERN.lastIndex = 0;
  while ((urlMatch = URL_ATTRIBUTE_PATTERN.exec(trimmed)) !== null) {
    const value = (urlMatch[1] ?? urlMatch[2] ?? urlMatch[3] ?? "").trim();
    if (value && !value.startsWith("#")) return undefined;
  }

  return trimmed;
}
