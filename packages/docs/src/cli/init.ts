import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  type Framework,
  type PackageManager,
  detectFramework,
  detectPackageManagerFromLockfile,
  detectGlobalCssFiles,
  detectNextAppDir,
  installCommand,
  devInstallCommand,
  writeFileSafe,
  fileExists,
  readFileSafe,
  exec,
  spawnAndWaitFor,
} from "./utils.js";

const EXAMPLES_REPO = "farming-labs/docs";
export const VALID_TEMPLATES = ["next", "nuxt", "sveltekit", "astro", "tanstack-start"] as const;
export type TemplateName = (typeof VALID_TEMPLATES)[number];

export interface InitOptions {
  template?: string;
  name?: string;
  theme?: string;
  entry?: string;
  apiReference?: boolean;
  apiRouteRoot?: string;
}

import {
  docsConfigTemplate,
  nextConfigTemplate,
  nextConfigMergedTemplate,
  rootLayoutTemplate,
  injectRootProviderIntoLayout,
  globalCssTemplate,
  injectCssImport,
  customThemeTsTemplate,
  customThemeCssTemplate,
  docsLayoutTemplate,
  nextApiReferencePageTemplate,
  nextLocaleDocPageTemplate,
  nextLocalizedPageTemplate,
  postcssConfigTemplate,
  tsconfigTemplate,
  welcomePageTemplate,
  installationPageTemplate,
  quickstartPageTemplate,
  tanstackDocsConfigTemplate,
  tanstackDocsServerTemplate,
  tanstackDocsFunctionsTemplate,
  tanstackDocsIndexRouteTemplate,
  tanstackDocsCatchAllRouteTemplate,
  tanstackApiDocsRouteTemplate,
  tanstackDocsPublicRouteTemplate,
  tanstackApiReferenceRouteTemplate,
  tanstackRootRouteTemplate,
  injectTanstackRootProviderIntoRoute,
  tanstackViteConfigTemplate,
  injectTanstackVitePlugins,
  tanstackWelcomePageTemplate,
  tanstackInstallationPageTemplate,
  tanstackQuickstartPageTemplate,
  svelteDocsConfigTemplate,
  svelteDocsServerTemplate,
  svelteDocsLayoutTemplate,
  svelteDocsLayoutServerTemplate,
  svelteDocsPageTemplate,
  svelteDocsApiRouteTemplate,
  svelteDocsPublicHookTemplate,
  injectSvelteDocsPublicHook,
  svelteApiReferenceRouteTemplate,
  svelteRootLayoutTemplate,
  svelteGlobalCssTemplate,
  injectSvelteCssImport,
  svelteWelcomePageTemplate,
  svelteInstallationPageTemplate,
  svelteQuickstartPageTemplate,
  astroDocsConfigTemplate,
  astroDocsServerTemplate,
  astroConfigTemplate,
  astroDocsPageTemplate,
  astroDocsIndexTemplate,
  astroApiRouteTemplate,
  astroDocsMiddlewareTemplate,
  injectAstroDocsMiddleware,
  astroApiReferenceRouteTemplate,
  astroGlobalCssTemplate,
  injectAstroCssImport,
  astroWelcomePageTemplate,
  astroInstallationPageTemplate,
  astroQuickstartPageTemplate,
  getAstroAdapterPkg,
  nuxtDocsConfigTemplate,
  nuxtServerApiDocsRouteTemplate,
  nuxtServerDocsPublicMiddlewareTemplate,
  nuxtServerApiReferenceRouteTemplate,
  nuxtDocsPageTemplate,
  nuxtConfigTemplate,
  nuxtWelcomePageTemplate,
  nuxtInstallationPageTemplate,
  nuxtQuickstartPageTemplate,
  nuxtGlobalCssTemplate,
  injectNuxtCssImport,
  type TemplateConfig,
} from "./templates.js";

const COMMON_LOCALE_OPTIONS = [
  { value: "en", label: "English", hint: "en" },
  { value: "fr", label: "French", hint: "fr" },
  { value: "es", label: "Spanish", hint: "es" },
  { value: "de", label: "German", hint: "de" },
  { value: "pt", label: "Portuguese", hint: "pt" },
  { value: "it", label: "Italian", hint: "it" },
  { value: "ja", label: "Japanese", hint: "ja" },
  { value: "ko", label: "Korean", hint: "ko" },
  { value: "zh", label: "Chinese", hint: "zh" },
  { value: "ar", label: "Arabic", hint: "ar" },
  { value: "hi", label: "Hindi", hint: "hi" },
  { value: "ru", label: "Russian", hint: "ru" },
] as const;

function normalizeLocaleCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const [language, ...rest] = trimmed.split("-");
  const normalizedLanguage = language.toLowerCase();
  if (rest.length === 0) return normalizedLanguage;
  return `${normalizedLanguage}-${rest.join("-").toUpperCase()}`;
}

function parseLocaleInput(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((value) => normalizeLocaleCode(value))
        .filter(Boolean),
    ),
  );
}

function normalizeEntryPath(entry: string): string {
  return entry.replace(/^\/+|\/+$/g, "");
}

function getTanstackDocsRouteDir(entry: string): string {
  return path.posix.join("src/routes", normalizeEntryPath(entry));
}

function normalizeApiRouteRoot(routeRoot: string): string {
  return routeRoot.replace(/^\/+|\/+$/g, "");
}

function detectApiRouteRoot(
  cwd: string,
  framework: Framework,
  nextAppDir: "app" | "src/app" = "app",
): string {
  const defaultRoot = "api";

  const detectFromRecursiveRouteFiles = (
    baseDir: string,
    matcher: (entry: fs.Dirent, relativePath: string) => boolean,
  ): string | null => {
    if (!fs.existsSync(baseDir)) return null;

    const candidates = new Map<string, number>();
    const walk = (dir: string, prefix = "") => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath, relativePath);
          continue;
        }

        if (!matcher(entry, relativePath)) continue;
        const [topLevel] = relativePath.split("/");
        if (!topLevel) continue;
        candidates.set(topLevel, (candidates.get(topLevel) ?? 0) + 1);
      }
    };

    walk(baseDir);

    return Array.from(candidates.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };

  if (framework === "nextjs") {
    const appRoot = path.join(cwd, nextAppDir);
    if (fs.existsSync(path.join(appRoot, defaultRoot))) return defaultRoot;
    return (
      detectFromRecursiveRouteFiles(appRoot, (_entry, relativePath) =>
        /\/?route\.(?:[cm]?[jt]sx?)$/i.test(relativePath),
      ) ?? defaultRoot
    );
  }

  if (framework === "tanstack-start") {
    const routesRoot = path.join(cwd, "src/routes");
    if (fs.existsSync(path.join(routesRoot, defaultRoot))) return defaultRoot;

    const topLevel = detectFromRecursiveRouteFiles(routesRoot, (_entry, relativePath) =>
      /(?:^|\/)[^/]+\.(?:[cm]?[jt]sx?)$/i.test(relativePath),
    );
    return topLevel ?? defaultRoot;
  }

  if (framework === "sveltekit") {
    const routesRoot = path.join(cwd, "src/routes");
    if (fs.existsSync(path.join(routesRoot, defaultRoot))) return defaultRoot;
    return (
      detectFromRecursiveRouteFiles(routesRoot, (_entry, relativePath) =>
        /\/?\+server\.(?:[cm]?[jt]s)$/i.test(relativePath),
      ) ?? defaultRoot
    );
  }

  if (framework === "astro") {
    const pagesRoot = path.join(cwd, "src/pages");
    if (fs.existsSync(path.join(pagesRoot, defaultRoot))) return defaultRoot;
    return (
      detectFromRecursiveRouteFiles(
        pagesRoot,
        (entry, relativePath) =>
          /\.(?:[cm]?[jt]s)$/i.test(relativePath) &&
          !relativePath.endsWith(".d.ts") &&
          entry.isFile(),
      ) ?? defaultRoot
    );
  }

  const serverRoot = path.join(cwd, "server");
  if (fs.existsSync(path.join(serverRoot, defaultRoot))) return defaultRoot;
  return (
    detectFromRecursiveRouteFiles(
      serverRoot,
      (entry, relativePath) =>
        /\.(?:[cm]?[jt]s)$/i.test(relativePath) &&
        !relativePath.endsWith(".d.ts") &&
        entry.isFile(),
    ) ?? defaultRoot
  );
}

