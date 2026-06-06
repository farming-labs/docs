/**
 * Threadline theme preset.
 * Compact chat-docs-inspired documentation chrome with neutral
 * shadcn-style tokens, Geist typography, soft surfaces, and page-action defaults.
 *
 * CSS: `@import "@farming-labs/theme/threadline/css";`
 */
import { createTheme } from "@farming-labs/docs";
import type { PageActionsConfig } from "@farming-labs/docs";

const ThreadlineUIDefaults = {
  colors: {
    primary: "oklch(0.205 0 0)",
    primaryForeground: "oklch(0.985 0 0)",
    background: "oklch(1 0 0)",
    foreground: "oklch(0.145 0 0)",
    muted: "oklch(0.97 0 0)",
    mutedForeground: "oklch(0.556 0 0)",
    border: "oklch(0.922 0 0)",
    card: "oklch(1 0 0)",
    cardForeground: "oklch(0.145 0 0)",
    accent: "oklch(0.97 0 0)",
    accentForeground: "oklch(0.205 0 0)",
    secondary: "oklch(0.97 0 0)",
    secondaryForeground: "oklch(0.205 0 0)",
    popover: "oklch(1 0 0)",
    popoverForeground: "oklch(0.145 0 0)",
    ring: "oklch(0.708 0 0)",
  },
  typography: {
    font: {
      style: {
        sans: "var(--font-geist-sans, GeistSans, GeistSans Fallback, ui-sans-serif, system-ui, sans-serif)",
        mono: "var(--font-geist-mono, GeistMono, GeistMono Fallback, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace)",
      },
      h1: { size: "1.5rem", weight: 600, lineHeight: "1.35", letterSpacing: "0" },
      h2: { size: "1.25rem", weight: 500, lineHeight: "1.4", letterSpacing: "0" },
      h3: { size: "1rem", weight: 500, lineHeight: "1.5", letterSpacing: "0" },
      h4: { size: "0.875rem", weight: 600, lineHeight: "1.5", letterSpacing: "0" },
      body: { size: "0.875rem", weight: 400, lineHeight: "1.7" },
      small: { size: "0.75rem", weight: 400, lineHeight: "1.45" },
    },
  },
  radius: "0.625rem",
  layout: {
    contentWidth: 944,
    sidebarWidth: 260,
    tocWidth: 224,
    toc: { enabled: true, depth: 3, style: "default" as const },
    header: { height: 48, sticky: true },
  },
  sidebar: {
    style: "bordered" as const,
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true, showLineNumbers: true },
    HoverLink: { linkLabel: "Open page", showIndicator: false },
    Prompt: {
      icon: "sparkles",
      actions: ["copy", "open"],
      providers: ["ChatGPT", "Claude", "Cursor", "T3 Chat"],
      copyIcon: "copy",
      copiedIcon: "check",
      openIcon: "arrowUpRight",
    },
    Tabs: { style: "default" },
  },
};

const githubIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.11.79-.25.79-.56v-2.02c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.71 1.25 3.37.96.1-.75.4-1.25.73-1.54-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.18 1.18a10.9 10.9 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.7.41.36.78 1.06.78 2.14v3.03c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>`;

const t3ChatIcon = `<svg width="16" height="16" viewBox="0 0 512 512" fill="none" aria-hidden="true"><rect width="512" height="512" rx="96" fill="url(#fd-t3-chat-bg)"/><path d="M115.3 407.6c-4.7 2.7-10.4-1.1-9.7-6.5l11.7-87.8C100.9 292.3 92 267.9 92 242c0-80.7 83.7-146.2 187-146.2S466 161.3 466 242 382.3 388.2 279 388.2c-28.2 0-55-4.9-78.9-13.6l-84.8 33Z" fill="url(#fd-t3-chat-bubble)"/><defs><linearGradient id="fd-t3-chat-bg" x1="86" x2="420" y1="32" y2="482" gradientUnits="userSpaceOnUse"><stop stop-color="#ff2bb5"/><stop offset="1" stop-color="#85005d"/></linearGradient><linearGradient id="fd-t3-chat-bubble" x1="176" x2="341" y1="113" y2="393" gradientUnits="userSpaceOnUse"><stop stop-color="#ffd3ff"/><stop offset="1" stop-color="#f66ce7"/></linearGradient></defs></svg>`;

/**
 * Page-action defaults for compact agent-friendly docs affordances as closely
 * as the shared page-actions API allows.
 */
const threadlinePageActions = {
  position: "toc",
  copyMarkdown: { enabled: true },
  alignment: "left",
  openDocs: {
    enabled: true,
    target: "markdown",
    prompt: "Read this documentation: {url}",
    providers: [
      { id: "github", name: "GitHub", icon: githubIcon },
      "chatgpt",
      "claude",
      { id: "cursor", mode: "app" },
      {
        name: "T3 Chat",
        urlTemplate: "https://t3.chat/new?q={prompt}",
        promptUrlTemplate: "https://t3.chat/new?q={prompt}",
        icon: t3ChatIcon,
      },
    ],
  },
} satisfies PageActionsConfig;

export const threadline = createTheme({
  name: "threadline",
  ui: ThreadlineUIDefaults,
});

export { ThreadlineUIDefaults, threadlinePageActions };
