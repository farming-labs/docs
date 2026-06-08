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
  "NEXT_PUBLIC_CUSTOM_DOCS_CLOUD_API_KEY",
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
      api: "https://api.farming-labs.dev/v1/projects/project_public/knowledge/ask",
      requestMode: "docs-cloud",
      requestStream: true,
      requestHeaders: {
        Authorization: "Bearer public-key",
      },
    });
  });

  it("uses a configured browser-safe Docs Cloud API key env for direct requests", () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_public";
    process.env.NEXT_PUBLIC_DOCS_CLOUD_API_KEY = "public-key";
    process.env.NEXT_PUBLIC_CUSTOM_DOCS_CLOUD_API_KEY = "custom-public-key";

    expect(
      resolveDocsCloudAIClientRequest(
        createDocsCloudConfig({
          apiKey: { env: "NEXT_PUBLIC_CUSTOM_DOCS_CLOUD_API_KEY" },
        }),
      ),
    ).toEqual({
      api: "https://api.farming-labs.dev/v1/projects/project_public/knowledge/ask",
      requestMode: "docs-cloud",
      requestStream: true,
      requestHeaders: {
        Authorization: "Bearer custom-public-key",
      },
    });
  });

  it("falls back to the docs API route when the configured API key env is server-only", () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_public";
    process.env.SERVER_DOCS_CLOUD_KEY = "server-key";

    expect(
      resolveDocsCloudAIClientRequest(
        createDocsCloudConfig({
          apiKey: { env: "SERVER_DOCS_CLOUD_KEY" },
        }),
      ),
    ).toEqual({
      api: "/api/docs",
      requestStream: true,
    });
  });

  it("keeps non-cloud providers on the docs API route", () => {
    expect(
      resolveDocsCloudAIClientRequest({
        entry: "docs",
        ai: {
          enabled: true,
          provider: "openai",
        } as unknown as DocsConfig["ai"],
      }),
    ).toEqual({
      api: "/api/docs",
    });
  });

  it("falls back to the docs API route when the public API key is missing", () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_public";

    expect(resolveDocsCloudAIClientRequest(createDocsCloudConfig())).toEqual({
      api: "/api/docs",
      requestStream: true,
    });
  });

  it("falls back to the docs API route when the public project id is missing", () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_API_KEY = "public-key";

    expect(resolveDocsCloudAIClientRequest(createDocsCloudConfig())).toEqual({
      api: "/api/docs",
      requestStream: true,
    });
  });

  it("allows Docs Cloud streaming to be disabled from ai.stream", () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_public";
    process.env.NEXT_PUBLIC_DOCS_CLOUD_API_KEY = "public-key";

    expect(
      resolveDocsCloudAIClientRequest({
        ...createDocsCloudConfig(),
        ai: {
          enabled: true,
          provider: "docs-cloud",
          stream: false,
        } as unknown as DocsConfig["ai"],
      }),
    ).toMatchObject({
      requestMode: "docs-cloud",
      requestStream: false,
    });
  });
});