export async function init(options: InitOptions = {}) {
  const cwd = process.cwd();

  p.intro(pc.bgCyan(pc.black(" @farming-labs/docs ")));

  // -----------------------------------------------------------------------
  // Ask: existing project or fresh project? (skip when --template is passed)
  // -----------------------------------------------------------------------

  type ProjectType = "existing" | "fresh";
  let projectType: ProjectType = "existing";

  if (!options.template) {
    const projectTypeAnswer = await p.select({
      message: "Are you adding docs to an existing project or starting fresh?",
      options: [
        {
          value: "existing",
          label: "Existing project",
          hint: "Add docs to the current app in this directory",
        },
        {
          value: "fresh",
          label: "Fresh project",
          hint: "Bootstrap a new app from a template (Next, Nuxt, SvelteKit, Astro, TanStack Start)",
        },
      ] as const,
    });

    if (p.isCancel(projectTypeAnswer)) {
      p.outro(pc.red("Init cancelled."));
      process.exit(0);
    }
    projectType = projectTypeAnswer as ProjectType;
  }

  // -----------------------------------------------------------------------
  // Fresh project: pick framework, project name, then clone template
  // -----------------------------------------------------------------------

  if (projectType === "fresh" || options.template) {
    let template: TemplateName;
    if (options.template) {
      template = options.template.toLowerCase() as TemplateName;
      if (!VALID_TEMPLATES.includes(template)) {
        p.log.error(
          `Invalid ${pc.cyan("--template")}. Use one of: ${VALID_TEMPLATES.map((t) => pc.cyan(t)).join(", ")}`,
        );
        process.exit(1);
      }
    } else {
      const templateAnswer = await p.select({
        message: "Which framework would you like to use?",
        options: [
          { value: "next", label: "Next.js", hint: "React with App Router" },
          { value: "nuxt", label: "Nuxt", hint: "Vue 3 with file-based routing" },
          { value: "sveltekit", label: "SvelteKit", hint: "Svelte with file-based routing" },
          { value: "astro", label: "Astro", hint: "Content-focused with islands" },
          {
            value: "tanstack-start",
            label: "TanStack Start",
            hint: "React with TanStack Router and server functions",
          },
        ],
      });
      if (p.isCancel(templateAnswer)) {
        p.outro(pc.red("Init cancelled."));
        process.exit(0);
      }
      template = templateAnswer as TemplateName;
    }

    const defaultProjectName = "my-docs";
    let projectName = options.name?.trim();
    if (!projectName) {
      const nameAnswer = await p.text({
        message: "Project name? (we'll create this folder and bootstrap the app here)",
        placeholder: defaultProjectName,
        defaultValue: defaultProjectName,
        validate: (value) => {
          const v = (value ?? "").trim();
          if (v.includes("/") || v.includes("\\"))
            return "Project name cannot contain path separators";
          if (v.includes(" ")) return "Project name cannot contain spaces";
        },
      });
      if (p.isCancel(nameAnswer)) {
        p.outro(pc.red("Init cancelled."));
        process.exit(0);
      }
      projectName = (nameAnswer as string).trim() || defaultProjectName;
    }

    const templateLabel =
      template === "next"
        ? "Next.js"
        : template === "nuxt"
          ? "Nuxt"
          : template === "sveltekit"
            ? "SvelteKit"
            : template === "astro"
              ? "Astro"
              : "TanStack Start";

    const targetDir = path.join(cwd, projectName);
    const fs = await import("node:fs");
    if (fs.existsSync(targetDir)) {
      p.log.error(
        `Directory ${pc.cyan(projectName)} already exists. Choose a different ${pc.cyan("--name")} or remove it.`,
      );
      process.exit(1);
    }
    fs.mkdirSync(targetDir, { recursive: true });

    p.log.step(`Bootstrapping project with ${pc.cyan(`'${projectName}'`)} (${templateLabel})...`);

    try {
      exec(`npx degit ${EXAMPLES_REPO}/examples/${template} . --force`, targetDir);
    } catch {
      p.log.error("Failed to bootstrap. Check your connection and that the repo exists.");
      process.exit(1);
    }

    // -------------------------------------------------------------------
    // Fresh project: let the user pick their package manager
    // -------------------------------------------------------------------

    const pmAnswer = await p.select({
      message: "Which package manager do you want to use in this new project?",
      options: [
        { value: "pnpm", label: "pnpm", hint: "Fast, disk-efficient (recommended)" },
        { value: "npm", label: "npm", hint: "Default Node.js package manager" },
        { value: "yarn", label: "yarn", hint: "Classic yarn (script: yarn dev)" },
        { value: "bun", label: "bun", hint: "Bun runtime + bun install/dev" },
      ] as const,
    });

    if (p.isCancel(pmAnswer)) {
      p.outro(pc.red("Init cancelled."));
      process.exit(0);
    }

    const pmFresh = pmAnswer as PackageManager;

    p.log.success(
      `Bootstrapped ${pc.cyan(`'${projectName}'`)}. Installing dependencies with ${pc.cyan(pmFresh)}...`,
    );

    const installCmd =
      pmFresh === "yarn"
        ? "yarn install"
        : pmFresh === "npm"
          ? "npm install"
          : pmFresh === "bun"
            ? "bun install"
            : "pnpm install";

    try {
      exec(installCmd, targetDir);
    } catch {
      p.log.warn(
        `${pmFresh} install failed. Run ${pc.cyan(installCmd)} manually inside the project.`,
      );
    }

    const devCmd =
      pmFresh === "yarn"
        ? "yarn dev"
        : pmFresh === "npm"
          ? "npm run dev"
          : pmFresh === "bun"
            ? "bun dev"
            : "pnpm dev";

    p.outro(
      pc.green(
        `Done! Run ${pc.cyan(`cd ${projectName} && ${devCmd}`)} to start the dev server and navigate to the /docs.`,
      ),
    );
    p.outro(pc.green("Happy documenting!"));
    process.exit(0);
  }

  // -----------------------------------------------------------------------
  // Step 1: Framework detection
  // -----------------------------------------------------------------------

  let framework = detectFramework(cwd);

  if (framework) {
    const frameworkName =
      framework === "nextjs"
        ? "Next.js"
        : framework === "tanstack-start"
          ? "TanStack Start"
          : framework === "sveltekit"
            ? "SvelteKit"
            : framework === "astro"
              ? "Astro"
              : "Nuxt";
    p.log.success(`Detected framework: ${pc.cyan(frameworkName)}`);
  } else {
    p.log.warn("Could not auto-detect a framework from " + pc.cyan("package.json") + ".");

    const picked = await p.select({
      message: "Which framework are you using?",
      options: [
        {
          value: "nextjs",
          label: "Next.js",
          hint: "React framework with App Router",
        },
        {
          value: "tanstack-start",
          label: "TanStack Start",
          hint: "React with TanStack Router and server functions",
        },
        {
          value: "sveltekit",
          label: "SvelteKit",
          hint: "Svelte framework with file-based routing",
        },
        {
          value: "astro",
          label: "Astro",
          hint: "Content-focused framework with island architecture",
        },
        {
          value: "nuxt",
          label: "Nuxt",
          hint: "Vue 3 framework with file-based routing and Nitro server",
        },
      ],
    });

    if (p.isCancel(picked)) {
      p.outro(pc.red("Init cancelled."));
      process.exit(0);
    }

    framework = picked as Framework;
  }

  // -----------------------------------------------------------------------
  // Step 1b: Next.js App Router directory (app vs src/app)
  // -----------------------------------------------------------------------

  let nextAppDir: "app" | "src/app" = "app";
  if (framework === "nextjs") {
    const detected = detectNextAppDir(cwd);
    if (detected) {
      nextAppDir = detected;
      p.log.info(
        `Using App Router at ${pc.cyan(nextAppDir)} (detected ${detected === "src/app" ? "src directory" : "root app"})`,
      );
    } else {
      const useSrcApp = await p.confirm({
        message: "Do you use the src directory for the App Router? (e.g. src/app instead of app)",
        initialValue: false,
      });
      if (p.isCancel(useSrcApp)) {
        p.outro(pc.red("Init cancelled."));
        process.exit(0);
      }
      nextAppDir = useSrcApp ? "src/app" : "app";
    }
  }

  // -----------------------------------------------------------------------
  // Step 2: Theme selection
  // -----------------------------------------------------------------------

  const themeOptions = [
    {
      value: "fumadocs",
      label: "Fumadocs (Default)",
      hint: "Clean, modern docs theme with sidebar, search, and dark mode",
    },
    {
      value: "darksharp",
      label: "Darksharp",
      hint: "All-black, sharp edges, zero-radius look",
    },
    {
      value: "pixel-border",
      label: "Pixel Border",
      hint: "Rounded borders, pixel-perfect spacing, refined sidebar",
    },
    {
      value: "colorful",
      label: "Colorful",
      hint: "Fumadocs-style neutral theme with description support",
    },
    {
      value: "darkbold",
      label: "DarkBold",
      hint: "Pure monochrome, Geist typography, clean minimalism",
    },
    {
      value: "shiny",
      label: "Shiny",
      hint: "Glossy, modern look with subtle shimmer effects",
    },
    {
      value: "ledger",
      label: "Ledger",
      hint: "Stripe Docs-inspired product docs shell with navy code panels",
    },
    {
      value: "greentree",
      label: "GreenTree",
      hint: "Emerald green accent, Inter font, Mintlify-inspired",
    },
    {
      value: "concrete",
      label: "Concrete",
      hint: "Brutalist poster-style theme with offset shadows and loud contrast",
    },
    {
      value: "command-grid",
      label: "Command Grid",
      hint: "Paper-grid docs shell inspired by better-cmdk",
    },
    {
      value: "hardline",
      label: "Hardline",
      hint: "Hard-edge theme with square corners and bold borders",
    },
    {
      value: "custom",
      label: "Create your own theme",
      hint: "Scaffold a new theme file + CSS in themes/ (name asked next)",
    },
  ];
  const themeValues = new Set(themeOptions.map((option) => option.value));
  let theme: string;
  if (options.theme) {
    if (!themeValues.has(options.theme)) {
      p.log.error(
        `Invalid ${pc.cyan("--theme")}. Use one of: ${themeOptions.map((option) => pc.cyan(option.value)).join(", ")}`,
      );
      process.exit(1);
    }
    theme = options.theme;
  } else {
    const themeAnswer = await p.select({
      message: "Which theme would you like to use?",
      options: themeOptions,
    });

    if (p.isCancel(themeAnswer)) {
      p.outro(pc.red("Init cancelled."));
      process.exit(0);
    }

    theme = themeAnswer as string;
  }

  const defaultThemeName = "my-theme";
  let customThemeName: string | undefined;
  if (theme === "custom") {
    const nameAnswer = await p.text({
      message: "Theme name? (we'll create themes/<name>.ts and themes/<name>.css)",
      placeholder: defaultThemeName,
      defaultValue: defaultThemeName,
      validate: (value) => {
        const v = (value ?? "").trim().replace(/\.(ts|css)$/i, "");
        if (v.includes("/") || v.includes("\\")) return "Theme name cannot contain path separators";
        if (v.includes(" ")) return "Theme name cannot contain spaces";
        if (v && !/^[a-z0-9_-]+$/i.test(v))
          return "Use only letters, numbers, hyphens, and underscores";
      },
    });
    if (p.isCancel(nameAnswer)) {
      p.outro(pc.red("Init cancelled."));
      process.exit(0);
    }
    const raw = (nameAnswer as string).trim().replace(/\.(ts|css)$/i, "");
    customThemeName = raw || defaultThemeName;
  }

  // -----------------------------------------------------------------------
  // Step 3: Path alias preference
  // -----------------------------------------------------------------------

  const aliasHint =
    framework === "nextjs"
      ? `Uses ${pc.cyan("@/")} prefix (requires tsconfig paths)`
      : framework === "tanstack-start"
        ? `Uses ${pc.cyan("@/")} prefix (requires tsconfig paths)`
        : framework === "sveltekit"
          ? `Uses ${pc.cyan("$lib/")} prefix (SvelteKit built-in)`
          : framework === "nuxt"
            ? `Uses ${pc.cyan("~/")} prefix (Nuxt built-in)`
            : `Uses ${pc.cyan("@/")} prefix (requires tsconfig paths)`;

  const useAlias = await p.confirm({
    message: `Use path aliases for imports? ${pc.dim(aliasHint)}`,
    initialValue: false,
  });

  if (p.isCancel(useAlias)) {
    p.outro(pc.red("Init cancelled."));
    process.exit(0);
  }

  // -----------------------------------------------------------------------
  // Step 4: Deployment target (Astro only)
  // -----------------------------------------------------------------------

  let astroAdapter: "vercel" | "netlify" | "node" | "cloudflare" | undefined;

  if (framework === "astro") {
    const adapter = await p.select({
      message: "Where will you deploy?",
      options: [
        { value: "vercel", label: "Vercel", hint: "Recommended for most projects" },
        { value: "netlify", label: "Netlify" },
        { value: "cloudflare", label: "Cloudflare Pages" },
        { value: "node", label: "Node.js / Docker", hint: "Self-hosted standalone server" },
      ],
    });

    if (p.isCancel(adapter)) {
      p.outro(pc.red("Init cancelled."));
      process.exit(0);
    }

    astroAdapter = adapter as typeof astroAdapter;
  }

  // -----------------------------------------------------------------------
  // Step 5: Docs entry path
  // -----------------------------------------------------------------------

  const defaultEntry = "docs";
  let entryPath: string;
  if (options.entry) {
    const normalizedEntry = options.entry.trim();
    if (normalizedEntry.startsWith("/")) {
      p.log.error("Use a relative path for --entry (no leading /)");
      process.exit(1);
    }
    if (normalizedEntry.includes(" ")) {
      p.log.error("Path passed to --entry cannot contain spaces");
      process.exit(1);
    }
    entryPath = normalizedEntry || defaultEntry;
  } else {
    const entry = await p.text({
      message: "Where should your docs live?",
      placeholder: defaultEntry,
      defaultValue: defaultEntry,
      validate: (value) => {
        const v = (value ?? "").trim();
        if (v.startsWith("/")) return "Use a relative path (no leading /)";
        if (v.includes(" ")) return "Path cannot contain spaces";
      },
    });

    if (p.isCancel(entry)) {
      p.outro(pc.red("Init cancelled."));
      process.exit(0);
    }

    entryPath = (entry as string).trim() || defaultEntry;
  }

  // -----------------------------------------------------------------------
  // Step 5a: Optional API reference scaffold
  // -----------------------------------------------------------------------

  const defaultApiRouteRoot = normalizeApiRouteRoot(
    options.apiRouteRoot?.trim() || detectApiRouteRoot(cwd, framework, nextAppDir),
  );

  let apiReferenceConfig:
    | {
        path: string;
        routeRoot: string;
      }
    | undefined;

  let enableApiReference: boolean;
  if (typeof options.apiReference === "boolean") {
    enableApiReference = options.apiReference;
  } else if (typeof options.apiRouteRoot === "string" && options.apiRouteRoot.trim()) {
    enableApiReference = true;
  } else {
    const apiReferenceAnswer = await p.confirm({
      message: "Do you want to scaffold API reference support?",
      initialValue: false,
    });

    if (p.isCancel(apiReferenceAnswer)) {
      p.outro(pc.red("Init cancelled."));
      process.exit(0);
    }

    enableApiReference = apiReferenceAnswer;
  }

  if (enableApiReference) {
    let routeRoot = options.apiRouteRoot?.trim();
    if (!routeRoot) {
      const routeRootAnswer = await p.text({
        message: "API route root to scan?",
        placeholder: defaultApiRouteRoot,
        defaultValue: defaultApiRouteRoot,
        validate: (value) => {
          const normalizedValue = normalizeApiRouteRoot((value ?? "").trim());
          if (!normalizedValue) return "Route root cannot be empty";
          if (normalizedValue.includes(" ")) return "Route root cannot contain spaces";
        },
      });

      if (p.isCancel(routeRootAnswer)) {
        p.outro(pc.red("Init cancelled."));
        process.exit(0);
      }

      routeRoot = (routeRootAnswer as string).trim() || defaultApiRouteRoot;
    }

    const normalizedRouteRoot = normalizeApiRouteRoot(routeRoot);
    if (!normalizedRouteRoot) {
      p.log.error("Route root cannot be empty");
      process.exit(1);
    }
    if (normalizedRouteRoot.includes(" ")) {
      p.log.error("Route root cannot contain spaces");
      process.exit(1);
    }

    apiReferenceConfig = {
      path: "api-reference",
      routeRoot: normalizedRouteRoot,
    };
  }

  // -----------------------------------------------------------------------
  // Step 5b: Optional i18n scaffold
  // -----------------------------------------------------------------------

  let docsI18n:
    | {
        locales: string[];
        defaultLocale: string;
      }
    | undefined;

  if (framework === "tanstack-start") {
    p.log.info(
      "Skipping i18n scaffold for TanStack Start. Configure localized routes manually if needed.",
    );
  } else {
    const enableI18n = await p.confirm({
      message: "Do you want to scaffold internationalized docs ?",
      initialValue: false,
    });

    if (p.isCancel(enableI18n)) {
      p.outro(pc.red("Init cancelled."));
      process.exit(0);
    }

    if (!enableI18n) {
      docsI18n = undefined;
    } else {
      const selectedLocales = await p.multiselect({
        message: "Which languages should we scaffold?",
        options: COMMON_LOCALE_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
          hint: option.hint,
        })),
      });

      if (p.isCancel(selectedLocales)) {
        p.outro(pc.red("Init cancelled."));
        process.exit(0);
      }

      const extraLocalesAnswer = await p.text({
        message: "Any additional locale codes? (comma-separated, optional)",
        placeholder: "nl, sv, pt-BR",
        defaultValue: "",
        validate: (value) => {
          const locales = parseLocaleInput(value ?? "");
          const valid = locales.every((locale) => /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(locale));
          return valid ? undefined : "Use locale codes like en, fr, zh, or pt-BR";
        },
      });

      if (p.isCancel(extraLocalesAnswer)) {
        p.outro(pc.red("Init cancelled."));
        process.exit(0);
      }

      const locales = Array.from(
        new Set([
          ...((selectedLocales as string[]) ?? []).map((locale) => normalizeLocaleCode(locale)),
          ...parseLocaleInput((extraLocalesAnswer as string) ?? ""),
        ]),
      ).filter(Boolean);

      if (locales.length === 0) {
        p.log.error("Pick at least one locale to scaffold i18n support.");
        p.outro(pc.red("Init cancelled."));
        process.exit(1);
      }

      const defaultLocaleAnswer = await p.select({
        message: "Which locale should be the default?",
        options: locales.map((locale) => ({
          value: locale,
          label: locale,
          hint: locale === "en" ? "Recommended default" : undefined,
        })),
        initialValue: locales[0],
      });

      if (p.isCancel(defaultLocaleAnswer)) {
        p.outro(pc.red("Init cancelled."));
        process.exit(0);
      }

      docsI18n = {
        locales,
        defaultLocale: defaultLocaleAnswer as string,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Step 6: Global CSS file location
  // -----------------------------------------------------------------------

  const detectedCssFiles = detectGlobalCssFiles(cwd);
  let globalCssRelPath: string;

  const defaultCssPath =
    framework === "tanstack-start"
      ? "src/styles/app.css"
      : framework === "sveltekit"
        ? "src/app.css"
        : framework === "astro"
          ? "src/styles/global.css"
          : framework === "nuxt"
            ? "assets/css/main.css"
            : framework === "nextjs"
              ? `${nextAppDir}/globals.css`
              : "app/globals.css";

  if (detectedCssFiles.length === 1) {
    globalCssRelPath = detectedCssFiles[0];
    p.log.info(`Found global CSS at ${pc.cyan(globalCssRelPath)}`);
  } else if (detectedCssFiles.length > 1) {
    const picked = await p.select({
      message: "Multiple global CSS files found. Which one should we use?",
      options: detectedCssFiles.map((f) => ({ value: f, label: f })),
    });
    if (p.isCancel(picked)) {
      p.outro(pc.red("Init cancelled."));
      process.exit(0);
    }
    globalCssRelPath = picked as string;
  } else {
    const cssPathAnswer = await p.text({
      message: "Where is your global CSS file?",
      placeholder: defaultCssPath,
      defaultValue: defaultCssPath,
      validate: (value) => {
        const v = (value ?? "").trim();
        if (v && !v.endsWith(".css")) return "Path must end with .css";
      },
    });
    if (p.isCancel(cssPathAnswer)) {
      p.outro(pc.red("Init cancelled."));
      process.exit(0);
    }
    globalCssRelPath = (cssPathAnswer as string).trim() || defaultCssPath;
  }

  // -----------------------------------------------------------------------
  // Step 7: Read project info
  // -----------------------------------------------------------------------

  const pkgJsonPath = path.join(cwd, "package.json");
  const pkgJsonContent = readFileSafe(pkgJsonPath);
  const pkgJson = pkgJsonContent ? JSON.parse(pkgJsonContent) : { name: "my-project" };
  const projectName = pkgJson.name || "My Project";

  const cfg: TemplateConfig = {
    entry: entryPath,
    theme,
    customThemeName,
    projectName,
    framework,
    useAlias: useAlias as boolean,
    astroAdapter,
    i18n: docsI18n,
    apiReference: apiReferenceConfig,
    ...(framework === "nextjs" && { nextAppDir }),
  };

  // -----------------------------------------------------------------------
  // Step 8: Write files
  // -----------------------------------------------------------------------

  const s = p.spinner();
  s.start("Scaffolding docs files");

  const written: string[] = [];
  const skipped: string[] = [];

  function write(rel: string, content: string, overwrite = false) {
    const abs = path.join(cwd, rel);
    if (writeFileSafe(abs, content, overwrite)) {
      written.push(rel);
    } else {
      skipped.push(rel);
    }
  }

  if (framework === "tanstack-start") {
    scaffoldTanstackStart(cwd, cfg, globalCssRelPath, write, skipped, written);
  } else if (framework === "sveltekit") {
    scaffoldSvelteKit(cwd, cfg, globalCssRelPath, write, skipped, written);
  } else if (framework === "astro") {
    scaffoldAstro(cwd, cfg, globalCssRelPath, write, skipped, written);
  } else if (framework === "nuxt") {
    scaffoldNuxt(cwd, cfg, globalCssRelPath, write, skipped, written);
  } else {
    scaffoldNextJs(cwd, cfg, globalCssRelPath, write, skipped, written);
  }

  s.stop("Files scaffolded");

  if (written.length > 0) {
    p.log.success(
      `Created ${written.length} file${written.length > 1 ? "s" : ""}:\n` +
        written.map((f) => `  ${pc.green("+")} ${f}`).join("\n"),
    );
  }

  if (skipped.length > 0) {
    p.log.info(
      `Skipped ${skipped.length} existing file${skipped.length > 1 ? "s" : ""}:\n` +
        skipped.map((f) => `  ${pc.dim("-")} ${f}`).join("\n"),
    );
  }

  // -----------------------------------------------------------------------
  // Step 9: Choose package manager (existing project)
  // -----------------------------------------------------------------------

  let pm = detectPackageManagerFromLockfile(cwd);
  if (pm) {
    p.log.info(`Detected ${pc.cyan(pm)}`);
  }

  const pmAnswerExisting = await p.select({
    ...(pm ? { initialValue: pm } : {}),
    message: "Which package manager do you want to use in this project?",
    options: [
      { value: "pnpm", label: "pnpm", hint: "Fast, disk-efficient (recommended)" },
      { value: "npm", label: "npm", hint: "Default Node.js package manager" },
      { value: "yarn", label: "yarn", hint: "Classic yarn (script: yarn dev)" },
      { value: "bun", label: "bun", hint: "Bun runtime + bun install/dev" },
    ] as const,
  });

  if (p.isCancel(pmAnswerExisting)) {
    p.outro(pc.red("Init cancelled."));
    process.exit(0);
  }

  pm = pmAnswerExisting as PackageManager;
  p.log.info(`Using ${pc.cyan(pm)} as package manager`);

  const s2 = p.spinner();
  s2.start("Installing dependencies");

  try {
    if (framework === "tanstack-start") {
      exec(
        `${installCommand(pm)} @farming-labs/docs @farming-labs/theme @farming-labs/tanstack-start`,
        cwd,
      );

      const devDeps = ["@tailwindcss/vite", "tailwindcss"];
      if (useAlias) {
        devDeps.push("vite-tsconfig-paths");
      }

      const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
      const missingDevDeps = devDeps.filter((d) => !allDeps[d]);

      if (missingDevDeps.length > 0) {
        exec(`${devInstallCommand(pm)} ${missingDevDeps.join(" ")}`, cwd);
      }
    } else if (framework === "sveltekit") {
      exec(
        `${installCommand(pm)} @farming-labs/docs @farming-labs/svelte @farming-labs/svelte-theme`,
        cwd,
      );
    } else if (framework === "astro") {
      const adapterPkg = getAstroAdapterPkg(cfg.astroAdapter ?? "vercel");
      exec(
        `${installCommand(pm)} @farming-labs/docs @farming-labs/astro @farming-labs/astro-theme ${adapterPkg}`,
        cwd,
      );
    } else if (framework === "nuxt") {
      exec(
        `${installCommand(pm)} @farming-labs/docs @farming-labs/nuxt @farming-labs/nuxt-theme`,
        cwd,
      );
    } else {
      exec(`${installCommand(pm)} @farming-labs/docs @farming-labs/next @farming-labs/theme`, cwd);

      const devDeps = [
        "@tailwindcss/postcss",
        "postcss",
        "tailwindcss",
        "@types/mdx",
        "@types/node",
      ];

      const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
      const missingDevDeps = devDeps.filter((d) => !allDeps[d]);

      if (missingDevDeps.length > 0) {
        exec(`${devInstallCommand(pm)} ${missingDevDeps.join(" ")}`, cwd);
      }
    }
  } catch {
    s2.stop("Failed to install dependencies");
    p.log.error(
      "Dependency installation failed. Run the install command manually:\n" +
        `  ${pc.cyan(`${installCommand(pm)} @farming-labs/docs`)}`,
    );
    p.outro(pc.yellow("Setup partially complete. Install deps and run dev server manually."));
    process.exit(1);
  }

  s2.stop("Dependencies installed");

  // -----------------------------------------------------------------------
  // Step 10: Start dev server
  // -----------------------------------------------------------------------

  const startDev = await p.confirm({
    message: "Start the dev server now?",
    initialValue: true,
  });

  if (p.isCancel(startDev) || !startDev) {
    p.log.info(
      "You can start the dev server later with:\n" +
        `  ${pc.cyan(`${pm === "yarn" ? "yarn" : pm + " run"} dev`)}`,
    );
    p.outro(pc.green("Done! Happy documenting."));
    process.exit(0);
  }

  p.log.step("Starting dev server...");

  const devCommand =
    framework === "tanstack-start"
      ? { cmd: "npx", args: ["vite", "dev"], waitFor: "ready" }
      : framework === "sveltekit"
        ? { cmd: "npx", args: ["vite", "dev"], waitFor: "ready" }
        : framework === "astro"
          ? { cmd: "npx", args: ["astro", "dev"], waitFor: "ready" }
          : framework === "nuxt"
            ? { cmd: "npx", args: ["nuxt", "dev"], waitFor: "Local" }
            : { cmd: "npx", args: ["next", "dev", "--webpack"], waitFor: "Ready" };

  const defaultPort =
    framework === "tanstack-start"
      ? "5173"
      : framework === "sveltekit"
        ? "5173"
        : framework === "astro"
          ? "4321"
          : framework === "nuxt"
            ? "3000"
            : "3000";

  try {
    const child = await spawnAndWaitFor(
      devCommand.cmd,
      devCommand.args,
      cwd,
      devCommand.waitFor,
      60_000,
    );

    const url = `http://localhost:${defaultPort}/${entryPath}`;

    console.log();
    p.log.success(
      `Dev server is running! Your docs are live at:\n\n` +
        `  ${pc.cyan(pc.underline(url))}\n\n` +
        `  Press ${pc.dim("Ctrl+C")} to stop the server.`,
    );

    p.outro(pc.green("Happy documenting!"));

    await new Promise<void>((resolve) => {
      child.on("close", () => resolve());
      process.on("SIGINT", () => {
        child.kill("SIGINT");
        resolve();
      });
      process.on("SIGTERM", () => {
        child.kill("SIGTERM");
        resolve();
      });
    });
  } catch {
    const manualCmd =
      framework === "tanstack-start"
        ? "npx vite dev"
        : framework === "sveltekit"
          ? "npx vite dev"
          : framework === "astro"
            ? "npx astro dev"
            : framework === "nuxt"
              ? "npx nuxt dev"
              : "pnpm dev";
    p.log.error("Could not start dev server. Try running manually:\n" + `  ${pc.cyan(manualCmd)}`);
    p.outro(pc.yellow("Setup complete. Start the server manually."));
    process.exit(1);
  }
}

