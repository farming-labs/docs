import { spawn } from "node:child_process";
import { constants } from "node:os";
import path from "node:path";
import { resolveSpecify } from "../specify.js";

const usage =
  "docs spec <list|show|approve|watch|run|github|mcp> [--specs <directory>] [--specify-package <directory>] [Specify options]";
export function specifyArgs(argv: string[]) {
  const separator = argv.indexOf("--");
  const options = separator === -1 ? argv : argv.slice(0, separator);
  const forwarded: string[] = [];
  let directory = "specs";
  let packageDir: string | undefined;
  for (let i = 0; i < options.length; i++) {
    const arg = options[i];
    const key = arg.split("=", 1)[0];
    if (!["--specs", "--specify-package", "--pages", "--approved"].includes(key)) {
      forwarded.push(arg);
      continue;
    }
    const value = arg === key ? options[++i] : arg.slice(key.length + 1);
    if (!value || value.startsWith("--")) throw new Error("Supply a path after " + key + ".");
    if (key === "--specs") directory = value;
    else if (key === "--specify-package") packageDir = value;
    else forwarded.push(key, value);
  }
  const command = forwarded[0];
  if (!["list", "show", "approve", "watch", "run", "github", "mcp"].includes(command))
    throw new Error(usage);
  if (command !== "watch" && !forwarded.includes("--pages"))
    forwarded.push("--pages", path.posix.join(directory.split(path.sep).join("/"), "pages"));
  if (command !== "github" && command !== "list" && !forwarded.includes("--approved"))
    forwarded.push("--approved", path.join(directory, "specs.approved.json"));
  if (separator !== -1) forwarded.push(...argv.slice(separator));
  return { ...(packageDir ? { packageDir } : {}), args: forwarded };
}

export async function runSpecify(argv: string[]) {
  if (
    !argv.length ||
    argv
      .slice(0, argv.includes("--") ? argv.indexOf("--") : argv.length)
      .some((arg) => arg === "--help" || arg === "-h")
  ) {
    console.log(usage);
    return;
  }
  const { args, packageDir } = specifyArgs(argv);
  const { bin } = resolveSpecify(process.cwd(), packageDir);
  const child = spawn(process.execPath, [bin, ...args], { stdio: "inherit" });
  const interrupt = () => {
    child.kill("SIGINT");
  };
  const terminate = () => {
    child.kill("SIGTERM");
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  try {
    process.exitCode = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) =>
        resolve(code ?? (signal ? 128 + constants.signals[signal] : 1)),
      );
    });
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
}
