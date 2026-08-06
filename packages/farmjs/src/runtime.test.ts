import { describe, expect, it } from "vitest";
import { farmDocsRuntimeAdapter, FARM_DOCS_ADAPTER_PROTOCOL } from "./runtime.js";

describe("Farm adapter runtime", () => {
  it("publishes the versioned runtime contract", () => {
    expect(farmDocsRuntimeAdapter.protocol).toBe(FARM_DOCS_ADAPTER_PROTOCOL);
    expect(farmDocsRuntimeAdapter.id).toBe("@farming-labs/farmjs");
  });
});
