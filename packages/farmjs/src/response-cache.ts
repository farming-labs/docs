/** Upper bound for rendered responses a production server keeps, in UTF-16 code units. */
export const FARM_DOCS_RESPONSE_CACHE_MAX_SIZE = 50 * 1024 * 1024;

export type FarmDocsResponseCache = <T>(
  key: string,
  compute: () => Promise<T>,
  sizeOf: (value: T) => number,
) => Promise<T>;

/**
 * Remember what `compute` produced for a key, least recently used first out
 * once the entries outgrow `maxSize`. Concurrent callers share one pending
 * computation. A failed computation, or a value whose size is zero (such as a
 * page that does not exist), is not kept, so the next request computes it again.
 */
export function createFarmDocsResponseCache(maxSize: number): FarmDocsResponseCache {
  const entries = new Map<string, { promise: Promise<unknown>; size: number }>();
  let totalSize = 0;

  return function cached<T>(
    key: string,
    compute: () => Promise<T>,
    sizeOf: (value: T) => number,
  ): Promise<T> {
    const hit = entries.get(key);
    if (hit) {
      entries.delete(key);
      entries.set(key, hit);
      return hit.promise as Promise<T>;
    }

    const entry = { promise: undefined as unknown as Promise<T>, size: 0 };
    entry.promise = compute().then(
      (value) => {
        if (entries.get(key) !== entry) return value;
        entry.size = sizeOf(value);
        if (entry.size <= 0) {
          entries.delete(key);
          return value;
        }
        totalSize += entry.size;
        for (const [otherKey, other] of entries) {
          if (totalSize <= maxSize) break;
          // A pending entry has no size yet and is accounted for when it settles.
          if (other.size === 0 || other === entry) continue;
          entries.delete(otherKey);
          totalSize -= other.size;
        }
        if (totalSize > maxSize) {
          entries.delete(key);
          totalSize -= entry.size;
        }
        return value;
      },
      (error: unknown) => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      },
    );
    entries.set(key, entry);
    return entry.promise;
  };
}
