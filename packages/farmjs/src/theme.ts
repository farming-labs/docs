import type { DocsConfig } from "@farming-labs/docs";

export function themeOptionsFromConfig(config: DocsConfig) {
  const toggle = config.themeToggle;
  const configuredTheme =
    toggle && typeof toggle === "object" && toggle.default !== "system"
      ? toggle.default
      : undefined;
  const isToggleDisabled = toggle && typeof toggle === "object" && toggle.enabled === false;

  return {
    forcedTheme: isToggleDisabled ? configuredTheme : undefined,
    defaultTheme: isToggleDisabled ? undefined : configuredTheme,
  };
}
