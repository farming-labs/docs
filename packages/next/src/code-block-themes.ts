import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DocsTheme } from "@farming-labs/docs";

export interface CodeBlockThemes {
  light: string;
  dark: string;
}

const DEFAULT_CODE_BLOCK_THEMES: CodeBlockThemes = {
  light: "github-light",
  dark: "github-dark",
};

const SHADCN_CODE_BLOCK_THEMES: CodeBlockThemes = {
  light: "github-light-default",
  dark: "vesper",
};

const SHADCN_THEME_IMPORT = /(?:from\s*|import\s*)["']@farming-labs\/theme\/shadcn["']/;

export function resolveCodeBlockThemes({
  root,
  configPath,
  theme,
}: {
  root: string;
  configPath: string;
  theme?: DocsTheme;
}): CodeBlockThemes {
  const configFile = join(root, configPath);
  const usesShadcnTheme =
    existsSync(configFile) && SHADCN_THEME_IMPORT.test(readFileSync(configFile, "utf8"));
  const fallback = usesShadcnTheme ? SHADCN_CODE_BLOCK_THEMES : DEFAULT_CODE_BLOCK_THEMES;
  const codeBlock = theme?.ui?.codeBlock;

  return {
    light: codeBlock?.theme ?? fallback.light,
    dark: codeBlock?.darkTheme ?? fallback.dark,
  };
}
