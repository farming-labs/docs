/**
 * Tweaks runtime — preset bundle, persistence, and FOUC prevention.
 *
 * The Tweaks dialog calls into this module to apply visual changes to
 * `document.documentElement` and persist them across reloads.
 * `buildFoucScript()` returns an inline `<script>` body that re-applies
 * saved selections before the browser paints, so there is no flash of the
 * un-tweaked theme on the next page load.
 *
 * Pure utilities — no React, no JSX. Safe to import from server and client.
 */

export type TweaksPresetKey =
  | "default"
  | "colorful"
  | "darksharp"
  | "pixel-border"
  | "shiny"
  | "ledger"
  | "darkbold";

export type TweaksDensity = "compact" | "comfortable" | "roomy";

/**
 * Author-mode color tokens. These map 1:1 to fumadocs' `--color-fd-*`
 * variables; the reader-mode `primary` field is a shortcut that also
 * sets `--color-fd-ring`.
 */
export type TweaksColorKey =
  | "primary"
  | "primaryForeground"
  | "background"
  | "foreground"
  | "muted"
  | "mutedForeground"
  | "border"
  | "card"
  | "cardForeground"
  | "accent"
  | "accentForeground"
  | "secondary"
  | "secondaryForeground"
  | "popover"
  | "popoverForeground"
  | "ring";

export const TWEAKS_COLOR_KEYS: ReadonlyArray<TweaksColorKey> = [
  "primary",
  "primaryForeground",
  "background",
  "foreground",
  "muted",
  "mutedForeground",
  "border",
  "card",
  "cardForeground",
  "accent",
  "accentForeground",
  "secondary",
  "secondaryForeground",
  "popover",
  "popoverForeground",
  "ring",
];

const COLOR_KEY_TO_CSS_VAR: Record<TweaksColorKey, string> = {
  primary: "--color-fd-primary",
  primaryForeground: "--color-fd-primary-foreground",
  background: "--color-fd-background",
  foreground: "--color-fd-foreground",
  muted: "--color-fd-muted",
  mutedForeground: "--color-fd-muted-foreground",
  border: "--color-fd-border",
  card: "--color-fd-card",
  cardForeground: "--color-fd-card-foreground",
  accent: "--color-fd-accent",
  accentForeground: "--color-fd-accent-foreground",
  secondary: "--color-fd-secondary",
  secondaryForeground: "--color-fd-secondary-foreground",
  popover: "--color-fd-popover",
  popoverForeground: "--color-fd-popover-foreground",
  ring: "--color-fd-ring",
};

export interface TweaksState {
  // Reader-mode knobs
  preset?: TweaksPresetKey;
  primary?: string;
  radius?: string;
  density?: TweaksDensity;
  fontFamily?: string;

  // Author-mode extras
  /** Per-token color overrides; takes precedence over `primary`. */
  colors?: Partial<Record<TweaksColorKey, string>>;
  /** Sidebar column width, e.g. `"280px"`. Writes `--fd-sidebar-width`. */
  sidebarWidth?: string;
  /** Content prose width, e.g. `"768px"`. Writes `--fd-content-width`. */
  contentWidth?: string;
  /** TOC column width, e.g. `"14rem"`. Writes `--fd-toc-width`. */
  tocWidth?: string;

  // UI preferences (don't affect theme; persisted alongside theme state for
  // convenience so a single localStorage key holds everything reader-related)
  /** Which side of the viewport the dialog snaps to. @default "right" */
  dialogSide?: "left" | "right";
}

interface PresetTokens {
  label: string;
  primary: string;
  primaryForeground: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  card: string;
  ring: string;
  radius: string;
  fontSans: string;
}

/**
 * Hand-curated token bundle for the seven presets where every color variable
 * is fully known from the preset's TS module + its companion CSS file.
 *
 * Adding more presets (greentree, hardline, concrete, command-grid) is a
 * mechanical lift — drop their `:root` declarations into a new entry here.
 */
