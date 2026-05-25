import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { materializeCloudConfig, runCloudPreview } from "./cloud.js";

describe("cloud cli", () => {
  const originalEnv = { ...process.env };
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "docs-cloud-cli-"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writePackageJson(dependencies: Record<string, string> = { next: "16.0.0" }) {
    writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "@acme/docs-app", dependencies }, null, 2),
      "utf-8",
    );
  }

  it("materializes docs.config cloud settings into docs.json without writing secrets", async () => {
    writePackageJson();
    mkdirSync(path.join(tmpDir, "app", "docs"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  nav: { title: "Acme Docs" },
  cloud: {
    apiKey: { env: "ACME_DOCS_CLOUD_KEY" },
    preview: { enabled: true },
    publish: { mode: "draft-pr", baseBranch: "main" },
  },
};
`,
      "utf-8",
    );

    const result = await materializeCloudConfig({ rootDir: tmpDir });

    expect(result.created).toBe(true);
    expect(result.apiKeyEnv).toBe("ACME_DOCS_CLOUD_KEY");
    expect(existsSync(path.join(tmpDir, "docs.json"))).toBe(true);

    const docsJson = JSON.parse(readFileSync(path.join(tmpDir, "docs.json"), "utf-8"));
    expect(docsJson).toMatchObject({
      $schema: "https://docs.farming-labs.dev/schema/docs.json",
      version: 1,
      docs: {
        mode: "framework",
        runtime: "nextjs",
        root: ".",
      },
      content: {
        docsRoot: "app/docs",
      },
      site: {
        name: "Acme Docs",
      },
      cloud: {
        apiKey: {
          env: "ACME_DOCS_CLOUD_KEY",
        },
        preview: {
          enabled: true,
        },
        publish: {
          mode: "draft-pr",
          baseBranch: "main",
        },
      },
    });
    expect(docsJson.cloud.enabled).toBeUndefined();
    expect(JSON.stringify(docsJson)).not.toContain("sk-");
  });

  it("auto-initializes docs.json for preview commands when docs.json is missing", async () => {
    writePackageJson({ "@sveltejs/kit": "2.0.0" });
    mkdirSync(path.join(tmpDir, "docs"), { recursive: true });

    const result = await materializeCloudConfig({ rootDir: tmpDir });
    const docsJson = JSON.parse(readFileSync(path.join(tmpDir, "docs.json"), "utf-8"));

    expect(result.created).toBe(true);
    expect(docsJson.docs).toEqual({
      mode: "framework",
      runtime: "sveltekit",
      root: ".",
    });
    expect(docsJson.cloud.apiKey.env).toBe("DOCS_CLOUD_API_KEY");
  });

  it("validates the configured API key and prints the preview URL", async () => {
    writePackageJson();
    writeFileSync(
      path.join(tmpDir, ".env.local"),
      "CUSTOM_DOCS_KEY=docs_cloud_test_key\n",
      "utf-8",
    );
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  cloud: {
    apiKey: { env: "CUSTOM_DOCS_KEY" },
    preview: { enabled: true },
  },
};
`,
      "utf-8",
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer docs_cloud_test_key");

      if (url === "https://cloud.example.com/api/cloud/me") {
        return new Response(
          JSON.stringify({
            workspace: { id: "workspace_1", name: "Acme" },
            apiKey: { id: "key_1", scopes: ["project:read", "preview:write"] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://cloud.example.com/api/cloud/preview") {
        return new Response(JSON.stringify({ url: "https://docs-cloud-acme.preview.test" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCloudPreview({
      rootDir: tmpDir,
      apiBaseUrl: "https://cloud.example.com",
      json: true,
    });

    expect(result.url).toBe("https://docs-cloud-acme.preview.test");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails before preview when the configured API key env var is missing", async () => {
    writePackageJson();
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  cloud: {
    apiKey: { env: "MISSING_DOCS_KEY" },
  },
};
`,
      "utf-8",
    );

    await expect(
      runCloudPreview({
        rootDir: tmpDir,
        apiBaseUrl: "https://cloud.example.com",
        json: true,
      }),
    ).rejects.toThrow("Missing Docs Cloud API key");
  });

  it("fails clearly when preview is disabled in cloud config", async () => {
    writePackageJson();
    writeFileSync(
      path.join(tmpDir, ".env.local"),
      "DOCS_CLOUD_API_KEY=docs_cloud_test_key\n",
      "utf-8",
    );
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  cloud: {
    apiKey: { env: "DOCS_CLOUD_API_KEY" },
    preview: { enabled: false },
  },
};
`,
      "utf-8",
    );

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runCloudPreview({
        rootDir: tmpDir,
        apiBaseUrl: "https://cloud.example.com",
        json: true,
      }),
    ).rejects.toThrow("Docs Cloud preview is disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
