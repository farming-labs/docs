import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

// Exercises the maintainer spec flow against the installed @assistant-ui/specify package,
// so an upstream release that changes the CLI, MCP events or runner protocol fails here.
const repo = fileURLToPath(new URL("..", import.meta.url));
const cli = path.join(repo, "packages/docs/dist/cli/index.mjs");
const key = "customization/page-actions#copy-markdown";
const snapshotUri = "specify://approved/snapshot";

let work;
let proposed;
const children = new Set();

function start(args, cwd) {
  const child = spawn(process.execPath, [cli, ...args], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  children.add(child);
  child.on("exit", () => children.delete(child));
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const lines = readline.createInterface({ input: child.stdout });
  const exited = new Promise((resolve) => child.on("exit", resolve));
  // Resolves with the first stdout JSON line matching `match`, or rejects when the process exits first.
  const next = (match) =>
    new Promise((resolve, reject) => {
      const onLine = (line) => {
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          return;
        }
        if (match(message)) {
          lines.off("line", onLine);
          resolve(message);
        }
      };
      lines.on("line", onLine);
      exited.then((code) =>
        reject(
          new Error(
            `docs ${args.join(" ")} exited with ${code} before the expected message.\n${stderr}`,
          ),
        ),
      );
    });
  return { child, next };
}

const approval = (rules) =>
  JSON.stringify({ _: "Disposable smoke-test approval.", pages: { [key]: rules } });

before(async () => {
  work = await mkdtemp(path.join(tmpdir(), "docs-specify-smoke-"));
  const shown = spawnSync(process.execPath, [cli, "spec", "show", key, "--json"], {
    cwd: repo,
    encoding: "utf8",
  });
  assert.equal(shown.status, 0, shown.stderr);
  proposed = JSON.parse(shown.stdout).proposed;
  assert.ok(proposed.length > 0, `${key} has no proposed rules.`);
});

after(async () => {
  for (const child of children) child.kill();
  await rm(work, { recursive: true, force: true });
});

test("docs spec list finds the pilot spec", () => {
  const listed = spawnSync(process.execPath, [cli, "spec", "list", "--json"], {
    cwd: repo,
    encoding: "utf8",
  });
  assert.equal(listed.status, 0, listed.stderr);
  assert.ok(JSON.parse(listed.stdout).specs.includes(key));
});

test(
  "an MCP subscriber receives the approval event and reads the approved wording",
  { timeout: 120_000 },
  async () => {
    const approved = path.join(work, "mcp.approved.json");
    const server = start(
      [
        "mcp",
        "author",
        "--specs",
        "../specs",
        "--allow-spec-proposals",
        "--spec-approved",
        approved,
      ],
      path.join(repo, "website"),
    );
    let id = 0;
    const call = (method, params) => {
      const requestId = ++id;
      const reply = server.next((message) => message.id === requestId);
      server.child.stdin.write(
        JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }) + "\n",
      );
      return reply;
    };

    const init = await call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "docs-specify-smoke", version: "1" },
    });
    assert.ok(init.result, JSON.stringify(init.error));
    server.child.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
    );

    const tools = (await call("tools/list", {})).result.tools.map((tool) => tool.name);
    for (const name of ["specify_list", "specify_read", "specify_propose"])
      assert.ok(tools.includes(name), name);

    const read = await call("tools/call", { name: "specify_read", arguments: { spec: key } });
    assert.notEqual(read.result?.isError, true, JSON.stringify(read));

    const subscribed = await call("resources/subscribe", { uri: snapshotUri });
    assert.equal(subscribed.error, undefined, JSON.stringify(subscribed.error));

    const updated = server.next(
      (message) =>
        message.method === "notifications/resources/updated" && message.params?.uri === snapshotUri,
    );
    await writeFile(approved, approval(proposed));
    await updated;

    const snapshot = await call("resources/read", { uri: snapshotUri });
    const text = snapshot.result.contents.map((content) => content.text).join("");
    for (const rule of proposed) assert.ok(text.includes(rule), `Snapshot is missing: ${rule}`);
  },
);

test("the runner delivers an approval to the pilot worker", { timeout: 300_000 }, async () => {
  const approved = path.join(work, "run.approved.json");
  const runner = start(
    [
      "spec",
      "run",
      "--approved",
      approved,
      "--state",
      path.join(work, "run.state.db"),
      "--",
      process.execPath,
      "specs/verify-copy-markdown.mjs",
    ],
    repo,
  );
  await runner.next((message) => message.event === "ready");
  const done = runner.next((message) => message.event === "completed");
  await writeFile(approved, approval(proposed));
  assert.equal((await done).spec, key);
});
