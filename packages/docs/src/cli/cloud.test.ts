import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkCloudConfig,
  initCloudConfig,
  materializeCloudConfig,
  runCloudDeploy,
  runCloudCheck,
  runCloudPreview,
} from "./cloud.js";

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

  it("initializes Docs Cloud config, analytics, and docs.json", async () => {
    writePackageJson();
    mkdirSync(path.join(tmpDir, "app", "docs"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `import { defineDocs } from "@farming-labs/docs";

export default defineDocs({
  entry: "docs",
  nav: { title: "Acme Docs" },
});
`,
      "utf-8",
    );

    const result = await initCloudConfig({ rootDir: tmpDir });
    const config = readFileSync(path.join(tmpDir, "docs.config.ts"), "utf-8");
    const docsJson = JSON.parse(readFileSync(path.join(tmpDir, "docs.json"), "utf-8"));

    expect(result).toMatchObject({
      apiKeyEnv: "DOCS_CLOUD_API_KEY",
      analyticsProjectIdEnv: "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID",
      configCreated: false,
      configUpdated: true,
      docsJsonCreated: true,
    });
    expect(config).toContain("analytics: {");
    expect(config).toContain("console: false");
    expect(config).toContain('apiKey: { env: "DOCS_CLOUD_API_KEY" }');
    expect(config).toContain("deploy: { enabled: true }");
    expect(config).toContain('publish: { mode: "draft-pr", baseBranch: "main" }');
    expect(config).not.toContain("createDocsCloudAnalytics");
    expect(docsJson).toMatchObject({
      cloud: {
        apiKey: { env: "DOCS_CLOUD_API_KEY" },
        deploy: { enabled: true },
        analytics: {
          enabled: true,
          console: false,
          includeInputs: false,
        },
        publish: {
          mode: "draft-pr",
          baseBranch: "main",
        },
      },
    });
  });

  it("creates docs.config.ts during cloud init when config is missing", async () => {
    writePackageJson({ "@sveltejs/kit": "2.0.0" });
    mkdirSync(path.join(tmpDir, "docs"), { recursive: true });

    const result = await initCloudConfig({
      rootDir: tmpDir,
      apiKeyEnv: "ACME_DOCS_CLOUD_KEY",
    });
    const config = readFileSync(path.join(tmpDir, "docs.config.ts"), "utf-8");
    const docsJson = JSON.parse(readFileSync(path.join(tmpDir, "docs.json"), "utf-8"));

    expect(result.configCreated).toBe(true);
    expect(config).toContain('apiKey: { env: "ACME_DOCS_CLOUD_KEY" }');
    expect(config).toContain("analytics: {");
    expect(docsJson.docs.runtime).toBe("sveltekit");
    expect(docsJson.cloud.apiKey.env).toBe("ACME_DOCS_CLOUD_KEY");
    expect(docsJson.cloud.analytics.enabled).toBe(true);
  });

  it("adds missing cloud init fields without replacing existing cloud settings", async () => {
    writePackageJson();
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  cloud: {
    publish: { mode: "draft-pr", baseBranch: "develop" },
  },
};
`,
      "utf-8",
    );

    await initCloudConfig({ rootDir: tmpDir });

    const config = readFileSync(path.join(tmpDir, "docs.config.ts"), "utf-8");
    const docsJson = JSON.parse(readFileSync(path.join(tmpDir, "docs.json"), "utf-8"));
    expect(config).toContain('baseBranch: "develop"');
    expect(config).toContain('apiKey: { env: "DOCS_CLOUD_API_KEY" }');
    expect(config).toContain("deploy: { enabled: true }");
    expect(docsJson.cloud.publish.baseBranch).toBe("develop");
    expect(docsJson.cloud.analytics).toEqual({
      enabled: true,
      console: false,
      includeInputs: false,
    });
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

  it("checks Docs Cloud config, analytics envs, API key scopes, and direct Ask AI wiring", async () => {
    writePackageJson();
    mkdirSync(path.join(tmpDir, "app", "docs"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, ".env.local"),
      [
        "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID=project_cloud",
        "NEXT_PUBLIC_DOCS_CLOUD_API_KEY=docs_cloud_public_key",
      ].join("\n"),
      "utf-8",
    );
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  analytics: { enabled: true, console: false },
  ai: {
    enabled: true,
    provider: "docs-cloud",
  },
  cloud: {
    apiKey: { env: "NEXT_PUBLIC_DOCS_CLOUD_API_KEY" },
    deploy: { enabled: true },
    analytics: {
      enabled: true,
      console: false,
      includeInputs: false,
    },
  },
};
`,
      "utf-8",
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://cloud.example.com/v1/cloud/me");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer docs_cloud_public_key");
      return new Response(
        JSON.stringify({
          workspace: { id: "workspace_1", name: "Acme" },
          apiKey: { id: "key_1", scopes: ["project:read", "preview:write", "jobs:read"] },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkCloudConfig({
      rootDir: tmpDir,
      apiBaseUrl: "https://cloud.example.com",
    });

    expect(result.ok).toBe(true);
    expect(result.analyticsProjectIdEnv).toBe("NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID");
    expect(result.identity).toMatchObject({
      workspace: { id: "workspace_1", name: "Acme" },
      apiKey: { id: "key_1", scopes: ["project:read", "preview:write", "jobs:read"] },
    });
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "analytics.cloud", status: "pass" }),
        expect.objectContaining({ name: "project.env", status: "pass" }),
        expect.objectContaining({ name: "askAi.direct", status: "pass" }),
        expect.objectContaining({ name: "apiKey.network", status: "pass" }),
        expect.objectContaining({ name: "apiKey.scopes", status: "pass" }),
      ]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports missing analytics project envs and can skip network checks", async () => {
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
  analytics: { enabled: true, console: false },
  cloud: {
    apiKey: { env: "DOCS_CLOUD_API_KEY" },
    analytics: { enabled: true },
  },
};
`,
      "utf-8",
    );

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkCloudConfig({
      rootDir: tmpDir,
      apiBaseUrl: "https://cloud.example.com",
      network: false,
    });

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "project.env", status: "fail" }),
        expect.objectContaining({ name: "apiKey.network", status: "warn" }),
      ]),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("can narrow cloud check to analytics integration only", async () => {
    writePackageJson();
    writeFileSync(
      path.join(tmpDir, ".env.local"),
      "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID=project_cloud\n",
      "utf-8",
    );
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  analytics: { enabled: true, console: false },
  cloud: {
    analytics: { enabled: true },
  },
};
`,
      "utf-8",
    );

    const result = await checkCloudConfig({
      rootDir: tmpDir,
      apiBaseUrl: "https://cloud.example.com",
      checkTargets: ["analytics"],
    });
    const checkNames = result.checks.map((check) => check.name);

    expect(result.ok).toBe(true);
    expect(result.targets).toEqual(["analytics"]);
    expect(checkNames).toContain("analytics.runtime");
    expect(checkNames).toContain("analytics.cloud");
    expect(checkNames).toContain("project.env");
    expect(checkNames).not.toContain("apiKey.value");
    expect(checkNames).not.toContain("askAi.provider");
    expect(checkNames).not.toContain("deploy.enabled");
  });

  it("checks direct Docs Cloud Ask AI with the configured API key env", async () => {
    writePackageJson();
    writeFileSync(
      path.join(tmpDir, ".env.local"),
      [
        "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID=project_cloud",
        "DOCS_CLOUD_API_KEY=docs_cloud_test_key",
      ].join("\n"),
      "utf-8",
    );
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  ai: {
    enabled: true,
    provider: "docs-cloud",
  },
  cloud: {
    apiKey: { env: "DOCS_CLOUD_API_KEY" },
    analytics: { enabled: true },
  },
};
`,
      "utf-8",
    );

    const result = await checkCloudConfig({
      rootDir: tmpDir,
      apiBaseUrl: "https://cloud.example.com",
      network: false,
    });

    expect(result.ok).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "askAi.provider", status: "pass" }),
        expect.objectContaining({ name: "project.env", status: "pass" }),
        expect.objectContaining({
          name: "askAi.direct",
          status: "warn",
          details: {
            apiKeyEnv: "DOCS_CLOUD_API_KEY",
            projectIdEnv: "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID",
            proxy: true,
          },
        }),
      ]),
    );
  });

  it("checks Docs Cloud browser CORS for analytics and Ask AI", async () => {
    writePackageJson();
    writeFileSync(
      path.join(tmpDir, ".env.local"),
      [
        "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID=project_cloud",
        "DOCS_CLOUD_API_KEY=docs_cloud_test_key",
      ].join("\n"),
      "utf-8",
    );
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  ai: {
    enabled: true,
    provider: "docs-cloud",
  },
  cloud: {
    apiKey: { env: "DOCS_CLOUD_API_KEY" },
    analytics: { enabled: true },
  },
  sitemap: {
    baseUrl: "https://docs.example.com",
  },
};
`,
      "utf-8",
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("OPTIONS");
      expect(new Headers(init?.headers).get("origin")).toBe("https://docs.example.com");

      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "https://docs.example.com",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "authorization, content-type",
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkCloudConfig({
      rootDir: tmpDir,
      apiBaseUrl: "https://cloud.example.com",
      checkTargets: ["analytics", "ask-ai"],
    });

    expect(result.ok).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "cloud.apiBaseUrl", status: "pass" }),
        expect.objectContaining({
          name: "docs.siteOrigin",
          status: "pass",
          details: {
            origin: "https://docs.example.com",
            source: "sitemap.baseUrl",
          },
        }),
        expect.objectContaining({ name: "cors.analytics", status: "pass" }),
        expect.objectContaining({ name: "cors.askAi", status: "pass" }),
      ]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cloud.example.com/v1/analytics/events",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cloud.example.com/v1/projects/project_cloud/knowledge/ask",
      expect.any(Object),
    );
  });

  it("fails Docs Cloud Ask AI CORS when preflight does not allow authorization", async () => {
    writePackageJson();
    writeFileSync(
      path.join(tmpDir, ".env.local"),
      [
        "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID=project_cloud",
        "NEXT_PUBLIC_DOCS_CLOUD_API_KEY=docs_cloud_public_key",
      ].join("\n"),
      "utf-8",
    );
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  ai: {
    enabled: true,
    provider: "docs-cloud",
  },
  cloud: {
    apiKey: { env: "NEXT_PUBLIC_DOCS_CLOUD_API_KEY" },
  },
  site: {
    url: "https://docs.example.com",
  },
};
`,
      "utf-8",
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "https://docs.example.com",
            "access-control-allow-methods": "POST, OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        });
      }),
    );

    const result = await checkCloudConfig({
      rootDir: tmpDir,
      apiBaseUrl: "https://cloud.example.com",
      checkTargets: ["ask-ai"],
    });

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "cors.askAi",
          status: "fail",
          details: expect.objectContaining({
            allowHeaders: "content-type",
          }),
        }),
      ]),
    );
  });

  it("prints json and exits non-zero when cloud check fails", async () => {
    writePackageJson();
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  cloud: {
    analytics: { enabled: true },
  },
};
`,
      "utf-8",
    );

    await expect(
      runCloudCheck({
        rootDir: tmpDir,
        apiBaseUrl: "https://cloud.example.com",
        json: true,
        network: false,
      }),
    ).rejects.toThrow("Docs Cloud check failed");
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"ok": false'));
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

      if (url === "https://cloud.example.com/v1/cloud/me") {
        return new Response(
          JSON.stringify({
            workspace: { id: "workspace_1", name: "Acme" },
            apiKey: { id: "key_1", scopes: ["project:read", "preview:write", "jobs:read"] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://cloud.example.com/v1/cloud/preview") {
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

      if (url === "https://cloud.example.com/v1/cloud/me") {
        return new Response(
          JSON.stringify({
            workspace: { id: "workspace_1", name: "Acme" },
            apiKey: { id: "key_1", scopes: ["project:read", "preview:write", "jobs:read"] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://cloud.example.com/v1/cloud/preview") {
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

      if (url === "https://cloud.example.com/v1/cloud/me") {
        return new Response(
          JSON.stringify({
            workspace: { id: "workspace_1", name: "Acme" },
            apiKey: { id: "key_1", scopes: ["project:read", "preview:write", "jobs:read"] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://cloud.example.com/v1/cloud/preview") {
        return new Response(
          JSON.stringify({
            status: "queued",
            statusUrl: "/v1/cloud/preview/job_1",
            preview: { status: "queued", url: null },
          }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://cloud.example.com/v1/cloud/preview/job_1") {
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

      if (url === "https://cloud.example.com/v1/cloud/me") {
        return new Response(
          JSON.stringify({
            workspace: { id: "workspace_1", name: "Acme" },
            apiKey: { id: "key_1", scopes: ["project:read", "preview:write", "jobs:read"] },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://cloud.example.com/v1/cloud/preview") {
        return new Response(
          JSON.stringify({
            status: "queued",
            statusUrl: "/v1/cloud/preview/job_1",
          }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }

      if (url === "https://cloud.example.com/v1/cloud/preview/job_1") {
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

      if (url === "https://cloud.example.com/v1/cloud/me") {
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
    ).rejects.toThrow("https://docs.farming-labs.dev/docs/cloud/deploy#missing-api-key");
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

    const check = await checkCloudConfig({
      rootDir: tmpDir,
      apiBaseUrl: "https://cloud.example.com",
      network: false,
    });
    expect(check.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "preview.enabled", status: "fail" }),
      ]),
    );

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
