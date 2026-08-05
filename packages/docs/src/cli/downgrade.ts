/**
 * Downgrade @farming-labs/* packages to a lower exact version.
 * Detects framework from package.json by default, or use --framework (next, tanstack-start, farmjs, nuxt, sveltekit, astro).
 */
import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { type PackageManager, exec, execOutput, fileExists } from "./utils.js";
import {
  buildDocsPackageInstallCommand,
  getPackagesForFramework,
  resolveDocsPackageFramework,
  resolveDocsPackageManager,
  validateUpgradeVersion,
  type UpgradeFramework,
} from "./package-version.js";

export interface DowngradeOptions {
  /** Explicit framework: next, tanstack-start, farmjs, nuxt, sveltekit, astro. If not set, framework is auto-detected. */
  framework?: string;
  /** Exact package version to install, e.g. 0.1.104. Must be lower than the current installed version. */
  version?: string;
  /** Print the resolved install command without running it. */
  dryRun?: boolean;
}

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

function parseSemver(version: string): ParsedSemver {
  const normalized = validateUpgradeVersion(version).split("+", 1)[0] ?? version;
  const prereleaseIndex = normalized.indexOf("-");
  const core = prereleaseIndex === -1 ? normalized : normalized.slice(0, prereleaseIndex);
  const prerelease = prereleaseIndex === -1 ? "" : normalized.slice(prereleaseIndex + 1);
  const [major = "0", minor = "0", patch = "0"] = core.split(".");

  return {
    major: Number.parseInt(major, 10),
    minor: Number.parseInt(minor, 10),
    patch: Number.parseInt(patch, 10),
    prerelease: prerelease ? prerelease.split(".") : [],
  };
}

function comparePrereleaseIdentifier(a: string, b: string): number {
  const aNumber = /^\d+$/.test(a) ? Number.parseInt(a, 10) : null;
  const bNumber = /^\d+$/.test(b) ? Number.parseInt(b, 10) : null;

  if (aNumber !== null && bNumber !== null) return Math.sign(aNumber - bNumber);
  if (aNumber !== null) return -1;
  if (bNumber !== null) return 1;
  return a.localeCompare(b);
}

export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);

  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) return Math.sign(left[key] - right[key]);
  }

  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
  if (left.prerelease.length === 0) return 1;
  if (right.prerelease.length === 0) return -1;

  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index++) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;

    const compared = comparePrereleaseIdentifier(leftPart, rightPart);
    if (compared !== 0) return compared;
  }

  return 0;
}

function normalizeMaybeVersion(value: string): string | null {
  try {
    return validateUpgradeVersion(value);
  } catch {
    return null;
  }
}

