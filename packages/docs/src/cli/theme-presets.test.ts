import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BUILT_IN_THEME_PRESETS,
  getFrameworkThemeCssName,
  getThemeInfo,
  getThemeOptions,
  type ThemeFramework,
} from "./theme-presets.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const packageDirectoryByName: Record<string, string> = {
  "@farming-labs/theme": "packages/fumadocs",
  "@farming-labs/svelte-theme": "packages/svelte-theme",
  "@farming-labs/astro-theme": "packages/astro-theme",
  "@farming-labs/nuxt-theme": "packages/nuxt-theme",
};

function readPackageExports(packageName: string): Record<string, unknown> {
  const packageDirectory = packageDirectoryByName[packageName];
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, packageDirectory, "package.json"), "utf8"),
  ) as { exports: Record<string, unknown> };
  return packageJson.exports;
}

function splitPackageImport(specifier: string): { packageName: string; subpath: string } {
  const segments = specifier.split("/");
  const packageName = segments.slice(0, 2).join("/");
  const remainder = segments.slice(2).join("/");
  return { packageName, subpath: remainder ? `./${remainder}` : "." };
}

function importForFramework(
  preset: (typeof BUILT_IN_THEME_PRESETS)[number],
  framework: ThemeFramework,
): string {
  if (framework === "sveltekit") return preset.svelteImport;
  if (framework === "astro") return preset.astroImport;
  if (framework === "nuxt") return preset.nuxtImport;
  return preset.nextImport;
}

describe("built-in theme registry", () => {
  it("contains unique theme names", () => {
    const values = BUILT_IN_THEME_PRESETS.map((preset) => preset.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("offers Junction on every supported framework", () => {
    for (const framework of [
      "nextjs",
      "tanstack-start",
      "farmjs",
      "sveltekit",
      "astro",
      "nuxt",
    ] as const) {
      expect(getThemeOptions(framework).map((option) => option.value)).toContain("junction");
    }
  });

  it("does not offer React-only presets to native framework adapters", () => {
    for (const framework of ["sveltekit", "astro", "nuxt"] as const) {
      const values = getThemeOptions(framework).map((option) => option.value);
      expect(values).not.toContain("darkbold");
      expect(values).not.toContain("shiny");
      expect(values).not.toContain("threadline");
    }
  });

  it("points every supported factory import at a real package export", () => {
    for (const preset of BUILT_IN_THEME_PRESETS) {
      for (const framework of preset.frameworks) {
        const { packageName, subpath } = splitPackageImport(importForFramework(preset, framework));
        expect(
          Object.hasOwn(readPackageExports(packageName), subpath),
          `${preset.value} on ${framework} imports ${packageName}${subpath}`,
        ).toBe(true);
      }
    }
  });

  it("points every shared CSS preset at a real package export", () => {
    const themeExports = readPackageExports("@farming-labs/theme");
    for (const preset of BUILT_IN_THEME_PRESETS) {
      expect(Object.hasOwn(themeExports, `./${preset.nextCssImport}/css`)).toBe(true);
    }
  });

  it("falls back to the default preset for unknown values", () => {
    expect(getThemeInfo("missing").value).toBe("fumadocs");
    expect(getFrameworkThemeCssName("default")).toBe("fumadocs");
  });
});
