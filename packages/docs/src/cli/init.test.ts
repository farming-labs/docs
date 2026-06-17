import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VALID_TEMPLATES, getDocsCloudConfigPathForFramework, init } from "./init.js";

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
    detectPackageManagerFromProject: vi.fn(actual.detectPackageManagerFromProject),
    detectPackageManagerFromLockfile: vi.fn(actual.detectPackageManagerFromLockfile),
    exec: vi.fn(),
  };
});

vi.mock("./cloud.js", () => ({
  initCloudConfig: vi.fn(),
}));

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

function packageManagerDetection(packageManager: "npm" | "pnpm" | "yarn" | "bun") {
  return {
    packageManager,
    directory: process.cwd(),
    filePath: `${packageManager === "pnpm" ? "pnpm-lock.yaml" : "package.json"}`,
    source: "lockfile" as const,
  };
}

describe("init", () => {
  describe("VALID_TEMPLATES", () => {
    it("includes next, nuxt, sveltekit, astro, tanstack-start", () => {
      expect(VALID_TEMPLATES).toEqual(["next", "nuxt", "sveltekit", "astro", "tanstack-start"]);
    });
  });

  describe("prompts (existing vs fresh project)", () => {
    let exitMock: { mockRestore: () => void } | undefined;

    beforeEach(async () => {
      const prompts = await import("@clack/prompts");
      const utils = await import("./utils.js");
      const cloud = await import("./cloud.js");
      vi.mocked(prompts.select).mockReset();
      vi.mocked(prompts.multiselect).mockReset();
      vi.mocked(prompts.text).mockReset();
      vi.mocked(prompts.confirm).mockReset();
      vi.mocked(prompts.log.info).mockReset();
      vi.mocked(prompts.log.success).mockReset();
      vi.mocked(prompts.log.warn).mockReset();
      vi.mocked(prompts.log.error).mockReset();
      vi.mocked(prompts.isCancel).mockImplementation((value: unknown) => value === cancelSymbol);
      vi.mocked(utils.detectFramework).mockReset();
      vi.mocked(utils.detectPackageManagerFromProject).mockReset();
      vi.mocked(utils.detectPackageManagerFromLockfile).mockReset();
      vi.mocked(utils.exec).mockReset();
      vi.mocked(cloud.initCloudConfig).mockReset();
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
      vi.mocked(utils.detectPackageManagerFromProject).mockReturnValue(
        packageManagerDetection("pnpm"),
      );

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
      vi.mocked(utils.detectPackageManagerFromProject).mockReturnValue(null);

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
      vi.mocked(utils.detectPackageManagerFromProject).mockReturnValue(
        packageManagerDetection("pnpm"),
      );

      vi.mocked(prompts.select)
        .mockResolvedValueOnce("existing" as never)
        .mockResolvedValueOnce("fumadocs" as never)
        .mockResolvedValueOnce("en" as never)
        .mockResolvedValueOnce(cancelSymbol as never);
      vi.mocked(prompts.confirm)
        .mockResolvedValueOnce(false as never)
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

    it("prompts for API route root when API reference scaffold is enabled", async () => {
      const prompts = await import("@clack/prompts");
      const utils = await import("./utils.js");

      vi.mocked(utils.detectFramework).mockReturnValue("nextjs");
      vi.mocked(utils.detectPackageManagerFromProject).mockReturnValue(
        packageManagerDetection("pnpm"),
      );

      vi.mocked(prompts.select)
        .mockResolvedValueOnce("existing" as never)
        .mockResolvedValueOnce(cancelSymbol as never);
      vi.mocked(prompts.confirm)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(false as never);
      vi.mocked(prompts.text)
        .mockResolvedValueOnce("internal-api" as never)
        .mockResolvedValueOnce("app/globals.css" as never);

      await expect(init({ theme: "fumadocs", entry: "docs" })).rejects.toThrow("process.exit");

      expect(prompts.text).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("API route root"),
          placeholder: "api",
          defaultValue: "api",
        }),
      );
    });

    it("asks whether to add Docs Cloud infrastructure support after installing deps", async () => {
      const prompts = await import("@clack/prompts");
      const utils = await import("./utils.js");

      vi.mocked(utils.detectFramework).mockReturnValue("nextjs");
      vi.mocked(utils.detectPackageManagerFromProject).mockReturnValue(
        packageManagerDetection("pnpm"),
      );

      vi.mocked(prompts.select)
        .mockResolvedValueOnce("existing" as never)
        .mockResolvedValueOnce("fumadocs" as never)
        .mockResolvedValueOnce("pnpm" as never);
      vi.mocked(prompts.confirm)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(cancelSymbol as never);
      vi.mocked(prompts.text)
        .mockResolvedValueOnce("docs" as never)
        .mockResolvedValueOnce("app/globals.css" as never);

      await expect(init({})).rejects.toThrow("process.exit");

      expect(prompts.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Docs Cloud infrastructure support"),
          initialValue: false,
        }),
      );
    });

    it("configures Docs Cloud support when enabled during init", async () => {
      const prompts = await import("@clack/prompts");
      const utils = await import("./utils.js");
      const cloud = await import("./cloud.js");

      vi.mocked(utils.detectFramework).mockReturnValue("nextjs");
      vi.mocked(utils.detectPackageManagerFromProject).mockReturnValue(
        packageManagerDetection("pnpm"),
      );
      vi.mocked(cloud.initCloudConfig).mockResolvedValueOnce({
        configPath: `${process.cwd()}/docs.config.ts`,
        docsJsonPath: `${process.cwd()}/docs.json`,
        apiKeyEnv: "DOCS_CLOUD_API_KEY",
        analyticsProjectIdEnv: "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID",
        configCreated: false,
        configUpdated: true,
        docsJsonCreated: true,
        docsJsonUpdated: true,
      });

      vi.mocked(prompts.select)
        .mockResolvedValueOnce("existing" as never)
        .mockResolvedValueOnce("fumadocs" as never)
        .mockResolvedValueOnce("pnpm" as never);
      vi.mocked(prompts.confirm)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(false as never);
      vi.mocked(prompts.text)
        .mockResolvedValueOnce("docs" as never)
        .mockResolvedValueOnce("app/globals.css" as never);

      await expect(init({})).rejects.toThrow("process.exit");

      expect(cloud.initCloudConfig).toHaveBeenCalledWith({
        rootDir: process.cwd(),
        configPath: undefined,
      });
      expect(prompts.log.success).toHaveBeenCalledWith(
        expect.stringContaining("Docs Cloud infrastructure support configured"),
      );
    });

    it("prints the framework-specific install command when dependency installation fails", async () => {
      const prompts = await import("@clack/prompts");
      const utils = await import("./utils.js");

      vi.mocked(utils.detectFramework).mockReturnValue("nextjs");
      vi.mocked(utils.detectPackageManagerFromProject).mockReturnValue(
        packageManagerDetection("pnpm"),
      );
      vi.mocked(utils.exec).mockImplementationOnce(() => {
        throw new Error("install failed");
      });

      vi.mocked(prompts.select)
        .mockResolvedValueOnce("existing" as never)
        .mockResolvedValueOnce("fumadocs" as never)
        .mockResolvedValueOnce("pnpm" as never);
      vi.mocked(prompts.confirm)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never);
      vi.mocked(prompts.text)
        .mockResolvedValueOnce("docs" as never)
        .mockResolvedValueOnce("app/globals.css" as never);

      await expect(init({})).rejects.toThrow("process.exit");

      expect(prompts.log.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "pnpm add @farming-labs/docs @farming-labs/next @farming-labs/theme",
        ),
      );
    });
  });

  describe("getDocsCloudConfigPathForFramework", () => {
    it("uses src/lib docs config paths for frameworks that scaffold there", () => {
      expect(getDocsCloudConfigPathForFramework("sveltekit")).toBe("src/lib/docs.config.ts");
      expect(getDocsCloudConfigPathForFramework("astro")).toBe("src/lib/docs.config.ts");
    });

    it("lets root-config frameworks auto-resolve docs.config extensions", () => {
      expect(getDocsCloudConfigPathForFramework("nextjs")).toBeUndefined();
      expect(getDocsCloudConfigPathForFramework("tanstack-start")).toBeUndefined();
      expect(getDocsCloudConfigPathForFramework("nuxt")).toBeUndefined();
    });
  });
});
