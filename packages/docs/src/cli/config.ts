import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DocsConfig } from "../types.js";

const FILE_EXTS = ["tsx", "ts", "jsx", "js"];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createPropertyPattern(key: string, valuePattern: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(key)}\\b\\s*:\\s*${valuePattern}`);
}

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
  const match = content.match(createPropertyPattern(key, `["']([^"']+)["']`));
  return match?.[1];
}

export function readEnvReferenceProperty(content: string, key: string): string | undefined {
  const patterns = [
    createPropertyPattern(key, `process\\.env\\.([A-Za-z_$][\\w$]*)`),
    createPropertyPattern(key, `process\\.env\\[['"]([^"'\\]]+)['"]\\]`),
    createPropertyPattern(key, `import\\.meta\\.env\\.([A-Za-z_$][\\w$]*)`),
    createPropertyPattern(key, `import\\.meta\\.env\\[['"]([^"'\\]]+)['"]\\]`),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) return match[1];
  }

  return undefined;
}

export function readBooleanProperty(content: string, key: string): boolean | undefined {
  const match = content.match(createPropertyPattern(key, "(true|false)"));
  return match ? match[1] === "true" : undefined;
}

export function readNumberProperty(content: string, key: string): number | undefined {
  const match = content.match(createPropertyPattern(key, "(-?\\d+(?:\\.\\d+)?)"));
  if (!match) return undefined;

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
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

export function extractTopLevelConfigObject(content: string): string | undefined {
  for (const marker of ["defineDocs(", "export default"]) {
    const markerIndex = content.indexOf(marker);
    if (markerIndex === -1) continue;

    const braceStart = content.indexOf("{", markerIndex);
    if (braceStart === -1) continue;

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
  }

  return undefined;
}

export function extractNestedObjectLiteral(content: string, keys: string[]): string | undefined {
  if (keys.length === 0) return undefined;

  let current = extractTopLevelConfigObject(content) ?? content;

  for (const key of keys) {
    const next = extractObjectLiteral(current, key);
    if (!next) return undefined;
    current = next;
  }

  return current;
}

function splitTopLevelProperties(content: string): string[] {
  const properties: string[] = [];
  let start = 0;
  let stringQuote: '"' | "'" | "`" | null = null;
  let escaped = false;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (stringQuote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === stringQuote) {
        stringQuote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      stringQuote = char;
      continue;
    }

    if (char === "{") {
      braceDepth += 1;
      continue;
    }

    if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }

    if (char === "[") {
      bracketDepth += 1;
      continue;
    }

    if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (char === "(") {
      parenDepth += 1;
      continue;
    }

    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (char === "," && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
      properties.push(content.slice(start, index));
      start = index + 1;
    }
  }

  const trailing = content.slice(start);
  if (trailing.trim().length > 0) properties.push(trailing);
  return properties;
}

export function readTopLevelStringProperty(content: string, key: string): string | undefined {
  const rootObject = extractTopLevelConfigObject(content);
  const source = rootObject ?? content;
  const propertyPattern = new RegExp(`^\\s*${escapeRegExp(key)}\\s*:\\s*["']([^"']+)["']`);

  for (const property of splitTopLevelProperties(source)) {
    const match = property.trim().match(propertyPattern);
    if (match) return match[1];
  }

  return undefined;
}

export function readNavTitle(content: string): string | undefined {
  const rootObject = extractTopLevelConfigObject(content) ?? content;
  const block = extractObjectLiteral(rootObject, "nav");
  if (!block) return undefined;
  return readStringProperty(block, "title");
}

export function resolveDocsContentDir(rootDir: string, content: string, entry: string): string {
  const configuredContentDir = readTopLevelStringProperty(content, "contentDir");
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

export async function loadDocsConfigModule(
  rootDir: string,
  explicitPath?: string,
): Promise<{ path: string; config: DocsConfig } | null> {
  const configPath = resolveDocsConfigPath(rootDir, explicitPath);

  try {
    const { createJiti } = await import("jiti");
    const jiti = createJiti(import.meta.url, {
      moduleCache: false,
      fsCache: false,
      interopDefault: true,
    });

    const loaded = await jiti.import(configPath);
    const config = ((loaded as { default?: unknown }).default ?? loaded) as DocsConfig | undefined;
    if (!config || typeof config !== "object") return null;

    return { path: configPath, config };
  } catch {
    return null;
  }
}
