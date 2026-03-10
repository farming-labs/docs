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
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn((value: unknown) => value === cancelSymbol),
}));

describe("init", () => {
  describe("VALID_TEMPLATES", () => {
    it("includes next, nuxt, sveltekit, astro", () => {
      expect(VALID_TEMPLATES).toEqual(["next", "nuxt", "sveltekit", "astro"]);
    });

    it("matches upgrade PRESETS for consistency", () => {
      expect([...VALID_TEMPLATES].sort()).toEqual([...PRESETS].sort());
    });
  });

  describe("prompts (existing vs fresh project)", () => {
    let exitMock: { mockRestore: () => void };

    beforeEach(async () => {
      const prompts = await import("@clack/prompts");
      vi.mocked(prompts.select).mockReset();
      vi.mocked(prompts.text).mockReset();
      vi.mocked(prompts.confirm).mockReset();
      vi.mocked(prompts.isCancel).mockImplementation((value: unknown) => value === cancelSymbol);
      exitMock = vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit");
      }) as () => never);
    });

    afterEach(() => {
      exitMock.mockRestore();
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
  });
});
