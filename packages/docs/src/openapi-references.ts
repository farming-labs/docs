import { createHash } from "node:crypto";

export const OPENAPI_BUNDLED_REFERENCES_EXTENSION = "x-farming-labs-references";
export const OPENAPI_REFERENCE_MAX_DOCUMENTS = 32;

export interface OpenApiReferenceDocument {
  uri: string;
  document: unknown;
}

export interface ResolveOpenApiReferencesSyncOptions {
  sourceUri: string;
  maxDocuments?: number;
  loadDocument?: (uri: URL, fromUri: URL) => OpenApiReferenceDocument;
}

export interface ResolveOpenApiReferencesOptions {
  sourceUri: string;
  maxDocuments?: number;
  loadDocument?: (uri: URL, fromUri: URL) => Promise<OpenApiReferenceDocument>;
}

interface DocumentState {
  retrievalUri: string;
  baseUri: string;
  document: unknown;
  entry: boolean;
  bundleKey?: string;
  output?: unknown;
  processing: boolean;
  processed: boolean;
}

export function resolveOpenApiReferencesSync(
  document: Record<string, unknown>,
  options: ResolveOpenApiReferencesSyncOptions,
): Record<string, unknown> {
  const sourceUri = normalizeDocumentUri(options.sourceUri);
  const entry = createDocumentState({ uri: sourceUri, document }, true);
  const documents = new Map<string, DocumentState>();
  registerDocument(documents, entry, sourceUri);
  const bundle: Record<string, unknown> = {};
  const maxDocuments = normalizeMaxDocuments(options.maxDocuments);

  const getDocument = (requestedUri: string, fromUri: string): DocumentState => {
    const normalizedRequest = normalizeDocumentUri(requestedUri);
    const cached = documents.get(normalizedRequest);
    if (cached) return cached;
    if (!options.loadDocument) {
      throw new Error(`OpenAPI reference requires an external document: ${normalizedRequest}`);
    }
    if (countDocuments(documents) >= maxDocuments) {
      throw new Error(`OpenAPI references exceed the ${maxDocuments}-document limit.`);
    }
    const loaded = options.loadDocument(new URL(normalizedRequest), new URL(fromUri));
    const state = createDocumentState(loaded, false);
    registerDocument(documents, state, normalizedRequest);
    return state;
  };

  const processDocument = (state: DocumentState): unknown => {
    if (state.processed || state.processing) return state.output;
    state.processing = true;
    state.output = structuredClone(state.document);
    if (!state.entry) {
      state.bundleKey = createBundleKey(state.retrievalUri);
      bundle[state.bundleKey] = state.output;
    }
    rewriteReferencesSync(state.output, state, getDocument, processDocument);
    state.processing = false;
    state.processed = true;
    return state.output;
  };

  const output = processDocument(entry);
  if (!isRecord(output)) throw new Error("The OpenAPI entry document must be an object.");
  if (Object.keys(bundle).length > 0) {
    if (Object.hasOwn(output, OPENAPI_BUNDLED_REFERENCES_EXTENSION)) {
      throw new Error(
        `The OpenAPI document uses the reserved \`${OPENAPI_BUNDLED_REFERENCES_EXTENSION}\` extension.`,
      );
    }
    output[OPENAPI_BUNDLED_REFERENCES_EXTENSION] = bundle;
  }
  return output;
}

