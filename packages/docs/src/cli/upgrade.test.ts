import { describe, it, expect } from "vitest";
import {
  PRESETS,
  PACKAGES_BY_FRAMEWORK,
  type UpgradeFramework,
  presetFromFramework,
  frameworkFromPreset,
  getPackagesForFramework,
  buildUpgradeCommand,
} from "./upgrade.js";

describe("upgrade", () => {
  describe("PRESETS", () => {
    it("includes next, nuxt, sveltekit, astro", () => {
      expect(PRESETS).toEqual(["next", "nuxt", "sveltekit", "astro"]);
    });
  });

  describe("PACKAGES_BY_FRAMEWORK / getPackagesForFramework", () => {
    it("nextjs has docs, theme, next", () => {
      const pkgs = getPackagesForFramework("nextjs");
      expect(pkgs).toContain("@farming-labs/docs");
      expect(pkgs).toContain("@farming-labs/theme");
      expect(pkgs).toContain("@farming-labs/next");
      expect(pkgs).toHaveLength(3);
    });

    it("nuxt has docs, nuxt, nuxt-theme", () => {
      const pkgs = getPackagesForFramework("nuxt");
      expect(pkgs).toContain("@farming-labs/docs");
      expect(pkgs).toContain("@farming-labs/nuxt");
      expect(pkgs).toContain("@farming-labs/nuxt-theme");
      expect(pkgs).toHaveLength(3);
    });

    it("sveltekit has docs, svelte, svelte-theme", () => {
      const pkgs = getPackagesForFramework("sveltekit");
      expect(pkgs).toContain("@farming-labs/docs");
      expect(pkgs).toContain("@farming-labs/svelte");
      expect(pkgs).toContain("@farming-labs/svelte-theme");
      expect(pkgs).toHaveLength(3);
    });

    it("astro has docs, astro, astro-theme", () => {
      const pkgs = getPackagesForFramework("astro");
      expect(pkgs).toContain("@farming-labs/docs");
      expect(pkgs).toContain("@farming-labs/astro");
      expect(pkgs).toContain("@farming-labs/astro-theme");
      expect(pkgs).toHaveLength(3);
    });

    it("every framework has exactly 3 packages", () => {
      const frameworks: UpgradeFramework[] = ["nextjs", "nuxt", "sveltekit", "astro"];
      for (const fw of frameworks) {
        expect(PACKAGES_BY_FRAMEWORK[fw]).toHaveLength(3);
      }
    });
  });

  describe("presetFromFramework / frameworkFromPreset", () => {
    it("nextjs maps to next preset", () => {
      expect(presetFromFramework("nextjs")).toBe("next");
    });

    it("other frameworks map to themselves as preset", () => {
      expect(presetFromFramework("nuxt")).toBe("nuxt");
      expect(presetFromFramework("sveltekit")).toBe("sveltekit");
      expect(presetFromFramework("astro")).toBe("astro");
    });

    it("next preset maps to nextjs framework", () => {
      expect(frameworkFromPreset("next")).toBe("nextjs");
    });

    it("round-trip: framework -> preset -> framework", () => {
      const frameworks: UpgradeFramework[] = ["nextjs", "nuxt", "sveltekit", "astro"];
      for (const fw of frameworks) {
        expect(frameworkFromPreset(presetFromFramework(fw))).toBe(fw);
      }
    });

    it("round-trip: preset -> framework -> preset", () => {
      for (const preset of PRESETS) {
        expect(presetFromFramework(frameworkFromPreset(preset))).toBe(preset);
      }
    });
  });

  describe("buildUpgradeCommand", () => {
    it("builds pnpm add command with latest tag", () => {
      const cmd = buildUpgradeCommand("nextjs", "latest", "pnpm");
      expect(cmd).toContain("pnpm add");
      expect(cmd).toContain("@farming-labs/docs@latest");
      expect(cmd).toContain("@farming-labs/theme@latest");
      expect(cmd).toContain("@farming-labs/next@latest");
    });

    it("builds command with beta tag", () => {
      const cmd = buildUpgradeCommand("nextjs", "beta", "pnpm");
      expect(cmd).toContain("@farming-labs/docs@beta");
      expect(cmd).toContain("@farming-labs/theme@beta");
      expect(cmd).toContain("@farming-labs/next@beta");
    });

    it("uses yarn add for yarn package manager", () => {
      const cmd = buildUpgradeCommand("nextjs", "latest", "yarn");
      expect(cmd).toContain("yarn add");
    });

    it("uses npm add for npm package manager", () => {
      const cmd = buildUpgradeCommand("nuxt", "latest", "npm");
      expect(cmd).toContain("npm add");
      expect(cmd).toContain("@farming-labs/nuxt@latest");
    });
  });
});
