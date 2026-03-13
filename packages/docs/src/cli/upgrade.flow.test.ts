import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
    fileExists: vi.fn(),
  };
});

import { upgrade } from "./upgrade.js";

describe("upgrade package manager selection", () => {
  let exitMock: { mockRestore: () => void };

  beforeEach(async () => {
    const prompts = await import("@clack/prompts");
    const utils = await import("./utils.js");

    vi.mocked(prompts.select).mockReset();
    vi.mocked(prompts.isCancel).mockImplementation((value: unknown) => value === cancelSymbol);

    vi.mocked(utils.fileExists).mockReset();
    vi.mocked(utils.detectFramework).mockReset();
    vi.mocked(utils.detectPackageManagerFromLockfile).mockReset();
    vi.mocked(utils.exec).mockReset();

    vi.mocked(utils.fileExists).mockReturnValue(true);
    vi.mocked(utils.detectFramework).mockReturnValue("nextjs");

    exitMock = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as () => never);
  });

  afterEach(() => {
    exitMock.mockRestore();
  });

  it("uses the detected package manager from lockfile without prompting", async () => {
    const prompts = await import("@clack/prompts");
    const utils = await import("./utils.js");

    vi.mocked(utils.detectPackageManagerFromLockfile).mockReturnValue("pnpm");

    await upgrade({ tag: "latest" });

    expect(prompts.select).not.toHaveBeenCalled();
    expect(utils.exec).toHaveBeenCalledWith(
      "pnpm add @farming-labs/docs@latest @farming-labs/theme@latest @farming-labs/next@latest",
      process.cwd(),
    );
  });

  it("prompts for a package manager when no lockfile is found", async () => {
    const prompts = await import("@clack/prompts");
    const utils = await import("./utils.js");

    vi.mocked(utils.detectPackageManagerFromLockfile).mockReturnValue(null);
    vi.mocked(prompts.select).mockResolvedValueOnce("bun" as never);

    await upgrade({ tag: "latest" });

    expect(prompts.select).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("package manager"),
        options: expect.arrayContaining([
          expect.objectContaining({ value: "pnpm", label: "pnpm" }),
          expect.objectContaining({ value: "npm", label: "npm" }),
          expect.objectContaining({ value: "yarn", label: "yarn" }),
          expect.objectContaining({ value: "bun", label: "bun" }),
        ]),
      }),
    );
    expect(utils.exec).toHaveBeenCalledWith(
      "bun add @farming-labs/docs@latest @farming-labs/theme@latest @farming-labs/next@latest",
      process.cwd(),
    );
  });
});
