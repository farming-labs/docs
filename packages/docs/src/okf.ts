import type {
  DocsOkfActorTimestamp,
  DocsOkfConfig,
  DocsOkfSource,
  DocsOkfStatus,
  DocsOkfTrustMetadata,
  DocsOkfTrustMetadataInput,
  DocsOkfTrustTier,
} from "./types.js";

export const DOCS_OKF_VERSION = "0.2";
export const DOCS_OKF_BUNDLE_FORMAT = "open-knowledge-format.v0.2";
export const DEFAULT_DOCS_OKF_ROUTE = "/.well-known/okf.json";

export interface DocsOkfPageLike {
  url: string;
  title: string;
  canonicalUrl?: string;
  sourcePath?: string;
  lastModified?: string;
  lastmod?: string;
  okf?: DocsOkfTrustMetadataInput;
}

export interface DocsOkfResolvedConfig extends DocsOkfTrustMetadataInput {
  enabled: boolean;
  route: string;
  generatedBy: string;
  staleAfterDays?: number;
}

export interface DocsOkfKnowledgeDocument {
  id: string;
  url: string;
  title: string;
  content?: string;
  trust: DocsOkfTrustMetadata;
}

export interface DocsOkfBundle {
  format: typeof DOCS_OKF_BUNDLE_FORMAT;
  spec_version: typeof DOCS_OKF_VERSION;
  generated: DocsOkfActorTimestamp;
  documents: DocsOkfKnowledgeDocument[];
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeDate(value: unknown): string | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  const stringValue = cleanString(value);
  if (!stringValue) return undefined;
  const parsed = new Date(stringValue);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
}

function normalizeDateOnly(value: unknown): string | undefined {
  const date = normalizeDate(value);
  return date?.slice(0, 10);
}

function normalizeStatus(value: unknown): DocsOkfStatus | undefined {
  return value === "draft" || value === "stable" || value === "deprecated" ? value : undefined;
}

function normalizeActorTimestamp(value: unknown): DocsOkfActorTimestamp | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const by = cleanString(record.by);
  const at = normalizeDate(record.at);
  return by && at ? { by, at } : undefined;
}

function normalizeSource(value: unknown): DocsOkfSource | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const resource = cleanString(record.resource);
  if (!resource) return undefined;
  const usageCount =
    typeof record.usage_count === "number" && Number.isInteger(record.usage_count)
      ? Math.max(0, record.usage_count)
      : undefined;
  const usageWindowRecord =
    record.usage_window &&
    typeof record.usage_window === "object" &&
    !Array.isArray(record.usage_window)
      ? (record.usage_window as Record<string, unknown>)
      : undefined;
  const usageWindow = usageWindowRecord
    ? {
        ...(normalizeDate(usageWindowRecord.start)
          ? { start: normalizeDate(usageWindowRecord.start) }
          : {}),
        ...(normalizeDate(usageWindowRecord.end)
          ? { end: normalizeDate(usageWindowRecord.end) }
          : {}),
      }
    : undefined;
  return {
    resource,
    ...(cleanString(record.id) ? { id: cleanString(record.id) } : {}),
    ...(cleanString(record.title) ? { title: cleanString(record.title) } : {}),
    ...(cleanString(record.author) ? { author: cleanString(record.author) } : {}),
    ...(usageCount !== undefined ? { usage_count: usageCount } : {}),
    ...(normalizeDate(record.last_modified)
      ? { last_modified: normalizeDate(record.last_modified) }
      : {}),
    ...(usageWindow && Object.keys(usageWindow).length > 0 ? { usage_window: usageWindow } : {}),
  };
}