export async function resolveOpenApiReferences(
  document: Record<string, unknown>,
  options: ResolveOpenApiReferencesOptions,
): Promise<Record<string, unknown>> {
  const sourceUri = normalizeDocumentUri(options.sourceUri);
  const entry = createDocumentState({ uri: sourceUri, document }, true);
  const documents = new Map<string, DocumentState>();
  registerDocument(documents, entry, sourceUri);
  const bundle: Record<string, unknown> = {};
  const maxDocuments = normalizeMaxDocuments(options.maxDocuments);

  const getDocument = async (requestedUri: string, fromUri: string): Promise<DocumentState> => {
    const normalizedRequest = normalizeDocumentUri(requestedUri);
    const cached = documents.get(normalizedRequest);
    if (cached) return cached;
    if (!options.loadDocument) {
      throw new Error(`OpenAPI reference requires an external document: ${normalizedRequest}`);
    }
    if (countDocuments(documents) >= maxDocuments) {
      throw new Error(`OpenAPI references exceed the ${maxDocuments}-document limit.`);
    }
    const loaded = await options.loadDocument(new URL(normalizedRequest), new URL(fromUri));
    const state = createDocumentState(loaded, false);
    registerDocument(documents, state, normalizedRequest);
    return state;
  };

  const processDocument = async (state: DocumentState): Promise<unknown> => {
    if (state.processed || state.processing) return state.output;
    state.processing = true;
    state.output = structuredClone(state.document);
    if (!state.entry) {
      state.bundleKey = createBundleKey(state.retrievalUri);
      bundle[state.bundleKey] = state.output;
    }
    await rewriteReferences(state.output, state, getDocument, processDocument);
    state.processing = false;
    state.processed = true;
    return state.output;
  };

  const output = await processDocument(entry);
  if (!isRecord(output)) throw new Error("The OpenAPI entry document must be an object.");
  if (Object.keys(bundle).length > 0) {
    if (Object.hasOwn(output, OPENAPI_BUNDLED_REFERENCES_EXTENSION)) {
      throw new Error(
        `The OpenAPI document uses the reserved \`${OPENAPI_BUNDLED_REFERENCES_EXTENSION}\` extension.`,
      );
    }
    output[OPENAPI_BUNDLED_REFERENCES_EXTENSION] = bundle;
  }
  return output;
}

function rewriteReferencesSync(
  value: unknown,
  currentDocument: DocumentState,
  getDocument: (uri: string, fromUri: string) => DocumentState,
  processDocument: (state: DocumentState) => unknown,
  ancestors = new WeakSet<object>(),
): void {
  if (!value || typeof value !== "object") return;
  if (ancestors.has(value)) {
    throw new Error("OpenAPI source documents cannot contain cyclic YAML aliases.");
  }
  ancestors.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      rewriteReferencesSync(item, currentDocument, getDocument, processDocument, ancestors);
    }
    ancestors.delete(value);
    return;
  }

  const record = value as Record<string, unknown>;
  if (Object.hasOwn(record, "$ref")) {
    record.$ref = rewriteReferenceSync(record.$ref, currentDocument, getDocument, processDocument);
  }
  for (const [key, child] of Object.entries(record)) {
    if (key === "$ref") continue;
    rewriteReferencesSync(child, currentDocument, getDocument, processDocument, ancestors);
  }
  ancestors.delete(value);
}

async function rewriteReferences(
  value: unknown,
  currentDocument: DocumentState,
  getDocument: (uri: string, fromUri: string) => Promise<DocumentState>,
  processDocument: (state: DocumentState) => Promise<unknown>,
  ancestors = new WeakSet<object>(),
): Promise<void> {
  if (!value || typeof value !== "object") return;
  if (ancestors.has(value)) {
    throw new Error("OpenAPI source documents cannot contain cyclic YAML aliases.");
  }
  ancestors.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      await rewriteReferences(item, currentDocument, getDocument, processDocument, ancestors);
    }
    ancestors.delete(value);
    return;
  }

  const record = value as Record<string, unknown>;
  if (Object.hasOwn(record, "$ref")) {
    record.$ref = await rewriteReference(
      record.$ref,
      currentDocument,
      getDocument,
      processDocument,
    );
  }
  for (const [key, child] of Object.entries(record)) {
    if (key === "$ref") continue;
    await rewriteReferences(child, currentDocument, getDocument, processDocument, ancestors);
  }
  ancestors.delete(value);
}

function rewriteReferenceSync(
  reference: unknown,
  currentDocument: DocumentState,
  getDocument: (uri: string, fromUri: string) => DocumentState,
  processDocument: (state: DocumentState) => unknown,
): string {
  const target = resolveReference(reference, currentDocument.baseUri);
  const targetDocument = getDocument(target.documentUri, currentDocument.baseUri);
  assertReferenceTarget(targetDocument.document, target.pointer, reference);
  processDocument(targetDocument);
  return buildBundledReference(targetDocument, target.pointer);
}

