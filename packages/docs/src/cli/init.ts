import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
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
  type TemplateConfig,
} from "./templates.js";

export async function init() {
  const cwd = process.cwd();

  p.intro(pc.bgCyan(pc.black(" @farming-labs/docs ")));

  // -----------------------------------------------------------------------
  // Step 1: Framework detection
  // -----------------------------------------------------------------------

  const framework = detectFramework(cwd);

  if (!framework) {
    p.log.error(
      "Could not detect a supported framework.\n" +
        "  Make sure you have a " +
        pc.cyan("package.json") +
        " with " +
        pc.cyan("next") +
        " or " +
        pc.cyan("@sveltejs/kit") +
        " installed.\n" +
        "  Supported frameworks: Next.js, SvelteKit",
    );
    p.outro(pc.red("Init cancelled."));
    process.exit(1);
  }

  const frameworkName = framework === "nextjs" ? "Next.js" : "SvelteKit";
  p.log.success(`Detected framework: ${pc.cyan(frameworkName)}`);

  // -----------------------------------------------------------------------
  // Step 2: Theme selection
  // -----------------------------------------------------------------------

  const themeOptions =
    framework === "sveltekit"
      ? [
          {
            value: "default",
            label: "Default",
            hint: "Clean, modern docs theme with sidebar, search, and dark mode",
          },
          {
            value: "pixel-border",
            label: "Pixel Border",
            hint: "Sharp pixel-art inspired theme with monospace text",
          },
        ]
      : [
          {
            value: "fumadocs",
            label: "Fumadocs",
            hint: "Clean, modern docs theme with sidebar, search, and dark mode",
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
  // Step 3: Docs entry path
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
  // Step 4: Global CSS file location
  // -----------------------------------------------------------------------

  const detectedCssFiles = detectGlobalCssFiles(cwd);
  let globalCssRelPath: string;

  const defaultCssPath =
    framework === "sveltekit" ? "src/app.css" : "app/globals.css";

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
  // Step 5: Read project info
  // -----------------------------------------------------------------------

  const pkgJson = JSON.parse(readFileSafe(path.join(cwd, "package.json"))!);
  const projectName = pkgJson.name || "My Project";

  const cfg: TemplateConfig = {
    entry: entryPath,
    theme: theme as string,
    projectName,
    framework,
  };

  // -----------------------------------------------------------------------
  // Step 6: Write files
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
  // Step 7: Install dependencies
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
    } else {
      exec(
        `${installCommand(pm)} @farming-labs/docs @farming-labs/next @farming-labs/theme`,
        cwd,
      );

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
    p.outro(
      pc.yellow(
        "Setup partially complete. Install deps and run dev server manually.",
      ),
    );
    process.exit(1);
  }

  s2.stop("Dependencies installed");

  // -----------------------------------------------------------------------
  // Step 8: Start dev server
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
      : { cmd: "npx", args: ["next", "dev", "--webpack"], waitFor: "Ready" };

  const defaultPort = framework === "sveltekit" ? "5173" : "3000";

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
      framework === "sveltekit" ? "npx vite dev" : "npx next dev --webpack";
    p.log.error(
      "Could not start dev server. Try running manually:\n" +
        `  ${pc.cyan(manualCmd)}`,
    );
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

  write("app/layout.tsx", rootLayoutTemplate(globalCssRelPath));

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

  write(`app/${cfg.entry}/layout.tsx`, docsLayoutTemplate());
  write("postcss.config.mjs", postcssConfigTemplate());

  if (!fileExists(path.join(cwd, "tsconfig.json"))) {
    write("tsconfig.json", tsconfigTemplate());
  }

  write(`app/${cfg.entry}/page.mdx`, welcomePageTemplate(cfg));
  write(
    `app/${cfg.entry}/installation/page.mdx`,
    installationPageTemplate(cfg),
  );
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
  write("docs.config.ts", svelteDocsConfigTemplate(cfg));

  write("src/lib/docs.server.ts", svelteDocsServerTemplate(cfg));
  write(
    `src/routes/${cfg.entry}/+layout.svelte`,
    svelteDocsLayoutTemplate(cfg),
  );
  write(
    `src/routes/${cfg.entry}/+layout.server.js`,
    svelteDocsLayoutServerTemplate(),
  );
  write(
    `src/routes/${cfg.entry}/[...slug]/+page.svelte`,
    svelteDocsPageTemplate(cfg),
  );

  const existingRootLayout = readFileSafe(
    path.join(cwd, "src/routes/+layout.svelte"),
  );
  if (!existingRootLayout) {
    write(
      "src/routes/+layout.svelte",
      svelteRootLayoutTemplate(globalCssRelPath),
    );
  }

  const globalCssAbsPath = path.join(cwd, globalCssRelPath);
  const existingGlobalCss = readFileSafe(globalCssAbsPath);

  const themeMapping: Record<string, string> = {
    default: "default",
    "pixel-border": "pixel-border",
    fumadocs: "default",
  };
  const cssTheme = themeMapping[cfg.theme] || "default";

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
  write(
    `${cfg.entry}/installation/page.md`,
    svelteInstallationPageTemplate(cfg),
  );
  write(
    `${cfg.entry}/quickstart/page.md`,
    svelteQuickstartPageTemplate(cfg),
  );
}
