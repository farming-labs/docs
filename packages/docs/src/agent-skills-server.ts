import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { access, lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { gzip, gzipSync } from "node:zlib";
import type { DocsAgentSkillsInput } from "./types.js";
import {
  buildDocsPublishedAgentSkill,
  DEFAULT_AGENT_SKILLS_ROUTE_PREFIX,
  type DocsPublishedAgentSkill,
  type DocsPublishedAgentSkillFile,
} from "./standards-discovery.js";

const COMPANION_DIRECTORIES = new Set(["references", "scripts", "assets"]);
const IGNORED_COLLECTION_DIRECTORIES = new Set([".git", "node_modules"]);
const MAX_COLLECTION_DEPTH = 12;
const MAX_FILES_PER_SKILL = 256;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_SKILL_BYTES = 8 * 1024 * 1024;

export interface ResolveConfiguredAgentSkillsOptions {
  rootDir?: string;
  workspaceRoot?: string;
}

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function findWorkspaceRoot(rootDir: string): string {
  let current = realpathSync(rootDir);
  for (;;) {
    if (
      existsSync(path.join(current, ".git")) ||
      existsSync(path.join(current, "pnpm-workspace.yaml")) ||
      existsSync(path.join(current, "pnpm-workspace.yml"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return realpathSync(rootDir);
    current = parent;
  }
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function findWorkspaceRootAsync(rootDir: string): Promise<string> {
  const resolvedRoot = await realpath(rootDir);
  let current = resolvedRoot;
  for (;;) {
    if (
      (await pathExists(path.join(current, ".git"))) ||
      (await pathExists(path.join(current, "pnpm-workspace.yaml"))) ||
      (await pathExists(path.join(current, "pnpm-workspace.yml")))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return resolvedRoot;
    current = parent;
  }
}

function normalizeConfiguredPaths(input: DocsAgentSkillsInput | undefined): string[] {
  if (!input) return [];
  const value =
    typeof input === "string" || Array.isArray(input)
      ? input
      : (input as { paths: string | readonly string[] }).paths;
  return (typeof value === "string" ? [value] : [...value])
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

function resolveSafeConfiguredPath(
  configuredPath: string,
  rootDir: string,
  workspaceRoot: string,
): string {
  const candidate = path.resolve(rootDir, configuredPath);
  if (!existsSync(candidate)) {
    throw new Error(`Configured Agent Skill path does not exist: ${configuredPath}`);
  }
  if (lstatSync(candidate).isSymbolicLink()) {
    throw new Error(`Configured Agent Skill paths may not be symlinks: ${configuredPath}`);
  }
  const resolved = realpathSync(candidate);
  if (!isInside(workspaceRoot, resolved)) {
    throw new Error(`Agent Skill symlink escapes the workspace: ${configuredPath}`);
  }
  return resolved;
}

async function resolveSafeConfiguredPathAsync(
  configuredPath: string,
  rootDir: string,
  workspaceRoot: string,
): Promise<string> {
  const candidate = path.resolve(rootDir, configuredPath);
  if (!(await pathExists(candidate))) {
    throw new Error(`Configured Agent Skill path does not exist: ${configuredPath}`);
  }
  if ((await lstat(candidate)).isSymbolicLink()) {
    throw new Error(`Configured Agent Skill paths may not be symlinks: ${configuredPath}`);
  }
  const resolved = await realpath(candidate);
  if (!isInside(workspaceRoot, resolved)) {
    throw new Error(`Agent Skill symlink escapes the workspace: ${configuredPath}`);
  }
  return resolved;
}

function collectSkillDocuments(
  candidate: string,
  workspaceRoot: string,
  results: Set<string>,
  visited: Set<string>,
  depth = 0,
): void {
  if (depth > MAX_COLLECTION_DEPTH) {
    throw new Error(`Agent Skill collection exceeds ${MAX_COLLECTION_DEPTH} directory levels.`);
  }
  const resolved = realpathSync(candidate);
  if (!isInside(workspaceRoot, resolved)) {
    throw new Error(`Agent Skill symlink escapes the workspace: ${candidate}`);
  }
  if (visited.has(resolved)) return;
  visited.add(resolved);

  const info = statSync(resolved);
  if (info.isFile()) {
    if (path.basename(resolved) !== "SKILL.md") {
      throw new Error(`Agent Skill file must be named SKILL.md: ${candidate}`);
    }
    results.add(resolved);
    return;
  }
  if (!info.isDirectory()) {
    throw new Error(`Agent Skill path must be a regular file or directory: ${candidate}`);
  }

  const directSkill = path.join(resolved, "SKILL.md");
  if (existsSync(directSkill)) {
    const directInfo = lstatSync(directSkill);
    if (!directInfo.isFile() || directInfo.isSymbolicLink()) {
      throw new Error(`Agent Skill SKILL.md must be a non-symlink regular file: ${directSkill}`);
    }
    results.add(directSkill);
    return;
  }

  for (const entry of readdirSync(resolved, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (
      IGNORED_COLLECTION_DIRECTORIES.has(entry.name) ||
      entry.name.startsWith(".") ||
      COMPANION_DIRECTORIES.has(entry.name)
    ) {
      continue;
    }
    const entryPath = path.join(resolved, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Agent Skill collections may not contain symlinks: ${entryPath}`);
    } else if (entry.isDirectory() || entry.isFile()) {
      if (entry.isDirectory() || entry.name === "SKILL.md") {
        collectSkillDocuments(entryPath, workspaceRoot, results, visited, depth + 1);
      }
    } else {
      throw new Error(`Unsafe filesystem entry in Agent Skill collection: ${entryPath}`);
    }
  }
}

async function collectSkillDocumentsAsync(
  candidate: string,
  workspaceRoot: string,
  results: Set<string>,
  visited: Set<string>,
  depth = 0,
): Promise<void> {
  if (depth > MAX_COLLECTION_DEPTH) {
    throw new Error(`Agent Skill collection exceeds ${MAX_COLLECTION_DEPTH} directory levels.`);
  }
  const resolved = await realpath(candidate);
  if (!isInside(workspaceRoot, resolved)) {
    throw new Error(`Agent Skill symlink escapes the workspace: ${candidate}`);
  }
  if (visited.has(resolved)) return;
  visited.add(resolved);

  const info = await stat(resolved);
  if (info.isFile()) {
    if (path.basename(resolved) !== "SKILL.md") {
      throw new Error(`Agent Skill file must be named SKILL.md: ${candidate}`);
    }
    results.add(resolved);
    return;
  }
  if (!info.isDirectory()) {
    throw new Error(`Agent Skill path must be a regular file or directory: ${candidate}`);
  }

  const directSkill = path.join(resolved, "SKILL.md");
  if (await pathExists(directSkill)) {
    const directInfo = await lstat(directSkill);
    if (!directInfo.isFile() || directInfo.isSymbolicLink()) {
      throw new Error(`Agent Skill SKILL.md must be a non-symlink regular file: ${directSkill}`);
    }
    results.add(directSkill);
    return;
  }

  const entries = await readdir(resolved, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (
      IGNORED_COLLECTION_DIRECTORIES.has(entry.name) ||
      entry.name.startsWith(".") ||
      COMPANION_DIRECTORIES.has(entry.name)
    ) {
      continue;
    }
    const entryPath = path.join(resolved, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Agent Skill collections may not contain symlinks: ${entryPath}`);
    } else if (entry.isDirectory() || entry.isFile()) {
      if (entry.isDirectory() || entry.name === "SKILL.md") {
        await collectSkillDocumentsAsync(entryPath, workspaceRoot, results, visited, depth + 1);
      }
    } else {
      throw new Error(`Unsafe filesystem entry in Agent Skill collection: ${entryPath}`);
    }
  }
}

function encodeSkillFileUrl(name: string, relativePath: string): string {
  const encodedPath = relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/${encodeURIComponent(name)}/${encodedPath}`;
}

function mediaTypeFor(relativePath: string): string {
  const extension = path.extname(relativePath).toLowerCase();
  if ([".md", ".mdx"].includes(extension)) return "text/markdown";
  if (
    [
      ".txt",
      ".sh",
      ".bash",
      ".zsh",
      ".py",
      ".js",
      ".mjs",
      ".cjs",
      ".ts",
      ".tsx",
      ".jsx",
      ".css",
      ".html",
      ".svg",
      ".csv",
      ".yaml",
      ".yml",
    ].includes(extension)
  ) {
    return "text/plain";
  }
  if (extension === ".json") return "application/json";
  if (extension === ".png") return "image/png";
  if ([".jpg", ".jpeg"].includes(extension)) return "image/jpeg";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";
  if (extension === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

function hashBytes(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function preserveFileBytes(content: Buffer, mediaType: string): string | Uint8Array {
  if (mediaType.startsWith("text/") || mediaType === "application/json") {
    const text = content.toString("utf8");
    if (Buffer.from(text, "utf8").equals(content)) return text;
  }
  return new Uint8Array(content);
}

function compareSkillFilePath(left: { path: string }, right: { path: string }): number {
  if (left.path === "SKILL.md") return -1;
  if (right.path === "SKILL.md") return 1;
  return left.path.localeCompare(right.path);
}

function readCompanionFiles(
  skillDir: string,
  name: string,
  rootSkillBytes: number,
): DocsPublishedAgentSkillFile[] {
  const files: DocsPublishedAgentSkillFile[] = [];
  let totalBytes = rootSkillBytes;

  function visit(absoluteDir: string, relativeDir: string, depth = 0): void {
    if (depth > MAX_COLLECTION_DEPTH) {
      throw new Error(
        `Agent Skill companion tree exceeds ${MAX_COLLECTION_DEPTH} levels: ${skillDir}`,
      );
    }
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const absolutePath = path.join(absoluteDir, entry.name);
      const relativePath = path.posix.join(relativeDir, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Agent Skill companion files may not be symlinks: ${absolutePath}`);
      }
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath, depth + 1);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`Unsafe filesystem entry in Agent Skill: ${absolutePath}`);
      }
      const executable = (statSync(absolutePath).mode & 0o111) !== 0;
      const content = readFileSync(absolutePath);
      if (content.byteLength > MAX_FILE_BYTES) {
        throw new Error(`Agent Skill file exceeds ${MAX_FILE_BYTES} bytes: ${absolutePath}`);
      }
      totalBytes += content.byteLength;
      if (totalBytes > MAX_SKILL_BYTES || files.length >= MAX_FILES_PER_SKILL - 1) {
        throw new Error(`Agent Skill exceeds safe publication limits: ${skillDir}`);
      }
      const mediaType = mediaTypeFor(relativePath);
      const value = preserveFileBytes(content, mediaType);
      const sha256 = hashBytes(value);
      files.push({
        path: relativePath,
        url: encodeSkillFileUrl(name, relativePath),
        mediaType,
        content: value,
        sha256,
        digest: `sha256:${sha256}`,
        executable,
      });
    }
  }

  for (const directory of [...COMPANION_DIRECTORIES].sort()) {
    const absoluteDir = path.join(skillDir, directory);
    if (!existsSync(absoluteDir)) continue;
    const info = lstatSync(absoluteDir);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error(`Agent Skill ${directory}/ must be a non-symlink directory: ${absoluteDir}`);
    }
    visit(absoluteDir, directory);
  }
  return files;
}

