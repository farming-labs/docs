import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

interface DocsContentDirectory {
  directories: string[];
  files: Set<string>;
}

interface DocsContentPage {
  data: Record<string, unknown>;
  content: string;
  modifiedAt: Date;
}

/**
 * Share filesystem reads between navigation and page metadata preparation.
 * Keep the reader local to one preparation pass: development must see edits,
 * and production only needs to retain the resulting tree and metadata maps.
 */
export function createDocsContentReader() {
  const directories = new Map<string, DocsContentDirectory>();
  const pages = new Map<string, DocsContentPage>();

  return {
    directory(dir: string): DocsContentDirectory {
      const cached = directories.get(dir);
      if (cached) return cached;

      const result: DocsContentDirectory = { directories: [], files: new Set() };
      if (fs.existsSync(/*! turbopackIgnore: true */ dir)) {
        for (const entry of fs.readdirSync(/*! turbopackIgnore: true */ dir, {
          withFileTypes: true,
        })) {
          const isDirectory = entry.isSymbolicLink()
            ? fs
                .statSync(
                  /*! turbopackIgnore: true */ path.join(
                    /*! turbopackIgnore: true */ dir,
                    entry.name,
                  ),
                )
                .isDirectory()
            : entry.isDirectory();
          if (isDirectory) result.directories.push(entry.name);
          else result.files.add(entry.name);
        }
      }
      result.directories.sort();
      directories.set(dir, result);
      return result;
    },
    page(filePath: string): DocsContentPage {
      const cached = pages.get(filePath);
      if (cached) return cached;

      const { data, content } = matter(
        fs.readFileSync(/*! turbopackIgnore: true */ filePath, "utf8"),
      );
      const page = {
        data,
        content,
        modifiedAt: fs.statSync(/*! turbopackIgnore: true */ filePath).mtime,
      };
      pages.set(filePath, page);
      return page;
    },
  };
}

export type DocsContentReader = ReturnType<typeof createDocsContentReader>;