function getScaffoldContentRoots(cfg: TemplateConfig): string[] {
  return cfg.i18n?.locales?.length
    ? cfg.i18n.locales.map((locale) => `${cfg.entry}/${locale}`)
    : [cfg.entry];
}

// ---------------------------------------------------------------------------
// Next.js scaffolding
// ---------------------------------------------------------------------------

function scaffoldNextJs(
  cwd: string,
  cfg: TemplateConfig,
  globalCssRelPath: string,
  write: (rel: string, content: string, overwrite?: boolean) => void,
  skipped: string[],
  written: string[],
) {
  const appDir = cfg.nextAppDir ?? "app";

  if (cfg.theme === "custom" && cfg.customThemeName) {
    const baseName = cfg.customThemeName.replace(/\.(ts|css)$/i, "");
    write(`themes/${baseName}.ts`, customThemeTsTemplate(baseName));
    write(`themes/${baseName}.css`, customThemeCssTemplate(baseName));
  }
  write("docs.config.ts", docsConfigTemplate(cfg));

  const existingNextConfig =
    readFileSafe(path.join(cwd, "next.config.ts")) ??
    readFileSafe(path.join(cwd, "next.config.mjs")) ??
    readFileSafe(path.join(cwd, "next.config.js"));

  if (existingNextConfig) {
    const configFile = fileExists(path.join(cwd, "next.config.ts"))
      ? "next.config.ts"
      : fileExists(path.join(cwd, "next.config.mjs"))
        ? "next.config.mjs"
        : "next.config.js";

    const merged = nextConfigMergedTemplate(existingNextConfig);
    if (merged !== existingNextConfig) {
      const abs = path.join(cwd, configFile);
      writeFileSafe(abs, merged, true);
      written.push(configFile + " (updated)");
    } else {
      skipped.push(configFile + " (already configured)");
    }
  } else {
    write("next.config.ts", nextConfigTemplate());
  }

  const rootLayoutPath = path.join(cwd, `${appDir}/layout.tsx`);
  const existingRootLayout = readFileSafe(rootLayoutPath);
  if (!existingRootLayout) {
    write(`${appDir}/layout.tsx`, rootLayoutTemplate(cfg, globalCssRelPath), true);
  } else if (!existingRootLayout.includes("RootProvider")) {
    const injected = injectRootProviderIntoLayout(existingRootLayout);
    if (injected) {
      writeFileSafe(rootLayoutPath, injected, true);
      written.push(`${appDir}/layout.tsx (injected RootProvider)`);
    } else {
      skipped.push(`${appDir}/layout.tsx (could not inject RootProvider)`);
    }
  } else {
    skipped.push(`${appDir}/layout.tsx (already has RootProvider)`);
  }

  const globalCssAbsPath = path.join(cwd, globalCssRelPath);
  const existingGlobalCss = readFileSafe(globalCssAbsPath);
  if (existingGlobalCss) {
    const injected = injectCssImport(
      existingGlobalCss,
      cfg.theme,
      cfg.customThemeName,
      globalCssRelPath,
    );
    if (injected) {
      writeFileSafe(globalCssAbsPath, injected, true);
      written.push(globalCssRelPath + " (updated)");
    } else {
      skipped.push(globalCssRelPath + " (already configured)");
    }
  } else {
    write(globalCssRelPath, globalCssTemplate(cfg.theme, cfg.customThemeName, globalCssRelPath));
  }

  write(`${appDir}/${cfg.entry}/layout.tsx`, docsLayoutTemplate(cfg));
  if (cfg.apiReference) {
    const apiReferencePage = `${appDir}/${cfg.apiReference.path}/[[...slug]]/page.tsx`;
    write(apiReferencePage, nextApiReferencePageTemplate(cfg, apiReferencePage));
  }
  write("postcss.config.mjs", postcssConfigTemplate());

  if (!fileExists(path.join(cwd, "tsconfig.json"))) {
    write("tsconfig.json", tsconfigTemplate(cfg.useAlias));
  }

  if (cfg.i18n?.locales.length) {
    write(
      `${appDir}/components/locale-doc-page.tsx`,
      nextLocaleDocPageTemplate(cfg.i18n.defaultLocale),
    );
    write(
      `${appDir}/${cfg.entry}/page.tsx`,
      nextLocalizedPageTemplate({
        locales: cfg.i18n.locales,
        defaultLocale: cfg.i18n.defaultLocale,
        componentName: "DocsIndexPage",
        helperImport: "../components/locale-doc-page",
        pageImports: cfg.i18n.locales.map((locale) => ({
          locale,
          importPath: `./${locale}/page.mdx`,
        })),
      }),
    );
    write(
      `${appDir}/${cfg.entry}/installation/page.tsx`,
      nextLocalizedPageTemplate({
        locales: cfg.i18n.locales,
        defaultLocale: cfg.i18n.defaultLocale,
        componentName: "InstallationPage",
        helperImport: "../../components/locale-doc-page",
        pageImports: cfg.i18n.locales.map((locale) => ({
          locale,
          importPath: `../${locale}/installation/page.mdx`,
        })),
      }),
    );
    write(
      `${appDir}/${cfg.entry}/quickstart/page.tsx`,
      nextLocalizedPageTemplate({
        locales: cfg.i18n.locales,
        defaultLocale: cfg.i18n.defaultLocale,
        componentName: "QuickstartPage",
        helperImport: "../../components/locale-doc-page",
        pageImports: cfg.i18n.locales.map((locale) => ({
          locale,
          importPath: `../${locale}/quickstart/page.mdx`,
        })),
      }),
    );

    for (const locale of cfg.i18n.locales) {
      const base = `${appDir}/${cfg.entry}/${locale}`;
      write(`${base}/page.mdx`, welcomePageTemplate(cfg));
      write(`${base}/installation/page.mdx`, installationPageTemplate(cfg));
      write(`${base}/quickstart/page.mdx`, quickstartPageTemplate(cfg));
    }
    return;
  }

  write(`${appDir}/${cfg.entry}/page.mdx`, welcomePageTemplate(cfg));
  write(`${appDir}/${cfg.entry}/installation/page.mdx`, installationPageTemplate(cfg));
  write(`${appDir}/${cfg.entry}/quickstart/page.mdx`, quickstartPageTemplate(cfg));
}