export function normalizeDocsOkfTrustMetadataInput(
  value: unknown,
): DocsOkfTrustMetadataInput | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const sources = Array.isArray(record.sources)
    ? record.sources.flatMap((source) => {
        const normalized = normalizeSource(source);
        return normalized ? [normalized] : [];
      })
    : undefined;
  const verified = Array.isArray(record.verified)
    ? record.verified.flatMap((entry) => {
        const normalized = normalizeActorTimestamp(entry);
        return normalized ? [normalized] : [];
      })
    : undefined;
  const generated = normalizeActorTimestamp(record.generated);
  const status = normalizeStatus(record.status);
  const staleAfter = normalizeDateOnly(record.stale_after);
  const result: DocsOkfTrustMetadataInput = {
    ...(sources && sources.length > 0 ? { sources } : {}),
    ...(generated ? { generated } : {}),
    ...(verified && verified.length > 0 ? { verified } : {}),
    ...(status ? { status } : {}),
    ...(staleAfter ? { stale_after: staleAfter } : {}),
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

export function resolveDocsOkfConfig(value?: boolean | DocsOkfConfig): DocsOkfResolvedConfig {
  const config = value && typeof value === "object" ? value : {};
  return {
    enabled:
      value === true || (typeof value === "object" && value !== null && value.enabled !== false),
    route: cleanString(config.route) ?? DEFAULT_DOCS_OKF_ROUTE,
    generatedBy: cleanString(config.generatedBy) ?? "software:@farming-labs/docs",
    ...(Number.isInteger(config.staleAfterDays) && (config.staleAfterDays ?? 0) > 0
      ? { staleAfterDays: config.staleAfterDays }
      : {}),
    ...normalizeDocsOkfTrustMetadataInput(config),
  };
}

function addDays(value: string, days: number): string | undefined {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function trustTier(verified: readonly DocsOkfActorTimestamp[]): DocsOkfTrustTier {
  if (verified.some((entry) => entry.by.toLowerCase().startsWith("human:"))) {
    return "human-reviewed";
  }
  return verified.length > 0 ? "machine-confirmed" : "unverified";
}

export function resolveDocsOkfTrustMetadata(
  page: DocsOkfPageLike,
  value?: boolean | DocsOkfConfig,
  now = new Date(),
): DocsOkfTrustMetadata {
  const config = resolveDocsOkfConfig(value);
  const authored = normalizeDocsOkfTrustMetadataInput(page.okf) ?? {};
  const bestTimestamp = normalizeDate(page.lastmod) ?? normalizeDate(page.lastModified);
  const generated = authored.generated ??
    config.generated ?? {
      by: config.generatedBy,
      at: bestTimestamp ?? "1970-01-01T00:00:00.000Z",
    };
  const sources = [...(authored.sources ?? config.sources ?? [])];
  if (sources.length === 0) {
    sources.push({
      resource: page.canonicalUrl ?? page.url,
      ...(page.sourcePath ? { id: page.sourcePath } : {}),
      title: page.title,
      ...(bestTimestamp ? { last_modified: bestTimestamp } : {}),
    });
  }
  const verified = [...(authored.verified ?? config.verified ?? [])];
  const staleAfter =
    authored.stale_after ??
    config.stale_after ??
    (config.staleAfterDays && bestTimestamp
      ? addDays(bestTimestamp, config.staleAfterDays)
      : undefined);
  return {
    sources,
    generated,
    verified,
    status: authored.status ?? config.status ?? "stable",
    ...(staleAfter ? { stale_after: staleAfter } : {}),
    trust_tier: trustTier(verified),
    stale: staleAfter ? now.getTime() > new Date(`${staleAfter}T23:59:59.999Z`).getTime() : false,
  };
}

export function buildDocsOkfBundle(
  pages: readonly (DocsOkfPageLike & { content?: string })[],
  value?: boolean | DocsOkfConfig,
): DocsOkfBundle {
  const config = resolveDocsOkfConfig(value);
  const documents = pages
    .map((page) => ({
      id: page.sourcePath ?? page.url,
      url: page.canonicalUrl ?? page.url,
      title: page.title,
      ...(page.content ? { content: page.content } : {}),
      trust: resolveDocsOkfTrustMetadata(page, config),
    }))
    .sort((left, right) => left.url.localeCompare(right.url));
  const generatedAt = documents.reduce(
    (latest, document) =>
      document.trust.generated.at > latest ? document.trust.generated.at : latest,
    "1970-01-01T00:00:00.000Z",
  );
  return {
    format: DOCS_OKF_BUNDLE_FORMAT,
    spec_version: DOCS_OKF_VERSION,
    generated: { by: config.generatedBy, at: generatedAt },
    documents,
  };
}
