export const GENERATED_AGENT_PROVENANCE_MARKER = "@farming-labs/docs:generated";
export const GENERATED_AGENT_PROVENANCE_VERSION = 1;

export type GeneratedAgentSourceKind = "resolved-page" | "agent-md";

export interface GeneratedAgentProvenance {
  version: number;
  sourceKind: GeneratedAgentSourceKind;
  sourceHash: string;
  settingsHash: string;
  outputHash: string;
  generatedAt: string;
}

export interface ParsedGeneratedAgentDocument {
  provenance?: GeneratedAgentProvenance;
  content: string;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
}

export function normalizeGeneratedAgentContent(value: string): string {
  return normalizeLineEndings(value).trimEnd();
}

export function hashGeneratedAgentContent(value: string): string {
  const normalized = normalizeGeneratedAgentContent(value);
  const bytes = new TextEncoder().encode(normalized);
  let hash = 0xcbf29ce484222325n;

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }

  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function parseProvenanceBlock(rawBlock: string): GeneratedAgentProvenance | undefined {
  const entries = new Map<string, string>();

  for (const line of rawBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || !value) continue;
    entries.set(key, value);
  }

  const version = Number.parseInt(entries.get("version") ?? "", 10);
  const sourceKind = entries.get("sourceKind");
  const sourceHash = entries.get("sourceHash");
  const settingsHash = entries.get("settingsHash");
  const outputHash = entries.get("outputHash");
  const generatedAt = entries.get("generatedAt");

  if (
    !Number.isFinite(version) ||
    (sourceKind !== "resolved-page" && sourceKind !== "agent-md") ||
    !sourceHash ||
    !settingsHash ||
    !outputHash ||
    !generatedAt
  ) {
    return undefined;
  }

  return {
    version,
    sourceKind,
    sourceHash,
    settingsHash,
    outputHash,
    generatedAt,
  };
}

export function parseGeneratedAgentDocument(raw: string): ParsedGeneratedAgentDocument {
  const normalized = normalizeLineEndings(raw);
  const headerPattern = new RegExp(
    `^<!-- ${GENERATED_AGENT_PROVENANCE_MARKER}\\n([\\s\\S]*?)\\n-->\\n?`,
  );
  const match = normalized.match(headerPattern);

  if (!match) {
    return {
      content: normalized,
    };
  }

  return {
    provenance: parseProvenanceBlock(match[1]),
    content: normalized.slice(match[0].length),
  };
}

export function stripGeneratedAgentProvenance(raw: string): string {
  return parseGeneratedAgentDocument(raw).content;
}

export function serializeGeneratedAgentDocument(
  content: string,
  provenance: GeneratedAgentProvenance,
): string {
  const normalizedContent = normalizeGeneratedAgentContent(content);
  const lines = [
    `<!-- ${GENERATED_AGENT_PROVENANCE_MARKER}`,
    `version=${provenance.version}`,
    `sourceKind=${provenance.sourceKind}`,
    `sourceHash=${provenance.sourceHash}`,
    `settingsHash=${provenance.settingsHash}`,
    `outputHash=${provenance.outputHash}`,
    `generatedAt=${provenance.generatedAt}`,
    "-->",
    normalizedContent,
  ];

  return `${lines.join("\n")}\n`;
}
