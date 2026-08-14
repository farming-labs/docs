import { describe, it, expect } from "vitest";
import {
  PRESETS,
  PACKAGES_BY_FRAMEWORK,
  type UpgradeFramework,
  presetFromFramework,
  frameworkFromPreset,
  getPackagesForFramework,
  buildUpgradeCommand,
  resolveUpgradeTarget,
  validateUpgradeVersion,
} from "./upgrade.js";

describe("upgrade", () => {
  describe("PRESETS", () => {
    it("includes every supported package preset", () => {
      expect(PRESETS).toEqual(["next", "tanstack-start", "farmjs", "nuxt", "sveltekit", "astro"]);
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

    it("tanstack-start has docs, theme, tanstack-start", () => {
      const pkgs = getPackagesForFramework("tanstack-start");
      expect(pkgs).toContain("@farming-labs/docs");
      expect(pkgs).toContain("@farming-labs/theme");
      expect(pkgs).toContain("@farming-labs/tanstack-start");
      expect(pkgs).toHaveLength(3);
    });

    it("farmjs has docs, theme, and the Farm adapter", () => {
      expect(getPackagesForFramework("farmjs")).toEqual([
        "@farming-labs/docs",
        "@farming-labs/theme",
        "@farming-labs/farmjs",
      ]);
    });

    it("nuxt has docs, nuxt, nuxt-theme, and shared theme css", () => {
      const pkgs = getPackagesForFramework("nuxt");
      expect(pkgs).toContain("@farming-labs/docs");
      expect(pkgs).toContain("@farming-labs/nuxt");
      expect(pkgs).toContain("@farming-labs/nuxt-theme");
      expect(pkgs).toContain("@farming-labs/theme");
      expect(pkgs).toHaveLength(4);
    });

    it("sveltekit has docs, svelte, svelte-theme, and shared theme css", () => {
      const pkgs = getPackagesForFramework("sveltekit");
      expect(pkgs).toContain("@farming-labs/docs");
      expect(pkgs).toContain("@farming-labs/svelte");
      expect(pkgs).toContain("@farming-labs/svelte-theme");
      expect(pkgs).toContain("@farming-labs/theme");
      expect(pkgs).toHaveLength(4);
    });

    it("astro has docs, astro, astro-theme, and shared theme css", () => {
      const pkgs = getPackagesForFramework("astro");
      expect(pkgs).toContain("@farming-labs/docs");
      expect(pkgs).toContain("@farming-labs/astro");
      expect(pkgs).toContain("@farming-labs/astro-theme");
      expect(pkgs).toContain("@farming-labs/theme");
      expect(pkgs).toHaveLength(4);
    });

    it("every framework installs the shared theme package", () => {
      const frameworks: UpgradeFramework[] = [
        "nextjs",
        "tanstack-start",
        "farmjs",
        "nuxt",
        "sveltekit",
        "astro",
      ];
      for (const fw of frameworks) {
        expect(PACKAGES_BY_FRAMEWORK[fw]).toContain("@farming-labs/theme");
      }
    });
  });

  describe("presetFromFramework / frameworkFromPreset", () => {
    it("nextjs maps to next preset", () => {
      expect(presetFromFramework("nextjs")).toBe("next");
    });

    it("other frameworks map to themselves as preset", () => {
      expect(presetFromFramework("tanstack-start")).toBe("tanstack-start");
      expect(presetFromFramework("farmjs")).toBe("farmjs");
      expect(presetFromFramework("nuxt")).toBe("nuxt");
      expect(presetFromFramework("sveltekit")).toBe("sveltekit");
      expect(presetFromFramework("astro")).toBe("astro");
    });

    it("next preset maps to nextjs framework", () => {
      expect(frameworkFromPreset("next")).toBe("nextjs");
    });

    it("round-trip: framework -> preset -> framework", () => {
      const frameworks: UpgradeFramework[] = [
        "nextjs",
        "tanstack-start",
        "farmjs",
        "nuxt",
        "sveltekit",
        "astro",
      ];
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

    it("builds TanStack Start command with latest tag", () => {
      const cmd = buildUpgradeCommand("tanstack-start", "latest", "pnpm");
      expect(cmd).toContain("@farming-labs/docs@latest");
      expect(cmd).toContain("@farming-labs/theme@latest");
      expect(cmd).toContain("@farming-labs/tanstack-start@latest");
    });

    it("builds command with beta tag", () => {
      const cmd = buildUpgradeCommand("nextjs", "beta", "pnpm");
      expect(cmd).toContain("@farming-labs/docs@beta");
      expect(cmd).toContain("@farming-labs/theme@beta");
      expect(cmd).toContain("@farming-labs/next@beta");
    });

    it("builds command with an exact version", () => {
      const cmd = buildUpgradeCommand("nextjs", "0.1.104", "pnpm");
      expect(cmd).toContain("@farming-labs/docs@0.1.104");
      expect(cmd).toContain("@farming-labs/theme@0.1.104");
      expect(cmd).toContain("@farming-labs/next@0.1.104");
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

  describe("resolveUpgradeTarget", () => {
    it("uses exact version before dist-tag", () => {
      expect(resolveUpgradeTarget({ tag: "beta", version: "0.1.104" })).toBe("0.1.104");
    });

    it("accepts prerelease exact versions", () => {
      expect(validateUpgradeVersion("0.1.104-beta.1")).toBe("0.1.104-beta.1");
    });

    it("rejects non-version values", () => {
      expect(() => validateUpgradeVersion("latest")).toThrow("Invalid version");
      expect(() => validateUpgradeVersion("0.1")).toThrow("Invalid version");
    });
  });
});
