import { describe, expect, it } from "vitest";
import type { DocsConfig } from "@farming-labs/docs";
import { themeOptionsFromConfig } from "./theme.ts";

const config = (themeToggle: DocsConfig["themeToggle"]) => ({ themeToggle }) as DocsConfig;

describe("themeOptionsFromConfig", () => {
  it.each(["light", "dark"] as const)(
    "forces the configured %s theme when the toggle is disabled",
    (theme) => {
      expect(themeOptionsFromConfig(config({ enabled: false, default: theme }))).toEqual({
        forcedTheme: theme,
        defaultTheme: undefined,
      });
    },
  );

  it("uses the configured theme as the default when the toggle is enabled", () => {
    expect(themeOptionsFromConfig(config({ default: "dark" }))).toEqual({
      forcedTheme: undefined,
      defaultTheme: "dark",
    });
  });

  it("derives nothing when the default is system", () => {
    expect(themeOptionsFromConfig(config({ enabled: false, default: "system" }))).toEqual({
      forcedTheme: undefined,
      defaultTheme: undefined,
    });
  });

  it("derives nothing when an object toggle is disabled without a default", () => {
    expect(themeOptionsFromConfig(config({ enabled: false }))).toEqual({
      forcedTheme: undefined,
      defaultTheme: undefined,
    });
  });

  it.each([false, true, undefined])("derives nothing from %s", (themeToggle) => {
    expect(themeOptionsFromConfig(config(themeToggle))).toEqual({
      forcedTheme: undefined,
      defaultTheme: undefined,
    });
  });
});
