import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { renderDocsMarkdownDocument } from "./agent.js";
import { analyzeDocsAgentFeedback, readDocsAgentFeedbackFile } from "./agent-feedback-loop.js";
import { createFilesystemDocsMcpSource } from "./mcp.js";

const execFileAsync = promisify(execFile);
const AUTHORING_MAX_COMMAND_OUTPUT_BYTES = 1_000_000;
const DEFAULT_MAX_AUTHORING_FILE_BYTES = 1_000_000;
const DOCS_AUTHORING_EXTENSIONS = new Set([".md", ".mdx", ".svx"]);

export interface DocsAuthoringMcpOptions {
  rootDir: string;
  /** Project-relative or absolute docs content directory. @default entry */
  contentDir?: string;
  /** Public docs entry and default content directory. @default "docs" */
  entry?: string;
  name?: string;
  version?: string;
  /** Branches created by the server must use this prefix. @default "docs/" */
  branchPrefix?: string;
  /** Pull request base branch. @default repository default resolved by gh */
  baseBranch?: string;
  /** Command argv used by authoring_run_doctor. The first item is the executable. */
  doctorCommand?: readonly [string, ...string[]];
  /** Register the external draft-PR publishing tool. Never enabled implicitly. */
  allowPublish?: boolean;
  maxFileBytes?: number;
}

export interface DocsAuthoringFileState {
  path: string;
  sha256: string;
  bytes: number;
  content: string;
}

interface CommandResult {
  ok: boolean;
  command: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
}

function structuredResult<T extends object>(value: T) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function isContained(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function projectPath(rootDir: string, absolutePath: string): string {
  return path.relative(rootDir, absolutePath).replace(/\\/g, "/");
}

function resolveContentRoot(options: DocsAuthoringMcpOptions): string {
  return path.resolve(options.rootDir, options.contentDir ?? options.entry ?? "docs");
}

function assertPathHasNoSymlinks(basePath: string, candidate: string): void {
  const relative = path.relative(basePath, candidate);
  let current = basePath;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error(`Authoring paths cannot traverse symbolic links: ${current}`);
    }
  }
}

function resolveDocsFile(options: DocsAuthoringMcpOptions, value: string): string {
  if (!value.trim() || path.isAbsolute(value) || value.includes("\0")) {
    throw new Error("Authoring paths must be non-empty project-relative paths.");
  }
  const rootDir = path.resolve(options.rootDir);
  const contentRoot = resolveContentRoot(options);
  const candidate = path.resolve(rootDir, value);
  if (!isContained(contentRoot, candidate)) {
    throw new Error(`Authoring is restricted to ${projectPath(rootDir, contentRoot)}/.`);
  }
  if (existsSync(contentRoot) && lstatSync(contentRoot).isSymbolicLink()) {
    throw new Error("The authoring content directory cannot be a symbolic link.");
  }
  assertPathHasNoSymlinks(contentRoot, candidate);
  if (!DOCS_AUTHORING_EXTENSIONS.has(path.extname(candidate).toLowerCase())) {
    throw new Error("Authoring only supports .md, .mdx, and .svx documentation files.");
  }
  return candidate;
}

function resolveProjectInputFile(rootDir: string, value: string): string {
  if (!value.trim() || path.isAbsolute(value) || value.includes("\0")) {
    throw new Error("Input paths must be non-empty project-relative paths.");
  }
  const resolvedRoot = path.resolve(rootDir);
  const candidate = path.resolve(resolvedRoot, value);
  if (!isContained(resolvedRoot, candidate)) {
    throw new Error("Input files must stay inside the project root.");
  }
  assertPathHasNoSymlinks(resolvedRoot, candidate);
  if (existsSync(candidate) && !isContained(realpathSync(resolvedRoot), realpathSync(candidate))) {
    throw new Error("Input files must stay inside the project root.");
  }
  return candidate;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function readDocsAuthoringFile(
  options: DocsAuthoringMcpOptions,
  filePath: string,
): DocsAuthoringFileState {
  const absolutePath = resolveDocsFile(options, filePath);
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    throw new Error(`Documentation file does not exist: ${filePath}`);
  }
  const content = readFileSync(absolutePath, "utf8");
  return {
    path: projectPath(path.resolve(options.rootDir), absolutePath),
    sha256: sha256(content),
    bytes: Buffer.byteLength(content, "utf8"),
    content,
  };
}

