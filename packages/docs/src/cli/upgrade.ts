/**
 * Upgrade @farming-labs/* packages to a dist-tag or exact version.
 * Detects framework from package.json by default, or use --framework (next, tanstack-start, nuxt, sveltekit, astro).
 */
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { type PackageManager, exec, fileExists } from "./utils.js";
import {
  buildDocsPackageInstallCommand,
  getPackagesForFramework,
  resolveDocsPackageFramework,
  resolveDocsPackageManager,
  validateUpgradeVersion,
  type UpgradeFramework,
} from "./package-version.js";

export {
  PACKAGES_BY_FRAMEWORK,
  PRESETS,
  frameworkFromPreset,
  getPackagesForFramework,
  presetFromFramework,
  validateUpgradeVersion,
  type PresetName,
  type UpgradeFramework,
} from "./package-version.js";

export type UpgradeTag = "latest" | "beta";
export type UpgradeTarget = UpgradeTag | (string & {});

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
  return buildDocsPackageInstallCommand(framework, target, pm);
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

  const { framework, preset } = resolveDocsPackageFramework(cwd, options.framework);
  const pm = await resolveDocsPackageManager(cwd, "upgrade");

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
