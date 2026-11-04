import type { DocsTheme } from "./types.js";

/** Whether the Markdown or MDX body authors its own top-level page heading. */
export function hasAuthoredPageTitle(content: string): boolean {
  const lines = content.split(/\r?\n/);
  let fence: "`" | "~" | undefined;
  let previousTextLine = "";

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1]?.[0] as "`" | "~";
      fence = fence === marker ? undefined : (fence ?? marker);
      previousTextLine = "";
      continue;
    }

    if (fence) continue;
    if (/^ {0,3}#(?:\s+|$)/.test(line) || /^\s*<h1(?:\s|>)/i.test(line)) return true;
    if (previousTextLine && /^ {0,3}=+\s*$/.test(line)) return true;

    previousTextLine = line.trim() && !line.trimStart().startsWith("<") ? line : "";
  }

  return false;
}

/**
 * The frontmatter title a layout renders as the page heading, when the theme
 * enables `ui.page.generatedTitle` and the body does not author its own h1.
 */
export function resolveGeneratedPageTitle(
  theme: DocsTheme | undefined,
  frontmatter: Record<string, unknown>,
  content: string,
): string | undefined {
  if (theme?.ui?.page?.generatedTitle !== true) return undefined;
  if (typeof frontmatter.title !== "string") return undefined;
  return hasAuthoredPageTitle(content) ? undefined : frontmatter.title;
}
