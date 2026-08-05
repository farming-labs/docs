import { describe, expect, it } from "vitest";
import { BoundedRouteCache } from "./bounded-route-cache.js";

describe("BoundedRouteCache", () => {
  it("keeps alternating route variants cached for the same locale", () => {
    const cache = new BoundedRouteCache<string>(2);

    cache.set(undefined, "/api/docs", "default");
    cache.set(undefined, "/api/internal/docs", "internal");

    expect(cache.get(undefined, "/api/docs")).toBe("default");
    expect(cache.get(undefined, "/api/internal/docs")).toBe("internal");
    expect(cache.get(undefined, "/api/docs")).toBe("default");
  });

  it("evicts the least recently used route without crossing locale boundaries", () => {
    const cache = new BoundedRouteCache<string>(2);

    cache.set("en", "/api/one", "one");
    cache.set("en", "/api/two", "two");
    cache.set("fr", "/api/un", "un");
    expect(cache.get("en", "/api/one")).toBe("one");

    cache.set("en", "/api/three", "three");

    expect(cache.get("en", "/api/two")).toBeUndefined();
    expect(cache.get("en", "/api/one")).toBe("one");
    expect(cache.get("en", "/api/three")).toBe("three");
    expect(cache.get("fr", "/api/un")).toBe("un");
  });

  it("rejects a non-positive capacity", () => {
    expect(() => new BoundedRouteCache(0)).toThrowError(RangeError);
  });
});
