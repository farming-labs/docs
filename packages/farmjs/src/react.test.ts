import { describe, expect, it } from "vitest";
import type { DocsConfig } from "@farming-labs/docs";
import { themeFromConfig } from "./theme.ts";

const config = (themeToggle: DocsConfig["themeToggle"]) => ({ themeToggle }) as DocsConfig;

describe("themeFromConfig", () => {
  it("forces the configured theme when the toggle is disabled", () => {
    expect(themeFromConfig(config({ enabled: false, default: "dark" }))).toEqual({
      forcedTheme: "dark",
      defaultTheme: undefined,
    });
  });

  it("uses the configured theme as the default when the toggle is enabled", () => {
    expect(themeFromConfig(config({ default: "dark" }))).toEqual({
      forcedTheme: undefined,
      defaultTheme: "dark",
    });
  });

  it("derives nothing when the default is system", () => {
    expect(themeFromConfig(config({ enabled: false, default: "system" }))).toEqual({
      forcedTheme: undefined,
      defaultTheme: undefined,
    });
  });

  it("derives nothing when the toggle is disabled without a default", () => {
    expect(themeFromConfig(config(false))).toEqual({
      forcedTheme: undefined,
      defaultTheme: undefined,
    });
  });

  it("derives nothing when the toggle is unconfigured", () => {
    expect(themeFromConfig(config(undefined))).toEqual({
      forcedTheme: undefined,
      defaultTheme: undefined,
    });
  });
});
