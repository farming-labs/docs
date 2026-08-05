import { describe, expect, it } from "vitest";
import {
  farmDocsPresentationCss,
  farmDocsRuntimeAdapter,
  FARM_DOCS_ADAPTER_PROTOCOL,
} from "./runtime.js";

describe("Farm adapter runtime", () => {
  it("publishes presentation CSS with the versioned runtime contract", () => {
    expect(farmDocsRuntimeAdapter.protocol).toBe(FARM_DOCS_ADAPTER_PROTOCOL);
    expect(farmDocsPresentationCss).toContain(".omni-overlay");
    expect(farmDocsPresentationCss).toContain("#nd-docs-layout");
    expect(farmDocsPresentationCss).toContain(".topbar-actions");
  });
});
