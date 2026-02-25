import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  type Framework,
  detectFramework,
  detectPackageManager,
  detectGlobalCssFiles,
  installCommand,
  devInstallCommand,
  writeFileSafe,
  fileExists,
  readFileSafe,
  exec,
  spawnAndWaitFor,
} from "./utils.js";

const EXAMPLES_REPO = "farming-labs/docs";
const VALID_TEMPLATES = ["next", "nuxt", "sveltekit", "astro"] as const;
type TemplateName = (typeof VALID_TEMPLATES)[number];

export interface InitOptions {
  template?: string;
  theme?: string;
  entry?: string;
}

import {
  docsConfigTemplate,
  nextConfigTemplate,
  nextConfigMergedTemplate,
  rootLayoutTemplate,
  globalCssTemplate,
  injectCssImport,
  docsLayoutTemplate,
  postcssConfigTemplate,
  tsconfigTemplate,
  welcomePageTemplate,
  installationPageTemplate,
  quickstartPageTemplate,
  svelteDocsConfigTemplate,
  svelteDocsServerTemplate,
  svelteDocsLayoutTemplate,
  svelteDocsLayoutServerTemplate,
  svelteDocsPageTemplate,
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
  astroGlobalCssTemplate,
  injectAstroCssImport,
  astroWelcomePageTemplate,
  astroInstallationPageTemplate,
  astroQuickstartPageTemplate,
  getAstroAdapterPkg,
  nuxtDocsConfigTemplate,
  nuxtDocsServerTemplate,
  nuxtServerApiDocsGetTemplate,
  nuxtServerApiDocsPostTemplate,
  nuxtServerApiDocsLoadTemplate,
  nuxtDocsPageTemplate,
  nuxtConfigTemplate,
  nuxtWelcomePageTemplate,
  nuxtInstallationPageTemplate,
  nuxtQuickstartPageTemplate,
  nuxtGlobalCssTemplate,
  injectNuxtCssImport,
  type TemplateConfig,
} from "./templates.js";