async function rewriteReference(
  reference: unknown,
  currentDocument: DocumentState,
  getDocument: (uri: string, fromUri: string) => Promise<DocumentState>,
  processDocument: (state: DocumentState) => Promise<unknown>,
): Promise<string> {
  const target = resolveReference(reference, currentDocument.baseUri);
  const targetDocument = await getDocument(target.documentUri, currentDocument.baseUri);
  assertReferenceTarget(targetDocument.document, target.pointer, reference);
  await processDocument(targetDocument);
  return buildBundledReference(targetDocument, target.pointer);
}

function resolveReference(
  reference: unknown,
  baseUri: string,
): { documentUri: string; pointer: string } {
  if (typeof reference !== "string" || !reference.trim()) {
    throw new Error("OpenAPI `$ref` values must be non-empty URI strings.");
  }

  let url: URL;
  try {
    url = new URL(reference, baseUri);
  } catch {
    throw new Error(`OpenAPI reference is not a valid URI: ${reference}`);
  }

  const pointer = normalizePointerFragment(url.hash, reference);
  url.hash = "";
  return { documentUri: url.href, pointer };
}

function normalizePointerFragment(hash: string, reference: unknown): string {
  if (!hash || hash === "#") return "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(hash.slice(1));
  } catch {
    throw new Error(`OpenAPI reference has an invalid encoded fragment: ${String(reference)}`);
  }
  if (!decoded.startsWith("/")) {
    throw new Error(
      `OpenAPI reference anchors are not supported yet; use a JSON Pointer fragment: ${String(reference)}`,
    );
  }
  return decoded;
}

function assertReferenceTarget(document: unknown, pointer: string, reference: unknown): void {
  if (!pointer) return;
  let current = document;
  for (const token of pointer.slice(1).split("/")) {
    if (!current || typeof current !== "object") {
      throw new Error(`OpenAPI reference target was not found: ${String(reference)}`);
    }
    const key = decodeJsonPointerToken(token, reference);
    if (!Object.hasOwn(current, key)) {
      throw new Error(`OpenAPI reference target was not found: ${String(reference)}`);
    }
    current = (current as Record<string, unknown>)[key];
  }
}

function decodeJsonPointerToken(token: string, reference: unknown): string {
  if (/~(?:[^01]|$)/.test(token)) {
    throw new Error(`OpenAPI reference has an invalid JSON Pointer fragment: ${String(reference)}`);
  }
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

function buildBundledReference(document: DocumentState, pointer: string): string {
  if (document.entry) return `#${pointer}`;
  if (!document.bundleKey) {
    throw new Error(`OpenAPI reference document was not bundled: ${document.retrievalUri}`);
  }
  return `#/${OPENAPI_BUNDLED_REFERENCES_EXTENSION}/${escapeJsonPointer(document.bundleKey)}${pointer}`;
}

function createDocumentState(loaded: OpenApiReferenceDocument, entry: boolean): DocumentState {
  const retrievalUri = normalizeDocumentUri(loaded.uri);
  const self = isRecord(loaded.document) ? loaded.document.$self : undefined;
  let baseUri = retrievalUri;
  if (typeof self === "string" && self.trim()) {
    try {
      baseUri = normalizeDocumentUri(new URL(self, retrievalUri).href);
    } catch {
      throw new Error(`OpenAPI document has an invalid \`$self\` URI: ${self}`);
    }
  }
  return {
    retrievalUri,
    baseUri,
    document: loaded.document,
    entry,
    processing: false,
    processed: false,
  };
}

function registerDocument(
  documents: Map<string, DocumentState>,
  document: DocumentState,
  requestedUri: string,
): void {
  for (const uri of [requestedUri, document.retrievalUri, document.baseUri]) {
    const normalized = normalizeDocumentUri(uri);
    const existing = documents.get(normalized);
    if (existing && existing !== document) {
      throw new Error(`Multiple OpenAPI documents claim the same base URI: ${normalized}`);
    }
    documents.set(normalized, document);
  }
}

function countDocuments(documents: Map<string, DocumentState>): number {
  return new Set(documents.values()).size;
}

function normalizeDocumentUri(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return url.href;
}

function normalizeMaxDocuments(value?: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : OPENAPI_REFERENCE_MAX_DOCUMENTS;
}

function createBundleKey(uri: string): string {
  return `ref-${createHash("sha256").update(uri).digest("hex").slice(0, 16)}`;
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
