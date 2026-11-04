import type { OpenDocsProvider, OpenDocsTarget } from "@farming-labs/docs";
import { OPEN_DOCS_PROVIDER_ICONS } from "./open-docs-provider-icons.js";

export interface SerializedOpenDocsProvider {
  name: string;
  iconHtml?: string;
  urlTemplate: string;
  promptUrlTemplate?: string;
  target?: OpenDocsTarget;
  prompt?: string;
  description?: string;
}

interface OpenDocsProviderPreset {
  name: string;
  iconHtml?: string;
  urlTemplate: string;
  promptUrlTemplate: string;
  target?: OpenDocsTarget;
  description: string;
}

interface ResolveOpenDocsProvidersOptions {
  target?: OpenDocsTarget;
  prompt?: string;
  serializeIcon?: (icon: unknown) => string | undefined;
}

const PROMPT_PROVIDER_TEMPLATES: Record<string, string> = {
  chatgpt: "https://chatgpt.com/?q={prompt}",
  claude: "https://claude.ai/new?q={prompt}",
  cursor: "https://cursor.com/link/prompt?text={prompt}",
  gemini: "https://gemini.google.com/app?q={prompt}",
  copilot: "https://github.com/copilot?prompt={prompt}",
  perplexity: "https://www.perplexity.ai/search/?q={prompt}",
  codex: "codex://new?prompt={prompt}",
};

const OPEN_DOCS_PROVIDER_PRESETS: Record<string, OpenDocsProviderPreset> = {
  chatgpt: {
    name: "ChatGPT",
    iconHtml: OPEN_DOCS_PROVIDER_ICONS.chatgpt,
    urlTemplate: "https://chatgpt.com/?q={prompt}",
    promptUrlTemplate: PROMPT_PROVIDER_TEMPLATES.chatgpt,
    description: "Ask ChatGPT about this page",
  },
  claude: {
    name: "Claude",
    iconHtml: OPEN_DOCS_PROVIDER_ICONS.claude,
    urlTemplate: "https://claude.ai/new?q={prompt}",
    promptUrlTemplate: PROMPT_PROVIDER_TEMPLATES.claude,
    description: "Ask Claude about this page",
  },
  cursor: {
    name: "Cursor",
    iconHtml: OPEN_DOCS_PROVIDER_ICONS.cursor,
    urlTemplate: "https://cursor.com/link/prompt?text={prompt}",
    promptUrlTemplate: PROMPT_PROVIDER_TEMPLATES.cursor,
    description: "Ask Cursor about this page",
  },
  gemini: {
    name: "Gemini",
    iconHtml: OPEN_DOCS_PROVIDER_ICONS.gemini,
    urlTemplate: "https://gemini.google.com/app?q={prompt}",
    promptUrlTemplate: PROMPT_PROVIDER_TEMPLATES.gemini,
    description: "Ask Gemini about this page",
  },
  copilot: {
    name: "Copilot",
    iconHtml: OPEN_DOCS_PROVIDER_ICONS.copilot,
    urlTemplate: "https://github.com/copilot?prompt={prompt}",
    promptUrlTemplate: PROMPT_PROVIDER_TEMPLATES.copilot,
    description: "Ask Copilot about this page",
  },
  perplexity: {
    name: "Perplexity",
    iconHtml: OPEN_DOCS_PROVIDER_ICONS.perplexity,
    urlTemplate: "https://www.perplexity.ai/search/?q={prompt}",
    promptUrlTemplate: PROMPT_PROVIDER_TEMPLATES.perplexity,
    description: "Ask Perplexity about this page",
  },
  codex: {
    name: "Codex",
    iconHtml: OPEN_DOCS_PROVIDER_ICONS.chatgpt,
    urlTemplate: "codex://new?prompt={prompt}",
    promptUrlTemplate: PROMPT_PROVIDER_TEMPLATES.codex,
    description: "Ask Codex about this page",
  },
  github: {
    name: "GitHub",
    iconHtml: OPEN_DOCS_PROVIDER_ICONS.github,
    urlTemplate: "{githubUrl}",
    promptUrlTemplate: "{githubUrl}",
    target: "github",
    description: "Edit this page on GitHub",
  },
};

function normalizeProviderName(name: string): string {
  return name.trim().toLowerCase();
}

export function resolveOpenDocsProviderIcon(name?: string): string | undefined {
  if (!name) return undefined;

  const normalizedName = normalizeProviderName(name);
  const presetId = normalizedName === "github copilot" ? "copilot" : normalizedName;
  return OPEN_DOCS_PROVIDER_PRESETS[presetId]?.iconHtml;
}

export function resolveOpenDocsProviders(
  providers?: OpenDocsProvider[],
  options: ResolveOpenDocsProvidersOptions = {},
): SerializedOpenDocsProvider[] | undefined {
  if (!providers || providers.length === 0) return undefined;

  const serialized = providers
    .map((provider) => resolveOpenDocsProvider(provider, options))
    .filter((provider): provider is SerializedOpenDocsProvider => provider !== undefined);

  return serialized.length > 0 ? serialized : undefined;
}

export function resolveOpenDocsProvider(
  provider: OpenDocsProvider,
  options: ResolveOpenDocsProvidersOptions = {},
): SerializedOpenDocsProvider | undefined {
  const normalizedId =
    typeof provider === "string"
      ? normalizeProviderName(provider)
      : typeof provider.id === "string"
        ? normalizeProviderName(provider.id)
        : typeof provider.name === "string"
          ? normalizeProviderName(provider.name)
          : typeof provider.label === "string"
            ? normalizeProviderName(provider.label)
            : undefined;
  const preset = normalizedId ? OPEN_DOCS_PROVIDER_PRESETS[normalizedId] : undefined;

  if (typeof provider === "string") {
    if (!preset) return undefined;
    return {
      name: preset.name,
      iconHtml: preset.iconHtml,
      urlTemplate: preset.urlTemplate,
      promptUrlTemplate: preset.promptUrlTemplate,
      target: preset.target ?? options.target,
      prompt: options.prompt,
      description: preset.description,
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
    iconHtml:
      options.serializeIcon?.(provider.icon) ??
      (typeof provider.icon === "string" ? provider.icon : undefined) ??
      preset?.iconHtml,
    target:
      provider.target ??
      preset?.target ??
      options.target ??
      (hasCustomUrlTemplate ? "page" : undefined),
    prompt: provider.prompt ?? options.prompt,
    description: provider.description ?? preset?.description,
  };
}
