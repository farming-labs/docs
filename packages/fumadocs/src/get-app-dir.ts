import fs from "node:fs";
import path from "node:path";

/**
 * Resolve Next.js App Router directory.
 * Prefers src/app when present (src directory layout), else app.
 * Use this so docs layout and API resolve MDX content in the same place the CLI generated it.
 */
export function getNextAppDir(root: string): string {
  if (fs.existsSync(path.join(root, "src", "app"))) return "src/app";
  return "app";
}
