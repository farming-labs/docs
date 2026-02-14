import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  detectFramework,
  detectPackageManager,
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
        " installed.\n" +
        "  Supported frameworks: Next.js",
    );
    p.outro(pc.red("Init cancelled."));
    process.exit(1);
  }

  p.log.success(`Detected framework: ${pc.cyan("Next.js")}`);

  // -----------------------------------------------------------------------
  // Step 2: Theme selection
  // -----------------------------------------------------------------------

  const theme = await p.select({
    message: "Which theme would you like to use?",
    options: [
      {
        value: "fumadocs",
        label: "Fumadocs",
        hint: "Clean, modern docs theme with sidebar, search, and dark mode",
      },
    ],
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
  // Step 4: Read project info
  // -----------------------------------------------------------------------

  const pkgJson = JSON.parse(readFileSafe(path.join(cwd, "package.json"))!);
  const projectName = pkgJson.name || "My Project";

  const cfg: TemplateConfig = {
    entry: entryPath,
    theme: theme as string,
    projectName,
  };

  // -----------------------------------------------------------------------
  // Step 5: Write files
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

  // docs.config.ts
  write("docs.config.ts", docsConfigTemplate(cfg));

  // next.config.ts — merge with existing or create new
  const existingNextConfig = readFileSafe(path.join(cwd, "next.config.ts"))
    ?? readFileSafe(path.join(cwd, "next.config.mjs"))
    ?? readFileSafe(path.join(cwd, "next.config.js"));

  if (existingNextConfig) {
    // Determine the actual config filename
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

  // app/layout.tsx
  write("app/layout.tsx", rootLayoutTemplate());

  // app/global.css — inject fumadocs CSS import into existing file,
  // or create a new one if it doesn't exist.
  const globalCssPath = path.join(cwd, "app/global.css");
  const existingGlobalCss = readFileSafe(globalCssPath);
  if (existingGlobalCss) {
    const injected = injectCssImport(existingGlobalCss, theme as string);
    if (injected) {
      writeFileSafe(globalCssPath, injected, true);
      written.push("app/global.css (updated)");
    } else {
      skipped.push("app/global.css (already configured)");
    }
  } else {
    write("app/global.css", globalCssTemplate(theme as string));
  }

  // app/{entry}/layout.tsx
  write(`app/${entryPath}/layout.tsx`, docsLayoutTemplate());

  // postcss.config.mjs
  write("postcss.config.mjs", postcssConfigTemplate());

  // tsconfig.json (only if missing)
  if (!fileExists(path.join(cwd, "tsconfig.json"))) {
    write("tsconfig.json", tsconfigTemplate());
  }

  // Sample MDX pages
  write(`app/${entryPath}/page.mdx`, welcomePageTemplate(cfg));
  write(
    `app/${entryPath}/installation/page.mdx`,
    installationPageTemplate(cfg),
  );
  write(`app/${entryPath}/quickstart/page.mdx`, quickstartPageTemplate(cfg));

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
  // Step 6: Install dependencies
  // -----------------------------------------------------------------------

  const pm = detectPackageManager(cwd);
  p.log.info(`Using ${pc.cyan(pm)} as package manager`);

  const s2 = p.spinner();
  s2.start("Installing dependencies");

  try {
    // Runtime deps
    exec(`${installCommand(pm)} @farming-labs/docs @farming-labs/next @farming-labs/fumadocs`, cwd);

    // Dev deps (Tailwind + types)
    const devDeps = [
      "@tailwindcss/postcss",
      "postcss",
      "tailwindcss",
      "@types/mdx",
      "@types/node",
    ];

    // Check which dev deps are already installed
    const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
    const missingDevDeps = devDeps.filter((d) => !allDeps[d]);

    if (missingDevDeps.length > 0) {
      exec(`${devInstallCommand(pm)} ${missingDevDeps.join(" ")}`, cwd);
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
  // Step 7: Start dev server
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

  try {
    const child = await spawnAndWaitFor(
      "npx",
      ["next", "dev", "--webpack"],
      cwd,
      "Ready",
      60_000,
    );

    const url = `http://localhost:3000/${entryPath}`;

    console.log();
    p.log.success(
      `Dev server is running! Your docs are live at:\n\n` +
        `  ${pc.cyan(pc.underline(url))}\n\n` +
        `  Press ${pc.dim("Ctrl+C")} to stop the server.`,
    );

    p.outro(pc.green("Happy documenting!"));

    // Keep the process alive until the child exits
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
    p.log.error(
      "Could not start dev server. Try running manually:\n" +
        `  ${pc.cyan("npx next dev --webpack")}`,
    );
    p.outro(pc.yellow("Setup complete. Start the server manually."));
    process.exit(1);
  }
}
