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
    if (
      pages.length === 1 &&
      /\.mdx?$/.test(pages[0].name) &&
      // Be conservative about module syntax, including exports after imports or
      // comments on the same line. A prose mention can safely keep legacy transport.
      !/\bexport\b/.test(
        DocsBuild.replaceDocsMarkdownFencedCodeBlocks(
          readFileSync(join(dir, pages[0].name), "utf8"),
          () => "",
        ),
      )
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
