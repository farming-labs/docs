#!/usr/bin/env node
import http from "node:http";
import { spawn } from "node:child_process";
import { appendFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const benchmarkRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(benchmarkRoot, "../../..");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const codexBin =
  process.env.CODEX_BIN ?? "/Applications/Codex.app/Contents/Resources/codex";
const providers = (process.env.BENCHMARK_PROVIDERS ?? "farming-labs,mintlify")
  .split(",")
  .map((provider) => provider.trim())
  .filter(Boolean);
const repeats = Math.max(1, Number.parseInt(process.env.BENCHMARK_REPEATS ?? "1", 10) || 1);
const attemptTimeoutMs = Math.max(
  60_000,
  Number.parseInt(process.env.BENCHMARK_ATTEMPT_TIMEOUT_MS ?? "900000", 10) || 900_000,
);
const invalidRetries = Math.max(
  0,
  Number.parseInt(process.env.BENCHMARK_INVALID_RETRIES ?? "2", 10) || 0,
);
const taskMatrix = JSON.parse(readFileSync(path.join(benchmarkRoot, "tasks.json"), "utf8"));
const allTasks = taskMatrix.tasks;
const selectedTaskIds = (process.env.SKYVERN_TASKS ?? allTasks.map((task) => task.id).join(","))
  .split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter(Number.isFinite);
const tasks = allTasks.filter((task) => selectedTaskIds.includes(task.id));
const supportedProviders = new Set(["farming-labs", "mintlify"]);
const legacySlugAliases = new Map([
  ["features/authentication-and-2fa", "credentials/handle-2fa"],
  ["features/browser-sessions", "optimization/browser-sessions"],
  ["features/proxy-and-geo-targeting", "going-to-production/proxy-geolocation"],
  ["features/code-caching", "optimization/cost-control"],
  ["features/captcha-and-bot-bypass", "going-to-production/captcha-bot-detection"],
  ["browser-automations/work-with-files", "multi-step-automations/file-operations"],
  ["browser-automations/overview", "multi-step-automations/build-a-workflow"],
  ["browser-automations/handle-browsers", "self-hosted/browser"],
  ["browser-automations/extract-structured-data", "running-automations/extract-structured-data"],
  ["sdk-reference/browser-automation/agent-login", "sdk-reference/complete-reference"],
  ["sdk-reference/browser-automation/agent-download-files", "sdk-reference/complete-reference"],
  ["sdk-reference/browser-automation/launch_cloud_browser", "sdk-reference/complete-reference"],
  ["sdk-reference/browser-automation/connect_to_browser_over_cdp", "sdk-reference/complete-reference"],
  ["sdk-reference/browser-automation/launch_local_browser", "sdk-reference/complete-reference"],
  ["sdk-reference/browser-automation/fill", "sdk-reference/complete-reference"],
  ["sdk-reference/browser-automation/fill_multipage_form", "sdk-reference/complete-reference"],
  ["sdk-reference/browser-automation/fill_autocomplete", "sdk-reference/complete-reference"],
  ["sdk-reference/browser-automation/upload_file", "sdk-reference/complete-reference"],
  ["sdk-reference/browser-automation/extract", "sdk-reference/complete-reference"],
  ["sdk-reference/browser-automation/extract_form_fields", "sdk-reference/complete-reference"],
  ["sdk-reference/browser-automation/act", "sdk-reference/complete-reference"],
  ["sdk-reference/browser-sessions/create_browser_session", "sdk-reference/browser-sessions"],
  ["sdk-reference/credentials/create_credential", "sdk-reference/credentials"],
  ["sdk-reference/credentials/send_totp_code", "sdk-reference/credentials"],
  ["sdk-reference/tasks/run_task", "sdk-reference/tasks"],
  ["sdk-reference/tasks/cancel_run", "sdk-reference/tasks"],
  ["sdk-reference/tasks/get_runs_v2", "sdk-reference/tasks"],
  ["sdk-reference/tasks/get_run_artifacts", "sdk-reference/tasks"],
  ["sdk-reference/tasks/get_run", "sdk-reference/tasks"],
  ["sdk-reference/tasks/get_run_timeline", "sdk-reference/tasks"],
  ["sdk-reference/workflows/create_workflow", "sdk-reference/workflows"],
  ["sdk-reference/workflows/run_workflow", "sdk-reference/workflows"],
  ["sdk-reference/helpers/upload_file", "sdk-reference/helpers"],
  ["sdk-reference/browser-profiles/create_browser_profile", "sdk-reference/browser-profiles"],
  ["sdk-reference/browser-profiles/get_browser_profile", "sdk-reference/browser-profiles"],
]);

function canonicalSlug(slug) {
  return slug ? (legacySlugAliases.get(slug) ?? slug) : slug;
}

function json(data) {
  return JSON.stringify(data, null, 2);
}

function now() {
  return new Date().toISOString();
}

function providerProjectRoot(provider) {
  return path.join(benchmarkRoot, provider);
}

function providerFile(provider, relativePath, context) {
  const file = path.join(providerProjectRoot(provider), relativePath);
  if (!existsSync(file)) return null;
  return readFileSync(file, "utf8")
    .replaceAll("{{BASE_URL}}", context.baseUrl)
    .replaceAll("__BASE_URL__", context.baseUrl);
}

function docSlugForPath(urlPath) {
  if (urlPath === "/" || urlPath === "/docs" || urlPath === "/docs.md") return "";
  if (!urlPath.startsWith("/docs/")) return null;
  const withoutPrefix = decodeURIComponent(urlPath.slice("/docs/".length));
  return withoutPrefix.endsWith(".md") ? withoutPrefix.slice(0, -".md".length) : withoutPrefix;
}

function docFileForPath(provider, urlPath) {
  const requestedSlug = docSlugForPath(urlPath);
  if (requestedSlug == null) return null;
  const slug = canonicalSlug(requestedSlug);

  if (provider === "farming-labs") {
    return slug ? `app/docs/${slug}/page.mdx` : "app/docs/page.mdx";
  }

  if (slug === "") return "docs/index.mdx";
  for (const extension of ["mdx", "md"]) {
    const candidate = `docs/${slug}.${extension}`;
    if (existsSync(path.join(providerProjectRoot(provider), candidate))) return candidate;
  }
  return null;
}

function jsonDocFileForPath(provider, urlPath) {
  if (!urlPath.startsWith("/docs/") || !urlPath.endsWith(".json")) return null;
  const relative = decodeURIComponent(urlPath.slice("/docs/".length));
  const candidate =
    provider === "farming-labs" ? `app/docs/${relative}` : `docs/${relative}`;
  return existsSync(path.join(providerProjectRoot(provider), candidate)) ? candidate : null;
}

function allDocPages(provider, context) {
  const root = providerProjectRoot(provider);
  const pages = [];

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (/\.(mdx|md)$/u.test(entry.name)) {
        let slug;
        if (provider === "farming-labs") {
          slug = path
            .relative(path.join(root, "app", "docs"), absolute)
            .replace(/\/page\.mdx$/u, "")
            .replace(/^page\.mdx$/u, "");
        } else {
          slug = path
            .relative(path.join(root, "docs"), absolute)
            .replace(/\.(mdx|md)$/u, "")
            .replace(/^index$/u, "");
        }
        pages.push({
          title: slug || "Home",
          slug,
          url: `${context.baseUrl}/docs${slug ? `/${slug}` : ""}.md`,
        });
      }
    }
  }

  walk(provider === "farming-labs" ? path.join(root, "app", "docs") : path.join(root, "docs"));
  return pages.sort((a, b) => a.slug.localeCompare(b.slug));
}

