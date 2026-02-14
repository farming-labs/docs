import { DocsLayout } from "fumadocs-ui/layouts/docs";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { ReactNode } from "react";
import type { DocsConfig } from "@farming-labs/docs";
import { DocsPageClient } from "./docs-page-client.js";

function buildTree(config: DocsConfig) {
  const docsDir = path.join(process.cwd(), "app", config.entry);
  const children: { type: "page"; name: string; url: string }[] = [];

  if (fs.existsSync(path.join(docsDir, "page.mdx"))) {
    const { data } = matter(
      fs.readFileSync(path.join(docsDir, "page.mdx"), "utf-8"),
    );
    children.push({
      type: "page",
      name: data?.title ?? "Docs",
      url: `/${config.entry}`,
    });
  }

  function scan(dir: string, base: string[] = []) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (
        fs.statSync(full).isDirectory() &&
        fs.existsSync(path.join(full, "page.mdx"))
      ) {
        const { data } = matter(
          fs.readFileSync(path.join(full, "page.mdx"), "utf-8"),
        );
        const slug = [...base, name];
        children.push({
          type: "page",
          name: data?.title ?? name.replace(/-/g, " "),
          url: `/${config.entry}/${slug.join("/")}`,
        });
        scan(full, slug);
      }
    }
  }
  scan(docsDir);

  return { name: "Docs", children };
}

export function createDocsLayout(config: DocsConfig) {
  // Read TOC settings from the theme config
  const tocConfig = config.theme?.ui?.layout?.toc;
  const tocEnabled = tocConfig?.enabled !== false; // enabled by default

  return function DocsLayoutWrapper({ children }: { children: ReactNode }) {
    return (
      <DocsLayout
        tree={buildTree(config)}
        nav={{ title: "Docs", url: `/${config.entry}` }}
      >
        <DocsPageClient tocEnabled={tocEnabled}>
          {children}
        </DocsPageClient>
      </DocsLayout>
    );
  };
}