export const TWEAKS_PRESET_BUNDLE: Record<TweaksPresetKey, PresetTokens> = {
  default: {
    label: "Default",
    primary: "#6366f1",
    primaryForeground: "#ffffff",
    background: "#0c0c0c",
    foreground: "#fafafa",
    muted: "#262626",
    mutedForeground: "#a3a3a3",
    border: "#262626",
    card: "#141414",
    ring: "#6366f1",
    radius: "0.5rem",
    fontSans: "Inter, system-ui, sans-serif",
  },
  colorful: {
    label: "Colorful",
    primary: "hsl(45, 100%, 60%)",
    primaryForeground: "hsl(0, 0%, 5%)",
    background: "hsl(0, 0%, 7.04%)",
    foreground: "hsl(0, 0%, 92%)",
    muted: "hsl(0, 0%, 12.9%)",
    mutedForeground: "hsla(0, 0%, 70%, 0.8)",
    border: "hsla(0, 0%, 40%, 20%)",
    card: "hsl(0, 0%, 9.8%)",
    ring: "hsl(45, 90%, 55%)",
    radius: "0.75rem",
    fontSans: "Inter, system-ui, sans-serif",
  },
  darksharp: {
    label: "Darksharp",
    primary: "#fafaf9",
    primaryForeground: "#0c0a09",
    background: "#000000",
    foreground: "#fafaf9",
    muted: "#1c1917",
    mutedForeground: "#a8a29e",
    border: "#292524",
    card: "#0c0a09",
    ring: "#fafaf9",
    radius: "0.2rem",
    fontSans: "Inter, system-ui, sans-serif",
  },
  "pixel-border": {
    label: "Pixel Border",
    primary: "#fbfbfa",
    primaryForeground: "#0a0a0a",
    background: "#050505",
    foreground: "#fafafa",
    muted: "#262626",
    mutedForeground: "#8c8c8c",
    border: "#262626",
    card: "#0d0d0d",
    ring: "#fbfbfa",
    radius: "0px",
    fontSans: "Inter, system-ui, sans-serif",
  },
  shiny: {
    label: "Shiny",
    primary: "hsl(256, 100%, 72%)",
    primaryForeground: "#ffffff",
    background: "hsl(240, 10%, 7%)",
    foreground: "hsl(0, 0%, 95%)",
    muted: "hsl(240, 5%, 16%)",
    mutedForeground: "hsl(240, 4%, 58%)",
    border: "hsl(240, 5%, 18%)",
    card: "hsl(240, 8%, 10%)",
    ring: "hsl(256, 85%, 65%)",
    radius: "0.75rem",
    fontSans: "Inter, system-ui, sans-serif",
  },
  ledger: {
    label: "Ledger",
    primary: "#5f6cf6",
    primaryForeground: "#ffffff",
    background: "#f6f8fb",
    foreground: "#30364a",
    muted: "#eef3fb",
    mutedForeground: "#677187",
    border: "#dbe3ef",
    card: "#ffffff",
    ring: "#5f6cf6",
    radius: "0.5rem",
    fontSans: "Inter, system-ui, sans-serif",
  },
  darkbold: {
    label: "DarkBold",
    primary: "#ffffff",
    primaryForeground: "#000000",
    background: "#0a0a0a",
    foreground: "#ededed",
    muted: "#1a1a1a",
    mutedForeground: "#888888",
    border: "#333333",
    card: "#111111",
    ring: "#ffffff",
    radius: "0.5rem",
    fontSans: "Geist, system-ui, sans-serif",
  },
};

export const TWEAKS_ACCENT_SWATCHES: ReadonlyArray<{ value: string; name: string }> = [
  { value: "#ef4444", name: "Red" },
  { value: "#f97316", name: "Orange" },
  { value: "#eab308", name: "Yellow" },
  { value: "#22c55e", name: "Green" },
  { value: "#14b8a6", name: "Teal" },
  { value: "#3b82f6", name: "Blue" },
  { value: "#6366f1", name: "Indigo" },
  { value: "#8b5cf6", name: "Violet" },
  { value: "#ec4899", name: "Pink" },
  { value: "#fafafa", name: "White" },
];

export const TWEAKS_DENSITY_SCALE: Record<TweaksDensity, string> = {
  compact: "0.9",
  comfortable: "1",
  roomy: "1.1",
};

export const TWEAKS_DEFAULT_STORAGE_KEY = "fd:tweaks:v1";

/**
 * Default font options use generic family stacks that are guaranteed to be
 * different visually regardless of which fonts the host site loaded. If you
 * want named fonts (Inter, Geist, …) provide them via `TweaksConfig.fontOptions`
 * — but only after ensuring the host actually loads them, otherwise the
 * browser silently falls back to the same system font and the change is
 * invisible.
 */
export const TWEAKS_DEFAULT_FONT_OPTIONS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "System", value: "system-ui, -apple-system, sans-serif" },
  { label: "Sans", value: "ui-sans-serif, system-ui, sans-serif" },
  { label: "Serif", value: "ui-serif, Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "ui-monospace, Menlo, Monaco, monospace" },
];

