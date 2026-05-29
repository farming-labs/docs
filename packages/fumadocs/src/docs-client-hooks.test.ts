import { afterEach, describe, expect, it } from "vitest";
import { isDocsClientAnalyticsEnabled } from "./docs-client-hooks.js";

describe("DocsClientHooks analytics resolution", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID;
    delete process.env.DOCS_CLOUD_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED;
    delete process.env.DOCS_CLOUD_ANALYTICS_ENABLED;
  });

  it("enables the client analytics hook from the Docs Cloud project id env", () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_cloud";

    expect(isDocsClientAnalyticsEnabled()).toBe(true);
  });

  it("keeps the client analytics hook disabled when Cloud analytics is opted out", () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_cloud";
    process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED = "false";

    expect(isDocsClientAnalyticsEnabled()).toBe(false);
  });

  it("respects an explicit analytics false config even when a Cloud project id exists", () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_cloud";

    expect(isDocsClientAnalyticsEnabled({ enabled: false })).toBe(false);
  });
});
