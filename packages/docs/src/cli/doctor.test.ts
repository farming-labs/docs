import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspectAgentReadiness, parseDoctorArgs } from "./doctor.js";

function writePackageJson(
  rootDir: string,
  name: string,
  dependencies: Record<string, string> = {},
) {
  writeFileSync(
    path.join(rootDir, "package.json"),
    JSON.stringify({ name, private: true, dependencies }),
    "utf-8",
  );
}

function writeDocsConfig(rootDir: string, relativePath: string, content: string) {
  const filePath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

function writeDocsPage(rootDir: string, contentDir = "docs") {
  mkdirSync(path.join(rootDir, contentDir), { recursive: true });
  writeFileSync(
    path.join(rootDir, contentDir, "page.mdx"),
    `---
title: "Overview"
description: "Docs home"
---

# Overview
`,
    "utf-8",
  );
}

describe("parseDoctorArgs", () => {
  it("defaults to agent mode", () => {
    expect(parseDoctorArgs([])).toEqual({ agent: true });
  });

  it("parses explicit agent mode and config path", () => {
    expect(parseDoctorArgs(["--agent", "--config", "src/lib/docs.config.ts"])).toEqual({
      agent: true,
      configPath: "src/lib/docs.config.ts",
    });
    expect(parseDoctorArgs(["agent", "--config=docs.config.tsx"])).toEqual({
      agent: true,
      configPath: "docs.config.tsx",
    });
  });

  it("treats -h as help", () => {
    expect(parseDoctorArgs(["-h"])).toEqual({ help: true });
  });

  it("rejects an empty inline config value", () => {
    expect(() => parseDoctorArgs(["--config="])).toThrow("Missing value for --config.");
  });
});

describe("inspectAgentReadiness", () => {
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "docs-doctor-"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = { ...originalEnv };
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("scores a healthy Next.js docs app as agent-optimized", async () => {
    writePackageJson(tmpDir, "doctor-next", { next: "16.0.0" });

    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  llmsTxt: { enabled: true },
  search: true,
  mcp: { enabled: true },
  feedback: {
    agent: {
      enabled: true,
    },
  },
  agent: {
    compact: {
      apiKeyEnv: "TOKEN_COMPANY_API_KEY",
      model: "bear-1.2",
    },
  },
};`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "next.config.ts"),
      `import { withDocs } from "@farming-labs/next/config";

export default withDocs({});
`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "app", "api", "docs"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "app", "api", "docs", "route.ts"),
      `import { createDocsAPI } from "@farming-labs/next/api";

export const { GET, POST } = createDocsAPI({});
`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "app", "docs"), { recursive: true });
    mkdirSync(path.join(tmpDir, "app", "docs", "installation"), { recursive: true });
    mkdirSync(path.join(tmpDir, "app", "docs", "configuration"), { recursive: true });

    writeFileSync(
      path.join(tmpDir, "app", "docs", "page.mdx"),
      `---
title: "Overview"
description: "Docs home"
---

# Overview

Human docs home.
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "app", "docs", "installation", "page.mdx"),
      `---
title: "Installation"
description: "Install the framework"
related:
  - /docs/configuration
---

# Installation

Human instructions.
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "app", "docs", "installation", "agent.md"),
      `Installation agent notes.
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "app", "docs", "configuration", "page.mdx"),
      `---
title: "Configuration"
description: "Configure the docs app"
---

# Configuration

Visible content.

<Agent>
Machine-only configuration hints.
</Agent>
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "skill.md"),
      `# Skill

Use this docs site through markdown routes and MCP.
`,
      "utf-8",
    );

    process.chdir(tmpDir);

    const report = await inspectAgentReadiness();

    expect(report.framework).toBe("nextjs");
    expect(report.grade).toBe("Agent-optimized");
    expect(report.score).toBeGreaterThanOrEqual(95);
    expect(report.coverage.totalPages).toBe(3);
    expect(report.coverage.pagesWithAgentFiles).toBe(1);
    expect(report.coverage.pagesWithAgentBlocks).toBe(1);
    expect(report.coverage.explicitCoverage).toBe(67);
    expect(report.checks.find((check) => check.id === "api-route")?.status).toBe("pass");
    expect(report.checks.find((check) => check.id === "public-routes")?.status).toBe("pass");
    expect(report.checks.find((check) => check.id === "agent-discovery")?.status).toBe("pass");
    expect(report.checks.find((check) => check.id === "skill")?.status).toBe("pass");
    expect(report.checks.find((check) => check.id === "feedback")?.status).toBe("pass");
    expect(report.checks.find((check) => check.id === "metadata")?.status).toBe("pass");
    expect(report.checks.find((check) => check.id === "compact")?.status).toBe("pass");
  });

  it("returns a failing report when docs config is missing", async () => {
    writePackageJson(tmpDir, "doctor-missing-config", { next: "16.0.0" });

    process.chdir(tmpDir);

    const report = await inspectAgentReadiness();

    expect(report.score).toBe(0);
    expect(report.grade).toBe("Needs work");
    expect(report.checks).toHaveLength(1);
    expect(report.checks[0]?.status).toBe("fail");
    expect(report.checks[0]?.title).toBe("Docs config");
  });

  it("restores environment variables loaded from project files after inspection", async () => {
    writePackageJson(tmpDir, "doctor-env", { next: "16.0.0" });

    writeFileSync(path.join(tmpDir, ".env"), "DOCTOR_TEST_KEY=from-dotenv\n", "utf-8");

    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  agent: {
    compact: {
      apiKey: process.env.DOCTOR_TEST_KEY,
    },
  },
};`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "app", "docs"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "app", "docs", "page.mdx"),
      `---
title: "Overview"
description: "Docs home"
---

# Overview
`,
      "utf-8",
    );

    delete process.env.DOCTOR_TEST_KEY;
    process.chdir(tmpDir);

    const report = await inspectAgentReadiness();

    expect(report.checks.find((check) => check.id === "compact")?.status).toBe("pass");
    expect(process.env.DOCTOR_TEST_KEY).toBeUndefined();
  });

  it("does not guess Astro from a generic src/middleware.ts file alone", async () => {
    writePackageJson(tmpDir, "doctor-unknown-framework");

    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
};`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "src", "middleware.ts"),
      `export default function middleware() {
  return null;
}
`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "docs"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "docs", "page.mdx"),
      `---
title: "Overview"
description: "Docs home"
---

# Overview
`,
      "utf-8",
    );

    process.chdir(tmpDir);

    const report = await inspectAgentReadiness();

    expect(report.framework).toBe("unknown");
  });

  it("skips symlinked directories while scanning project files", async () => {
    writePackageJson(tmpDir, "doctor-symlink-scan", { next: "16.0.0" });

    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
};`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "app", "docs"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "app", "docs", "page.mdx"),
      `---
title: "Overview"
description: "Docs home"
---

# Overview
`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "external"), { recursive: true });
    writeFileSync(path.join(tmpDir, "external", "ignored.txt"), "ignore me\n", "utf-8");
    symlinkSync(path.join(tmpDir, "external"), path.join(tmpDir, "linked-external"), "dir");

    process.chdir(tmpDir);

    const report = await inspectAgentReadiness();

    expect(report.framework).toBe("nextjs");
    expect(report.checks.find((check) => check.id === "content")?.status).toBe("pass");
  });

  it("detects TanStack Start route wiring", async () => {
    writePackageJson(tmpDir, "doctor-tanstack", {
      "@tanstack/react-start": "1.0.0",
    });

    writeDocsConfig(
      tmpDir,
      "docs.config.ts",
      `export default {
  entry: "docs",
  contentDir: "docs",
  llmsTxt: { enabled: true },
  search: true,
  mcp: { enabled: true },
};`,
    );

    writeDocsPage(tmpDir, "docs");

    mkdirSync(path.join(tmpDir, "src", "routes"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "src", "routes", "api.docs.ts"),
      `import { createFileRoute } from "@tanstack/react-router";
import { docsServer } from "@/lib/docs.server";

export const Route = createFileRoute("/api/docs")({
  server: {
    handlers: {
      GET: async ({ request }) => docsServer.GET({ request }),
      POST: async ({ request }) => docsServer.POST({ request }),
    },
  },
});
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "src", "routes", "$.ts"),
      `import { createFileRoute } from "@tanstack/react-router";
import { isDocsMcpRequest, isDocsPublicGetRequest } from "@farming-labs/docs";
import { docsServer } from "@/lib/docs.server";

const docsEntry = "docs";

export const Route = createFileRoute("/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const method = request.method.toUpperCase();
        if (isDocsMcpRequest(url)) return docsServer.MCP.GET({ request });
        if ((method === "GET" || method === "HEAD") && isDocsPublicGetRequest(docsEntry, url, request)) {
          return docsServer.GET({ request });
        }
        return new Response("Not Found", { status: 404 });
      },
    },
  },
});
`,
      "utf-8",
    );

    process.chdir(tmpDir);

    const report = await inspectAgentReadiness();
    const apiRoute = report.checks.find((check) => check.id === "api-route");
    const publicRoutes = report.checks.find((check) => check.id === "public-routes");

    expect(report.framework).toBe("tanstack-start");
    expect(apiRoute?.status).toBe("pass");
    expect(apiRoute?.detail).toBe("Found TanStack docs API route at src/routes/api.docs.ts.");
    expect(publicRoutes?.status).toBe("pass");
    expect(publicRoutes?.detail).toBe("Found public docs forwarder at src/routes/$.ts.");
  });

  it("detects SvelteKit route wiring", async () => {
    writePackageJson(tmpDir, "doctor-sveltekit", {
      "@sveltejs/kit": "2.0.0",
    });

    writeDocsConfig(
      tmpDir,
      "src/lib/docs.config.ts",
      `export default {
  entry: "docs",
  contentDir: "docs",
  llmsTxt: { enabled: true },
  search: true,
  mcp: { enabled: true },
};`,
    );

    writeDocsPage(tmpDir, "docs");

    mkdirSync(path.join(tmpDir, "src", "routes", "api", "docs"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "src", "routes", "api", "docs", "+server.js"),
      `export { GET, POST } from "$lib/docs.server.js";
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "src", "hooks.server.js"),
      `import { isDocsMcpRequest, isDocsPublicGetRequest } from "@farming-labs/docs";
import config from "$lib/docs.config";
import { GET, MCP } from "$lib/docs.server.js";

const docsEntry = config.entry ?? "docs";

export async function handle({ event, resolve }) {
  const method = event.request.method.toUpperCase();

  if (isDocsMcpRequest(event.url)) {
    if (method === "POST") return MCP.POST({ request: event.request });
    if (method === "DELETE") return MCP.DELETE({ request: event.request });
    if (method === "GET" || method === "HEAD") return MCP.GET({ request: event.request });
  }

  if (
    (method === "GET" || method === "HEAD") &&
    isDocsPublicGetRequest(docsEntry, event.url, event.request)
  ) {
    return GET({ url: event.url, request: event.request });
  }

  return resolve(event);
}
`,
      "utf-8",
    );

    process.chdir(tmpDir);

    const report = await inspectAgentReadiness({ configPath: "src/lib/docs.config.ts" });
    const apiRoute = report.checks.find((check) => check.id === "api-route");
    const publicRoutes = report.checks.find((check) => check.id === "public-routes");

    expect(report.framework).toBe("sveltekit");
    expect(apiRoute?.status).toBe("pass");
    expect(apiRoute?.detail).toBe(
      "Found SvelteKit docs API route at src/routes/api/docs/+server.js.",
    );
    expect(publicRoutes?.status).toBe("pass");
    expect(publicRoutes?.detail).toBe("Found SvelteKit public docs hook at src/hooks.server.js.");
  });

  it("detects Astro route wiring", async () => {
    writePackageJson(tmpDir, "doctor-astro", { astro: "5.0.0" });

    writeDocsConfig(
      tmpDir,
      "src/lib/docs.config.ts",
      `export default {
  entry: "docs",
  contentDir: "docs",
  llmsTxt: { enabled: true },
  search: true,
  mcp: { enabled: true },
};`,
    );

    writeDocsPage(tmpDir, "docs");

    writeFileSync(path.join(tmpDir, "astro.config.ts"), "export default {};\n", "utf-8");
    mkdirSync(path.join(tmpDir, "src", "pages", "api"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "src", "pages", "api", "docs.ts"),
      `import type { APIRoute } from "astro";
import { GET as docsGET, POST as docsPOST } from "../../lib/docs.server";

export const GET: APIRoute = async ({ request }) => {
  return docsGET({ request });
};

export const POST: APIRoute = async ({ request }) => {
  return docsPOST({ request });
};
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "src", "middleware.ts"),
      `import { isDocsMcpRequest, isDocsPublicGetRequest } from "@farming-labs/docs";
import type { MiddlewareHandler } from "astro";
import config from "./lib/docs.config";
import { GET, MCP } from "./lib/docs.server";

const docsEntry = config.entry ?? "docs";

export const onRequest: MiddlewareHandler = async (context, next) => {
  const method = context.request.method.toUpperCase();

  if (isDocsMcpRequest(context.url)) {
    if (method === "POST") return MCP.POST({ request: context.request });
    if (method === "DELETE") return MCP.DELETE({ request: context.request });
    if (method === "GET" || method === "HEAD") return MCP.GET({ request: context.request });
  }

  if (
    (method === "GET" || method === "HEAD") &&
    isDocsPublicGetRequest(docsEntry, context.url, context.request)
  ) {
    return GET({ request: context.request });
  }

  return next();
};
`,
      "utf-8",
    );

    process.chdir(tmpDir);

    const report = await inspectAgentReadiness({ configPath: "src/lib/docs.config.ts" });
    const apiRoute = report.checks.find((check) => check.id === "api-route");
    const publicRoutes = report.checks.find((check) => check.id === "public-routes");

    expect(report.framework).toBe("astro");
    expect(apiRoute?.status).toBe("pass");
    expect(apiRoute?.detail).toBe("Found Astro docs API route at src/pages/api/docs.ts.");
    expect(publicRoutes?.status).toBe("pass");
    expect(publicRoutes?.detail).toBe("Found Astro middleware forwarder at src/middleware.ts.");
  });

  it("detects Nuxt route wiring", async () => {
    writePackageJson(tmpDir, "doctor-nuxt", { nuxt: "4.0.0" });

    writeDocsConfig(
      tmpDir,
      "docs.config.ts",
      `export default {
  entry: "docs",
  contentDir: "docs",
  llmsTxt: { enabled: true },
  search: true,
  mcp: { enabled: true },
};`,
    );

    writeDocsPage(tmpDir, "docs");

    mkdirSync(path.join(tmpDir, "server", "api"), { recursive: true });
    mkdirSync(path.join(tmpDir, "server", "middleware"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "server", "api", "docs.ts"),
      `import { defineDocsHandler } from "@farming-labs/nuxt/server";
import config from "../../docs.config";

export default defineDocsHandler(config, useStorage);
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "server", "middleware", "docs-public.ts"),
      `import { defineDocsPublicHandler } from "@farming-labs/nuxt/server";
import config from "../../docs.config";

export default defineDocsPublicHandler(config, useStorage);
`,
      "utf-8",
    );

    process.chdir(tmpDir);

    const report = await inspectAgentReadiness();
    const apiRoute = report.checks.find((check) => check.id === "api-route");
    const publicRoutes = report.checks.find((check) => check.id === "public-routes");

    expect(report.framework).toBe("nuxt");
    expect(apiRoute?.status).toBe("pass");
    expect(apiRoute?.detail).toBe("Found Nuxt docs API handler at server/api/docs.ts.");
    expect(publicRoutes?.status).toBe("pass");
    expect(publicRoutes?.detail).toBe(
      "Found Nuxt public docs middleware at server/middleware/docs-public.ts.",
    );
  });
});