// ---------------------------------------------------------------------------
// TanStack Start scaffolding
// ---------------------------------------------------------------------------

function scaffoldTanstackStart(
  cwd: string,
  cfg: TemplateConfig,
  globalCssRelPath: string,
  write: (rel: string, content: string, overwrite?: boolean) => void,
  skipped: string[],
  written: string[],
) {
  if (cfg.theme === "custom" && cfg.customThemeName) {
    const baseName = cfg.customThemeName.replace(/\.(ts|css)$/i, "");
    write(`themes/${baseName}.ts`, customThemeTsTemplate(baseName));
    write(`themes/${baseName}.css`, customThemeCssTemplate(baseName));
  }

  write("docs.config.ts", tanstackDocsConfigTemplate(cfg));
  write("src/lib/docs.server.ts", tanstackDocsServerTemplate());
  write("src/lib/docs.functions.ts", tanstackDocsFunctionsTemplate());

  const routeDir = getTanstackDocsRouteDir(cfg.entry);
  const docsIndexRoute = `${routeDir}/index.tsx`;
  const docsCatchAllRoute = `${routeDir}/$.tsx`;
  const apiRoute = "src/routes/api/docs.ts";
  const publicRoute = "src/routes/$.ts";

  write(
    docsIndexRoute,
    tanstackDocsIndexRouteTemplate({
      entry: cfg.entry,
      filePath: docsIndexRoute,
      useAlias: cfg.useAlias,
      projectName: cfg.projectName,
    }),
  );
  write(
    docsCatchAllRoute,
    tanstackDocsCatchAllRouteTemplate({
      entry: cfg.entry,
      filePath: docsCatchAllRoute,
      useAlias: cfg.useAlias,
      projectName: cfg.projectName,
    }),
  );
  write(apiRoute, tanstackApiDocsRouteTemplate(cfg.useAlias, apiRoute));
  write(publicRoute, tanstackDocsPublicRouteTemplate(cfg.useAlias, publicRoute, cfg.entry));
  if (cfg.apiReference) {
    const apiReferenceIndexRoute = `src/routes/${cfg.apiReference.path}.index.ts`;
    const apiReferenceCatchAllRoute = `src/routes/${cfg.apiReference.path}.$.ts`;
    write(
      apiReferenceIndexRoute,
      tanstackApiReferenceRouteTemplate({
        filePath: apiReferenceIndexRoute,
        useAlias: cfg.useAlias,
        apiReferencePath: cfg.apiReference.path,
        catchAll: false,
      }),
    );
    write(
      apiReferenceCatchAllRoute,
      tanstackApiReferenceRouteTemplate({
        filePath: apiReferenceCatchAllRoute,
        useAlias: cfg.useAlias,
        apiReferencePath: cfg.apiReference.path,
        catchAll: true,
      }),
    );
  }

  const rootRoutePath = path.join(cwd, "src/routes/__root.tsx");
  const existingRootRoute = readFileSafe(rootRoutePath);
  if (!existingRootRoute) {
    write("src/routes/__root.tsx", tanstackRootRouteTemplate(globalCssRelPath), true);
  } else if (!existingRootRoute.includes("RootProvider")) {
    const injected = injectTanstackRootProviderIntoRoute(existingRootRoute);
    if (injected) {
      writeFileSafe(rootRoutePath, injected, true);
      written.push("src/routes/__root.tsx (injected RootProvider)");
    } else {
      skipped.push("src/routes/__root.tsx (could not inject RootProvider)");
    }
  } else {
    skipped.push("src/routes/__root.tsx (already has RootProvider)");
  }

  const viteConfigRel = fileExists(path.join(cwd, "vite.config.ts"))
    ? "vite.config.ts"
    : fileExists(path.join(cwd, "vite.config.mts"))
      ? "vite.config.mts"
      : fileExists(path.join(cwd, "vite.config.js"))
        ? "vite.config.js"
        : "vite.config.ts";
  const viteConfigPath = path.join(cwd, viteConfigRel);
  const existingViteConfig = readFileSafe(viteConfigPath);
  if (!existingViteConfig) {
    write(viteConfigRel, tanstackViteConfigTemplate(cfg.useAlias), true);
  } else {
    const injected = injectTanstackVitePlugins(existingViteConfig, cfg.useAlias);
    if (injected) {
      writeFileSafe(viteConfigPath, injected, true);
      written.push(`${viteConfigRel} (updated)`);
    } else {
      skipped.push(`${viteConfigRel} (already configured)`);
    }
  }

  const globalCssAbsPath = path.join(cwd, globalCssRelPath);
  const existingGlobalCss = readFileSafe(globalCssAbsPath);
  if (existingGlobalCss) {
    const injected = injectCssImport(
      existingGlobalCss,
      cfg.theme,
      cfg.customThemeName,
      globalCssRelPath,
    );
    if (injected) {
      writeFileSafe(globalCssAbsPath, injected, true);
      written.push(globalCssRelPath + " (updated)");
    } else {
      skipped.push(globalCssRelPath + " (already configured)");
    }
  } else {
    write(globalCssRelPath, globalCssTemplate(cfg.theme, cfg.customThemeName, globalCssRelPath));
  }

  for (const base of getScaffoldContentRoots(cfg)) {
    write(`${base}/page.mdx`, tanstackWelcomePageTemplate(cfg));
    write(`${base}/installation/page.mdx`, tanstackInstallationPageTemplate(cfg));
    write(`${base}/quickstart/page.mdx`, tanstackQuickstartPageTemplate(cfg));
  }
}

