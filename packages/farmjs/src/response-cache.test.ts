import { describe, expect, it } from "vitest";
import { createFarmDocsResponseCache } from "./response-cache.js";

describe("createFarmDocsResponseCache", () => {
  it("computes a key once and shares a pending computation", async () => {
    const cached = createFarmDocsResponseCache(100);
    let calls = 0;
    const compute = async () => {
      calls += 1;
      await Promise.resolve();
      return "page";
    };

    const [first, second] = await Promise.all([
      cached("a", compute, (value) => value.length),
      cached("a", compute, (value) => value.length),
    ]);
    const third = await cached("a", compute, (value) => value.length);

    expect([first, second, third]).toEqual(["page", "page", "page"]);
    expect(calls).toBe(1);
  });

  it("forgets failures and empty values so the next call computes again", async () => {
    const cached = createFarmDocsResponseCache(100);
    let calls = 0;
    const flaky = async () => {
      calls += 1;
      if (calls === 1) throw new Error("render failed");
      return "page";
    };

    await expect(cached("a", flaky, (value) => value.length)).rejects.toThrow("render failed");
    await expect(cached("a", flaky, (value) => value.length)).resolves.toBe("page");
    expect(calls).toBe(2);

    let misses = 0;
    const missing = async () => {
      misses += 1;
      return null;
    };
    await cached("missing", missing, () => 0);
    await cached("missing", missing, () => 0);
    expect(misses).toBe(2);
  });

  it("evicts the least recently used entries once over its size", async () => {
    const cached = createFarmDocsResponseCache(10);
    const computed: string[] = [];
    const read = (key: string) =>
      cached(
        key,
        async () => {
          computed.push(key);
          return "x".repeat(4);
        },
        (value) => value.length,
      );

    await read("a");
    await read("b");
    // Using "a" makes "b" the least recently used entry.
    await read("a");
    await read("c");
    expect(computed).toEqual(["a", "b", "c"]);

    await read("a");
    await read("c");
    expect(computed).toEqual(["a", "b", "c"]);
    await read("b");
    expect(computed).toEqual(["a", "b", "c", "b"]);
  });

  it("does not keep a value larger than its whole size", async () => {
    const cached = createFarmDocsResponseCache(3);
    let calls = 0;
    const large = async () => {
      calls += 1;
      return "large";
    };

    await cached("a", large, (value) => value.length);
    await cached("a", large, (value) => value.length);
    expect(calls).toBe(2);
  });
});