function taskAgentSpec(task, context) {
  const spec = JSON.parse(
    readFileSync(path.join(providerProjectRoot("farming-labs"), "agent-spec.json"), "utf8"),
  );
  const activeTask = spec.tasks.find((entry) => entry.id === task.id);
  return {
    version: spec.version,
    name: spec.name,
    subject: spec.subject,
    capabilities: spec.capabilities,
    baseUrl: context.baseUrl,
    recommendedEntry: `${context.baseUrl}/docs.md`,
    recommendedTaskRunbook: `${context.baseUrl}/docs/agent-runbooks/task-${task.id}.md`,
    navigationPolicy: {
      mode: "agent-first",
      firstFetch: "/docs.md",
      secondFetch: `/docs/agent-runbooks/task-${task.id}.md`,
      sourcePages: "Fetch canonical source pages only if the task runbook is missing an API detail or acceptance fails.",
    },
    api: {
      docs: `${context.baseUrl}/api/docs`,
      agentSpec: `${context.baseUrl}/api/docs/agent/spec`,
      wellKnown: `${context.baseUrl}/.well-known/agent.json`,
      activeTask: `${context.baseUrl}/api/docs/agent/task/${task.id}`,
    },
    activeTask: {
      ...activeTask,
      taskRunbook: `${context.baseUrl}/docs/agent-runbooks/task-${task.id}.md`,
      canonicalPages: task.canonicalPages.map((slug) => `${context.baseUrl}/docs/${slug}.md`),
    },
  };
}