// ---------------------------------------------------------------------------
// SvelteKit scaffolding
// ---------------------------------------------------------------------------

function scaffoldSvelteKit(
  cwd: string,
  cfg: TemplateConfig,
  globalCssRelPath: string,
  write: (rel: string, content: string, overwrite?: boolean) => void,
  skipped: string[],
  written: string[],
) {
  if (cfg.theme === "custom" && cfg.customThemeName) {
    const baseName = cfg.customThemeName.replace(/\.(ts|css)$/i, "");
    write(`themes/${baseName}.ts`, customThemeTsTemplate(baseName));
    write(`themes/${baseName}.css`, customThemeCssTemplate(baseName));
  }
  write("src/lib/docs.config.ts", svelteDocsConfigTemplate(cfg));

  write("src/lib/docs.server.ts", svelteDocsServerTemplate(cfg));
  write(`src/routes/${cfg.entry}/+layout.svelte`, svelteDocsLayoutTemplate(cfg));
  write(`src/routes/${cfg.entry}/+layout.server.js`, svelteDocsLayoutServerTemplate(cfg));
  write(`src/routes/${cfg.entry}/[...slug]/+page.svelte`, svelteDocsPageTemplate(cfg));
  if (cfg.i18n?.locales.length) {
    write(`src/routes/${cfg.entry}/+page.svelte`, svelteDocsPageTemplate(cfg));
  }
  const apiDocsRoute = "src/routes/api/docs/+server.ts";
  const publicHook = "src/hooks.server.ts";
  write(apiDocsRoute, svelteDocsApiRouteTemplate(apiDocsRoute, cfg.useAlias));
  const publicHookPath = path.join(cwd, publicHook);
  const existingPublicHook = readFileSafe(publicHookPath);
  if (existingPublicHook) {
    const injected = injectSvelteDocsPublicHook(existingPublicHook, publicHook, cfg.useAlias);
    if (injected) {
      writeFileSafe(publicHookPath, injected, true);
      written.push(`${publicHook} (composed docs public hook)`);
    } else {
      skipped.push(`${publicHook} (already configured or could not compose docs public hook)`);
    }
  } else {
    write(publicHook, svelteDocsPublicHookTemplate(publicHook, cfg.useAlias));
  }
  if (cfg.apiReference) {
    const apiReferenceIndexRoute = `src/routes/${cfg.apiReference.path}/+server.ts`;
    const apiReferenceCatchAllRoute = `src/routes/${cfg.apiReference.path}/[...slug]/+server.ts`;
    write(
      apiReferenceIndexRoute,
      svelteApiReferenceRouteTemplate(apiReferenceIndexRoute, cfg.useAlias),
    );
    write(
      apiReferenceCatchAllRoute,
      svelteApiReferenceRouteTemplate(apiReferenceCatchAllRoute, cfg.useAlias),
    );
  }

  const existingRootLayout = readFileSafe(path.join(cwd, "src/routes/+layout.svelte"));
  if (!existingRootLayout) {
    write("src/routes/+layout.svelte", svelteRootLayoutTemplate(globalCssRelPath));
  }

  const globalCssAbsPath = path.join(cwd, globalCssRelPath);
  const existingGlobalCss = readFileSafe(globalCssAbsPath);

  const themeMapping: Record<string, string> = {
    fumadocs: "fumadocs",
    darksharp: "darksharp",
    "pixel-border": "pixel-border",
    colorful: "colorful",
    darkbold: "darkbold",
    shiny: "shiny",
    ledger: "ledger",
    greentree: "greentree",
    concrete: "concrete",
    "command-grid": "command-grid",
    hardline: "hardline",
    default: "fumadocs",
  };
  const cssTheme = themeMapping[cfg.theme] || "fumadocs";

  if (existingGlobalCss) {
    const injected =
      cfg.theme === "custom" && cfg.customThemeName
        ? injectSvelteCssImport(existingGlobalCss, "custom", cfg.customThemeName, globalCssRelPath)
        : injectSvelteCssImport(existingGlobalCss, cssTheme);
    if (injected) {
      writeFileSafe(globalCssAbsPath, injected, true);
      written.push(globalCssRelPath + " (updated)");
    } else {
      skipped.push(globalCssRelPath + " (already configured)");
    }
  } else {
    write(
      globalCssRelPath,
      cfg.theme === "custom" && cfg.customThemeName
        ? svelteGlobalCssTemplate("custom", cfg.customThemeName, globalCssRelPath)
        : svelteGlobalCssTemplate(cssTheme),
    );
  }

  for (const base of getScaffoldContentRoots(cfg)) {
    write(`${base}/page.md`, svelteWelcomePageTemplate(cfg));
    write(`${base}/installation/page.md`, svelteInstallationPageTemplate(cfg));
    write(`${base}/quickstart/page.md`, svelteQuickstartPageTemplate(cfg));
  }
}

