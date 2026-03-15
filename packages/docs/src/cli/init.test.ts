import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VALID_TEMPLATES, init } from "./init.js";
import { PRESETS } from "./upgrade.js";

const cancelSymbol = Symbol("clack:cancel");

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: { step: vi.fn(), info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn() },
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  select: vi.fn(),
  multiselect: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn((value: unknown) => value === cancelSymbol),
}));

// Stub exec to avoid running real shell commands during tests.
vi.mock("./utils.js", async () => {
  const actual = await vi.importActual<typeof import("./utils.js")>("./utils.js");
  return {
    ...actual,
    detectFramework: vi.fn(actual.detectFramework),
    detectPackageManagerFromLockfile: vi.fn(actual.detectPackageManagerFromLockfile),
    exec: vi.fn(),
  };
});

// Mock fs so fresh template flow doesn't touch the real filesystem.
vi.mock("node:fs", () => {
  const existsSync = vi.fn().mockReturnValue(false);
  const mkdirSync = vi.fn();
  const readFileSync = vi.fn().mockReturnValue("{}");
  const writeFileSync = vi.fn();
  return {
    __esModule: true,
    default: { existsSync, mkdirSync, readFileSync, writeFileSync },
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
  };
});

describe("init", () => {
  describe("VALID_TEMPLATES", () => {
    it("includes next, nuxt, sveltekit, astro, tanstack-start", () => {
      expect(VALID_TEMPLATES).toEqual(["next", "nuxt", "sveltekit", "astro", "tanstack-start"]);
    });

    it("matches upgrade PRESETS for consistency", () => {
      expect([...VALID_TEMPLATES].sort()).toEqual([...PRESETS].sort());
    });
  });

  describe("prompts (existing vs fresh project)", () => {
    let exitMock: { mockRestore: () => void } | undefined;

    beforeEach(async () => {
      const prompts = await import("@clack/prompts");
      const utils = await import("./utils.js");
      vi.mocked(prompts.select).mockReset();
      vi.mocked(prompts.multiselect).mockReset();
      vi.mocked(prompts.text).mockReset();
      vi.mocked(prompts.confirm).mockReset();
      vi.mocked(prompts.isCancel).mockImplementation((value: unknown) => value === cancelSymbol);
      vi.mocked(utils.detectFramework).mockReset();
      vi.mocked(utils.detectPackageManagerFromLockfile).mockReset();
      exitMock = vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit");
      }) as () => never);
    });

    afterEach(() => {
      exitMock?.mockRestore();
    });

    it("asks existing vs fresh when run without --template", async () => {
      const prompts = await import("@clack/prompts");
      vi.mocked(prompts.select).mockResolvedValueOnce(cancelSymbol as never);

      await expect(init({})).rejects.toThrow("process.exit");

      expect(prompts.select).toHaveBeenCalledTimes(1);
      expect(prompts.select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("existing project or starting fresh"),
          options: expect.arrayContaining([
            expect.objectContaining({
              value: "existing",
              label: "Existing project",
              hint: expect.stringContaining("Add docs to the current app"),
            }),
            expect.objectContaining({
              value: "fresh",
              label: "Fresh project",
              hint: expect.stringContaining("Bootstrap a new app"),
            }),
          ]),
        }),
      );
    });

    it("asks for package manager when bootstrapping a fresh template project", async () => {
      const prompts = await import("@clack/prompts");
      // Fresh project path when --template is provided; we cancel at the package manager prompt
      // so the rest of init exits early via process.exit.
      vi.mocked(prompts.select).mockResolvedValueOnce(cancelSymbol as never);

      await expect(init({ template: "next", name: "my-docs" })).rejects.toThrow("process.exit");

      expect(prompts.select).toHaveBeenCalledTimes(1);
      expect(prompts.select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Which package manager"),
          options: expect.arrayContaining([
            expect.objectContaining({ value: "pnpm", label: "pnpm" }),
            expect.objectContaining({ value: "npm", label: "npm" }),
            expect.objectContaining({ value: "yarn", label: "yarn" }),
            expect.objectContaining({ value: "bun", label: "bun" }),
          ]),
        }),
      );
    });

    it("prefills existing-project package manager from lockfile when detected", async () => {
      const prompts = await import("@clack/prompts");
      const utils = await import("./utils.js");

      vi.mocked(utils.detectFramework).mockReturnValue("nextjs");
      vi.mocked(utils.detectPackageManagerFromLockfile).mockReturnValue("pnpm");

      vi.mocked(prompts.select)
        .mockResolvedValueOnce("existing" as never)
        .mockResolvedValueOnce("fumadocs" as never)
        .mockResolvedValueOnce(cancelSymbol as never);
      vi.mocked(prompts.confirm)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never);
      vi.mocked(prompts.text)
        .mockResolvedValueOnce("docs" as never)
        .mockResolvedValueOnce("app/globals.css" as never);

      await expect(init({})).rejects.toThrow("process.exit");

      expect(prompts.select).toHaveBeenLastCalledWith(
        expect.objectContaining({
          initialValue: "pnpm",
          message: expect.stringContaining("Which package manager"),
        }),
      );
    });

    it("asks existing-project package manager without npm prefill when no lockfile is found", async () => {
      const prompts = await import("@clack/prompts");
      const utils = await import("./utils.js");

      vi.mocked(utils.detectFramework).mockReturnValue("nextjs");
      vi.mocked(utils.detectPackageManagerFromLockfile).mockReturnValue(null);

      vi.mocked(prompts.select)
        .mockResolvedValueOnce("existing" as never)
        .mockResolvedValueOnce("fumadocs" as never)
        .mockResolvedValueOnce(cancelSymbol as never);
      vi.mocked(prompts.confirm)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never);
      vi.mocked(prompts.text)
        .mockResolvedValueOnce("docs" as never)
        .mockResolvedValueOnce("app/globals.css" as never);

      await expect(init({})).rejects.toThrow("process.exit");

      expect(prompts.select).toHaveBeenLastCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Which package manager"),
        }),
      );
      expect(vi.mocked(prompts.select).mock.calls.at(-1)?.[0]).not.toHaveProperty("initialValue");
    });

    it("asks for locales when i18n scaffold is enabled", async () => {
      const prompts = await import("@clack/prompts");
      const utils = await import("./utils.js");

      vi.mocked(utils.detectFramework).mockReturnValue("nextjs");
      vi.mocked(utils.detectPackageManagerFromLockfile).mockReturnValue("pnpm");

      vi.mocked(prompts.select)
        .mockResolvedValueOnce("existing" as never)
        .mockResolvedValueOnce("fumadocs" as never)
        .mockResolvedValueOnce("en" as never)
        .mockResolvedValueOnce(cancelSymbol as never);
      vi.mocked(prompts.confirm)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(true as never);
      vi.mocked(prompts.multiselect).mockResolvedValueOnce(["en", "fr"] as never);
      vi.mocked(prompts.text)
        .mockResolvedValueOnce("docs" as never)
        .mockResolvedValueOnce("" as never)
        .mockResolvedValueOnce("app/globals.css" as never);

      await expect(init({})).rejects.toThrow("process.exit");

      expect(prompts.multiselect).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Which languages should we scaffold"),
        }),
      );
      expect(prompts.select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("default"),
          options: expect.arrayContaining([
            expect.objectContaining({ value: "en" }),
            expect.objectContaining({ value: "fr" }),
          ]),
        }),
      );
    });
  });
});
