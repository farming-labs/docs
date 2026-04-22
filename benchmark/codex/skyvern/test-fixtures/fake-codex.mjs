#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function fetchDoc(baseUrl, route) {
  const response = await fetch(`${baseUrl}${route}`);
  await response.text();
}

async function writeSolution(workspaceDir, task) {
  await mkdir(path.join(workspaceDir, "solutions"), { recursive: true });

  const tokens = task.requiredTokens.map((token) => `# required: ${token}`).join("\n");
  const task4Body =
    task.id === 4
      ? "    browser = await client.connect_to_browser_over_cdp('http://localhost:9222')\n"
      : "    client = Skyvern(api_key='test')\n";
  const task8Body =
    task.id === 8
      ? "    client = Skyvern(api_key=os.environ['SKYVERN_API_KEY'], base_url='https://skyvern.internal.ourco.com')\n"
      : task4Body;

  await writeFile(
    path.join(workspaceDir, "solutions", `task-${task.id}.py`),
    [
      "import asyncio",
      "import os",
      "from skyvern import Skyvern",
      "",
      tokens,
      "",
      "async def main():",
      task8Body,
      "    return True",
      "",
      "if __name__ == \"__main__\":",
      "    asyncio.run(main())",
      "",
    ].join("\n"),
  );

  await writeFile(
    path.join(workspaceDir, "solutions", `task-${task.id}.md`),
    [
      `# Skyvern task ${task.id}`,
      "",
      "Fake Codex smoke output. The real benchmark asks Codex to implement this from docs.",
      "",
      ...task.requiredTokens.map((token) => `- ${token}`),
      "",
    ].join("\n"),
  );
}

const outputFile = argValue("-o");
const workspaceDir = process.cwd();
const prompt = process.argv.at(-1) ?? "";
const baseUrl = prompt.match(/Docs base URL: (\S+)/)?.[1];
const taskId = Number.parseInt(prompt.match(/Skyvern task ID: (\d+)/)?.[1] ?? "1", 10);
const packageJson = JSON.parse(await readFile(path.join(workspaceDir, "package.json"), "utf8"));
const provider = packageJson.benchmark?.docsProvider;
const tasks = JSON.parse(await readFile(path.join(workspaceDir, "tasks.json"), "utf8")).tasks;
const task = tasks.find((entry) => entry.id === taskId);

if (!baseUrl || !task) {
  console.error("Fake Codex could not resolve the docs base URL or task.");
  process.exit(1);
}

if (provider === "farming-labs") {
  await fetchDoc(baseUrl, "/docs.md");
  await fetchDoc(baseUrl, `/docs/agent-runbooks/task-${task.id}.md`);
} else {
  await fetchDoc(baseUrl, "/docs.md");
  await fetchDoc(baseUrl, "/llms.txt");
  await fetchDoc(baseUrl, `/docs/${task.canonicalPages[0]}.md`);
}

await writeSolution(workspaceDir, task);

if (outputFile) {
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `Fake Codex completed Skyvern task ${task.id} for ${provider}.\n`);
}

console.log(
  JSON.stringify({
    type: "turn.completed",
    usage: {
      input_tokens: provider === "farming-labs" ? 1200 : 3200,
      cached_input_tokens: 0,
      output_tokens: provider === "farming-labs" ? 500 : 780,
    },
  }),
);