async function startDocsServer(provider, task, logFile) {
  const context = { baseUrl: "" };
  await mkdir(path.dirname(logFile), { recursive: true });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const accept = String(req.headers.accept ?? "");
    const headers = { "Cache-Control": "no-store" };
    if (provider === "mintlify") {
      headers.Link = '</llms.txt>; rel="llms-txt"';
      headers["X-Llms-Txt"] = "/llms.txt";
    } else {
      headers.Link = '</.well-known/agent.json>; rel="agent"';
      headers["X-Agent-Spec"] = "/api/docs/agent/spec";
    }

    async function send(status, body, extraHeaders = {}) {
      const text = typeof body === "string" ? body : json(body);
      const responseHeaders = {
        ...headers,
        "Content-Type":
          typeof body === "string"
            ? "text/markdown; charset=utf-8"
            : "application/json; charset=utf-8",
        ...extraHeaders,
      };
      await appendFile(
        logFile,
        `${JSON.stringify({
          timestamp: now(),
          provider,
          task_id: task.id,
          method: req.method,
          url: url.pathname + url.search,
          accept,
          status,
          responseBytes: Buffer.byteLength(text),
          contentType: responseHeaders["Content-Type"],
        })}\n`,
      );
      res.writeHead(status, responseHeaders);
      res.end(text);
    }

    if (provider === "mintlify" && url.pathname === "/llms.txt") {
      const body = providerFile(provider, "llms.txt", context);
      return send(body ? 200 : 404, body ?? "Not found");
    }

    if (provider === "farming-labs" && url.pathname === "/.well-known/agent.json") {
      return send(200, taskAgentSpec(task, context), {
        "Content-Type": "application/json; charset=utf-8",
      });
    }

    if (provider === "farming-labs" && url.pathname === "/api/docs/agent/spec") {
      return send(200, taskAgentSpec(task, context), {
        "Content-Type": "application/json; charset=utf-8",
      });
    }

    if (provider === "farming-labs" && url.pathname === `/api/docs/agent/task/${task.id}`) {
      return send(200, taskAgentSpec(task, context).activeTask, {
        "Content-Type": "application/json; charset=utf-8",
      });
    }

    if (provider === "farming-labs" && url.pathname === "/api/docs") {
      const format = url.searchParams.get("format");
      const pagePath = url.searchParams.get("path");
      const query = url.searchParams.get("query");

      if (format === "markdown" && pagePath) {
        const docFile = docFileForPath(provider, `/docs/${pagePath}.md`);
        const body = docFile ? providerFile(provider, docFile, context) : null;
        return send(body ? 200 : 404, body ?? "Not found");
      }

      if (query) {
        const normalized = query.toLowerCase();
        const results = allDocPages(provider, context)
          .map((page) => ({
            ...page,
            markdownUrl: page.url,
            score:
              page.slug === `agent-runbooks/task-${task.id}`
                ? 1
                : page.slug === "agent-runbook"
                  ? 0.98
                  : task.canonicalPages.includes(page.slug) ||
                      normalized.includes(String(task.id)) ||
                      normalized.includes(task.slug)
                    ? 0.95
                    : 0.2,
          }))
          .sort((a, b) => b.score - a.score);
        return send(200, {
          query,
          task: task.id,
          recommendedRunbook: `${context.baseUrl}/docs/agent-runbooks/task-${task.id}.md`,
          results,
        });
      }
    }

    const jsonDocFile = jsonDocFileForPath(provider, url.pathname);
    if (jsonDocFile) {
      const body = providerFile(provider, jsonDocFile, context);
      return send(body ? 200 : 404, body ?? "Not found", {
        "Content-Type": "application/json; charset=utf-8",
      });
    }

    const docFile = docFileForPath(provider, url.pathname);
    if (docFile) {
      const body = providerFile(provider, docFile, context);
      if (body) return send(200, body);
    }

    return send(404, "Not found");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start docs server");
  context.baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl: context.baseUrl };
}

async function createProviderWorkspace(provider, workspaceDir) {
  const projectDir = providerProjectRoot(provider);
  const ignoredWorkspaceDirs = new Set(["node_modules", ".next", ".turbo", "dist", "out"]);
  await cp(projectDir, workspaceDir, {
    recursive: true,
    force: true,
    filter(source) {
      const relativePath = path.relative(projectDir, source);
      if (!relativePath) return true;
      return !relativePath
        .split(path.sep)
        .some((segment) => ignoredWorkspaceDirs.has(segment));
    },
  });
}

