import { describe, expect, it } from "vitest";
import type { DocsConfig } from "@farming-labs/docs";
import { themeOptionsFromConfig } from "./theme.ts";

const config = (themeToggle: DocsConfig["themeToggle"]) => ({ themeToggle }) as DocsConfig;

describe("themeOptionsFromConfig", () => {
  it("forces the configured theme when the toggle is disabled", () => {
    expect(themeOptionsFromConfig(config({ enabled: false, default: "dark" }))).toEqual({
      forcedTheme: "dark",
      defaultTheme: undefined,
    });
  });

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

  it("derives nothing when the toggle is disabled without a default", () => {
    expect(themeOptionsFromConfig(config(false))).toEqual({
      forcedTheme: undefined,
      defaultTheme: undefined,
    });
  });

  it("derives nothing when the toggle is unconfigured", () => {
    expect(themeOptionsFromConfig(config(undefined))).toEqual({
      forcedTheme: undefined,
      defaultTheme: undefined,
    });
  });
});
