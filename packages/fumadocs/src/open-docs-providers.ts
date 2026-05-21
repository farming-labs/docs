import type { OpenDocsProvider, OpenDocsTarget } from "@farming-labs/docs";

export interface SerializedOpenDocsProvider {
  name: string;
  iconHtml?: string;
  urlTemplate: string;
  promptUrlTemplate?: string;
  target?: OpenDocsTarget;
  prompt?: string;
}

interface OpenDocsProviderPreset {
  name: string;
  urlTemplate: string;
  promptUrlTemplate: string;
  target?: OpenDocsTarget;
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
};

const OPEN_DOCS_PROVIDER_PRESETS: Record<string, OpenDocsProviderPreset> = {
  chatgpt: {
    name: "ChatGPT",
    urlTemplate: "https://chatgpt.com/?q={prompt}",
    promptUrlTemplate: PROMPT_PROVIDER_TEMPLATES.chatgpt,
  },
  claude: {
    name: "Claude",
    urlTemplate: "https://claude.ai/new?q={prompt}",
    promptUrlTemplate: PROMPT_PROVIDER_TEMPLATES.claude,
  },
  cursor: {
    name: "Cursor",
    urlTemplate: "https://cursor.com/link/prompt?text={prompt}",
    promptUrlTemplate: PROMPT_PROVIDER_TEMPLATES.cursor,
  },
  gemini: {
    name: "Gemini",
    urlTemplate: "https://gemini.google.com/app?q={prompt}",
    promptUrlTemplate: PROMPT_PROVIDER_TEMPLATES.gemini,
  },
  copilot: {
    name: "Copilot",
    urlTemplate: "https://github.com/copilot?prompt={prompt}",
    promptUrlTemplate: PROMPT_PROVIDER_TEMPLATES.copilot,
  },
  github: {
    name: "GitHub",
    urlTemplate: "{githubUrl}",
    promptUrlTemplate: "{githubUrl}",
    target: "github",
  },
};

function normalizeProviderName(name: string): string {
  return name.trim().toLowerCase();
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
    iconHtml:
      options.serializeIcon?.(provider.icon) ??
      (typeof provider.icon === "string" ? provider.icon : undefined),
    target:
      provider.target ??
      options.target ??
      preset?.target ??
      (hasCustomUrlTemplate ? "page" : undefined),
    prompt: provider.prompt ?? options.prompt,
  };
}
