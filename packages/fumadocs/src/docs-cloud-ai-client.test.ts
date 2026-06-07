import { afterEach, describe, expect, it } from "vitest";
import type { DocsConfig } from "@farming-labs/docs";
import { resolveDocsCloudAIClientRequest } from "./docs-cloud-ai-client.js";

const ENV_KEYS = [
  "NEXT_PUBLIC_DOCS_CLOUD_API_KEY",
  "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID",
  "NEXT_PUBLIC_DOCS_CLOUD_URL",
  "DOCS_CLOUD_API_URL",
  "DOCS_CLOUD_API_KEY",
  "SERVER_DOCS_CLOUD_KEY",
] as const;

const originalEnv = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function createDocsCloudConfig(cloud?: DocsConfig["cloud"]): DocsConfig {
  return {
    entry: "docs",
    ai: {
      enabled: true,
      provider: "docs-cloud",
    } as unknown as DocsConfig["ai"],
    cloud,
  };
}

describe("resolveDocsCloudAIClientRequest", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("uses the default public Docs Cloud API key env when no config override is set", () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_public";
    process.env.NEXT_PUBLIC_DOCS_CLOUD_API_KEY = "public-key";

    expect(resolveDocsCloudAIClientRequest(createDocsCloudConfig())).toEqual({
      api: "https://docs-app.farming-labs.dev/v1/projects/project_public/knowledge/ask",
      requestMode: "docs-cloud",
      requestHeaders: {
        Authorization: "Bearer public-key",
      },
    });
  });

  it("falls back to the server proxy when configured API key env is not public", () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_public";
    process.env.NEXT_PUBLIC_DOCS_CLOUD_API_KEY = "public-key";
    process.env.SERVER_DOCS_CLOUD_KEY = "server-key";

    expect(
      resolveDocsCloudAIClientRequest(
        createDocsCloudConfig({
          apiKey: { env: "SERVER_DOCS_CLOUD_KEY" },
        }),
      ),
    ).toEqual({
      api: "/api/docs",
    });
  });
});
