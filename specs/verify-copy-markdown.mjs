import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const task = JSON.parse(input);
if (task.version !== 1 || task.spec !== "customization/page-actions#copy-markdown") {
  throw new Error(
    "This worker handles only the Copy Markdown pilot. Choose a worker for the assigned spec.",
  );
}
console.log(
  JSON.stringify({ task: task.id, spec: task.spec, rules: task.rules, review: task.review }),
);
const theme = new URL("../packages/fumadocs/package.json", import.meta.url);
const requireFromTheme = createRequire(theme);
const manifest = requireFromTheme.resolve("vitest/package.json");
const cli = path.resolve(path.dirname(manifest), requireFromTheme(manifest).bin.vitest);
const result = spawnSync(process.execPath, [cli, "run", "src/page-actions.test.ts"], {
  cwd: fileURLToPath(new URL(".", theme)),
  stdio: ["ignore", "inherit", "inherit"],
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
