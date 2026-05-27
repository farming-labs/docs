import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { materializeCloudConfig, runCloudDeploy, runCloudPreview } from "./cloud.js";

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

  it("auto-initializes docs.json for cloud commands when docs.json is missing", async () => {
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
    expect(docsJson.cloud.preview).toBeUndefined();
  });

  it("preserves boolean analytics.console values when static config parsing is used", async () => {
    writePackageJson();
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `import missing from "missing-cloud-test-package";

export default {
  entry: "docs",
  cloud: {
    analytics: {
      enabled: true,
      console: false,
      includeInputs: true,
    },
  },
};

void missing;
`,
      "utf-8",
    );

    await materializeCloudConfig({ rootDir: tmpDir });

    const docsJson = JSON.parse(readFileSync(path.join(tmpDir, "docs.json"), "utf-8"));
    expect(docsJson.cloud.analytics).toEqual({
      enabled: true,
      console: false,
      includeInputs: true,
    });
  });

  it("preserves true analytics.console values when static config parsing is used", async () => {
    writePackageJson();
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `import missing from "missing-cloud-test-package";

export default {
  entry: "docs",
  cloud: {
    analytics: {
      console: true,
    },
  },
};

void missing;
`,
      "utf-8",
    );

    await materializeCloudConfig({ rootDir: tmpDir });

    const docsJson = JSON.parse(readFileSync(path.join(tmpDir, "docs.json"), "utf-8"));
    expect(docsJson.cloud.analytics).toEqual({
      enabled: true,
      console: true,
      includeInputs: false,
    });
  });

  it("validates the configured API key and prints the deployment URL", async () => {
    writePackageJson();
    execFileSync("git", ["init"], { cwd: tmpDir, stdio: "ignore" });
    execFileSync("git", ["checkout", "-b", "preview-branch"], { cwd: tmpDir, stdio: "ignore" });
    execFileSync("git", ["remote", "add", "origin", "git@github.com:acme/docs-app.git"], {
      cwd: tmpDir,
      stdio: "ignore",
    });
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
            apiKey: { id: "key_1", scopes: ["project:read", "preview:write", "jobs:read"] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://cloud.example.com/api/cloud/preview") {
        const requestBody = JSON.parse(String(init?.body)) as {
          repository?: {
            owner?: string;
            name?: string;
            branch?: string;
            rootDirectory?: string;
          };
        };
        expect(requestBody.repository).toMatchObject({
          owner: "acme",
          name: "docs-app",
          branch: "preview-branch",
          rootDirectory: ".",
        });

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

  it("deploy command requests the hosted preview deployment", async () => {
    writePackageJson();
    execFileSync("git", ["init"], { cwd: tmpDir, stdio: "ignore" });
    execFileSync("git", ["checkout", "-b", "deploy-branch"], { cwd: tmpDir, stdio: "ignore" });
    execFileSync("git", ["remote", "add", "origin", "https://github.com/acme/docs-app.git"], {
      cwd: tmpDir,
      stdio: "ignore",
    });
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
    deploy: { enabled: true },
  },
};
`,
      "utf-8",
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "https://cloud.example.com/api/cloud/me") {
        return new Response(
          JSON.stringify({
            workspace: { id: "workspace_1", name: "Acme" },
            apiKey: { id: "key_1", scopes: ["project:read", "preview:write", "jobs:read"] },
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

    const result = await runCloudDeploy({
      rootDir: tmpDir,
      apiBaseUrl: "https://cloud.example.com",
      json: true,
    });

    expect(result.url).toBe("https://docs-cloud-acme.preview.test");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("polls queued previews until the live URL is ready", async () => {
    writePackageJson();
    execFileSync("git", ["init"], { cwd: tmpDir, stdio: "ignore" });
    execFileSync("git", ["checkout", "-b", "queued-preview"], { cwd: tmpDir, stdio: "ignore" });
    execFileSync("git", ["remote", "add", "origin", "https://github.com/acme/docs-app.git"], {
      cwd: tmpDir,
      stdio: "ignore",
    });
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
    preview: { enabled: true },
  },
};
`,
      "utf-8",
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "https://cloud.example.com/api/cloud/me") {
        return new Response(
          JSON.stringify({
            workspace: { id: "workspace_1", name: "Acme" },
            apiKey: { id: "key_1", scopes: ["project:read", "preview:write", "jobs:read"] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://cloud.example.com/api/cloud/preview") {
        return new Response(
          JSON.stringify({
            status: "queued",
            statusUrl: "/api/cloud/preview/job_1",
            preview: { status: "queued", url: null },
          }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://cloud.example.com/api/cloud/preview/job_1") {
        return new Response(
          JSON.stringify({
            job: { id: "job_1", status: "SUCCEEDED" },
            url: "https://docs-cloud-acme.preview.test",
            preview: { status: "ready", url: "https://docs-cloud-acme.preview.test" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runCloudPreview({
      rootDir: tmpDir,
      apiBaseUrl: "https://cloud.example.com",
      json: true,
      pollIntervalMs: 1,
    });

    expect(result.url).toBe("https://docs-cloud-acme.preview.test");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("fails when a nested preview job reaches a terminal failure state", async () => {
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
    preview: { enabled: true },
  },
};
`,
      "utf-8",
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "https://cloud.example.com/api/cloud/me") {
        return new Response(
          JSON.stringify({
            workspace: { id: "workspace_1", name: "Acme" },
            apiKey: { id: "key_1", scopes: ["project:read", "preview:write", "jobs:read"] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://cloud.example.com/api/cloud/preview") {
        return new Response(
          JSON.stringify({
            status: "queued",
            statusUrl: "/api/cloud/preview/job_1",
          }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://cloud.example.com/api/cloud/preview/job_1") {
        return new Response(
          JSON.stringify({
            status: "queued",
            job: {
              id: "job_1",
              status: "FAILED",
              runs: [
                {
                  name: "Build",
                  status: "FAILED",
                  steps: [
                    { name: "Install dependencies", status: "SUCCEEDED" },
                    {
                      name: "Compile docs",
                      status: "FAILED",
                      message: "next build exited with code 1",
                    },
                  ],
                },
              ],
            },
            error: "Build failed",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runCloudPreview({
        rootDir: tmpDir,
        apiBaseUrl: "https://cloud.example.com",
        json: true,
        pollIntervalMs: 1,
      }),
    ).rejects.toThrow(
      "Docs Cloud preview failed at job_1 > Build > Compile docs (FAILED): next build exited with code 1",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("requires jobs:read so preview polling can use the API key", async () => {
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
    preview: { enabled: true },
  },
};
`,
      "utf-8",
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "https://cloud.example.com/api/cloud/me") {
        return new Response(
          JSON.stringify({
            workspace: { id: "workspace_1", name: "Acme" },
            apiKey: { id: "key_1", scopes: ["project:read", "preview:write"] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runCloudPreview({
        rootDir: tmpDir,
        apiBaseUrl: "https://cloud.example.com",
        json: true,
      }),
    ).rejects.toThrow("jobs:read");
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it("fails clearly when preview deployment is disabled in cloud config", async () => {
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
    ).rejects.toThrow("Docs Cloud preview deployments are disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails clearly when deploy is disabled in cloud config", async () => {
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
    deploy: { enabled: false },
  },
};
`,
      "utf-8",
    );

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runCloudDeploy({
        rootDir: tmpDir,
        apiBaseUrl: "https://cloud.example.com",
        json: true,
      }),
    ).rejects.toThrow("Docs Cloud deployment is disabled");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
