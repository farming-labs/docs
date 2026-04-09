import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const FILE_EXTS = ["tsx", "ts", "jsx", "js"];

export function resolveDocsConfigPath(rootDir: string, explicitPath?: string): string {
  if (explicitPath) {
    const resolvedPath = resolve(rootDir, explicitPath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Could not find docs config at ${explicitPath}.`);
    }
    return resolvedPath;
  }

  for (const ext of FILE_EXTS) {
    const configPath = join(rootDir, `docs.config.${ext}`);
    if (existsSync(configPath)) return configPath;
  }

  throw new Error(
    "Could not find docs.config.ts or docs.config.tsx in the current project. Use --config to point at a custom path.",
  );
}

export function readStringProperty(content: string, key: string): string | undefined {
  const match = content.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`));
  return match?.[1];
}

export function readBooleanProperty(content: string, key: string): boolean | undefined {
  const match = content.match(new RegExp(`${key}\\s*:\\s*(true|false)`));
  return match ? match[1] === "true" : undefined;
}

export function extractObjectLiteral(content: string, key: string): string | undefined {
  const keyIndex = content.search(new RegExp(`${key}\\s*:\\s*\\{`));
  if (keyIndex === -1) return undefined;

  const braceStart = content.indexOf("{", keyIndex);
  if (braceStart === -1) return undefined;

  let depth = 0;

  for (let index = braceStart; index < content.length; index += 1) {
    const char = content[index];

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char !== "}") continue;

    depth -= 1;
    if (depth === 0) {
      return content.slice(braceStart + 1, index);
    }
  }

  return undefined;
}

export function readNavTitle(content: string): string | undefined {
  const block = extractObjectLiteral(content, "nav");
  if (!block) return undefined;
  return readStringProperty(block, "title");
}

export function resolveDocsContentDir(rootDir: string, content: string, entry: string): string {
  const configuredContentDir = readStringProperty(content, "contentDir");
  if (configuredContentDir) return configuredContentDir;

  const candidates = [entry, join("app", entry), join("src", "app", entry)];
  for (const candidate of candidates) {
    if (existsSync(join(rootDir, candidate))) {
      return candidate;
    }
  }

  return entry;
}

function parseEnvValue(rawValue: string): string {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function loadProjectEnv(rootDir: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const filename of [".env", ".env.local"]) {
    const fullPath = join(rootDir, filename);
    if (!existsSync(fullPath)) continue;

    const lines = readFileSync(fullPath, "utf-8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) continue;

      const key = trimmed.slice(0, equalsIndex).trim();
      const rawValue = trimmed.slice(equalsIndex + 1);
      if (!key) continue;

      env[key] = parseEnvValue(rawValue);
    }
  }

  return env;
}