// ---------------------------------------------------------------------------
// Astro scaffolding
// ---------------------------------------------------------------------------

function scaffoldAstro(
  cwd: string,
  cfg: TemplateConfig,
  globalCssRelPath: string,
  write: (rel: string, content: string, overwrite?: boolean) => void,
  skipped: string[],
  written: string[],
) {
  if (cfg.theme === "custom" && cfg.customThemeName) {
    const baseName = cfg.customThemeName.replace(/\.(ts|css)$/i, "");
    write(`themes/${baseName}.ts`, customThemeTsTemplate(baseName));
    write(`themes/${baseName}.css`, customThemeCssTemplate(baseName));
  }
  write("src/lib/docs.config.ts", astroDocsConfigTemplate(cfg));
  write("src/lib/docs.server.ts", astroDocsServerTemplate(cfg));

  if (
    !fileExists(path.join(cwd, "astro.config.mjs")) &&
    !fileExists(path.join(cwd, "astro.config.ts"))
  ) {
    write("astro.config.mjs", astroConfigTemplate(cfg.astroAdapter ?? "vercel"));
  }

  write(`src/pages/${cfg.entry}/index.astro`, astroDocsIndexTemplate(cfg));
  write(`src/pages/${cfg.entry}/[...slug].astro`, astroDocsPageTemplate(cfg));
  write(`src/pages/api/${cfg.entry}.ts`, astroApiRouteTemplate(cfg));
  const middleware = "src/middleware.ts";
  const middlewarePath = path.join(cwd, middleware);
  const existingMiddleware = readFileSafe(middlewarePath);
  if (existingMiddleware) {
    const injected = injectAstroDocsMiddleware(existingMiddleware, middleware, cfg.useAlias);
    if (injected) {
      writeFileSafe(middlewarePath, injected, true);
      written.push(`${middleware} (composed docs public middleware)`);
    } else {
      skipped.push(
        `${middleware} (already configured or could not compose docs public middleware)`,
      );
    }
  } else {
    write(middleware, astroDocsMiddlewareTemplate(middleware, cfg.useAlias));
  }
  if (cfg.apiReference) {
    const apiReferenceIndexRoute = `src/pages/${cfg.apiReference.path}/index.ts`;
    const apiReferenceCatchAllRoute = `src/pages/${cfg.apiReference.path}/[...slug].ts`;
    write(apiReferenceIndexRoute, astroApiReferenceRouteTemplate(apiReferenceIndexRoute));
    write(apiReferenceCatchAllRoute, astroApiReferenceRouteTemplate(apiReferenceCatchAllRoute));
  }

  const globalCssAbsPath = path.join(cwd, globalCssRelPath);
  const existingGlobalCss = readFileSafe(globalCssAbsPath);

  const themeMapping: Record<string, string> = {
    fumadocs: "fumadocs",
    darksharp: "darksharp",
    "pixel-border": "pixel-border",
    colorful: "colorful",
    darkbold: "darkbold",
    shiny: "shiny",
    ledger: "ledger",
    greentree: "greentree",
    concrete: "concrete",
    "command-grid": "command-grid",
    hardline: "hardline",
    default: "fumadocs",
  };
  const cssTheme = themeMapping[cfg.theme] || "fumadocs";

  if (existingGlobalCss) {
    const injected =
      cfg.theme === "custom" && cfg.customThemeName
        ? injectAstroCssImport(existingGlobalCss, "custom", cfg.customThemeName, globalCssRelPath)
        : injectAstroCssImport(existingGlobalCss, cssTheme);
    if (injected) {
      writeFileSafe(globalCssAbsPath, injected, true);
      written.push(globalCssRelPath + " (updated)");
    } else {
      skipped.push(globalCssRelPath + " (already configured)");
    }
  } else {
    write(
      globalCssRelPath,
      cfg.theme === "custom" && cfg.customThemeName
        ? astroGlobalCssTemplate("custom", cfg.customThemeName, globalCssRelPath)
        : astroGlobalCssTemplate(cssTheme),
    );
  }

  for (const base of getScaffoldContentRoots(cfg)) {
    write(`${base}/page.md`, astroWelcomePageTemplate(cfg));
    write(`${base}/installation/page.md`, astroInstallationPageTemplate(cfg));
    write(`${base}/quickstart/page.md`, astroQuickstartPageTemplate(cfg));
  }
}

