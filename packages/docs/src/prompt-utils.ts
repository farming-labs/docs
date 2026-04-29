import { createRequire } from "node:module";
import type { OpenDocsProvider } from "./types.js";

const require = createRequire(import.meta.url);

export type PromptAction = "copy" | "open";

export interface SerializedOpenDocsProvider {
  name: string;
  iconHtml?: string;
  urlTemplate: string;
  promptUrlTemplate?: string;
}

export interface PromptProviderChoice {
  name: string;
  iconHtml?: string;
  urlTemplate: string;
}

export const DEFAULT_PROMPT_PROVIDER_TEMPLATES: Record<string, string> = {
  chatgpt: "https://chatgpt.com/?q={prompt}",
  claude: "https://claude.ai/new?q={prompt}",
  cursor: "https://cursor.com/link/prompt?text={prompt}",
  gemini: "https://gemini.google.com/app?q={prompt}",
  copilot: "https://github.com/copilot?prompt={prompt}",
};

export function normalizePromptProviderName(name: string): string {
  return name.trim().toLowerCase();
}

export function serializeDocsIcon(icon: unknown): string | undefined {
  if (!icon) return undefined;
  if (typeof icon === "string") return icon;

  try {
    const { renderToStaticMarkup } = require("react-dom/server") as {
      renderToStaticMarkup: (element: unknown) => string;
    };
    return renderToStaticMarkup(icon);
  } catch {
    return undefined;
  }
}

export function serializeDocsIconRegistry(
  icons?: Record<string, unknown>,
): Record<string, string> | undefined {
  if (!icons) return undefined;

  const entries = Object.entries(icons)
    .map(([name, icon]) => [name, serializeDocsIcon(icon)] as const)
    .filter((entry): entry is readonly [string, string] => typeof entry[1] === "string");

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function serializeOpenDocsProviders(
  providers?: OpenDocsProvider[],
): SerializedOpenDocsProvider[] | undefined {
  if (!providers || providers.length === 0) return undefined;

  return providers.map((provider) => ({
    name: provider.name,
    urlTemplate: provider.urlTemplate,
    promptUrlTemplate: provider.promptUrlTemplate,
    iconHtml: serializeDocsIcon(provider.icon),
  }));
}

export function parsePromptStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const normalized = value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }

  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return undefined;
    const normalized = inner
      .split(",")
      .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }

  const normalized = trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

export function resolvePromptProviderChoices(
  availableProviders?: Array<Pick<SerializedOpenDocsProvider, "name" | "iconHtml" | "promptUrlTemplate">>,
  preferredNames?: string[],
): PromptProviderChoice[] {
  const configuredByName = new Map(
    (availableProviders ?? []).map((provider) => [
      normalizePromptProviderName(provider.name),
      provider,
    ]),
  );

  const names = preferredNames && preferredNames.length > 0
    ? preferredNames
    : (availableProviders ?? []).map((provider) => provider.name);

  const seen = new Set<string>();
  const resolved: PromptProviderChoice[] = [];

  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;

    const normalized = normalizePromptProviderName(name);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const configured = configuredByName.get(normalized);
    const template =
      configured?.promptUrlTemplate ?? DEFAULT_PROMPT_PROVIDER_TEMPLATES[normalized];

    if (!template) continue;

    resolved.push({
      name: configured?.name ?? name,
      iconHtml: configured?.iconHtml,
      urlTemplate: template,
    });
  }

  return resolved;
}

export function sanitizePromptText(text: string): string {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .split("\n");

  const normalized: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index] ?? "";
    const previous = normalized[normalized.length - 1] ?? "";
    let nextNonEmpty = "";

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor]?.trim() ?? "";
      if (candidate) {
        nextNonEmpty = candidate;
        break;
      }
    }

    if (
      current.trim() === "" &&
      previous.trim().startsWith("- ") &&
      nextNonEmpty.startsWith("- ")
    ) {
      continue;
    }

    normalized.push(current);
  }

  return normalized.join("\n");
}
