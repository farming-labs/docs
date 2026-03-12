import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getNextAppDir } from "./get-app-dir.js";

describe("getNextAppDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "get-app-dir-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('returns "app" when only app exists', () => {
    fs.mkdirSync(path.join(tmpDir, "app"), { recursive: true });
    expect(getNextAppDir(tmpDir)).toBe("app");
  });

  it('returns "src/app" when only src/app exists', () => {
    fs.mkdirSync(path.join(tmpDir, "src", "app"), { recursive: true });
    expect(getNextAppDir(tmpDir)).toBe("src/app");
  });

  it('prefers "src/app" when both app and src/app exist', () => {
    fs.mkdirSync(path.join(tmpDir, "app"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "src", "app"), { recursive: true });
    expect(getNextAppDir(tmpDir)).toBe("src/app");
  });

  it('returns "app" when neither exists (default)', () => {
    expect(getNextAppDir(tmpDir)).toBe("app");
  });
});