// ---------------------------------------------------------------------------
// Nuxt scaffolding
// ---------------------------------------------------------------------------

function scaffoldNuxt(
  cwd: string,
  cfg: TemplateConfig,
  globalCssRelPath: string,
  write: (rel: string, content: string, overwrite?: boolean) => void,
  skipped: string[],
  written: string[],
) {
  if (cfg.theme === "custom" && cfg.customThemeName) {
    const baseName = cfg.customThemeName.replace(/\.(ts|css)$/i, "");
    write(`themes/${baseName}.ts`, customThemeTsTemplate(baseName));
    write(`themes/${baseName}.css`, customThemeCssTemplate(baseName));
  }
  write("docs.config.ts", nuxtDocsConfigTemplate(cfg));
  write("server/api/docs.ts", nuxtServerApiDocsRouteTemplate(cfg));
  write("server/middleware/docs-public.ts", nuxtServerDocsPublicMiddlewareTemplate(cfg));
  write(`pages/${cfg.entry}/[[...slug]].vue`, nuxtDocsPageTemplate(cfg));
  if (cfg.apiReference) {
    const apiReferenceIndexRoute = `server/routes/${cfg.apiReference.path}/index.ts`;
    const apiReferenceCatchAllRoute = `server/routes/${cfg.apiReference.path}/[...slug].ts`;
    write(
      apiReferenceIndexRoute,
      nuxtServerApiReferenceRouteTemplate(apiReferenceIndexRoute, cfg.useAlias),
    );
    write(
      apiReferenceCatchAllRoute,
      nuxtServerApiReferenceRouteTemplate(apiReferenceCatchAllRoute, cfg.useAlias),
    );
  }

  if (
    !fileExists(path.join(cwd, "nuxt.config.ts")) &&
    !fileExists(path.join(cwd, "nuxt.config.js"))
  ) {
    write("nuxt.config.ts", nuxtConfigTemplate(cfg));
  }

  const themeMapping: Record<string, string> = {
    fumadocs: "fumadocs",
    darksharp: "darksharp",
    "pixel-border": "pixel-border",
    colorful: "colorful",
    darkbold: "darkbold",
    shiny: "shiny",
    ledger: "ledger",
    greentree: "greentree",
    concrete: "concrete",
    "command-grid": "command-grid",
    hardline: "hardline",
    default: "fumadocs",
  };
  const cssTheme = themeMapping[cfg.theme] || "fumadocs";

  const globalCssAbsPath = path.join(cwd, globalCssRelPath);
  const existingGlobalCss = readFileSafe(globalCssAbsPath);
  if (existingGlobalCss) {
    const injected =
      cfg.theme === "custom" && cfg.customThemeName
        ? injectNuxtCssImport(existingGlobalCss, "custom", cfg.customThemeName, globalCssRelPath)
        : injectNuxtCssImport(existingGlobalCss, cssTheme);
    if (injected) {
      writeFileSafe(globalCssAbsPath, injected, true);
      written.push(globalCssRelPath + " (updated)");
    } else {
      skipped.push(globalCssRelPath + " (already configured)");
    }
  } else {
    write(
      globalCssRelPath,
      cfg.theme === "custom" && cfg.customThemeName
        ? nuxtGlobalCssTemplate("custom", cfg.customThemeName, globalCssRelPath)
        : nuxtGlobalCssTemplate(cssTheme),
    );
  }

  for (const base of getScaffoldContentRoots(cfg)) {
    write(`${base}/page.md`, nuxtWelcomePageTemplate(cfg));
    write(`${base}/installation/page.md`, nuxtInstallationPageTemplate(cfg));
    write(`${base}/quickstart/page.md`, nuxtQuickstartPageTemplate(cfg));
  }
}

/** Exported for testing: ensures Next.js scaffold writes under app or src/app consistently. */
export { scaffoldNextJs, scaffoldTanstackStart, scaffoldSvelteKit, scaffoldAstro, scaffoldNuxt };
