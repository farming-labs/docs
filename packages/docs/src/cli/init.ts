import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  type Framework,
  type PackageManager,
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
export const VALID_TEMPLATES = ["next", "nuxt", "sveltekit", "astro"] as const;
export type TemplateName = (typeof VALID_TEMPLATES)[number];

export interface InitOptions {
  template?: string;
  name?: string;
  theme?: string;
  entry?: string;
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
          hint: "Bootstrap a new app from a template (Next, Nuxt, SvelteKit, Astro)",
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
            : "Astro";

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
    } catch (err) {
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
    {
      value: "custom",
      label: "Create your own theme",
      hint: "Scaffold a new theme file + CSS in themes/ (name asked next)",
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

  const entryPath = (entry as string).trim() || defaultEntry;

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
    theme: theme as string,
    customThemeName,
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
  // Step 9: Choose package manager (existing project)
  // -----------------------------------------------------------------------

  let pm = detectPackageManager(cwd);
  p.log.info(`Detected ${pc.cyan(pm)} as package manager`);

  const pmAnswerExisting = await p.select({
    initialValue: pm,
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
            : "pnpm dev";
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

  const rootLayoutPath = path.join(cwd, "app/layout.tsx");
  const existingRootLayout = readFileSafe(rootLayoutPath);
  if (!existingRootLayout) {
    write("app/layout.tsx", rootLayoutTemplate(cfg, globalCssRelPath), true);
  } else if (!existingRootLayout.includes("RootProvider")) {
    const injected = injectRootProviderIntoLayout(existingRootLayout);
    if (injected) {
      writeFileSafe(rootLayoutPath, injected, true);
      written.push("app/layout.tsx (injected RootProvider)");
    } else {
      skipped.push("app/layout.tsx (could not inject RootProvider)");
    }
  } else {
    skipped.push("app/layout.tsx (already has RootProvider)");
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
  if (cfg.theme === "custom" && cfg.customThemeName) {
    const baseName = cfg.customThemeName.replace(/\.(ts|css)$/i, "");
    write(`themes/${baseName}.ts`, customThemeTsTemplate(baseName));
    write(`themes/${baseName}.css`, customThemeCssTemplate(baseName));
  }
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

  write(`${cfg.entry}/page.md`, nuxtWelcomePageTemplate(cfg));
  write(`${cfg.entry}/installation/page.md`, nuxtInstallationPageTemplate(cfg));
  write(`${cfg.entry}/quickstart/page.md`, nuxtQuickstartPageTemplate(cfg));
}