function extractVersionFromSpec(spec: string): string | null {
  const exact = normalizeMaybeVersion(spec);
  if (exact) return exact;

  const rangeMatch = spec.match(/^[~^]([^~^<>=|\s]+)/);
  if (!rangeMatch) return null;

  return normalizeMaybeVersion(rangeMatch[1] ?? "");
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function packageJsonPath(cwd: string, packageName: string): string {
  return path.join(cwd, "node_modules", ...packageName.split("/"), "package.json");
}

export function readCurrentPackageVersion(cwd: string, packageNames: string[]): string | null {
  for (const packageName of packageNames) {
    const installedPackageJson = readJsonFile(packageJsonPath(cwd, packageName));
    const installedVersion =
      typeof installedPackageJson?.version === "string"
        ? normalizeMaybeVersion(installedPackageJson.version)
        : null;
    if (installedVersion) return installedVersion;
  }

  const projectPackageJson = readJsonFile(path.join(cwd, "package.json"));
  const dependencyGroups = [
    projectPackageJson?.dependencies,
    projectPackageJson?.devDependencies,
    projectPackageJson?.peerDependencies,
  ];

  for (const group of dependencyGroups) {
    if (!group || typeof group !== "object") continue;

    for (const packageName of packageNames) {
      const spec = (group as Record<string, unknown>)[packageName];
      if (typeof spec !== "string") continue;

      const version = extractVersionFromSpec(spec);
      if (version) return version;
    }
  }

  return null;
}

export function parsePublishedVersions(raw: string): string[] {
  const parsed = JSON.parse(raw) as unknown;
  const versions = Array.isArray(parsed) ? parsed : [parsed];

  return versions
    .filter((version): version is string => typeof version === "string")
    .map((version) => normalizeMaybeVersion(version))
    .filter((version): version is string => version !== null);
}

export function getPreviousVersion(versions: string[], currentVersion: string): string | null {
  const current = validateUpgradeVersion(currentVersion);

  return (
    versions
      .filter((version) => compareSemver(version, current) < 0)
      .sort(compareSemver)
      .at(-1) ?? null
  );
}

export function fetchPublishedVersions(cwd: string): string[] {
  return parsePublishedVersions(execOutput("npm view @farming-labs/docs versions --json", cwd));
}

export function buildDowngradeCommand(
  framework: UpgradeFramework,
  version: string,
  pm: PackageManager,
): string {
  return buildDocsPackageInstallCommand(framework, validateUpgradeVersion(version), pm);
}

export async function downgrade(options: DowngradeOptions = {}) {
  const cwd = process.cwd();

  p.intro(pc.bgCyan(pc.black(" @farming-labs/docs downgrade ")));

  const projectPackageJsonPath = path.join(cwd, "package.json");
  if (!fileExists(projectPackageJsonPath)) {
    p.log.error("No package.json found in the current directory. Run this from your project root.");
    process.exit(1);
  }

  const { framework, preset } = resolveDocsPackageFramework(cwd, options.framework);
  const packages = getPackagesForFramework(framework);
  const currentVersion = readCurrentPackageVersion(cwd, packages);

  if (!currentVersion) {
    p.log.error(
      "Could not determine the current @farming-labs docs package version. Install dependencies first or use an exact package version in package.json.",
    );
    process.exit(1);
  }

  let targetVersion: string;
  if (options.version !== undefined) {
    try {
      targetVersion = validateUpgradeVersion(options.version);
    } catch (error) {
      p.log.error(error instanceof Error ? error.message : "Invalid downgrade version.");
      process.exit(1);
    }

    const comparison = compareSemver(targetVersion, currentVersion);
    if (comparison > 0) {
      p.log.error(
        `Version ${pc.cyan(targetVersion)} is newer than current ${pc.cyan(currentVersion)}.`,
      );
      p.log.info(`Use ${pc.cyan(`docs upgrade --version ${targetVersion}`)} instead.`);
      process.exit(1);
    }

    if (comparison === 0) {
      p.log.error(
        `Version ${pc.cyan(targetVersion)} is already installed. Choose a lower version to downgrade.`,
      );
      process.exit(1);
    }
  } else {
    let publishedVersions: string[];
    try {
      publishedVersions = fetchPublishedVersions(cwd);
    } catch {
      p.log.error(
        "Could not fetch published @farming-labs/docs versions. Pass an exact version with " +
          pc.cyan("--version <version>") +
          ".",
      );
      process.exit(1);
    }

    const previousVersion = getPreviousVersion(publishedVersions, currentVersion);
    if (!previousVersion) {
      p.log.error(`No published version found below current ${pc.cyan(currentVersion)}.`);
      process.exit(1);
    }

    targetVersion = previousVersion;
  }

  const pm = await resolveDocsPackageManager(cwd, "downgrade");
  const cmd = buildDowngradeCommand(framework, targetVersion, pm);

  p.log.step(`Downgrading ${preset} docs packages from ${currentVersion} to ${targetVersion}...`);
  p.log.message(pc.dim(packages.join(", ")));

  if (options.dryRun) {
    p.log.info("Dry run. Would run:\n  " + pc.cyan(cmd));
    p.outro(pc.green("Dry run complete. No changes made."));
    return;
  }

  try {
    exec(cmd, cwd);
    p.log.success(`Packages downgraded to ${targetVersion}.`);
    p.outro(pc.green("Done. Run your dev server to confirm everything works."));
  } catch {
    p.log.error("Downgrade failed. Try running manually:\n  " + pc.cyan(cmd));
    process.exit(1);
  }
}