export function readSavedTweaks(storageKey: string = TWEAKS_DEFAULT_STORAGE_KEY): TweaksState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") return parsed as TweaksState;
    return null;
  } catch {
    return null;
  }
}

export function writeSavedTweaks(
  state: TweaksState,
  storageKey: string = TWEAKS_DEFAULT_STORAGE_KEY,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // silently ignore
  }
}

/** Remove the persisted tweaks entry. No-op on SSR. */
export function clearSavedTweaks(storageKey: string = TWEAKS_DEFAULT_STORAGE_KEY): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // noop
  }
}

const RADIUS_OVERRIDE_STYLE_ID = "fd-tweaks-radius-override";
const LAYOUT_OVERRIDE_STYLE_ID = "fd-tweaks-layout-override";
const FOUC_VARS_STYLE_ID = "fd-tweaks-vars";

/**
 * Apply token-level tweaks (preset colors, radius, font scale, font family,
 * per-token color overrides) via a single `<style id="fd-tweaks-vars">`
 * element in `<head>`, rather than mutating inline styles on `<html>` /
 * `<body>`.
 *
 * Why: writing inline styles on the documentElement before React hydrates
 * creates a server/client attribute mismatch that aborts hydration on the
 * entire tree (every onClick handler fails to attach). A fresh `<style>`
 * element appended to `<head>` isn't part of React's SSR tree, so it
 * doesn't show up in the hydration diff. The cascade resolves the
 * variables identically either way.
 *
 * Targets both `:root` and `body` because Next.js's `next/font` className
 * redefines `--fd-font-sans` on `<body>`; rules on `:root` alone would lose
 * the cascade at body scope. `!important` is added so we beat any
 * className-scoped definitions (which lack `!important` themselves).
 */
function applyFoucVars(state: TweaksState): void {
  if (typeof document === "undefined") return;

  const declarations: string[] = [];

  if (state.preset && state.preset in TWEAKS_PRESET_BUNDLE) {
    const p = TWEAKS_PRESET_BUNDLE[state.preset];
    declarations.push(`--color-fd-primary:${p.primary}`);
    declarations.push(`--color-fd-primary-foreground:${p.primaryForeground}`);
    declarations.push(`--color-fd-background:${p.background}`);
    declarations.push(`--color-fd-foreground:${p.foreground}`);
    declarations.push(`--color-fd-muted:${p.muted}`);
    declarations.push(`--color-fd-muted-foreground:${p.mutedForeground}`);
    declarations.push(`--color-fd-border:${p.border}`);
    declarations.push(`--color-fd-card:${p.card}`);
    declarations.push(`--color-fd-ring:${p.ring}`);
    declarations.push(`--radius:${p.radius}`);
    declarations.push(`--fd-font-sans:${p.fontSans}`);
  }
  if (state.primary) {
    declarations.push(`--color-fd-primary:${state.primary}`);
    declarations.push(`--color-fd-ring:${state.primary}`);
  }
  if (state.radius) {
    declarations.push(`--radius:${state.radius}`);
  }
  if (state.density) {
    declarations.push(`--fd-font-scale:${TWEAKS_DENSITY_SCALE[state.density]}`);
  }
  if (state.fontFamily) {
    declarations.push(`--fd-font-sans:${state.fontFamily}`);
  }
  if (state.colors) {
    for (const key of TWEAKS_COLOR_KEYS) {
      const value = state.colors[key];
      if (value) declarations.push(`${COLOR_KEY_TO_CSS_VAR[key]}:${value}`);
    }
  }

  let style = document.getElementById(FOUC_VARS_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = FOUC_VARS_STYLE_ID;
    document.head.appendChild(style);
  }

  style.textContent =
    declarations.length === 0
      ? ""
      : `:root, body { ${declarations.map((d) => d + " !important").join("; ")}; }`;
}

function clearFoucVars(): void {
  if (typeof document === "undefined") return;
  const style = document.getElementById(FOUC_VARS_STYLE_ID);
  if (style) style.remove();
}

/**
 * Most preset CSS files hardcode `border-radius` per element rather than
 * referencing `var(--radius)`, so setting --radius alone has no visible
 * effect. We additionally emit a `<style>` block that overrides common
 * rounded UI elements with the chosen value.
 *
 * The override targets framework-shipped element classes; theme authors
 * who want their custom elements to participate can use `var(--radius)`
 * in their own CSS.
 */