function buildPrompt(provider, baseUrl, task) {
  const discovery =
    provider === "farming-labs"
      ? `Start by fetching ${baseUrl}/docs.md, then fetch ${baseUrl}/docs/agent-runbooks/task-${task.id}.md.
The task runbook is the provider's optimized <Agent> primitive and is intended to be sufficient for
the first implementation attempt. Do not fetch broad canonical source pages until after acceptance
fails or the runbook is missing a concrete API detail. If you need machine-readable discovery, use
${baseUrl}/.well-known/agent.json or ${baseUrl}/api/docs/agent/spec.`
      : `Start by fetching ${baseUrl}/docs.md and ${baseUrl}/llms.txt, then use the listed docs pages.
This provider does not expose a task-specific <Agent> primitive, so navigate from its docs index and
llms.txt.`;

  return `You are benchmarking how easy a documentation framework is for implementation agents.

Docs base URL: ${baseUrl}
Skyvern task ID: ${task.id}
Docs provider: ${provider}

Use only the documentation at that base URL. Do not use the public internet and do not rely on prior
knowledge of Skyvern APIs.

Discovery policy:
${discovery}

Task:
${task.prompt}

Constraints:
- Update only the local artifact workspace files.
- Create solutions/task-${task.id}.py and solutions/task-${task.id}.md.
- Do not install packages.
- Keep this as a script/example; do not call real customer sites.
- Use python3, not python, for local syntax or dry-run checks.
- Retrieve documentation through the docs base URL only; do not read copied docs files from the
  workspace filesystem.
- Do not run broad docs-corpus enumeration commands such as rg --files, find app/docs, or ls app/docs.
  If needed, inspect scripts/acceptance.mjs directly.
- Run SKYVERN_TASK_ID=${task.id} node scripts/acceptance.mjs.
- Finish only after acceptance passes or you are truly blocked.

At the end, summarize:
- Which docs URLs you fetched.
- Which docs page was the first truly relevant page.
- What files you changed.
- Any wrong pages, command errors, or confusing docs.
- Whether acceptance passed.
`;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const { timeoutMs, ...spawnOptions } = options;
    const child = spawn(command, args, { ...spawnOptions, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let killTimer = null;
    const timer =
      timeoutMs && Number.isFinite(timeoutMs)
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
            killTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
            killTimer.unref?.();
          }, timeoutMs)
        : null;
    timer?.unref?.();
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve({ code: timedOut ? 124 : code, stdout, stderr, timedOut });
    });
  });
}

function parseJsonLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function secondsBetween(start, end) {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Number(((endMs - startMs) / 1000).toFixed(3));
}

