import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
  detectFramework,
  detectPackageManager,
  detectPackageManagerFromLockfile,
  installCommand,
  devInstallCommand,
  runCommand,
  writeFileSafe,
  fileExists,
  readFileSafe,
  detectGlobalCssFiles,
  detectNextAppDir,
} from "./utils.js";

describe("utils", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-cli-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe("detectFramework", () => {
    it("returns null when package.json does not exist", () => {
      expect(detectFramework(tmpDir)).toBeNull();
    });

    it("returns nextjs when next is in dependencies", () => {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ dependencies: { next: "14.0.0" } }),
      );
      expect(detectFramework(tmpDir)).toBe("nextjs");
    });

    it("returns nextjs when next is in devDependencies", () => {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ devDependencies: { next: "14.0.0" } }),
      );
      expect(detectFramework(tmpDir)).toBe("nextjs");
    });

    it("returns sveltekit when @sveltejs/kit is present", () => {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ dependencies: { "@sveltejs/kit": "2.0.0" } }),
      );
      expect(detectFramework(tmpDir)).toBe("sveltekit");
    });

    it("returns astro when astro is present", () => {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ dependencies: { astro: "4.0.0" } }),
      );
      expect(detectFramework(tmpDir)).toBe("astro");
    });

    it("returns nuxt when nuxt is present", () => {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ dependencies: { nuxt: "3.0.0" } }),
      );
      expect(detectFramework(tmpDir)).toBe("nuxt");
    });

    it("returns null when no known framework in package.json", () => {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ dependencies: { react: "18.0.0" } }),
      );
      expect(detectFramework(tmpDir)).toBeNull();
    });
  });

  describe("detectPackageManager", () => {
    it("returns null from lockfile-only detection when no lockfile exists", () => {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
      expect(detectPackageManagerFromLockfile(tmpDir)).toBeNull();
    });

    it("returns pnpm when pnpm-lock.yaml exists", () => {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
      fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
      expect(detectPackageManagerFromLockfile(tmpDir)).toBe("pnpm");
      expect(detectPackageManager(tmpDir)).toBe("pnpm");
    });

    it("returns yarn when yarn.lock exists", () => {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
      fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "");
      expect(detectPackageManagerFromLockfile(tmpDir)).toBe("yarn");
      expect(detectPackageManager(tmpDir)).toBe("yarn");
    });

    it("returns bun when bun.lock or bun.lockb exists", () => {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
      fs.writeFileSync(path.join(tmpDir, "bun.lockb"), "");
      expect(detectPackageManagerFromLockfile(tmpDir)).toBe("bun");
      expect(detectPackageManager(tmpDir)).toBe("bun");
    });

    it("returns npm when package-lock.json exists", () => {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
      fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "");
      expect(detectPackageManagerFromLockfile(tmpDir)).toBe("npm");
      expect(detectPackageManager(tmpDir)).toBe("npm");
    });

    it("returns npm when no lock file (default)", () => {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
      expect(detectPackageManager(tmpDir)).toBe("npm");
    });
  });

  describe("installCommand", () => {
    it("returns 'pnpm add' for pnpm", () => {
      expect(installCommand("pnpm")).toBe("pnpm add");
    });
    it("returns 'yarn add' for yarn", () => {
      expect(installCommand("yarn")).toBe("yarn add");
    });
    it("returns 'npm add' for npm", () => {
      expect(installCommand("npm")).toBe("npm add");
    });
    it("returns 'bun add' for bun", () => {
      expect(installCommand("bun")).toBe("bun add");
    });
  });

  describe("devInstallCommand", () => {
    it("returns dev flag for pnpm", () => {
      expect(devInstallCommand("pnpm")).toBe("pnpm add -D");
    });
    it("returns yarn add -D for yarn", () => {
      expect(devInstallCommand("yarn")).toBe("yarn add -D");
    });
    it("returns npm install -D for npm", () => {
      expect(devInstallCommand("npm")).toBe("npm install -D");
    });
  });

  describe("runCommand", () => {
    it("returns 'pnpm run' for pnpm", () => {
      expect(runCommand("pnpm")).toBe("pnpm run");
    });
    it("returns yarn for yarn", () => {
      expect(runCommand("yarn")).toBe("yarn");
    });
    it("returns 'npm run' for npm", () => {
      expect(runCommand("npm")).toBe("npm run");
    });
  });

  describe("writeFileSafe", () => {
    it("writes file and creates parent dirs", () => {
      const filePath = path.join(tmpDir, "a", "b", "file.txt");
      const result = writeFileSafe(filePath, "hello", false);
      expect(result).toBe(true);
      expect(fs.readFileSync(filePath, "utf-8")).toBe("hello");
    });

    it("returns false when file exists and overwrite is false", () => {
      const filePath = path.join(tmpDir, "existing.txt");
      fs.writeFileSync(filePath, "old");
      expect(writeFileSafe(filePath, "new", false)).toBe(false);
      expect(fs.readFileSync(filePath, "utf-8")).toBe("old");
    });

    it("overwrites when overwrite is true", () => {
      const filePath = path.join(tmpDir, "existing.txt");
      fs.writeFileSync(filePath, "old");
      expect(writeFileSafe(filePath, "new", true)).toBe(true);
      expect(fs.readFileSync(filePath, "utf-8")).toBe("new");
    });
  });

  describe("fileExists", () => {
    it("returns true for existing file", () => {
      const filePath = path.join(tmpDir, "f");
      fs.writeFileSync(filePath, "");
      expect(fileExists(filePath)).toBe(true);
    });

    it("returns false for non-existing file", () => {
      expect(fileExists(path.join(tmpDir, "nonexistent"))).toBe(false);
    });
  });

  describe("readFileSafe", () => {
    it("returns content for existing file", () => {
      const filePath = path.join(tmpDir, "f");
      fs.writeFileSync(filePath, "content");
      expect(readFileSafe(filePath)).toBe("content");
    });

    it("returns null for non-existing file", () => {
      expect(readFileSafe(path.join(tmpDir, "nonexistent"))).toBeNull();
    });
  });

  describe("detectGlobalCssFiles", () => {
    it("returns empty array when none of the candidates exist", () => {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");
      expect(detectGlobalCssFiles(tmpDir)).toEqual([]);
    });

    it("returns path when app/globals.css exists", () => {
      fs.mkdirSync(path.join(tmpDir, "app"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app", "globals.css"), "");
      expect(detectGlobalCssFiles(tmpDir)).toContain("app/globals.css");
    });

    it("returns multiple when multiple candidates exist", () => {
      fs.mkdirSync(path.join(tmpDir, "app"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, "src", "app"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app", "globals.css"), "");
      fs.writeFileSync(path.join(tmpDir, "src", "app.css"), "");
      const found = detectGlobalCssFiles(tmpDir);
      expect(found).toContain("app/globals.css");
      expect(found).toContain("src/app.css");
    });
  });

  describe("detectNextAppDir", () => {
    it("returns null when neither app nor src/app exists", () => {
      expect(detectNextAppDir(tmpDir)).toBeNull();
    });

    it('returns "app" when only app exists', () => {
      fs.mkdirSync(path.join(tmpDir, "app"), { recursive: true });
      expect(detectNextAppDir(tmpDir)).toBe("app");
    });

    it('returns "src/app" when only src/app exists', () => {
      fs.mkdirSync(path.join(tmpDir, "src", "app"), { recursive: true });
      expect(detectNextAppDir(tmpDir)).toBe("src/app");
    });

    it('prefers "src/app" when both app and src/app exist', () => {
      fs.mkdirSync(path.join(tmpDir, "app"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, "src", "app"), { recursive: true });
      expect(detectNextAppDir(tmpDir)).toBe("src/app");
    });
  });
});