function applyRadiusOverride(value: string): void {
  if (typeof document === "undefined") return;
  let style = document.getElementById(RADIUS_OVERRIDE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = RADIUS_OVERRIDE_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent =
    `:where(.fd-page-action-btn, .fd-page-action-menu, .fd-page-action-menu-item, ` +
    `.fd-feedback-input, .fd-feedback-submit, .fd-feedback-choice, ` +
    `.fd-page-nav-card, .fd-prompt, .fd-prompt-body, .fd-prompt-action-btn, ` +
    `.fd-prompt-menu, .fd-prompt-menu-item, .fd-ai-dialog, .fd-ai-floating-btn, ` +
    `.fd-ai-suggestion, .fd-ai-input-wrap, .fd-tweaks-dialog, .fd-tweaks-swatch, ` +
    `.fd-tweaks-chip, .fd-tweaks-select, .fd-tweaks-reset, .fd-tweaks-chips) ` +
    `{ border-radius: ${value} !important; }`;
}

function clearRadiusOverride(): void {
  if (typeof document === "undefined") return;
  const style = document.getElementById(RADIUS_OVERRIDE_STYLE_ID);
  if (style) style.remove();
}

/**
 * Override layout dimensions at runtime. The framework's `LayoutStyle`
 * SSR-emits these on `:root` and (for sidebar) on `[style*="fd-sidebar-col"]`
 * with `!important`. Additionally, fumadocs-ui's sidebar placeholder gets a
 * Tailwind arbitrary class like `md:layout:[--fd-sidebar-width:268px]` that
 * sets the variable on that specific element — which beats any cascade from
 * `documentElement`. So we have to inject an `!important` override that
 * targets the same elements.
 *
 * TOC and sidebar widths are responsive: TOC hides below 1200px, sidebar
 * hides below 767px. A matchMedia listener re-applies the override when
 * the viewport crosses those thresholds.
 */

let lastLayoutOptions: { sidebarWidth?: string; contentWidth?: string; tocWidth?: string } | null = null;
let layoutMediaCleanup: (() => void) | null = null;

function applyLayoutOverride(options: {
  sidebarWidth?: string;
  contentWidth?: string;
  tocWidth?: string;
}): void {
  if (typeof document === "undefined") return;

  lastLayoutOptions = options;

  let style = document.getElementById(LAYOUT_OVERRIDE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = LAYOUT_OVERRIDE_STYLE_ID;
    document.head.appendChild(style);
  }
  const rules: string[] =           [];
  if (options.sidebarWidth) {
    const sidebarVisible = window.matchMedia("(min-width: 767px)").matches;
    if (sidebarVisible) {
      rules.push(
        `:root, [data-sidebar-placeholder], [style*="fd-sidebar-col"] {` +
          ` --fd-sidebar-width: ${options.sidebarWidth} !important;` +
          ` --fd-sidebar-col: ${options.sidebarWidth} !important;` +
          ` }`,
      );
    }
  }
  if (options.contentWidth) {
    rules.push(
      `:root { --fd-content-width: ${options.contentWidth} !important; }`,
    );
    rules.push(
      `article#nd-page, article#nd-page > .prose {` +
        ` max-width: ${options.contentWidth} !important;` +
        ` }`,
    );
  }
  if (options.tocWidth) {
    const tocVisible = window.matchMedia("(min-width: 1200px)").matches;
    if (tocVisible) {
      rules.push(
        `:root, [style*="--fd-toc-width"], [style*="fd-sidebar-col"] {` +
          ` --fd-toc-width: ${options.tocWidth} !important;` +
          ` }`,
      );
    }
  }
  style.textContent = rules.join("\n");

  setupLayoutMediaListeners();
}

function setupLayoutMediaListeners(): void {
  if (typeof window === "undefined" || layoutMediaCleanup) return;

  const tocMediaQuery = window.matchMedia("(min-width: 1200px)");
  const sidebarMediaQuery = window.matchMedia("(min-width: 767px)");

  const handler = () => {
    if (lastLayoutOptions) applyLayoutOverride(lastLayoutOptions);
  };

  tocMediaQuery.addEventListener("change", handler);
  sidebarMediaQuery.addEventListener("change", handler);

  layoutMediaCleanup = () => {
    tocMediaQuery.removeEventListener("change", handler);
    sidebarMediaQuery.removeEventListener("change", handler);
  };
}

function clearLayoutOverride(): void {
  if (typeof document === "undefined") return;
  const style = document.getElementById(LAYOUT_OVERRIDE_STYLE_ID);
  if (style) style.remove();
  lastLayoutOptions = null;
  if (layoutMediaCleanup) {
    layoutMediaCleanup();
    layoutMediaCleanup = null;
  }
}

/**
 * Apply the given tweaks state. Writes a single `<style id="fd-tweaks-vars">`
 * element to `<head>` (no inline-style mutation on `<html>` / `<body>`), so
 * applying tweaks before React hydrates does not produce a hydration
 * mismatch. No-op on SSR.
 */
export function applyTweaks(state: TweaksState): void {
  if (typeof document === "undefined") return;

  applyFoucVars(state);

  if (state.radius) {
    applyRadiusOverride(state.radius);
  }
  if (state.sidebarWidth || state.contentWidth || state.tocWidth) {
    applyLayoutOverride({
      sidebarWidth: state.sidebarWidth,
      contentWidth: state.contentWidth,
      tocWidth: state.tocWidth,
    });
  }
}

/**
 * Remove every CSS variable Tweaks may have set, reverting to the
 * SSR-applied preset values.
 */
export function resetTweaks(): void {
  if (typeof document === "undefined") return;
  clearFoucVars();
  clearRadiusOverride();
  clearLayoutOverride();
}

/**
 * Inline `<script>` body that applies saved tweaks before the browser paints —
 * the same trick `next-themes` uses for dark-mode FOUC prevention.
 *
 * The script is self-contained: it reads `localStorage`, parses the saved
 * state, and writes inline styles directly to `documentElement`. Bundle is
 * inlined so the script has no runtime dependencies.
 */
export function buildFoucScript(storageKey: string = TWEAKS_DEFAULT_STORAGE_KEY): string {
  const bundle = JSON.stringify(TWEAKS_PRESET_BUNDLE);
  const density = JSON.stringify(TWEAKS_DENSITY_SCALE);
  const key = JSON.stringify(storageKey);
  return (
    "(function(){try{" +
    `var storage=localStorage.getItem(${key});if(!storage)return;` +
    "var tweaks=JSON.parse(storage);if(!tweaks||typeof tweaks!=='object')return;" +
    "var root=document.documentElement;" +
    `var presets=${bundle};` +
    "if(tweaks.preset&&presets[tweaks.preset]){var preset=presets[tweaks.preset];" +
    "root.style.setProperty('--color-fd-primary',preset.primary);" +
    "root.style.setProperty('--color-fd-primary-foreground',preset.primaryForeground);" +
    "root.style.setProperty('--color-fd-background',preset.background);" +
    "root.style.setProperty('--color-fd-foreground',preset.foreground);" +
    "root.style.setProperty('--color-fd-muted',preset.muted);" +
    "root.style.setProperty('--color-fd-muted-foreground',preset.mutedForeground);" +
    "root.style.setProperty('--color-fd-border',preset.border);" +
    "root.style.setProperty('--color-fd-card',preset.card);" +
    "root.style.setProperty('--color-fd-ring',preset.ring);" +
    "root.style.setProperty('--radius',preset.radius);" +
    "if(document.body){document.body.style.setProperty('--fd-font-sans',preset.fontSans);}}" +
    "if(tweaks.primary){root.style.setProperty('--color-fd-primary',tweaks.primary);root.style.setProperty('--color-fd-ring',tweaks.primary);}" +
    "if(tweaks.radius){root.style.setProperty('--radius',tweaks.radius);" +
    `var radiusOverride=document.createElement('style');radiusOverride.id='${RADIUS_OVERRIDE_STYLE_ID}';` +
    "radiusOverride.textContent=':where(.fd-page-action-btn,.fd-page-action-menu,.fd-page-action-menu-item,.fd-feedback-input,.fd-feedback-submit,.fd-feedback-choice,.fd-page-nav-card,.fd-prompt,.fd-prompt-body,.fd-prompt-action-btn,.fd-prompt-menu,.fd-prompt-menu-item,.fd-ai-dialog,.fd-ai-floating-btn,.fd-ai-suggestion,.fd-ai-input-wrap,.fd-tweaks-dialog,.fd-tweaks-swatch,.fd-tweaks-chip,.fd-tweaks-select,.fd-tweaks-reset,.fd-tweaks-chips){border-radius:'+tweaks.radius+' !important;}';" +
    "document.head.appendChild(radiusOverride);}" +
    `if(tweaks.density){var density=${density};if(density[tweaks.density])root.style.setProperty('--fd-font-scale',density[tweaks.density]);}` +
    "if(tweaks.fontFamily&&document.body){document.body.style.setProperty('--fd-font-sans',tweaks.fontFamily);}" +
    "}catch(e){}})();"
  );
}
