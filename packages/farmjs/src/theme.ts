import { ThemeToggleConfig, DocsConfig } from "@farming-labs/docs";

export function resolveThemeSwitch(toggle: boolean | ThemeToggleConfig | undefined) {
  // undefined or true → show toggle (default)
  if (toggle === undefined || toggle === true) {
    return { enabled: true };
  }
  // false → hide toggle
  if (toggle === false) {
    return { enabled: false };
  }
  // object → map to fumadocs-ui shape
  return {
    enabled: toggle.enabled !== false,
    mode: toggle.mode,
  };
}

export function themeOptionsFromConfig(config: DocsConfig) {
  const themeToggle = resolveThemeSwitch(config.themeToggle);
  const toggleConfig = typeof config?.themeToggle === "object" ? config.themeToggle : undefined;
  const forcedTheme =
    toggleConfig?.enabled === false && toggleConfig?.default && toggleConfig.default !== "system"
      ? toggleConfig?.default
      : undefined;
  const defaultTheme =
    themeToggle.enabled === true && toggleConfig?.default && toggleConfig?.default !== "system"
      ? toggleConfig?.default
      : undefined;

  return {
    forcedTheme,
    defaultTheme,
  };
}
