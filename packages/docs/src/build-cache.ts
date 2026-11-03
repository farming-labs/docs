import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

interface Entry {
  key: string;
  value: string;
  checksum: string;
}

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 1_024;

export function docsBuildCacheDigest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface DocsBuildCacheOptions {
  maxBytes?: number;
  maxEntries?: number;
  validate?: (value: unknown) => boolean;
}

/** Persistent cache for deterministic, JSON-serializable build output. */
export class DocsBuildCache<T> {
  private readonly entries = new Map<string, Entry>();
  private readonly entryBytes = new Map<string, number>();
  private readonly unvisited = new Set<string>();
  private readonly pending = new Map<string, Promise<string | undefined>>();
  private admissionBlocked = false;
  private loaded?: Promise<void>;
  private bytes = 0;
  private revision = 0;
  private persistedRevision = 0;
  private flushing?: Promise<void>;

  private readonly maxBytes: number;
  private readonly maxEntries: number;

  constructor(
    private readonly file: string,
    private readonly options: DocsBuildCacheOptions = {},
  ) {
    this.maxBytes = options.maxBytes ?? MAX_BYTES;
    this.maxEntries = options.maxEntries ?? MAX_ENTRIES;
  }

  private remember(id: string, entry: Entry) {
    const size = Buffer.byteLength(JSON.stringify([id, entry]));
    if (size > this.maxBytes || this.maxEntries < 1) return false;
    let bytes = this.bytes - (this.entryBytes.get(id) ?? 0) + size;
    let count = this.entries.size + (this.entries.has(id) ? 0 : 1);
    const evictions: string[] = [];
    for (const candidate of this.entries.keys()) {
      if (bytes <= this.maxBytes && count <= this.maxEntries) break;
      // An early miss in a sequential build must not evict last build's pages
      // before they have had a chance to hit. The output still compiles normally.
      if (candidate === id || this.unvisited.has(candidate)) continue;
      evictions.push(candidate);
      bytes -= this.entryBytes.get(candidate) ?? 0;
      count -= 1;
    }
    if (bytes > this.maxBytes || count > this.maxEntries) {
      this.admissionBlocked = true;
      return false;
    }
    for (const candidate of evictions) {
      this.entries.delete(candidate);
      this.entryBytes.delete(candidate);
    }
    this.entries.delete(id);
    this.entries.set(id, entry);
    this.entryBytes.set(id, size);
    this.bytes = bytes;
    return true;
  }

  private async load() {
    try {
      if ((await fs.stat(this.file)).size > this.maxBytes + 64 * 1024) return;
      const data: unknown = JSON.parse(await fs.readFile(this.file, "utf8"));
      if (!Array.isArray(data)) return;
      for (const item of data) {
        if (
          !Array.isArray(item) ||
          typeof item[0] !== "string" ||
          typeof item[1]?.key !== "string" ||
          typeof item[1]?.value !== "string" ||
          item[1]?.checksum !== docsBuildCacheDigest(item[1].value)
        )
          continue;
        const result = JSON.parse(item[1].value);
        if (!this.options.validate || this.options.validate(result))
          this.remember(item[0], item[1]);
      }
      for (const id of this.entries.keys()) this.unvisited.add(id);
    } catch {
      // Missing, incompatible, truncated or unreadable caches are ordinary misses.
      this.entries.clear();
      this.entryBytes.clear();
      this.unvisited.clear();
      this.bytes = 0;
    }
  }

  async compile(id: string, key: string, compile: () => T | Promise<T>): Promise<T> {
    await (this.loaded ??= this.load());
    this.unvisited.delete(id);
    const entry = this.entries.get(id);
    if (entry?.key === key) {
      // Refresh eviction order without serializing unchanged compiled output.
      this.entries.delete(id);
      this.entries.set(id, entry);
      return JSON.parse(entry.value);
    }
    const pendingKey = JSON.stringify([id, key]);
    let pending = this.pending.get(pendingKey);
    if (!pending) {
      pending = Promise.resolve()
        .then(compile)
        .then((result) => {
          // Undefined means the build stage skipped this input.
          if (result === undefined) return undefined;
          const value = JSON.stringify(result);
          if (this.remember(id, { key, value, checksum: docsBuildCacheDigest(value) })) {
            this.revision += 1;
          }
          return value;
        })
        .finally(() => this.pending.delete(pendingKey));
      this.pending.set(pendingKey, pending);
    }
    // Build stages may mutate their output: never share cached objects.
    const value = await pending;
    return value === undefined ? (undefined as T) : JSON.parse(value);
  }

  async flush(): Promise<void> {
    if (!this.loaded) return;
    await this.loaded;
    // Multiple build stages can finish together. An older snapshot must
    // finish before a newer one, or its rename could discard the newer entries.
    while (this.flushing) await this.flushing;
    if (this.admissionBlocked) {
      // Reclaim unused old pages at the build boundary so a replaced corpus can
      // populate the cache on the next build instead of being excluded forever.
      for (const id of this.unvisited) {
        this.entries.delete(id);
        this.bytes -= this.entryBytes.get(id) ?? 0;
        this.entryBytes.delete(id);
        this.revision += 1;
      }
      this.unvisited.clear();
      this.admissionBlocked = false;
    }
    if (this.persistedRevision === this.revision) return;
    const revision = this.revision;
    const flushing = this.writeSnapshot(JSON.stringify([...this.entries])).then((saved) => {
      if (saved) this.persistedRevision = revision;
    });
    this.flushing = flushing;
    try {
      await flushing;
    } finally {
      if (this.flushing === flushing) this.flushing = undefined;
    }
  }

  private async writeSnapshot(snapshot: string): Promise<boolean> {
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(temporary, snapshot);
      await fs.rename(temporary, this.file);
      return true;
    } catch {
      // Keep the revision dirty so a later flush can retry a failed write.
      return false;
    } finally {
      await fs.unlink(temporary).catch(() => undefined);
    }
  }
}
