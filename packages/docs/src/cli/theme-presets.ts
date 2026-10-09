export const THEME_FRAMEWORKS = [
  "nextjs",
  "tanstack-start",
  "farmjs",
  "sveltekit",
  "astro",
  "nuxt",
] as const;

export type ThemeFramework = (typeof THEME_FRAMEWORKS)[number];

export interface ThemeInfo {
  factory: string;
  nextImport: string;
  svelteImport: string;
  astroImport: string;
  nuxtImport: string;
  nextCssImport: string;
}

export interface BuiltInThemePreset extends ThemeInfo {
  value: string;
  label: string;
  hint: string;
  frameworks: readonly ThemeFramework[];
}

const allFrameworks = THEME_FRAMEWORKS;
const reactFrameworks = ["nextjs", "tanstack-start", "farmjs"] as const;

export const BUILT_IN_THEME_PRESETS = [
  {
    value: "fumadocs",
    label: "Fumadocs (Default)",
    hint: "Clean, modern docs theme with sidebar, search, and dark mode",
    factory: "fumadocs",
    nextImport: "@farming-labs/theme",
    svelteImport: "@farming-labs/svelte-theme",
    astroImport: "@farming-labs/astro-theme",
    nuxtImport: "@farming-labs/nuxt-theme",
    nextCssImport: "default",
    frameworks: allFrameworks,
  },
  {
    value: "darksharp",
    label: "Darksharp",
    hint: "All-black, sharp edges, zero-radius look",
    factory: "darksharp",
    nextImport: "@farming-labs/theme/darksharp",
    svelteImport: "@farming-labs/svelte-theme/darksharp",
    astroImport: "@farming-labs/astro-theme/darksharp",
    nuxtImport: "@farming-labs/nuxt-theme/darksharp",
    nextCssImport: "darksharp",
    frameworks: allFrameworks,
  },
  {
    value: "pixel-border",
    label: "Pixel Border",
    hint: "Rounded borders, pixel-perfect spacing, refined sidebar",
    factory: "pixelBorder",
    nextImport: "@farming-labs/theme/pixel-border",
    svelteImport: "@farming-labs/svelte-theme/pixel-border",
    astroImport: "@farming-labs/astro-theme/pixel-border",
    nuxtImport: "@farming-labs/nuxt-theme/pixel-border",
    nextCssImport: "pixel-border",
    frameworks: allFrameworks,
  },
  {
    value: "colorful",
    label: "Colorful",
    hint: "Fumadocs-style neutral theme with description support",
    factory: "colorful",
    nextImport: "@farming-labs/theme/colorful",
    svelteImport: "@farming-labs/svelte-theme/colorful",
    astroImport: "@farming-labs/astro-theme/colorful",
    nuxtImport: "@farming-labs/nuxt-theme/colorful",
    nextCssImport: "colorful",
    frameworks: allFrameworks,
  },
  {
    value: "darkbold",
    label: "DarkBold",
    hint: "Pure monochrome, Geist typography, clean minimalism",
    factory: "darkbold",
    nextImport: "@farming-labs/theme/darkbold",
    svelteImport: "@farming-labs/svelte-theme/darkbold",
    astroImport: "@farming-labs/astro-theme/darkbold",
    nuxtImport: "@farming-labs/nuxt-theme/darkbold",
    nextCssImport: "darkbold",
    frameworks: reactFrameworks,
  },
  {
    value: "shiny",
    label: "Shiny",
    hint: "Glossy, modern look with subtle shimmer effects",
    factory: "shiny",
    nextImport: "@farming-labs/theme/shiny",
    svelteImport: "@farming-labs/svelte-theme/shiny",
    astroImport: "@farming-labs/astro-theme/shiny",
    nuxtImport: "@farming-labs/nuxt-theme/shiny",
    nextCssImport: "shiny",
    frameworks: reactFrameworks,
  },
  {
    value: "ledger",
    label: "Ledger",
    hint: "Product docs shell with navy code panels",
    factory: "ledger",
    nextImport: "@farming-labs/theme/ledger",
    svelteImport: "@farming-labs/svelte-theme/ledger",
    astroImport: "@farming-labs/astro-theme/ledger",
    nuxtImport: "@farming-labs/nuxt-theme/ledger",
    nextCssImport: "ledger",
    frameworks: allFrameworks,
  },
  {
    value: "shadcn",
    label: "Shadcn Docs",
    hint: "Compact neutral shell inspired by the shadcn/ui documentation",
    factory: "shadcn",
    nextImport: "@farming-labs/theme/shadcn",
    svelteImport: "@farming-labs/svelte-theme/shadcn",
    astroImport: "@farming-labs/astro-theme/shadcn",
    nuxtImport: "@farming-labs/nuxt-theme/shadcn",
    nextCssImport: "shadcn",
    frameworks: allFrameworks,
  },
  {
    value: "greentree",
    label: "GreenTree",
    hint: "Emerald green accent, Inter font, Mintlify-inspired",
    factory: "greentree",
    nextImport: "@farming-labs/theme/greentree",
    svelteImport: "@farming-labs/svelte-theme/greentree",
    astroImport: "@farming-labs/astro-theme/greentree",
    nuxtImport: "@farming-labs/nuxt-theme/greentree",
    nextCssImport: "greentree",
    frameworks: allFrameworks,
  },
  {
    value: "concrete",
    label: "Concrete",
    hint: "Brutalist poster-style theme with offset shadows and loud contrast",
    factory: "concrete",
    nextImport: "@farming-labs/theme/concrete",
    svelteImport: "@farming-labs/svelte-theme/concrete",
    astroImport: "@farming-labs/astro-theme/concrete",
    nuxtImport: "@farming-labs/nuxt-theme/concrete",
    nextCssImport: "concrete",
    frameworks: allFrameworks,
  },
  {
    value: "command-grid",
    label: "Command Grid",
    hint: "Paper-grid docs shell inspired by better-cmdk",
    factory: "commandGrid",
    nextImport: "@farming-labs/theme/command-grid",
    svelteImport: "@farming-labs/svelte-theme/command-grid",
    astroImport: "@farming-labs/astro-theme/command-grid",
    nuxtImport: "@farming-labs/nuxt-theme/command-grid",
    nextCssImport: "command-grid",
    frameworks: allFrameworks,
  },
  {
    value: "hardline",
    label: "Hardline",
    hint: "Hard-edge theme with square corners and bold borders",
    factory: "hardline",
    nextImport: "@farming-labs/theme/hardline",
    svelteImport: "@farming-labs/svelte-theme/hardline",
    astroImport: "@farming-labs/astro-theme/hardline",
    nuxtImport: "@farming-labs/nuxt-theme/hardline",
    nextCssImport: "hardline",
    frameworks: allFrameworks,
  },
  {
    value: "threadline",
    label: "Threadline",
    hint: "Compact neutral shell for chat and agent documentation",
    factory: "threadline",
    nextImport: "@farming-labs/theme/threadline",
    svelteImport: "@farming-labs/svelte-theme/threadline",
    astroImport: "@farming-labs/astro-theme/threadline",
    nuxtImport: "@farming-labs/nuxt-theme/threadline",
    nextCssImport: "threadline",
    frameworks: reactFrameworks,
  },
  {
    value: "junction",
    label: "Junction",
    hint: "Dashed rails, square junction marks, and compact technical typography",
    factory: "junction",
    nextImport: "@farming-labs/theme/junction",
    svelteImport: "@farming-labs/svelte-theme/junction",
    astroImport: "@farming-labs/astro-theme/junction",
    nuxtImport: "@farming-labs/nuxt-theme/junction",
    nextCssImport: "junction",
    frameworks: allFrameworks,
  },
] as const satisfies readonly BuiltInThemePreset[];

const presetByValue = new Map<string, BuiltInThemePreset>(
  BUILT_IN_THEME_PRESETS.map((preset) => [preset.value, preset]),
);

export function getThemeInfo(theme: string): BuiltInThemePreset {
  return presetByValue.get(theme) ?? presetByValue.get("fumadocs")!;
}

export function getThemeOptions(framework: ThemeFramework) {
  return BUILT_IN_THEME_PRESETS.filter((preset) =>
    preset.frameworks.some((candidate) => candidate === framework),
  ).map(({ value, label, hint }) => ({ value, label, hint }));
}

export function getFrameworkThemeCssName(theme: string): string {
  return getThemeInfo(theme).value;
}
