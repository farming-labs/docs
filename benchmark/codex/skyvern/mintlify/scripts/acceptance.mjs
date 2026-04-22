import { existsSync, readFileSync } from "node:fs";

const taskId = Number.parseInt(process.env.SKYVERN_TASK_ID ?? "1", 10);
const tasks = JSON.parse(readFileSync("tasks.json", "utf8")).tasks;
const task = tasks.find((entry) => entry.id === taskId);
const failures = [];

function read(file) {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

function normalize(value) {
  return value
    .toLowerCase()
    .replaceAll("'", '"')
    .replaceAll("`", '"')
    .replace(/\s+/g, " ")
    .replace(/\s*=\s*/g, "=");
}

function includesToken(content, token) {
  const normalizedContent = normalize(content);
  const normalizedToken = normalize(token);
  return normalizedContent.includes(normalizedToken);
}

function check(name, condition) {
  if (!condition) failures.push(name);
}

if (!task) {
  console.error(`Unknown SKYVERN_TASK_ID: ${taskId}`);
  process.exit(1);
}

const scriptFile = `solutions/task-${task.id}.py`;
const notesFile = `solutions/task-${task.id}.md`;
const script = read(scriptFile);
const notes = read(notesFile);
const combined = `${script}\n${notes}`;

check(`${scriptFile} exists`, Boolean(script));
check("script imports or references skyvern", /skyvern/i.test(combined));
check("script is async or runnable", /async\s+def|asyncio\.run|if __name__ == "__main__"/.test(script));

for (const token of task.requiredTokens) {
  check(`required token: ${token}`, includesToken(combined, token));
}

if (task.id === 4) {
  check("does not launch a fresh cloud browser", !includesToken(script, "launch_cloud_browser"));
  check("does not call page.agent.login", !includesToken(script, "page.agent.login"));
}

if (task.id === 8) {
  check("includes deployment env vars", includesToken(combined, "SKYVERN_API_KEY"));
  check("includes python SDK base URL", includesToken(combined, "base_url"));
}

if (failures.length > 0) {
  console.error("Acceptance failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`acceptance passed for Skyvern task ${task.id}`);
