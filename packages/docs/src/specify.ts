import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { McpServer } from "@modelcontextprotocol/server";

const packageName = "@assistant-ui/specify";

export function resolveSpecify(root: string, packageDir?: string) {
  let dir: string;
  if (packageDir) {
    dir = path.resolve(root, packageDir);
  } else {
    const projectRequire = createRequire(path.join(root, "package.json"));
    let entry: string;
    try {
      entry = projectRequire.resolve(packageName);
    } catch (cause) {
      throw new Error(
        "Install @assistant-ui/specify in this project or pass --specify-package <built-package-directory>.",
        { cause },
      );
    }
    dir = path.dirname(entry);
    while (!existsSync(path.join(dir, "package.json")) && dir !== path.dirname(dir))
      dir = path.dirname(dir);
  }
  const manifest = path.join(dir, "package.json");
  if (!existsSync(manifest))
    throw new Error(
      "Point --specify-package at the built @assistant-ui/specify package directory.",
    );
  const data = JSON.parse(readFileSync(manifest, "utf8"));
  if (data.name !== packageName || typeof data.bin?.specify !== "string")
    throw new Error(
      "The selected package must be @assistant-ui/specify and provide its specify CLI.",
    );
  const bin = path.resolve(dir, data.bin.specify);
  if (!existsSync(bin))
    throw new Error("Build @assistant-ui/specify before running its docs integration.");
  return { bin, manifest };
}

export interface DocsSpecifyOptions {
  /** Directory containing pages/ and specs.approved.json. */
  directory: string;
  /** Override the approval file, for example with the GitHub receiver's snapshot. */
  approved?: string;
  /** A trusted built Specify package, as an alternative to the project's installed dependency. */
  packageDir?: string;
  allowProposals?: boolean;
}

export async function mountSpecify(
  server: McpServer,
  root: string,
  options: DocsSpecifyOptions,
  era: "modern" | "legacy",
) {
  const { manifest } = resolveSpecify(root, options.packageDir);
  const entry = createRequire(manifest).resolve("@assistant-ui/specify/mcp");
  const { registerSpecifyMcp } = await import(
    /*! turbopackIgnore: true */ pathToFileURL(entry).href
  );
  if (typeof registerSpecifyMcp !== "function")
    throw new Error(
      "Use a Specify build that exports registerSpecifyMcp from @assistant-ui/specify/mcp.",
    );
  await registerSpecifyMcp(server, {
    root,
    era,
    pages: path.join(options.directory, "pages"),
    approved: options.approved ?? path.join(options.directory, "specs.approved.json"),
    allowProposals: options.allowProposals === true,
  });
}