async function readCompanionFilesAsync(
  skillDir: string,
  name: string,
  rootSkillBytes: number,
): Promise<DocsPublishedAgentSkillFile[]> {
  const files: DocsPublishedAgentSkillFile[] = [];
  let totalBytes = rootSkillBytes;

  async function visit(absoluteDir: string, relativeDir: string, depth = 0): Promise<void> {
    if (depth > MAX_COLLECTION_DEPTH) {
      throw new Error(
        `Agent Skill companion tree exceeds ${MAX_COLLECTION_DEPTH} levels: ${skillDir}`,
      );
    }
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const absolutePath = path.join(absoluteDir, entry.name);
      const relativePath = path.posix.join(relativeDir, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Agent Skill companion files may not be symlinks: ${absolutePath}`);
      }
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath, depth + 1);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`Unsafe filesystem entry in Agent Skill: ${absolutePath}`);
      }
      const executable = ((await stat(absolutePath)).mode & 0o111) !== 0;
      const content = await readFile(absolutePath);
      if (content.byteLength > MAX_FILE_BYTES) {
        throw new Error(`Agent Skill file exceeds ${MAX_FILE_BYTES} bytes: ${absolutePath}`);
      }
      totalBytes += content.byteLength;
      if (totalBytes > MAX_SKILL_BYTES || files.length >= MAX_FILES_PER_SKILL - 1) {
        throw new Error(`Agent Skill exceeds safe publication limits: ${skillDir}`);
      }
      const mediaType = mediaTypeFor(relativePath);
      const value = preserveFileBytes(content, mediaType);
      const sha256 = hashBytes(value);
      files.push({
        path: relativePath,
        url: encodeSkillFileUrl(name, relativePath),
        mediaType,
        content: value,
        sha256,
        digest: `sha256:${sha256}`,
        executable,
      });
    }
  }

  for (const directory of [...COMPANION_DIRECTORIES].sort()) {
    const absoluteDir = path.join(skillDir, directory);
    if (!(await pathExists(absoluteDir))) continue;
    const info = await lstat(absoluteDir);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error(`Agent Skill ${directory}/ must be a non-symlink directory: ${absoluteDir}`);
    }
    await visit(absoluteDir, directory);
  }
  return files;
}

function writeTarString(header: Uint8Array, offset: number, length: number, value: string): void {
  const encoded = Buffer.from(value, "utf8");
  if (encoded.byteLength > length)
    throw new Error(`Agent Skill archive path is too long: ${value}`);
  header.set(encoded, offset);
}

function writeTarOctal(header: Uint8Array, offset: number, length: number, value: number): void {
  writeTarString(header, offset, length, value.toString(8).padStart(length - 1, "0"));
}

function createTarHeader(name: string, size: number, executable: boolean): Uint8Array {
  const header = new Uint8Array(512);
  writeTarString(header, 0, 100, name);
  writeTarOctal(header, 100, 8, executable ? 0o755 : 0o644);
  writeTarOctal(header, 108, 8, 0);
  writeTarOctal(header, 116, 8, 0);
  writeTarOctal(header, 124, 12, size);
  writeTarOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeTarString(header, 257, 6, "ustar");
  writeTarString(header, 263, 2, "00");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeTarString(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
  return header;
}

function createDeterministicTar(files: DocsPublishedAgentSkillFile[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (const file of [...files].sort(compareSkillFilePath)) {
    const content = typeof file.content === "string" ? Buffer.from(file.content) : file.content;
    const header = createTarHeader(file.path, content.byteLength, file.executable === true);
    chunks.push(header, content);
    total += header.byteLength + content.byteLength;
    const padding = (512 - (content.byteLength % 512)) % 512;
    if (padding) {
      chunks.push(new Uint8Array(padding));
      total += padding;
    }
  }
  chunks.push(new Uint8Array(1024));
  total += 1024;
  const tar = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    tar.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return tar;
}

function normalizeGzipArchive(content: Uint8Array): Uint8Array {
  const archive = new Uint8Array(content);
  if (archive.byteLength > 9) archive[9] = 255;
  return archive;
}

function createDeterministicTarGzip(files: DocsPublishedAgentSkillFile[]): Uint8Array {
  return normalizeGzipArchive(gzipSync(createDeterministicTar(files), { level: 9 }));
}

function createDeterministicTarGzipAsync(
  files: DocsPublishedAgentSkillFile[],
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    gzip(createDeterministicTar(files), { level: 9 }, (error, content) => {
      if (error) reject(error);
      else resolve(normalizeGzipArchive(content));
    });
  });
}

function publishSkillDocumentSync(skillPath: string): DocsPublishedAgentSkill {
  const skillDir = path.dirname(skillPath);
  const skillDocument = readFileSync(skillPath, "utf8");
  const skillDocumentBytes = Buffer.byteLength(skillDocument, "utf8");
  if (skillDocumentBytes > MAX_FILE_BYTES) {
    throw new Error(`Agent Skill SKILL.md exceeds ${MAX_FILE_BYTES} bytes: ${skillPath}`);
  }
  const base = buildDocsPublishedAgentSkill(skillDocument, hashBytes(skillDocument));
  if (base.name !== path.basename(skillDir)) {
    throw new Error(
      `Agent Skill frontmatter name "${base.name}" must match its directory "${path.basename(skillDir)}".`,
    );
  }
  const companions = readCompanionFiles(skillDir, base.name, skillDocumentBytes);
  const files = [...base.files, ...companions].sort(compareSkillFilePath);
  if (companions.length === 0) return { ...base, files };

  const content = createDeterministicTarGzip(files);
  const sha256 = hashBytes(content);
  return {
    name: base.name,
    type: "archive",
    description: base.description,
    url: `${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/${encodeURIComponent(base.name)}.tar.gz`,
    digest: `sha256:${sha256}`,
    content,
    sha256,
    skillDocument,
    files,
  };
}

async function publishSkillDocumentAsync(skillPath: string): Promise<DocsPublishedAgentSkill> {
  const skillDir = path.dirname(skillPath);
  const skillDocument = await readFile(skillPath, "utf8");
  const skillDocumentBytes = Buffer.byteLength(skillDocument, "utf8");
  if (skillDocumentBytes > MAX_FILE_BYTES) {
    throw new Error(`Agent Skill SKILL.md exceeds ${MAX_FILE_BYTES} bytes: ${skillPath}`);
  }
  const base = buildDocsPublishedAgentSkill(skillDocument, hashBytes(skillDocument));
  if (base.name !== path.basename(skillDir)) {
    throw new Error(
      `Agent Skill frontmatter name "${base.name}" must match its directory "${path.basename(skillDir)}".`,
    );
  }
  const companions = await readCompanionFilesAsync(skillDir, base.name, skillDocumentBytes);
  const files = [...base.files, ...companions].sort(compareSkillFilePath);
  if (companions.length === 0) return { ...base, files };

  const content = await createDeterministicTarGzipAsync(files);
  const sha256 = hashBytes(content);
  return {
    name: base.name,
    type: "archive",
    description: base.description,
    url: `${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/${encodeURIComponent(base.name)}.tar.gz`,
    digest: `sha256:${sha256}`,
    content,
    sha256,
    skillDocument,
    files,
  };
}

function validateAndSortSkills(published: DocsPublishedAgentSkill[]): DocsPublishedAgentSkill[] {
  const names = new Set<string>();
  for (const skill of published) {
    if (names.has(skill.name))
      throw new Error(`Duplicate configured Agent Skill name: ${skill.name}`);
    names.add(skill.name);
  }
  return published.sort((left, right) => left.name.localeCompare(right.name));
}

/** Resolve and safely package all project skills configured through `agent.skills` synchronously. */
export function resolveConfiguredAgentSkillsSync(
  input: DocsAgentSkillsInput | undefined,
  options: ResolveConfiguredAgentSkillsOptions = {},
): DocsPublishedAgentSkill[] {
  const configuredPaths = normalizeConfiguredPaths(input);
  if (configuredPaths.length === 0) return [];

  const rootDir = realpathSync(options.rootDir ?? process.cwd());
  const workspaceRoot = realpathSync(options.workspaceRoot ?? findWorkspaceRoot(rootDir));
  if (!isInside(workspaceRoot, rootDir)) {
    throw new Error("Agent Skill rootDir must stay inside the configured workspace root.");
  }

  const documents = new Set<string>();
  const visited = new Set<string>();
  for (const configuredPath of configuredPaths) {
    collectSkillDocuments(
      resolveSafeConfiguredPath(configuredPath, rootDir, workspaceRoot),
      workspaceRoot,
      documents,
      visited,
    );
  }

  const published = [...documents].sort().map(publishSkillDocumentSync);
  return validateAndSortSkills(published);
}

/** Resolve and package configured skills without blocking runtime filesystem or compression work. */
export async function resolveConfiguredAgentSkills(
  input: DocsAgentSkillsInput | undefined,
  options: ResolveConfiguredAgentSkillsOptions = {},
): Promise<DocsPublishedAgentSkill[]> {
  const configuredPaths = normalizeConfiguredPaths(input);
  if (configuredPaths.length === 0) return [];

  const rootDir = await realpath(options.rootDir ?? process.cwd());
  const workspaceRoot =
    options.workspaceRoot === undefined
      ? await findWorkspaceRootAsync(rootDir)
      : await realpath(options.workspaceRoot);
  if (!isInside(workspaceRoot, rootDir)) {
    throw new Error("Agent Skill rootDir must stay inside the configured workspace root.");
  }

  const documents = new Set<string>();
  const visited = new Set<string>();
  for (const configuredPath of configuredPaths) {
    await collectSkillDocumentsAsync(
      await resolveSafeConfiguredPathAsync(configuredPath, rootDir, workspaceRoot),
      workspaceRoot,
      documents,
      visited,
    );
  }

  const published = await Promise.all([...documents].sort().map(publishSkillDocumentAsync));
  return validateAndSortSkills(published);
}
