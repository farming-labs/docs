import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cwd = dirname(fileURLToPath(import.meta.url));
const root = resolve(cwd, "../../..");

if (!existsSync(join(root, "pnpm-workspace.yaml"))) {
  process.exit(0);
}

execFileSync(
  "pnpm",
  [
    "--dir",
    root,
    "--filter",
    "@farming-labs/docs",
    "--filter",
    "@farming-labs/svelte",
    "run",
    "build",
  ],
  { stdio: "inherit" },
);
