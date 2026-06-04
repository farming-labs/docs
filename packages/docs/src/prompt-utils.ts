import { createRequire } from "node:module";
import type { OpenDocsProvider, OpenDocsTarget } from "./types.js";

const require = createRequire(import.meta.url);

export type PromptAction = "copy" | "open";

export interface SerializedOpenDocsProvider {
  name: string;
  iconHtml?: string;
  urlTemplate: string;
  promptUrlTemplate?: string;
  target?: OpenDocsTarget;
  prompt?: string;
}

export interface PromptProviderChoice {
  name: string;
  iconHtml?: string;
  urlTemplate: string;
}

type PromptProviderInput = Pick<SerializedOpenDocsProvider, "name" | "iconHtml"> &
  Partial<Pick<SerializedOpenDocsProvider, "promptUrlTemplate" | "urlTemplate">>;

interface OpenDocsProviderPreset {
  name: string;
  urlTemplate: string;
  promptUrlTemplate: string;
  target?: OpenDocsTarget;
}

export interface SerializeOpenDocsProviderOptions {
  target?: OpenDocsTarget;
  prompt?: string;
}

export const DEFAULT_PROMPT_PROVIDER_TEMPLATES: Record<string, string> = {
  chatgpt: "https://chatgpt.com/?q={prompt}",
  claude: "https://claude.ai/new?q={prompt}",
  cursor: "https://cursor.com/link/prompt?text={prompt}",
  gemini: "https://gemini.google.com/app?q={prompt}",
  copilot: "https://github.com/copilot?prompt={prompt}",
};

export const DEFAULT_OPEN_DOCS_TARGET: OpenDocsTarget = "markdown";

export const DEFAULT_OPEN_DOCS_PROMPT = "Read this documentation: {url}";

export const DEFAULT_OPEN_DOCS_PROVIDER_IDS = ["chatgpt", "claude"] as const;

const DEFAULT_OPEN_DOCS_PROVIDER_PRESETS: Record<string, OpenDocsProviderPreset> = {
  chatgpt: {
    name: "ChatGPT",
    urlTemplate: "https://chatgpt.com/?q={prompt}",
    promptUrlTemplate: DEFAULT_PROMPT_PROVIDER_TEMPLATES.chatgpt,
  },
  claude: {
    name: "Claude",
    urlTemplate: "https://claude.ai/new?q={prompt}",
    promptUrlTemplate: DEFAULT_PROMPT_PROVIDER_TEMPLATES.claude,
  },
  cursor: {
    name: "Cursor",
    urlTemplate: "https://cursor.com/link/prompt?text={prompt}",
    promptUrlTemplate: DEFAULT_PROMPT_PROVIDER_TEMPLATES.cursor,
  },
  gemini: {
    name: "Gemini",
    urlTemplate: "https://gemini.google.com/app?q={prompt}",
    promptUrlTemplate: DEFAULT_PROMPT_PROVIDER_TEMPLATES.gemini,
  },
  copilot: {
    name: "Copilot",
    urlTemplate: "https://github.com/copilot?prompt={prompt}",
    promptUrlTemplate: DEFAULT_PROMPT_PROVIDER_TEMPLATES.copilot,
  },
  github: {
    name: "GitHub",
    urlTemplate: "{githubUrl}",
    promptUrlTemplate: "{githubUrl}",
    target: "github",
  },
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
  options: SerializeOpenDocsProviderOptions = {},
): SerializedOpenDocsProvider[] | undefined {
  if (!providers || providers.length === 0) return undefined;

  const serialized = providers
    .map((provider) => serializeOpenDocsProvider(provider, options))
    .filter((provider): provider is SerializedOpenDocsProvider => provider !== undefined);

  return serialized.length > 0 ? serialized : undefined;
}

export function serializeOpenDocsProvider(
  provider: OpenDocsProvider,
  options: SerializeOpenDocsProviderOptions = {},
): SerializedOpenDocsProvider | undefined {
  const normalizedId =
    typeof provider === "string"
      ? normalizePromptProviderName(provider)
      : typeof provider.id === "string"
        ? normalizePromptProviderName(provider.id)
        : typeof provider.name === "string"
          ? normalizePromptProviderName(provider.name)
          : typeof provider.label === "string"
            ? normalizePromptProviderName(provider.label)
            : undefined;
  const preset = normalizedId ? DEFAULT_OPEN_DOCS_PROVIDER_PRESETS[normalizedId] : undefined;

  if (typeof provider === "string") {
    if (!preset) return undefined;
    return {
      name: preset.name,
      urlTemplate: preset.urlTemplate,
      promptUrlTemplate: preset.promptUrlTemplate,
      target: preset.target ?? options.target,
      prompt: options.prompt,
    };
  }

  const cursorAppTemplate =
    normalizedId === "cursor" && provider.mode === "app"
      ? "cursor://anysphere.cursor-deeplink/prompt?text={prompt}"
      : undefined;
  const name = provider.name ?? provider.label ?? preset?.name;
  const urlTemplate = provider.urlTemplate ?? cursorAppTemplate ?? preset?.urlTemplate;
  const hasCustomUrlTemplate = typeof provider.urlTemplate === "string";

  if (!name || !urlTemplate) return undefined;

  return {
    name,
    urlTemplate,
    promptUrlTemplate: provider.promptUrlTemplate ?? cursorAppTemplate ?? preset?.promptUrlTemplate,
    iconHtml: serializeDocsIcon(provider.icon),
    target:
      provider.target ??
      preset?.target ??
      options.target ??
      (hasCustomUrlTemplate ? "page" : undefined),
    prompt: provider.prompt ?? options.prompt,
  };
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
  availableProviders?: PromptProviderInput[],
  preferredNames?: string[],
): PromptProviderChoice[] {
  const configuredByName = new Map(
    (availableProviders ?? []).map((provider) => [
      normalizePromptProviderName(provider.name),
      provider,
    ]),
  );

  const names =
    preferredNames && preferredNames.length > 0
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
      configured?.promptUrlTemplate ??
      configured?.urlTemplate ??
      DEFAULT_PROMPT_PROVIDER_TEMPLATES[normalized];

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
