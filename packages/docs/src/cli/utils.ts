import fs from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";

// ---------------------------------------------------------------------------
// Framework detection
// ---------------------------------------------------------------------------

export type Framework = "nextjs" | "tanstack-start" | "farmjs" | "sveltekit" | "astro" | "nuxt";

export function detectFramework(cwd: string): Framework | null {
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) return null;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  if (allDeps["next"]) return "nextjs";
  if (allDeps["@tanstack/react-start"]) return "tanstack-start";
  if (allDeps["@farmjs/core"]) return "farmjs";
  if (allDeps["@sveltejs/kit"]) return "sveltekit";
  if (allDeps["astro"]) return "astro";
  if (allDeps["nuxt"]) return "nuxt";

  return null;
}

// ---------------------------------------------------------------------------
// Package manager detection
// ---------------------------------------------------------------------------

export type PackageManager = "pnpm" | "yarn" | "npm" | "bun";

export type PackageManagerDetectionSource = "lockfile" | "packageManager";

export interface PackageManagerDetection {
  packageManager: PackageManager;
  directory: string;
  filePath: string;
  source: PackageManagerDetectionSource;
}

const PACKAGE_MANAGER_LOCKFILES: Array<{ fileName: string; packageManager: PackageManager }> = [
  { fileName: "pnpm-lock.yaml", packageManager: "pnpm" },
  { fileName: "bun.lockb", packageManager: "bun" },
  { fileName: "bun.lock", packageManager: "bun" },
  { fileName: "yarn.lock", packageManager: "yarn" },
  { fileName: "package-lock.json", packageManager: "npm" },
];

function readPackageManagerName(value: unknown): PackageManager | null {
  if (typeof value !== "string") return null;

  const name = value.trim().split("@")[0];
  if (name === "pnpm" || name === "yarn" || name === "npm" || name === "bun") {
    return name;
  }

  return null;
}

function detectPackageManagerLockfileInDirectory(
  directory: string,
): PackageManagerDetection | null {
  for (const { fileName, packageManager } of PACKAGE_MANAGER_LOCKFILES) {
    const filePath = path.join(directory, fileName);
    if (fs.existsSync(filePath)) {
      return {
        packageManager,
        directory,
        filePath,
        source: "lockfile",
      };
    }
  }

  return null;
}

function detectPackageManagerInDirectory(directory: string): PackageManagerDetection | null {
  const lockfile = detectPackageManagerLockfileInDirectory(directory);
  if (lockfile) return lockfile;

  const packageJsonPath = path.join(directory, "package.json");
  if (!fs.existsSync(packageJsonPath)) return null;

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as {
      packageManager?: unknown;
    };
    const packageManager = readPackageManagerName(packageJson.packageManager);
    if (!packageManager) return null;

    return {
      packageManager,
      directory,
      filePath: packageJsonPath,
      source: "packageManager",
    };
  } catch {
    return null;
  }
}

export function detectPackageManagerFromProject(cwd: string): PackageManagerDetection | null {
  let current = path.resolve(cwd);

  while (true) {
    const detected = detectPackageManagerInDirectory(current);
    if (detected) return detected;

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function formatPackageManagerDetection(
  cwd: string,
  detection: PackageManagerDetection,
): string {
  const relativePath = path.relative(path.resolve(cwd), detection.filePath);
  const displayPath = relativePath || path.basename(detection.filePath);

  if (detection.source === "packageManager") {
    return `packageManager in ${displayPath}`;
  }

  return displayPath;
}

export function detectPackageManagerFromLockfile(cwd: string): PackageManager | null {
  let current = path.resolve(cwd);

  while (true) {
    const detected = detectPackageManagerLockfileInDirectory(current);
    if (detected) return detected.packageManager;

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function detectPackageManager(cwd: string): PackageManager {
  const detected = detectPackageManagerFromProject(cwd);
  if (detected) return detected.packageManager;
  return "npm";
}

export function installCommand(pm: PackageManager): string {
  return pm === "yarn" ? "yarn add" : `${pm} add`;
}

export function devInstallCommand(pm: PackageManager): string {
  if (pm === "yarn") return "yarn add -D";
  if (pm === "npm") return "npm install -D";
  return `${pm} add -D`;
}

export function runCommand(pm: PackageManager): string {
  if (pm === "yarn") return "yarn";
  return `${pm} run`;
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

/**
 * Write a file, creating parent directories as needed.
 * Returns true if the file was written, false if it already existed and was skipped.
 */
export function writeFileSafe(filePath: string, content: string, overwrite = false): boolean {
  if (fs.existsSync(filePath) && !overwrite) {
    return false;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  return true;
}

/**
 * Check if a file exists.
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Read a file, returning null if it does not exist.
 */
export function readFileSafe(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

// ---------------------------------------------------------------------------
// Global CSS detection
// ---------------------------------------------------------------------------

/** Common locations where global CSS files live in Next.js / SvelteKit projects. */
const GLOBAL_CSS_CANDIDATES = [
  "app/globals.css",
  "app/global.css",
  "src/app/globals.css",
  "src/app/global.css",
  "src/app.css",
  "src/styles/app.css",
  "styles/globals.css",
  "styles/global.css",
  "src/styles/globals.css",
  "src/styles/global.css",
  "assets/css/main.css",
  "assets/main.css",
];

/**
 * Find existing global CSS files in the project.
 * Returns relative paths that exist.
 */
export function detectGlobalCssFiles(cwd: string): string[] {
  return GLOBAL_CSS_CANDIDATES.filter((rel) => fs.existsSync(path.join(cwd, rel)));
}

// ---------------------------------------------------------------------------
// Next.js App Router directory (app vs src/app)
// ---------------------------------------------------------------------------

/**
 * Detect whether the Next.js project uses `app` or `src/app` for the App Router.
 * Returns the directory that exists; if both exist, prefers src/app; if neither, returns null.
 */
export function detectNextAppDir(cwd: string): "app" | "src/app" | null {
  const hasSrcApp = fs.existsSync(path.join(cwd, "src", "app"));
  const hasApp = fs.existsSync(path.join(cwd, "app"));
  if (hasSrcApp) return "src/app";
  if (hasApp) return "app";
  return null;
}

// ---------------------------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------------------------

/**
 * Run a shell command synchronously, inheriting stdio.
 */
export function exec(command: string, cwd: string): void {
  execSync(command, { cwd, stdio: "inherit" });
}

/**
 * Run a shell command synchronously and return stdout.
 */
export function execOutput(command: string, cwd: string): string {
  return execSync(command, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Spawn a process and wait for a specific string in stdout,
 * then resolve with the child process (still running).
 */
export function spawnAndWaitFor(
  command: string,
  args: string[],
  cwd: string,
  waitFor: string,
  timeoutMs = 60_000,
): Promise<import("node:child_process").ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out waiting for "${waitFor}" after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
      if (output.includes(waitFor)) {
        clearTimeout(timer);
        resolve(child);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      process.stderr.write(data.toString());
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (!output.includes(waitFor)) {
        reject(new Error(`Process exited with code ${code} before "${waitFor}" appeared`));
      }
    });
  });
}
