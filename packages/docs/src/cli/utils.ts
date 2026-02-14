import fs from "node:fs";
import path from "node:path";
import { execSync, spawn } from "node:child_process";

// ---------------------------------------------------------------------------
// Framework detection
// ---------------------------------------------------------------------------

export type Framework = "nextjs";

export function detectFramework(cwd: string): Framework | null {
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) return null;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  if (allDeps["next"]) return "nextjs";

  return null;
}

// ---------------------------------------------------------------------------
// Package manager detection
// ---------------------------------------------------------------------------

export type PackageManager = "pnpm" | "yarn" | "npm" | "bun";

export function detectPackageManager(cwd: string): PackageManager {
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(cwd, "bun.lockb")) || fs.existsSync(path.join(cwd, "bun.lock"))) return "bun";
  if (fs.existsSync(path.join(cwd, "yarn.lock"))) return "yarn";
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
export function writeFileSafe(
  filePath: string,
  content: string,
  overwrite = false,
): boolean {
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
// Shell helpers
// ---------------------------------------------------------------------------

/**
 * Run a shell command synchronously, inheriting stdio.
 */
export function exec(command: string, cwd: string): void {
  execSync(command, { cwd, stdio: "inherit" });
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
