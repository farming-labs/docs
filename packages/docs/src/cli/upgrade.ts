/**
 * Upgrade @farming-labs/* packages to a dist-tag or exact version.
 * Detects framework from package.json by default, or use --framework (next, tanstack-start, nuxt, sveltekit, astro).
 */
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  type Framework,
  type PackageManager,
  detectFramework,
  detectPackageManagerFromLockfile,
  installCommand,
  exec,
  fileExists,
} from "./utils.js";

export const PRESETS = ["next", "tanstack-start", "nuxt", "sveltekit", "astro"] as const;
export type PresetName = (typeof PRESETS)[number];
export type UpgradeFramework = Framework;

export const PACKAGES_BY_FRAMEWORK: Record<UpgradeFramework, string[]> = {
  nextjs: ["@farming-labs/docs", "@farming-labs/theme", "@farming-labs/next"],
  "tanstack-start": ["@farming-labs/docs", "@farming-labs/theme", "@farming-labs/tanstack-start"],
  nuxt: ["@farming-labs/docs", "@farming-labs/nuxt", "@farming-labs/nuxt-theme"],
  sveltekit: ["@farming-labs/docs", "@farming-labs/svelte", "@farming-labs/svelte-theme"],
  astro: ["@farming-labs/docs", "@farming-labs/astro", "@farming-labs/astro-theme"],
};

export function presetFromFramework(fw: UpgradeFramework): PresetName {
  return fw === "nextjs" ? "next" : fw;
}

export function frameworkFromPreset(preset: PresetName): UpgradeFramework {
  return preset === "next" ? "nextjs" : preset;
}

/** Return package list for a framework (for testing and CLI). */
export function getPackagesForFramework(framework: UpgradeFramework): string[] {
  return PACKAGES_BY_FRAMEWORK[framework];
}

const exactSemverPattern =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export type UpgradeTag = "latest" | "beta";
export type UpgradeTarget = UpgradeTag | (string & {});

export function validateUpgradeVersion(version: string): string {
  const normalized = version.trim();
  if (!exactSemverPattern.test(normalized)) {
    throw new Error(`Invalid version "${version}". Use an exact semver version like 0.1.104.`);
  }
  return normalized;
}

export function resolveUpgradeTarget(options: Pick<UpgradeOptions, "tag" | "version">): string {
  if (options.version !== undefined) {
    return validateUpgradeVersion(options.version);
  }

  return options.tag ?? "latest";
}

/** Build the install command for upgrade (for testing). */
export function buildUpgradeCommand(
  framework: UpgradeFramework,
  target: UpgradeTarget,
  pm: PackageManager,
): string {
  const packages = PACKAGES_BY_FRAMEWORK[framework];
  const packagesWithTarget = packages.map((name) => `${name}@${target}`);
  return `${installCommand(pm)} ${packagesWithTarget.join(" ")}`;
}

export interface UpgradeOptions {
  /** Explicit framework: next, tanstack-start, nuxt, sveltekit, astro. If not set, framework is auto-detected. */
  framework?: string;
  /** npm dist-tag to install: "latest" (default) or "beta". */
  tag?: UpgradeTag;
  /** Exact package version to install, e.g. 0.1.104. Overrides tag when provided. */
  version?: string;
}

export async function upgrade(options: UpgradeOptions = {}) {
  const cwd = process.cwd();

  p.intro(pc.bgCyan(pc.black(" @farming-labs/docs upgrade ")));

  let target: string;
  try {
    target = resolveUpgradeTarget(options);
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : "Invalid upgrade version.");
    process.exit(1);
  }

  const packageJsonPath = path.join(cwd, "package.json");
  if (!fileExists(packageJsonPath)) {
    p.log.error("No package.json found in the current directory. Run this from your project root.");
    process.exit(1);
  }

  let framework: UpgradeFramework | null = null;
  let preset: PresetName;

  if (options.framework) {
    const raw = options.framework.toLowerCase().trim();
    const normalized = raw === "nextjs" ? "next" : raw;
    if (!PRESETS.includes(normalized as PresetName)) {
      p.log.error(
        `Invalid framework ${pc.cyan(options.framework)}. Use one of: ${PRESETS.map((t) => pc.cyan(t)).join(", ")}`,
      );
      process.exit(1);
    }
    preset = normalized as PresetName;
    framework = frameworkFromPreset(preset);
  } else {
    const detected = detectFramework(cwd);
    if (!detected) {
      p.log.error(
        "Could not detect a supported framework (Next.js, TanStack Start, Nuxt, SvelteKit, Astro). Use " +
          pc.cyan("--framework <next|tanstack-start|nuxt|sveltekit|astro>") +
          " to specify.",
      );
      process.exit(1);
    }
    framework = detected;
    preset = presetFromFramework(framework);
  }

  let pm = detectPackageManagerFromLockfile(cwd);
  if (pm) {
    p.log.info(`Detected ${pc.cyan(pm)} from lockfile`);
  } else {
    const pmAnswer = await p.select({
      message: "Which package manager do you want to use for this upgrade?",
      options: [
        { value: "pnpm", label: "pnpm", hint: "Use pnpm add" },
        { value: "npm", label: "npm", hint: "Use npm add" },
        { value: "yarn", label: "yarn", hint: "Use yarn add" },
        { value: "bun", label: "bun", hint: "Use bun add" },
      ] as const,
    });

    if (p.isCancel(pmAnswer)) {
      p.outro(pc.red("Upgrade cancelled."));
      process.exit(0);
    }

    pm = pmAnswer as PackageManager;
    p.log.info(`Using ${pc.cyan(pm)} as package manager`);
  }

  const cmd = buildUpgradeCommand(framework, target, pm);
  const packages = getPackagesForFramework(framework);

  p.log.step(`Upgrading ${preset} docs packages to ${target}...`);
  p.log.message(pc.dim(packages.join(", ")));

  try {
    exec(cmd, cwd);
    p.log.success(`Packages upgraded to ${target}.`);
    p.outro(pc.green("Done. Run your dev server to confirm everything works."));
  } catch {
    p.log.error("Upgrade failed. Try running manually:\n  " + pc.cyan(cmd));
    process.exit(1);
  }
}
