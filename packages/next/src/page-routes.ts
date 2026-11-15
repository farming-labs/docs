import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import * as DocsBuild from "@farming-labs/docs/build";

export function supportsDocsPageBoundary(root: string): boolean {
  if (!DocsBuild.replaceDocsMarkdownFencedCodeBlocks) return false;
  try {
    createRequire(join(root, "package.json")).resolve("@farming-labs/theme/internal/page");
    return true;
  } catch (error) {
    if (
      ["MODULE_NOT_FOUND", "ERR_PACKAGE_PATH_NOT_EXPORTED"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      return false;
    throw error;
  }
}

// A top-level `audience: agent` key in the leading frontmatter block.
function isAgentOnlySource(source: string): boolean {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)?.[1];
  return (
    frontmatter !== undefined &&
    /^audience[ \t]*:[ \t]*(["']?)agent\1[ \t]*(?:#.*)?$/m.test(frontmatter)
  );
}

export interface DocsPageRoute {
  source: string;
  route: string;
}

/** Only ordinary file routes can move the page wrapper without changing layout nesting. */
export function discoverDocsPageRoutes(directory: string, publicPath: string): DocsPageRoute[] {
  const routes: DocsPageRoute[] = [];
  function visit(dir: string, parts: string[]) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    if (
      parts.length > 0 &&
      entries.some(
        (entry) => entry.isFile() && /^(?:layout|template)\.[cm]?[jt]sx?$/.test(entry.name),
      )
    )
      return;
    const files = entries.filter((entry) => entry.isFile());
    // Multiple page extensions and non-MDX routes stay on the existing layout path.
    const pages = files.filter((entry) => /^page\.(?:mdx?|[cm]?[jt]sx?)$/.test(entry.name));
    const source =
      pages.length === 1 && /\.mdx?$/.test(pages[0].name)
        ? readFileSync(join(dir, pages[0].name), "utf8")
        : undefined;
    if (
      source !== undefined &&
      // Agent-only pages have no human page to wrap, and the route list reaches the browser.
      !isAgentOnlySource(source) &&
      // Be conservative about module syntax, including exports after imports or
      // comments on the same line. A prose mention can safely keep legacy transport.
      !/\bexport\b/.test(DocsBuild.replaceDocsMarkdownFencedCodeBlocks(source, () => ""))
    ) {
      routes.push({
        source: join(dir, pages[0].name).replaceAll("\\", "/"),
        route: `${publicPath}/${parts.join("/")}`.replace(/\/$/, "") || "/",
      });
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !/^[.(@_]|\[/.test(entry.name))
        visit(join(dir, entry.name), [...parts, entry.name]);
    }
  }
  visit(directory, []);
  return routes;
}
