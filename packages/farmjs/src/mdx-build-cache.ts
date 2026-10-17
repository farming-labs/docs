import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type mdx from "@mdx-js/rollup";

type CompiledMdx = Awaited<ReturnType<ReturnType<typeof mdx>["transform"]>>;

interface Entry {
  key: string;
  value: string;
  checksum: string;
}

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_ENTRIES = 1_024;

export function mdxCacheDigest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Only the adapter's deterministic MDX stage is cached, never the Vite graph. */
export class MdxBuildCache {
  private readonly entries = new Map<string, Entry>();
  private readonly entryBytes = new Map<string, number>();
  private readonly pending = new Map<string, Promise<string | undefined>>();
  private loaded?: Promise<void>;
  private bytes = 0;
  private revision = 0;
  private persistedRevision = 0;
  private flushing?: Promise<void>;

  constructor(
    private readonly file: string,
    private readonly maxBytes = MAX_BYTES,
    private readonly maxEntries = MAX_ENTRIES,
  ) {}

  private remember(id: string, entry: Entry) {
    this.bytes -= this.entryBytes.get(id) ?? 0;
    const size = Buffer.byteLength(JSON.stringify([id, entry]));
    this.entries.delete(id);
    this.entries.set(id, entry);
    this.entryBytes.set(id, size);
    this.bytes += size;
    while (this.bytes > this.maxBytes || this.entries.size > this.maxEntries) {
      const oldest = this.entries.entries().next().value;
      if (!oldest) break;
      this.entries.delete(oldest[0]);
      this.bytes -= this.entryBytes.get(oldest[0]) ?? 0;
      this.entryBytes.delete(oldest[0]);
    }
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
          item[1]?.checksum !== mdxCacheDigest(item[1].value)
        )
          continue;
        const result = JSON.parse(item[1].value);
        if (typeof result?.code === "string") this.remember(item[0], item[1]);
      }
    } catch {
      // Missing, incompatible, truncated or unreadable caches are ordinary misses.
      this.entries.clear();
      this.entryBytes.clear();
      this.bytes = 0;
    }
  }

  async compile(
    id: string,
    key: string,
    compile: () => Promise<CompiledMdx>,
  ): Promise<CompiledMdx> {
    await (this.loaded ??= this.load());
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
          // The upstream filter deliberately skips some IDs, including virtual modules.
          if (result === undefined) return undefined;
          const value = JSON.stringify(result);
          this.remember(id, { key, value, checksum: mdxCacheDigest(value) });
          this.revision += 1;
          return value;
        })
        .finally(() => this.pending.delete(pendingKey));
      this.pending.set(pendingKey, pending);
    }
    // Subsequent plugins may mutate source maps: don't share mutable results.
    const value = await pending;
    return value === undefined ? undefined : JSON.parse(value);
  }

  async flush(): Promise<void> {
    if (!this.loaded) return;
    await this.loaded;
    // Multiple Vite environments can finish together. An older snapshot must
    // finish before a newer one, or its rename could discard the newer entries.
    while (this.flushing) await this.flushing;
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
