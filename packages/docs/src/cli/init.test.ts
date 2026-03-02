import { describe, it, expect } from "vitest";
import { VALID_TEMPLATES } from "./init.js";
import { PRESETS } from "./upgrade.js";

describe("init", () => {
  describe("VALID_TEMPLATES", () => {
    it("includes next, nuxt, sveltekit, astro", () => {
      expect(VALID_TEMPLATES).toEqual(["next", "nuxt", "sveltekit", "astro"]);
    });

    it("matches upgrade PRESETS for consistency", () => {
      expect([...VALID_TEMPLATES].sort()).toEqual([...PRESETS].sort());
    });

    it("has exactly 4 templates", () => {
      expect(VALID_TEMPLATES).toHaveLength(4);
    });
  });
});
