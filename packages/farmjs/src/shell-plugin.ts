import path from "node:path";
import type { Plugin } from "vite";

const FARM_DOCS_SHELL_MODULE = /^@farming-labs\/farmjs\/shell$/;

/**
 * Point the adapter's docs page shell at the app's module. An alias rather than `resolveId`,
 * so Vite's dependency optimizer also uses it when it pre-bundles the adapter in development.
 */
export function docsShell(shell: string | undefined): Plugin {
  return {
    name: "farming-labs-farmjs-shell",
    config(config) {
      if (!shell) return undefined;
      return {
        resolve: {
          alias: [
            {
              find: FARM_DOCS_SHELL_MODULE,
              replacement: path.resolve(config.root ?? process.cwd(), shell),
            },
          ],
        },
      };
    },
  };
}
