import type { ComponentType } from "react";
import { normalizeDocsModuleKey, resolveDocsModule } from "./module-map.js";

export interface FarmDocsMdxModule {
  default: ComponentType<any>;
}

export type FarmDocsMdxLoader = () => Promise<FarmDocsMdxModule>;

interface FarmDocsPageModuleRef {
  sourcePath: string;
  entry?: string;
}

export interface FarmDocsPageModules {
  /** Load the compiled Markdown a page renders. Resolves at once if it already has. */
  load(page: FarmDocsPageModuleRef): Promise<void>;
  /** The page's compiled Markdown, if it has been loaded. */
  get(page: FarmDocsPageModuleRef): FarmDocsMdxModule | undefined;
}

/**
 * The compiled Markdown pages, one loader each, and the ones loaded so far.
 *
 * Every page is its own chunk, so a page downloads only the Markdown it shows.
 * A page's module is loaded before it renders (on the server before rendering,
 * in the browser before hydrating or showing a page it navigated to), which
 * keeps rendering itself synchronous and the first client render identical to
 * the server's.
 */
export function createFarmDocsPageModules(
  loaders: Record<string, FarmDocsMdxLoader>,
): FarmDocsPageModules {
  const byKey = Object.fromEntries(
    Object.entries(loaders).map(([key, load]) => [normalizeDocsModuleKey(key), load]),
  );
  const loaded = new Map<FarmDocsMdxLoader, FarmDocsMdxModule>();
  const find = (page: FarmDocsPageModuleRef) =>
    resolveDocsModule(byKey, page.sourcePath, page.entry);

  return {
    async load(page) {
      const load = find(page);
      if (!load || loaded.has(load)) return;
      loaded.set(load, await load());
    },
    get(page) {
      const load = find(page);
      return load ? loaded.get(load) : undefined;
    },
  };
}