export async function init(options: InitOptions = {}) {
  const cwd = process.cwd();

  p.intro(pc.bgCyan(pc.black(" @farming-labs/docs ")));

  // -----------------------------------------------------------------------
  // Template: clone example from repo (--template next | nuxt | sveltekit | astro)
  // -----------------------------------------------------------------------

  if (options.template) {
    const template = options.template.toLowerCase();
    if (!VALID_TEMPLATES.includes(template as TemplateName)) {
      p.log.error(
        `Invalid ${pc.cyan("--template")}. Use one of: ${VALID_TEMPLATES.map((t) => pc.cyan(t)).join(", ")}`,
      );
      process.exit(1);
    }

    const templateLabel =
      template === "next"
        ? "Next.js"
        : template === "nuxt"
          ? "Nuxt"
          : template === "sveltekit"
            ? "SvelteKit"
            : "Astro";

    p.log.step(`Cloning ${pc.cyan(`examples/${template}`)} from ${pc.cyan(EXAMPLES_REPO)}...`);

    try {
      exec(`npx degit ${EXAMPLES_REPO}/examples/${template} . --force`, cwd);
    } catch (err) {
      p.log.error("Failed to clone the example. Check your connection and that the repo exists.");
      process.exit(1);
    }

    p.log.success(`Cloned ${templateLabel} example. Installing dependencies...`);

    const pm = detectPackageManager(cwd);
    try {
      if (pm === "pnpm") {
        exec("pnpm install", cwd);
      } else if (pm === "yarn") {
        exec("yarn install", cwd);
      } else if (pm === "bun") {
        exec("bun install", cwd);
      } else {
        exec("npm install", cwd);
      }
    } catch {
      p.log.warn("Dependency install failed. Run your package manager install command manually.");
    }

    p.outro(
      pc.green(
        `Done! Run ${pc.cyan(pm === "yarn" ? "yarn dev" : pm === "bun" ? "bun dev" : `${pm} run dev`)} to start the dev server.`,
      ),
    );
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
      value: "greentree",
      label: "GreenTree",
      hint: "Emerald green accent, Inter font, Mintlify-inspired",
    },
  ];

  const theme = await p.select({
    message: "Which theme would you like to use?",
    options: themeOptions,
  });

  if (p.isCancel(theme)) {
    p.outro(pc.red("Init cancelled."));
    process.exit(0);
  }

  // -----------------------------------------------------------------------
  // Step 3: Path alias preference
  // -----------------------------------------------------------------------

  const aliasHint =
    framework === "nextjs"
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

  const entry = await p.text({
    message: "Where should your docs live?",
    placeholder: "docs",
    defaultValue: "docs",
    validate: (value) => {
      if (!value) return "Entry path is required";
      if (value.startsWith("/")) return "Use a relative path (no leading /)";
      if (value.includes(" ")) return "Path cannot contain spaces";
    },
  });

  if (p.isCancel(entry)) {
    p.outro(pc.red("Init cancelled."));
    process.exit(0);
  }

  const entryPath = entry as string;

  // -----------------------------------------------------------------------
  // Step 6: Global CSS file location
  // -----------------------------------------------------------------------

  const detectedCssFiles = detectGlobalCssFiles(cwd);
  let globalCssRelPath: string;

  const defaultCssPath =
    framework === "sveltekit"
      ? "src/app.css"
      : framework === "astro"
        ? "src/styles/global.css"
        : framework === "nuxt"
          ? "assets/css/main.css"
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
    const cssPath = await p.text({
      message: "Where is your global CSS file?",
      placeholder: defaultCssPath,
      defaultValue: defaultCssPath,
      validate: (value) => {
        if (!value) return "CSS file path is required";
        if (!value.endsWith(".css")) return "Path must end with .css";
      },
    });
    if (p.isCancel(cssPath)) {
      p.outro(pc.red("Init cancelled."));
      process.exit(0);
    }
    globalCssRelPath = cssPath as string;
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
    theme: theme as string,
    projectName,
    framework,
    useAlias: useAlias as boolean,
    astroAdapter,
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

  if (framework === "sveltekit") {
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
  // Step 9: Install dependencies
  // -----------------------------------------------------------------------

  const pm = detectPackageManager(cwd);
  p.log.info(`Using ${pc.cyan(pm)} as package manager`);

  const s2 = p.spinner();
  s2.start("Installing dependencies");

  try {
    if (framework === "sveltekit") {
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
    framework === "sveltekit"
      ? { cmd: "npx", args: ["vite", "dev"], waitFor: "ready" }
      : framework === "astro"
        ? { cmd: "npx", args: ["astro", "dev"], waitFor: "ready" }
        : framework === "nuxt"
          ? { cmd: "npx", args: ["nuxt", "dev"], waitFor: "Local" }
          : { cmd: "npx", args: ["next", "dev", "--webpack"], waitFor: "Ready" };

  const defaultPort =
    framework === "sveltekit"
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
  } catch (err) {
    const manualCmd =
      framework === "sveltekit"
        ? "npx vite dev"
        : framework === "astro"
          ? "npx astro dev"
          : framework === "nuxt"
            ? "npx nuxt dev"
            : "npx next dev --webpack";
    p.log.error("Could not start dev server. Try running manually:\n" + `  ${pc.cyan(manualCmd)}`);
    p.outro(pc.yellow("Setup complete. Start the server manually."));
    process.exit(1);
  }
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

  write("app/layout.tsx", rootLayoutTemplate(cfg, globalCssRelPath));

  const globalCssAbsPath = path.join(cwd, globalCssRelPath);
  const existingGlobalCss = readFileSafe(globalCssAbsPath);
  if (existingGlobalCss) {
    const injected = injectCssImport(existingGlobalCss, cfg.theme);
    if (injected) {
      writeFileSafe(globalCssAbsPath, injected, true);
      written.push(globalCssRelPath + " (updated)");
    } else {
      skipped.push(globalCssRelPath + " (already configured)");
    }
  } else {
    write(globalCssRelPath, globalCssTemplate(cfg.theme));
  }

  write(`app/${cfg.entry}/layout.tsx`, docsLayoutTemplate(cfg));
  write("postcss.config.mjs", postcssConfigTemplate());

  if (!fileExists(path.join(cwd, "tsconfig.json"))) {
    write("tsconfig.json", tsconfigTemplate(cfg.useAlias));
  }

  write(`app/${cfg.entry}/page.mdx`, welcomePageTemplate(cfg));
  write(`app/${cfg.entry}/installation/page.mdx`, installationPageTemplate(cfg));
  write(`app/${cfg.entry}/quickstart/page.mdx`, quickstartPageTemplate(cfg));
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
  write("src/lib/docs.config.ts", svelteDocsConfigTemplate(cfg));

  write("src/lib/docs.server.ts", svelteDocsServerTemplate(cfg));
  write(`src/routes/${cfg.entry}/+layout.svelte`, svelteDocsLayoutTemplate(cfg));
  write(`src/routes/${cfg.entry}/+layout.server.js`, svelteDocsLayoutServerTemplate(cfg));
  write(`src/routes/${cfg.entry}/[...slug]/+page.svelte`, svelteDocsPageTemplate(cfg));

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
    greentree: "greentree",
    default: "fumadocs",
  };
  const cssTheme = themeMapping[cfg.theme] || "fumadocs";

  if (existingGlobalCss) {
    const injected = injectSvelteCssImport(existingGlobalCss, cssTheme);
    if (injected) {
      writeFileSafe(globalCssAbsPath, injected, true);
      written.push(globalCssRelPath + " (updated)");
    } else {
      skipped.push(globalCssRelPath + " (already configured)");
    }
  } else {
    write(globalCssRelPath, svelteGlobalCssTemplate(cssTheme));
  }

  write(`${cfg.entry}/page.md`, svelteWelcomePageTemplate(cfg));
  write(`${cfg.entry}/installation/page.md`, svelteInstallationPageTemplate(cfg));
  write(`${cfg.entry}/quickstart/page.md`, svelteQuickstartPageTemplate(cfg));
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

  const globalCssAbsPath = path.join(cwd, globalCssRelPath);
  const existingGlobalCss = readFileSafe(globalCssAbsPath);

  const themeMapping: Record<string, string> = {
    fumadocs: "fumadocs",
    darksharp: "darksharp",
    "pixel-border": "pixel-border",
    colorful: "colorful",
    darkbold: "darkbold",
    shiny: "shiny",
    greentree: "greentree",
    default: "fumadocs",
  };
  const cssTheme = themeMapping[cfg.theme] || "fumadocs";

  if (existingGlobalCss) {
    const injected = injectAstroCssImport(existingGlobalCss, cssTheme);
    if (injected) {
      writeFileSafe(globalCssAbsPath, injected, true);
      written.push(globalCssRelPath + " (updated)");
    } else {
      skipped.push(globalCssRelPath + " (already configured)");
    }
  } else {
    write(globalCssRelPath, astroGlobalCssTemplate(cssTheme));
  }

  write(`${cfg.entry}/page.md`, astroWelcomePageTemplate(cfg));
  write(`${cfg.entry}/installation/page.md`, astroInstallationPageTemplate(cfg));
  write(`${cfg.entry}/quickstart/page.md`, astroQuickstartPageTemplate(cfg));
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
  write("docs.config.ts", nuxtDocsConfigTemplate(cfg));
  write("server/utils/docs-server.ts", nuxtDocsServerTemplate(cfg));
  write("server/api/docs.get.ts", nuxtServerApiDocsGetTemplate());
  write("server/api/docs.post.ts", nuxtServerApiDocsPostTemplate());
  write("server/api/docs/load.get.ts", nuxtServerApiDocsLoadTemplate());
  write(`pages/${cfg.entry}/[[...slug]].vue`, nuxtDocsPageTemplate(cfg));

  const nuxtConfigPath = path.join(cwd, "nuxt.config.ts");
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
    greentree: "greentree",
    default: "fumadocs",
  };
  const cssTheme = themeMapping[cfg.theme] || "fumadocs";

  const globalCssAbsPath = path.join(cwd, globalCssRelPath);
  const existingGlobalCss = readFileSafe(globalCssAbsPath);
  if (existingGlobalCss) {
    const injected = injectNuxtCssImport(existingGlobalCss, cssTheme);
    if (injected) {
      writeFileSafe(globalCssAbsPath, injected, true);
      written.push(globalCssRelPath + " (updated)");
    } else {
      skipped.push(globalCssRelPath + " (already configured)");
    }
  } else {
    write(globalCssRelPath, nuxtGlobalCssTemplate(cssTheme));
  }

  write(`${cfg.entry}/page.md`, nuxtWelcomePageTemplate(cfg));
  write(`${cfg.entry}/installation/page.md`, nuxtInstallationPageTemplate(cfg));
  write(`${cfg.entry}/quickstart/page.md`, nuxtQuickstartPageTemplate(cfg));
}
