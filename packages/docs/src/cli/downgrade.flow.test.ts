import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cancelSymbol = Symbol("clack:cancel");

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: {
    step: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
  select: vi.fn(),
  isCancel: vi.fn((value: unknown) => value === cancelSymbol),
}));

vi.mock("./utils.js", async () => {
  const actual = await vi.importActual<typeof import("./utils.js")>("./utils.js");
  return {
    ...actual,
    detectFramework: vi.fn(),
    detectPackageManagerFromLockfile: vi.fn(),
    exec: vi.fn(),
    execOutput: vi.fn(),
    fileExists: vi.fn(),
  };
});

import { downgrade } from "./downgrade.js";

function writePackageJson(project: string, version: string) {
  writeFileSync(
    join(project, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
        dependencies: {
          "@farming-labs/docs": version,
          next: "16.1.6",
        },
      },
      null,
      2,
    ),
    "utf-8",
  );
}

function writeInstalledDocsPackage(project: string, version: string) {
  const packageDir = join(project, "node_modules", "@farming-labs", "docs");
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify({ name: "@farming-labs/docs", version }, null, 2),
    "utf-8",
  );
}

describe("downgrade", () => {
  let exitMock: { mockRestore: () => void };
  let originalCwd: string;
  let tempProject: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempProject = mkdtempSync(join(tmpdir(), "docs-downgrade-"));
    writePackageJson(tempProject, "0.1.105");
    writeInstalledDocsPackage(tempProject, "0.1.105");
    process.chdir(tempProject);

    const prompts = await import("@clack/prompts");
    const utils = await import("./utils.js");

    vi.mocked(prompts.select).mockReset();
    vi.mocked(prompts.isCancel).mockImplementation((value: unknown) => value === cancelSymbol);

    vi.mocked(utils.fileExists).mockReset();
    vi.mocked(utils.detectFramework).mockReset();
    vi.mocked(utils.detectPackageManagerFromLockfile).mockReset();
    vi.mocked(utils.exec).mockReset();
    vi.mocked(utils.execOutput).mockReset();

    vi.mocked(utils.fileExists).mockImplementation((filePath: string) => existsSync(filePath));
    vi.mocked(utils.detectFramework).mockReturnValue("nextjs");
    vi.mocked(utils.detectPackageManagerFromLockfile).mockReturnValue("pnpm");
    vi.mocked(utils.execOutput).mockReturnValue('["0.1.103","0.1.104","0.1.105"]');

    exitMock = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as () => never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempProject, { recursive: true, force: true });
    exitMock.mockRestore();
  });

  it("downgrades to the previous published version by default", async () => {
    const utils = await import("./utils.js");

    await downgrade();

    expect(utils.execOutput).toHaveBeenCalledWith(
      "npm view @farming-labs/docs versions --json",
      process.cwd(),
    );
    expect(utils.exec).toHaveBeenCalledWith(
      "pnpm add @farming-labs/docs@0.1.104 @farming-labs/theme@0.1.104 @farming-labs/next@0.1.104",
      process.cwd(),
    );
  });

  it("downgrades to an exact lower version when requested", async () => {
    const utils = await import("./utils.js");

    await downgrade({ version: "0.1.103" });

    expect(utils.execOutput).not.toHaveBeenCalled();
    expect(utils.exec).toHaveBeenCalledWith(
      "pnpm add @farming-labs/docs@0.1.103 @farming-labs/theme@0.1.103 @farming-labs/next@0.1.103",
      process.cwd(),
    );
  });

  it("rejects a version newer than the current version", async () => {
    const utils = await import("./utils.js");

    await expect(downgrade({ version: "0.1.106" })).rejects.toThrow("process.exit");

    expect(utils.exec).not.toHaveBeenCalled();
  });

  it("rejects the current version", async () => {
    const utils = await import("./utils.js");

    await expect(downgrade({ version: "0.1.105" })).rejects.toThrow("process.exit");

    expect(utils.exec).not.toHaveBeenCalled();
  });

  it("prompts for package manager when no lockfile is found", async () => {
    const prompts = await import("@clack/prompts");
    const utils = await import("./utils.js");

    vi.mocked(utils.detectPackageManagerFromLockfile).mockReturnValue(null);
    vi.mocked(prompts.select).mockResolvedValueOnce("bun" as never);

    await downgrade({ version: "0.1.104" });

    expect(prompts.select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("package manager"),
      }),
    );
    expect(utils.exec).toHaveBeenCalledWith(
      "bun add @farming-labs/docs@0.1.104 @farming-labs/theme@0.1.104 @farming-labs/next@0.1.104",
      process.cwd(),
    );
  });
});