export function writeDocsAuthoringFile(
  options: DocsAuthoringMcpOptions,
  input: { path: string; content: string; expectedSha256?: string },
): DocsAuthoringFileState {
  const absolutePath = resolveDocsFile(options, input.path);
  const maxFileBytes = Math.max(1, options.maxFileBytes ?? DEFAULT_MAX_AUTHORING_FILE_BYTES);
  const bytes = Buffer.byteLength(input.content, "utf8");
  if (bytes > maxFileBytes) {
    throw new Error(`Authoring write exceeds the ${maxFileBytes}-byte file limit.`);
  }
  if (existsSync(absolutePath)) {
    const current = readFileSync(absolutePath, "utf8");
    if (!input.expectedSha256) {
      throw new Error(
        "expectedSha256 is required when overwriting an existing documentation file.",
      );
    }
    if (sha256(current) !== input.expectedSha256) {
      throw new Error("Documentation changed since it was read; read it again before overwriting.");
    }
  } else if (input.expectedSha256) {
    throw new Error("expectedSha256 was provided, but the documentation file does not exist.");
  }

  mkdirSync(path.dirname(absolutePath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(absolutePath),
    `.${path.basename(absolutePath)}.${randomUUID()}.tmp`,
  );
  try {
    writeFileSync(temporaryPath, input.content, { encoding: "utf8", flag: "wx" });
    renameSync(temporaryPath, absolutePath);
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    throw error;
  }
  return readDocsAuthoringFile(options, input.path);
}

async function runCommand(
  rootDir: string,
  command: readonly [string, ...string[]],
  timeout = 120_000,
): Promise<CommandResult> {
  try {
    const result = await execFileAsync(command[0], command.slice(1), {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: AUTHORING_MAX_COMMAND_OUTPUT_BYTES,
      timeout,
    });
    return {
      ok: true,
      command: [...command],
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    };
  } catch (error) {
    const failure = error as Error & {
      code?: number | string;
      stdout?: string;
      stderr?: string;
    };
    return {
      ok: false,
      command: [...command],
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? failure.message,
      exitCode: typeof failure.code === "number" ? failure.code : 1,
    };
  }
}

async function runGit(rootDir: string, args: readonly string[]): Promise<CommandResult> {
  return runCommand(rootDir, ["git", ...args]);
}

async function requireGitSuccess(rootDir: string, args: readonly string[]): Promise<string> {
  const result = await runGit(rootDir, args);
  if (!result.ok) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed.`);
  return result.stdout.trim();
}

async function listChangedFiles(rootDir: string): Promise<string[]> {
  const [unstaged, staged, untracked] = await Promise.all([
    requireGitSuccess(rootDir, ["diff", "--name-only", "--no-ext-diff"]),
    requireGitSuccess(rootDir, ["diff", "--cached", "--name-only", "--no-ext-diff"]),
    requireGitSuccess(rootDir, ["ls-files", "--others", "--exclude-standard"]),
  ]);
  return [
    ...new Set(
      [unstaged, staged, untracked].flatMap((value) => value.split(/\r?\n/)).filter(Boolean),
    ),
  ]
    .map((value) => value.replace(/\\/g, "/"))
    .sort();
}

function validateAuthoringBranch(branch: string, prefix: string): void {
  if (
    !branch.startsWith(prefix) ||
    branch === prefix ||
    /\s|\.\.|~|\^|:|\?|\*|\[|\\/.test(branch)
  ) {
    throw new Error(`Authoring branches must start with ${prefix} and use a valid Git ref name.`);
  }
}

async function previewDocsFile(options: DocsAuthoringMcpOptions, filePath: string) {
  const state = readDocsAuthoringFile(options, filePath);
  const source = createFilesystemDocsMcpSource({
    rootDir: options.rootDir,
    entry: options.entry ?? "docs",
    contentDir: options.contentDir ?? options.entry ?? "docs",
  });
  const pages = await Promise.resolve(source.getPages());
  const page = pages.find((candidate) => candidate.sourcePath === state.path);
  if (!page) throw new Error(`The docs source did not resolve a public page for ${state.path}.`);
  const document = renderDocsMarkdownDocument(page);
  return {
    file: state.path,
    url: page.url,
    title: page.title,
    sha256: state.sha256,
    markdown: document.slice(0, 100_000),
    truncated: document.length > 100_000,
  };
}

async function publishDraftPullRequest(
  options: DocsAuthoringMcpOptions,
  input: { title: string; body: string; commitMessage: string },
) {
  const rootDir = path.resolve(options.rootDir);
  const contentRoot = resolveContentRoot(options);
  const contentRootRelative = projectPath(rootDir, contentRoot);
  const branch = await requireGitSuccess(rootDir, ["branch", "--show-current"]);
  const prefix = options.branchPrefix?.trim() || "docs/";
  validateAuthoringBranch(branch, prefix);
  const changedFiles = await listChangedFiles(rootDir);
  if (changedFiles.length === 0)
    throw new Error("No documentation changes are available to publish.");
  const outsideContent = changedFiles.filter(
    (file) => file !== contentRootRelative && !file.startsWith(`${contentRootRelative}/`),
  );
  if (outsideContent.length > 0) {
    throw new Error(
      `Draft PR publishing refuses changes outside ${contentRootRelative}/: ${outsideContent.join(", ")}`,
    );
  }
  const auth = await runCommand(rootDir, ["gh", "auth", "status"], 30_000);
  if (!auth.ok) throw new Error("GitHub CLI authentication is required before publishing.");
  await requireGitSuccess(rootDir, ["add", "--", contentRootRelative]);
  await requireGitSuccess(rootDir, ["commit", "-m", input.commitMessage]);
  await requireGitSuccess(rootDir, ["push", "-u", "origin", branch]);
  const command: [string, ...string[]] = [
    "gh",
    "pr",
    "create",
    "--draft",
    ...(options.baseBranch ? ["--base", options.baseBranch] : []),
    "--head",
    branch,
    "--title",
    input.title,
    "--body",
    input.body,
  ];
  const created = await runCommand(rootDir, command, 60_000);
  if (!created.ok) throw new Error(created.stderr.trim() || "Could not create the draft PR.");
  return {
    branch,
    changedFiles,
    url: created.stdout.trim().split(/\r?\n/).at(-1) ?? "",
    draft: true,
  };
}

/**
 * Create a protected authoring-only MCP server.
 *
 * This server is intentionally separate from createDocsMcpServer and is never wired into public
 * framework adapters. Use stdio locally or place the returned server behind an authenticated,
 * authoring-scoped transport.
 */
export async function createDocsAuthoringMcpServer(
  options: DocsAuthoringMcpOptions,
): Promise<McpServer> {
  const rootDir = path.resolve(options.rootDir);
  const contentRoot = resolveContentRoot(options);
  if (!isContained(rootDir, contentRoot)) {
    throw new Error("The authoring content directory must stay inside the project root.");
  }
  if (existsSync(contentRoot) && lstatSync(contentRoot).isSymbolicLink()) {
    throw new Error("The authoring content directory cannot be a symbolic link.");
  }
  const branchPrefix = options.branchPrefix?.trim() || "docs/";
  const server = new McpServer(
    {
      name: options.name ?? "@farming-labs/docs-authoring",
      version: options.version ?? "0.0.0",
    },
    { capabilities: { logging: {} } },
  );

  server.registerTool(
    "authoring_status",
    {
      title: "Inspect documentation authoring status",
      description: "Return the current branch and changed files before an authoring operation.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const branch = await requireGitSuccess(rootDir, ["branch", "--show-current"]);
      return structuredResult({
        branch,
        branchPrefix,
        contentDirectory: projectPath(rootDir, contentRoot),
        changedFiles: await listChangedFiles(rootDir),
        publishEnabled: options.allowPublish === true,
      });
    },
  );

  server.registerTool(
    "authoring_create_branch",
    {
      title: "Create a documentation authoring branch",
      description: "Create a constrained branch after verifying the complete worktree is clean.",
      inputSchema: z.object({ branch: z.string().trim().min(1).max(200) }),
      annotations: { readOnlyHint: false, idempotentHint: false },
    },
    async ({ branch }) => {
      validateAuthoringBranch(branch, branchPrefix);
      const changedFiles = await listChangedFiles(rootDir);
      if (changedFiles.length > 0) {
        throw new Error("Create the authoring branch before editing; the worktree is not clean.");
      }
      await requireGitSuccess(rootDir, ["switch", "-c", branch]);
      return structuredResult({ branch, created: true });
    },
  );

  server.registerTool(
    "authoring_read_doc",
    {
      title: "Read a documentation source file",
      description: "Read a docs-tree file and return the SHA-256 required for safe overwrites.",
      inputSchema: z.object({ path: z.string().trim().min(1).max(4_096) }),
      annotations: { readOnlyHint: true },
    },
    async ({ path: filePath }) => structuredResult(readDocsAuthoringFile(options, filePath)),
  );

  server.registerTool(
    "authoring_write_doc",
    {
      title: "Write a documentation source file",
      description:
        "Atomically write inside the docs tree. Existing files require the SHA-256 returned by authoring_read_doc.",
      inputSchema: z.object({
        path: z.string().trim().min(1).max(4_096),
        content: z.string(),
        expectedSha256: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
      }),
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async (input) => structuredResult(writeDocsAuthoringFile(options, input)),
  );

  server.registerTool(
    "authoring_preview_doc",
    {
      title: "Preview machine-readable documentation",
      description: "Render the edited page through the same Markdown projection used by agents.",
      inputSchema: z.object({ path: z.string().trim().min(1).max(4_096) }),
      annotations: { readOnlyHint: true },
    },
    async ({ path: filePath }) => structuredResult(await previewDocsFile(options, filePath)),
  );

  server.registerTool(
    "authoring_run_doctor",
    {
      title: "Run docs doctor",
      description: "Run the operator-configured docs doctor command without a shell.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      if (!options.doctorCommand) {
        throw new Error("No doctorCommand was configured for this authoring server.");
      }
      return structuredResult(await runCommand(rootDir, options.doctorCommand));
    },
  );

  server.registerTool(
    "authoring_diff",
    {
      title: "Review documentation diff",
      description: "Return the docs-tree Git diff and any untracked documentation paths.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const contentRootRelative = projectPath(rootDir, contentRoot);
      const diff = await runGit(rootDir, [
        "diff",
        "--no-ext-diff",
        "--unified=3",
        "HEAD",
        "--",
        contentRootRelative,
      ]);
      if (!diff.ok) throw new Error(diff.stderr || "Could not render the documentation diff.");
      const changedFiles = await listChangedFiles(rootDir);
      return structuredResult({
        changedFiles,
        diff: diff.stdout.slice(0, AUTHORING_MAX_COMMAND_OUTPUT_BYTES),
        truncated: diff.stdout.length > AUTHORING_MAX_COMMAND_OUTPUT_BYTES,
      });
    },
  );

  server.registerTool(
    "authoring_analyze_feedback",
    {
      title: "Turn recurring agent feedback into improvement drafts",
      description:
        "Cluster a project-local JSON or JSONL feedback export and draft golden tasks, issues, and a docs PR description.",
      inputSchema: z.object({
        path: z.string().trim().min(1).max(4_096),
        minOccurrences: z.number().int().min(2).max(100).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ path: filePath, minOccurrences }) => {
      const feedback = readDocsAgentFeedbackFile(resolveProjectInputFile(rootDir, filePath));
      return structuredResult(analyzeDocsAgentFeedback(feedback, { minOccurrences }));
    },
  );

  if (options.allowPublish === true) {
    server.registerTool(
      "authoring_publish_draft_pr",
      {
        title: "Commit, push, and open a draft documentation PR",
        description:
          "Publish docs-only changes after an explicit confirmation. Rejects changes outside the configured content directory.",
        inputSchema: z.object({
          confirm: z.literal(true),
          title: z.string().trim().min(1).max(256),
          body: z.string().max(65_536),
          commitMessage: z.string().trim().min(1).max(256),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async ({ title, body, commitMessage }) =>
        structuredResult(await publishDraftPullRequest(options, { title, body, commitMessage })),
    );
  }

  return server;
}

export async function runDocsAuthoringMcpStdio(options: DocsAuthoringMcpOptions): Promise<void> {
  await serveStdio(() => createDocsAuthoringMcpServer(options));
}