function scoreDocs(provider, task, requests) {
  const statusErrorRequests = requests.filter((event) => event.url && event.status >= 400);
  const docsRequests = requests.filter((event) => event.url && event.status < 400);
  const canonical = new Set(task.canonicalPages);
  const classified = docsRequests.map((event) => {
    const url = new URL(event.url, "http://benchmark.local");
    const slug =
      url.pathname === "/api/docs" && url.searchParams.get("path")
        ? url.searchParams.get("path")
        : docSlugForPath(url.pathname);
    const normalizedSlug = canonicalSlug(slug);
    const agentInstruction =
      provider === "farming-labs" &&
      (["/docs.md", "/docs/agent-runbook.md", "/.well-known/agent.json", "/api/docs/agent/spec"]
        .some((pathname) => url.pathname === pathname) ||
        url.pathname.startsWith("/docs/agent-runbooks/") ||
        url.pathname.startsWith("/api/docs/agent/task/"));
    const isSearch =
      provider === "farming-labs" &&
      url.pathname === "/api/docs" &&
      url.searchParams.has("query");
    const isDiscovery =
      url.pathname === "/llms.txt" ||
      slug === "" ||
      isSearch;
    const isTarget = agentInstruction || (normalizedSlug ? canonical.has(normalizedSlug) : false);
    const isDocsPage = slug != null;

    return {
      event,
      slug,
      kind: isTarget ? "target" : isDiscovery ? "discovery" : isDocsPage ? "noisy" : "other",
      resourceId: normalizedSlug ? `page:${normalizedSlug}` : url.pathname + url.search,
      agentInstruction,
      targetSource: agentInstruction
        ? "agent-runbook"
        : canonical.has(normalizedSlug)
          ? "target-page"
          : null,
    };
  });
  const relevant = classified.filter((entry) => entry.kind === "target").map((entry) => entry.event);
  const noisy = classified.filter((entry) => entry.kind === "noisy").map((entry) => entry.event);
  const discovery = classified
    .filter((entry) => entry.kind === "discovery")
    .map((entry) => entry.event);
  const agentInstruction = classified
    .filter((entry) => entry.agentInstruction)
    .map((entry) => entry.event);
  const firstRelevant = relevant[0] ?? null;
  const firstRelevantIndex = firstRelevant ? docsRequests.indexOf(firstRelevant) : -1;
  const noisyBeforeRelevant =
    firstRelevantIndex >= 0
      ? docsRequests.slice(0, firstRelevantIndex).filter((event) => noisy.includes(event)).length
      : noisy.length;
  const offTargetBeforeRelevant = noisyBeforeRelevant;
  const uniqueResources = new Set(classified.map((entry) => entry.resourceId));

  return {
    docsFetches: docsRequests.length,
    rawDocsFetches: docsRequests.length,
    uniqueDocsResources: uniqueResources.size,
    totalDocsBytes: docsRequests.reduce((sum, event) => sum + (event.responseBytes ?? 0), 0),
    statusErrorFetches: statusErrorRequests.length,
    notFoundFetches: statusErrorRequests.filter((event) => event.status === 404).length,
    relevantFetches: relevant.length,
    discoveryFetches: discovery.length,
    agentInstructionFetches: agentInstruction.length,
    wrongOrNoisyFetches: noisy.length,
    noisyBeforeRelevant,
    offTargetBeforeRelevant,
    normalizedRetrievalSteps: firstRelevantIndex >= 0 ? firstRelevantIndex + 1 : null,
    firstDocsFetchAt: docsRequests[0]?.timestamp ?? null,
    firstRelevantAt: firstRelevant?.timestamp ?? null,
    firstRelevantUrl: firstRelevant?.url ?? null,
    firstRelevantSource:
      classified.find((entry) => entry.event === firstRelevant)?.targetSource ?? null,
    discoveryUsed:
      provider === "farming-labs"
        ? agentInstruction.length > 0
        : docsRequests.some((event) => event.url === "/docs.md" || event.url.includes("/llms.txt")),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function agentErrorPressure({ validAttempt, acceptancePassed, success, codex, cmdErrors, docs }) {
  const completion = validAttempt && acceptancePassed && success ? 0 : 40;
  const session = clamp(
    (codex.timedOut ? 12 : 0) +
      (codex.code !== 0 ? 4 : 0) +
      cmdErrors.length * 4,
    0,
    20,
  );
  const retrieval = clamp(
    (docs.firstRelevantUrl ? 0 : 12) +
      (docs.discoveryUsed ? 0 : 4) +
      docs.offTargetBeforeRelevant * 4 +
      docs.statusErrorFetches * 3,
    0,
    20,
  );
  const context = clamp(
    Math.max(0, docs.rawDocsFetches - 2) * 1.5 +
      Math.max(0, docs.totalDocsBytes - 25_000) / 25_000,
    0,
    20,
  );
  const total = Number((completion + session + retrieval + context).toFixed(1));

  return {
    score: total,
    components: {
      completion: Number(completion.toFixed(1)),
      session: Number(session.toFixed(1)),
      retrieval: Number(retrieval.toFixed(1)),
      context: Number(context.toFixed(1)),
    },
  };
}

function commandErrors(events) {
  return events.filter((event) => {
    if (event.type !== "item.completed") return false;
    if (event.item?.type !== "command_execution") return false;
    if (typeof event.item.exit_code !== "number") return false;
    return event.item.exit_code !== 0;
  });
}

function isInfrastructureFailure({ codex, usage, finalMessage }) {
  const totalTokens =
    (usage.input_tokens ?? 0) + (usage.cached_input_tokens ?? 0) + (usage.output_tokens ?? 0);
  return codex.code !== 0 && totalTokens === 0 && !existsSync(finalMessage);
}

async function writeResultMarkdown(artifactDir, result, requests) {
  await writeFile(
    path.join(artifactDir, "result.md"),
    [
      `# Skyvern Task ${result.task_id} ${result.provider} Result`,
      "",
      `- Valid attempt: ${result.valid_attempt}`,
      `- Infrastructure failure: ${result.infrastructure_failure}`,
      `- Success: ${result.success}`,
      `- Error-free: ${result.error_free}`,
      `- Agent Error Pressure Score: ${result.agent_error_pressure_score} / 100`,
      `- Acceptance passed: ${result.acceptance_passed}`,
      `- Weighted errors: ${result.weighted_errors}`,
      `- First relevant URL: ${result.docs.firstRelevantUrl ?? "none"}`,
      `- First relevant source: ${result.docs.firstRelevantSource ?? "none"}`,
      `- Raw docs fetches: ${result.docs.rawDocsFetches}`,
      `- Unique docs resources: ${result.docs.uniqueDocsResources}`,
      "",
      "## Request Log",
      "",
      "| Time | Method | URL | Status | Bytes |",
      "| ---- | ------ | --- | ------ | ----- |",
      ...requests.map(
        (event) =>
          `| ${event.timestamp} | ${event.method} | \`${event.url}\` | ${event.status} | ${event.responseBytes} |`,
      ),
      "",
    ].join("\n"),
  );
}

async function runProviderTask(provider, task, attempt) {
  const projectDir = providerProjectRoot(provider);
  const artifactDir = path.join(
    benchmarkRoot,
    "artifacts",
    runId,
    provider,
    `task-${task.id}`,
    `attempt-${attempt}`,
  );
  const workspaceDir = path.join(artifactDir, "workspace");
  const docsLog = path.join(artifactDir, "docs-requests.jsonl");
  const eventsLog = path.join(artifactDir, "codex-events.jsonl");
  const stderrLog = path.join(artifactDir, "codex-stderr.log");
  const finalMessage = path.join(artifactDir, "codex-final.md");

  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(workspaceDir, { recursive: true });
  await createProviderWorkspace(provider, workspaceDir);

  const { server, baseUrl } = await startDocsServer(provider, task, docsLog);
  const startedAt = now();

  try {
    const prompt = buildPrompt(provider, baseUrl, task);
    await writeFile(path.join(artifactDir, "prompt.txt"), prompt);

    const codex = await runCommand(
      codexBin,
      [
        "exec",
        "--json",
        "--ephemeral",
        "--skip-git-repo-check",
        "-s",
        "danger-full-access",
        "-C",
        workspaceDir,
        "-o",
        finalMessage,
        prompt,
      ],
      {
        cwd: workspaceDir,
        env: { ...process.env, SKYVERN_TASK_ID: String(task.id) },
        timeoutMs: attemptTimeoutMs,
      },
    );
    await writeFile(eventsLog, codex.stdout);
    await writeFile(stderrLog, codex.stderr);

    const acceptance = await runCommand("node", ["scripts/acceptance.mjs"], {
      cwd: workspaceDir,
      env: { ...process.env, SKYVERN_TASK_ID: String(task.id) },
    });
    const completedAt = now();
    await writeFile(path.join(artifactDir, "acceptance.stdout.log"), acceptance.stdout);
    await writeFile(path.join(artifactDir, "acceptance.stderr.log"), acceptance.stderr);

    const events = parseJsonLines(codex.stdout);
    const usage = events
      .filter((event) => event.type === "turn.completed" && event.usage)
      .reduce(
        (sum, event) => ({
          input_tokens: sum.input_tokens + (event.usage.input_tokens ?? 0),
          cached_input_tokens: sum.cached_input_tokens + (event.usage.cached_input_tokens ?? 0),
          output_tokens: sum.output_tokens + (event.usage.output_tokens ?? 0),
        }),
        { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 },
      );
    const requests = existsSync(docsLog) ? parseJsonLines(await readFile(docsLog, "utf8")) : [];
    const docs = scoreDocs(provider, task, requests);
    const cmdErrors = commandErrors(events);
    const acceptancePassed = acceptance.code === 0;
    const infrastructureFailure = isInfrastructureFailure({ codex, usage, finalMessage });
    const validAttempt = !infrastructureFailure;
    const success =
      validAttempt && acceptancePassed && docs.relevantFetches > 0 && docs.discoveryUsed;
    const weightedErrors =
      (validAttempt && !acceptancePassed ? 10 : 0) +
      (docs.relevantFetches > 0 ? 0 : 8) +
      (docs.discoveryUsed ? 0 : 3) +
      docs.noisyBeforeRelevant +
      cmdErrors.length * 2;
    const errorFree =
      validAttempt && success && cmdErrors.length === 0 && docs.offTargetBeforeRelevant === 0;
    const pressure = agentErrorPressure({
      validAttempt,
      acceptancePassed,
      success,
      codex,
      cmdErrors,
      docs,
    });

    const result = {
      run_id: runId,
      provider,
      task_id: task.id,
      task_slug: task.slug,
      attempt,
      valid_attempt: validAttempt,
      infrastructure_failure: infrastructureFailure,
      docs_base_url: baseUrl,
      project_dir: path.relative(repoRoot, projectDir),
      artifact_dir: path.relative(repoRoot, artifactDir),
      workspace_dir: path.relative(repoRoot, workspaceDir),
      started_at: startedAt,
      completed_at: completedAt,
      codex_exit_code: codex.code,
      codex_timed_out: codex.timedOut,
      acceptance_exit_code: acceptance.code,
      acceptance_passed: acceptancePassed,
      success,
      error_free: errorFree,
      agent_error_pressure_score: pressure.score,
      agent_error_pressure_components: pressure.components,
      weighted_errors: weightedErrors,
      command_error_count: cmdErrors.length,
      usage,
      time: {
        time_to_first_docs_fetch_seconds: secondsBetween(startedAt, docs.firstDocsFetchAt),
        time_to_first_relevant_page_seconds: secondsBetween(startedAt, docs.firstRelevantAt),
        time_to_full_implementation_seconds: secondsBetween(startedAt, completedAt),
      },
      docs,
      files: {
        prompt: path.relative(repoRoot, path.join(artifactDir, "prompt.txt")),
        final_message: path.relative(repoRoot, finalMessage),
        events: path.relative(repoRoot, eventsLog),
        docs_requests: path.relative(repoRoot, docsLog),
        result: path.relative(repoRoot, path.join(artifactDir, "result.md")),
      },
    };

    await writeFile(path.join(artifactDir, "result.json"), json(result));
    await writeResultMarkdown(artifactDir, result, requests);
    return result;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

for (const provider of providers) {
  if (!supportedProviders.has(provider)) throw new Error(`Unsupported provider: ${provider}`);
}
if (tasks.length === 0) throw new Error("No Skyvern tasks selected.");

const results = [];
for (const task of tasks) {
  for (const provider of providers) {
    let validAttempts = 0;
    let startedAttempts = 0;
    while (validAttempts < repeats && startedAttempts < repeats + invalidRetries) {
      startedAttempts += 1;
      const result = await runProviderTask(provider, task, startedAttempts);
      results.push(result);
      if (result.valid_attempt) validAttempts += 1;
    }
  }
}

function average(values) {
  const numeric = values.filter((value) => typeof value === "number");
  if (numeric.length === 0) return null;
  return Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(3));
}

function median(values) {
  const sorted = values.filter((value) => typeof value === "number").sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(3));
}

function rate(count, total) {
  if (total === 0) return 0;
  return Number((count / total).toFixed(3));
}

function taskLevelAverage(resultsForProvider, pickValue) {
  const byTask = new Map();
  for (const result of resultsForProvider) {
    const group = byTask.get(result.task_id) ?? [];
    group.push(result);
    byTask.set(result.task_id, group);
  }

  const taskValues = [];
  for (const group of byTask.values()) {
    const valid = group.filter((result) => result.valid_attempt);
    const source = valid.length > 0 ? valid : group;
    const values = source.map(pickValue).filter((value) => typeof value === "number");
    if (values.length > 0) taskValues.push(average(values));
  }

  return average(taskValues);
}

function aggregateProvider(provider) {
  const providerResults = results.filter((result) => result.provider === provider);
  const valid = providerResults.filter((result) => result.valid_attempt);
  const attempts = valid.length;
  return {
    provider,
    attempts_started: providerResults.length,
    valid_attempts: attempts,
    invalid_attempts: providerResults.length - attempts,
    success_rate: rate(valid.filter((result) => result.success).length, attempts),
    task_error_rate: rate(valid.filter((result) => !result.success).length, attempts),
    acceptance_error_rate: rate(valid.filter((result) => !result.acceptance_passed).length, attempts),
    session_error_rate: rate(
      valid.filter(
        (result) =>
          !result.acceptance_passed ||
          result.command_error_count > 0 ||
          result.codex_timed_out,
      ).length,
      attempts,
    ),
    docs_error_rate: rate(
      valid.filter(
        (result) => !result.docs.firstRelevantUrl || result.docs.offTargetBeforeRelevant > 0,
      ).length,
      attempts,
    ),
    error_free_rate: rate(valid.filter((result) => result.error_free).length, attempts),
    agent_error_pressure_score: taskLevelAverage(
      providerResults,
      (result) => result.agent_error_pressure_score,
    ),
    median_full_time_seconds: median(
      valid.map((result) => result.time.time_to_full_implementation_seconds),
    ),
    median_first_relevant_seconds: median(
      valid.map((result) => result.time.time_to_first_relevant_page_seconds),
    ),
    mean_weighted_errors: average(valid.map((result) => result.weighted_errors)),
    mean_raw_docs_fetches: average(valid.map((result) => result.docs.rawDocsFetches)),
    mean_unique_docs_resources: average(valid.map((result) => result.docs.uniqueDocsResources)),
    mean_agent_instruction_fetches: average(
      valid.map((result) => result.docs.agentInstructionFetches),
    ),
    mean_off_target_before_relevant: average(
      valid.map((result) => result.docs.offTargetBeforeRelevant),
    ),
    mean_docs_bytes: average(valid.map((result) => result.docs.totalDocsBytes)),
    mean_input_tokens: average(valid.map((result) => result.usage.input_tokens)),
    mean_output_tokens: average(valid.map((result) => result.usage.output_tokens)),
  };
}

function format(value) {
  if (typeof value !== "number") return "n/a";
  return value.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

const aggregate = providers.map(aggregateProvider);
const summaryDir = path.join(benchmarkRoot, "artifacts", runId);
const analysisDir = path.join(benchmarkRoot, "analysis", runId);
await mkdir(summaryDir, { recursive: true });
await mkdir(analysisDir, { recursive: true });
await writeFile(
  path.join(summaryDir, "summary.json"),
  json({
    run_id: runId,
    subject: "skyvern",
    tasks: tasks.map((task) => ({ id: task.id, slug: task.slug, title: task.title })),
    repeats,
    invalid_retries: invalidRetries,
    attempt_timeout_ms: attemptTimeoutMs,
    providers,
    aggregate,
    results,
  }),
);
await writeFile(
  path.join(analysisDir, "metric-log.jsonl"),
  `${results.map((result) => JSON.stringify(result)).join("\n")}\n`,
);
await writeFile(
  path.join(analysisDir, "aggregate.json"),
  json(aggregate),
);
await writeFile(
  path.join(summaryDir, "summary.md"),
  [
    `# Skyvern Codex Benchmark ${runId}`,
    "",
    `- Tasks: ${tasks.map((task) => task.id).join(", ")}`,
    `- Target valid attempts per provider/task: ${repeats}`,
    `- Invalid retry budget: ${invalidRetries}`,
    `- Attempt timeout: ${format(attemptTimeoutMs / 1000)}s`,
    "",
    "## Outcome",
    "",
    "| Provider | Started | Valid | Invalid | Success | Error-Free | Task Error | Acceptance Error | Session Error | Docs Error |",
    "| -------- | ------- | ----- | ------- | ------- | ---------- | ---------- | ---------------- | ------------- | ---------- |",
    ...aggregate.map(
      (entry) =>
        `| ${entry.provider} | ${entry.attempts_started} | ${entry.valid_attempts} | ${entry.invalid_attempts} | ${format(entry.success_rate)} | ${format(entry.error_free_rate)} | ${format(entry.task_error_rate)} | ${format(entry.acceptance_error_rate)} | ${format(entry.session_error_rate)} | ${format(entry.docs_error_rate)} |`,
    ),
    "",
    "## Efficiency",
    "",
    "| Provider | Median Full Time | Median First Relevant | Raw Fetches | Unique Resources | Agent Instruction Fetches | Docs Bytes | Input Tokens | Output Tokens |",
    "| -------- | ---------------- | --------------------- | ----------- | ---------------- | ------------------------- | ---------- | ------------ | ------------- |",
    ...aggregate.map(
      (entry) =>
        `| ${entry.provider} | ${format(entry.median_full_time_seconds)}s | ${format(entry.median_first_relevant_seconds)}s | ${format(entry.mean_raw_docs_fetches)} | ${format(entry.mean_unique_docs_resources)} | ${format(entry.mean_agent_instruction_fetches)} | ${format(entry.mean_docs_bytes)} | ${format(entry.mean_input_tokens)} | ${format(entry.mean_output_tokens)} |`,
    ),
    "",
    "## Agent Error Pressure",
    "",
    "Lower is better. The score blends completion failures, session errors, docs retrieval mistakes, and context waste.",
    "",
    "| Provider | Score | Reading |",
    "| -------- | ----- | ------- |",
    ...aggregate.map((entry) => {
      const score = entry.agent_error_pressure_score;
      const reading =
        typeof score !== "number"
          ? "n/a"
          : score <= 15
            ? "Low"
            : score <= 35
              ? "Moderate"
              : "High";
      return `| ${entry.provider} | ${format(score)} / 100 | ${reading} error pressure |`;
    }),
    "",
    "## Attempts",
    "",
    "| Provider | Task | Attempt | Valid | Success | Error-Free | Error Pressure | First Relevant | Raw Fetches | Target Source | Weighted Errors |",
    "| -------- | ---- | ------- | ----- | ------- | ---------- | -------------- | -------------- | ----------- | ------------- | --------------- |",
    ...results.map(
      (result) =>
        `| ${result.provider} | ${result.task_id} | ${result.attempt} | ${result.valid_attempt} | ${result.success} | ${result.error_free} | ${format(result.agent_error_pressure_score)} | ${format(result.time.time_to_first_relevant_page_seconds)}s | ${format(result.docs.rawDocsFetches)} | ${result.docs.firstRelevantSource ?? "none"} | ${format(result.weighted_errors)} |`,
    ),
    "",
  ].join("\n"),
);

console.log(`Wrote summary: ${path.relative(process.cwd(), path.join(summaryDir, "summary.md"))}`);
