import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isDocsClientAnalyticsEnabled } from "./docs-client-hooks.js";

describe("DocsClientHooks analytics resolution", () => {
  function clearDocsCloudEnv() {
    delete process.env.PUBLIC_DOCS_CLOUD_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID;
    delete process.env.DOCS_CLOUD_PROJECT_ID;
    delete process.env.PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED;
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED;
    delete process.env.DOCS_CLOUD_ANALYTICS_ENABLED;
  }

  beforeEach(clearDocsCloudEnv);
  afterEach(clearDocsCloudEnv);

  it("enables the client analytics hook from the Docs Cloud project id env", () => {
    process.env.PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_cloud";

    expect(isDocsClientAnalyticsEnabled()).toBe(true);
  });

  it("enables the client analytics hook when the layout owns cloud delivery", () => {
    expect(isDocsClientAnalyticsEnabled({ enabled: true, console: false, cloud: false })).toBe(
      true,
    );
  });

  it("keeps the client analytics hook disabled when Cloud analytics is opted out", () => {
    process.env.PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_cloud";
    process.env.PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED = "false";

    expect(isDocsClientAnalyticsEnabled()).toBe(false);
  });

  it("respects an explicit analytics false config even when a Cloud project id exists", () => {
    process.env.PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_cloud";

    expect(isDocsClientAnalyticsEnabled({ enabled: false })).toBe(false);
  });
});
