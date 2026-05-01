import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { computeManagedSourceStamp, materializeManagedRuntime, parseNextDevLine } from "./dev.js";

const tempDirs: string[] = [];

function makeTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-managed-dev-"));
  tempDirs.push(dir);
  return dir;
}

function writeFile(rootDir: string, relativePath: string, content: string | Buffer): void {
  const fullPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("materializeManagedRuntime", () => {
  it("builds a hidden runtime from docs.cloud.json, docs/, and api-reference/", () => {
    const projectRoot = makeTempProject();

    writeFile(
      projectRoot,
      "docs.cloud.json",
      JSON.stringify(
        {
          docs: {
            mode: "frameworkless",
            runtime: "nextjs",
          },
          site: {
            name: "Acme Docs",
            titleTemplate: "%s | Acme Docs",
          },
          theme: {
            preset: "colorful",
          },
        },
        null,
        2,
      ),
    );
    writeFile(
      projectRoot,
      "docs/index.mdx",
      `---
title: "Home"
---

# Home

[Installation](./docs/installation.mdx)
[Authentication](./api-reference/authentication.mdx)
`,
    );
    writeFile(
      projectRoot,
      "docs/installation.mdx",
      `---
title: "Installation"
---

# Installation

[Back home](./docs/index.mdx)
![Diagram](./diagram.png)
`,
    );
    writeFile(projectRoot, "docs/diagram.png", Buffer.from("diagram"));
    writeFile(
      projectRoot,
      "api-reference/index.mdx",
      `---
title: "API Reference"
---

# API Reference

[Authentication](./authentication.mdx)
`,
    );
    writeFile(
      projectRoot,
      "api-reference/authentication.mdx",
      `---
title: "Authentication"
---

# Authentication
`,
    );

    const runtime = materializeManagedRuntime(projectRoot);

    expect(runtime.homeTarget).toBe("/docs");
    expect(runtime.docs.routes).toEqual(["/docs", "/docs/installation"]);
    expect(runtime.apiReference.routes).toEqual([
      "/api-reference",
      "/api-reference/authentication",
    ]);

    const docsIndex = fs.readFileSync(
      path.join(projectRoot, ".docs/site/app/docs/page.mdx"),
      "utf-8",
    );
    const installationPage = fs.readFileSync(
      path.join(projectRoot, ".docs/site/app/docs/installation/page.mdx"),
      "utf-8",
    );
    const docsLayout = fs.readFileSync(
      path.join(projectRoot, ".docs/site/app/docs/layout.tsx"),
      "utf-8",
    );
    const apiReferenceLayout = fs.readFileSync(
      path.join(projectRoot, ".docs/site/app/api-reference/layout.tsx"),
      "utf-8",
    );
    const apiConfig = fs.readFileSync(
      path.join(projectRoot, ".docs/site/api-reference.config.ts"),
      "utf-8",
    );
    const apiReferenceIndex = fs.readFileSync(
      path.join(projectRoot, ".docs/site/app/api-reference/page.mdx"),
      "utf-8",
    );
    const authenticationPage = fs.readFileSync(
      path.join(projectRoot, ".docs/site/app/api-reference/authentication/page.mdx"),
      "utf-8",
    );
    const proxy = fs.readFileSync(path.join(projectRoot, ".docs/site/proxy.ts"), "utf-8");

    expect(docsIndex).toContain("[Installation](/docs/installation)");
    expect(docsIndex).toContain("[Authentication](/api-reference/authentication)");
    expect(installationPage).toContain("[Back home](/docs)");
    expect(apiReferenceIndex).toContain("[Authentication](/api-reference/authentication)");
    expect(docsLayout).toContain("createNextDocsLayout");
    expect(apiReferenceLayout).toContain('import docsConfig from "@/api-reference.config"');
    expect(authenticationPage).toContain("# Authentication");
    expect(apiConfig).toContain('entry: "api-reference"');
    expect(apiConfig).toContain('from "@farming-labs/theme/colorful"');
    expect(proxy).toContain('matcher: ["/docs/:path*", "/api-reference/:path*"]');
    expect(proxy).toContain("console.log(`${LOG_PREFIX} ${pathname}`)");
    expect(
      fs.existsSync(path.join(projectRoot, ".docs/site/app/docs/installation/diagram.png")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(projectRoot, ".docs/site/app/api-reference/authentication/page.mdx")),
    ).toBe(true);
  });

  it("builds a Fumadocs API reference from content.openapi", () => {
    const projectRoot = makeTempProject();

    writeFile(
      projectRoot,
      "docs.cloud.json",
      JSON.stringify(
        {
          docs: {
            mode: "frameworkless",
            runtime: "nextjs",
          },
          content: {
            docsRoot: "docs",
            openapi: [
              {
                name: "Core API",
                path: "api/openapi.yaml",
                route: "/api-reference",
              },
            ],
          },
          site: {
            name: "Acme Docs",
            titleTemplate: "%s | Acme Docs",
          },
          theme: {
            preset: "colorful",
          },
        },
        null,
        2,
      ),
    );
    writeFile(
      projectRoot,
      "docs/index.mdx",
      `---
title: "Home"
---

# Home

[API Reference](/api-reference)
`,
    );
    writeFile(
      projectRoot,
      "api/openapi.yaml",
      [
        "openapi: 3.1.0",
        "info:",
        "  title: Core API",
        "  version: 1.0.0",
        "paths:",
        "  /auth/login:",
        "    post:",
        "      summary: Login",
        "      responses:",
        '        "200":',
        "          description: OK",
        "",
      ].join("\n"),
    );

    const runtime = materializeManagedRuntime(projectRoot);

    expect(runtime.homeTarget).toBe("/docs");
    expect(runtime.docs.routes).toEqual(["/docs"]);
    expect(runtime.apiReference.routes).toEqual(["/api-reference"]);

    const docsConfig = fs.readFileSync(
      path.join(projectRoot, ".docs/site/docs.config.ts"),
      "utf-8",
    );
    const rootLayout = fs.readFileSync(
      path.join(projectRoot, ".docs/site/app/layout.tsx"),
      "utf-8",
    );
    const apiReferenceLayout = fs.readFileSync(
      path.join(projectRoot, ".docs/site/app/api-reference/layout.tsx"),
      "utf-8",
    );
    const apiReferencePage = fs.readFileSync(
      path.join(projectRoot, ".docs/site/app/api-reference/[[...slug]]/page.tsx"),
      "utf-8",
    );
    const openApiRoute = fs.readFileSync(
      path.join(projectRoot, ".docs/site/app/api/docs/openapi/route.ts"),
      "utf-8",
    );

    expect(docsConfig).toContain("apiReference:");
    expect(docsConfig).toContain('path: "api-reference"');
    expect(docsConfig).toContain('specUrl: "/api/docs/openapi"');
    expect(docsConfig).toContain('renderer: "fumadocs"');
    expect(rootLayout).toContain("@farming-labs/next/api-reference.css");
    expect(apiReferenceLayout).toContain("createNextApiReferenceLayout");
    expect(apiReferencePage).toContain("createNextApiReferencePage");
    expect(apiReferencePage).not.toContain("@farming-labs/next/api-reference.css");
    expect(openApiRoute).toContain('import { parse } from "yaml"');
    expect(openApiRoute).toContain(
      'const specPath = path.resolve(projectRoot, "api/openapi.yaml")',
    );
    expect(fs.existsSync(path.join(projectRoot, ".docs/site/app/api-reference/page.mdx"))).toBe(
      false,
    );
  });

  it("detects api/openapi.json by convention when content.openapi is omitted", () => {
    const projectRoot = makeTempProject();

    writeFile(
      projectRoot,
      "docs.cloud.json",
      JSON.stringify(
        {
          docs: {
            mode: "frameworkless",
            runtime: "nextjs",
          },
        },
        null,
        2,
      ),
    );
    writeFile(
      projectRoot,
      "api/openapi.json",
      JSON.stringify(
        {
          openapi: "3.1.0",
          info: {
            title: "Convention API",
            version: "1.0.0",
          },
          paths: {
            "/health": {
              get: {
                summary: "Health",
                responses: {
                  "200": {
                    description: "OK",
                  },
                },
              },
            },
          },
        },
        null,
        2,
      ),
    );

    const runtime = materializeManagedRuntime(projectRoot);
    const docsConfig = fs.readFileSync(
      path.join(projectRoot, ".docs/site/docs.config.ts"),
      "utf-8",
    );

    expect(runtime.homeTarget).toBe("/api-reference");
    expect(runtime.apiReference.routes).toEqual(["/api-reference"]);
    expect(docsConfig).toContain('specUrl: "/api/docs/openapi"');
    expect(fs.existsSync(path.join(projectRoot, ".docs/site/app/api/docs/openapi/route.ts"))).toBe(
      true,
    );
  });

  it("passes through a remote OpenAPI URL from content.openapi", () => {
    const projectRoot = makeTempProject();

    writeFile(
      projectRoot,
      "docs.cloud.json",
      JSON.stringify(
        {
          docs: {
            mode: "frameworkless",
            runtime: "nextjs",
          },
          content: {
            openapi: [
              {
                name: "Remote API",
                path: "https://petstore3.swagger.io/api/v3/openapi.json",
                route: "/api-reference",
              },
            ],
          },
        },
        null,
        2,
      ),
    );
    writeFile(
      projectRoot,
      "docs/index.mdx",
      `---
title: "Home"
---

# Home

[API Reference](/api-reference)
`,
    );

    const runtime = materializeManagedRuntime(projectRoot);
    const docsConfig = fs.readFileSync(
      path.join(projectRoot, ".docs/site/docs.config.ts"),
      "utf-8",
    );

    expect(runtime.homeTarget).toBe("/docs");
    expect(runtime.apiReference.routes).toEqual(["/api-reference"]);
    expect(docsConfig).toContain("apiReference:");
    expect(docsConfig).toContain('path: "api-reference"');
    expect(docsConfig).toContain('specUrl: "https://petstore3.swagger.io/api/v3/openapi.json"');
    expect(fs.existsSync(path.join(projectRoot, ".docs/site/app/api/docs/openapi/route.ts"))).toBe(
      false,
    );
  });

  it("tracks source changes through the computed stamp", () => {
    const projectRoot = makeTempProject();

    writeFile(
      projectRoot,
      "docs.cloud.json",
      JSON.stringify(
        {
          docs: {
            mode: "frameworkless",
            runtime: "nextjs",
          },
        },
        null,
        2,
      ),
    );
    writeFile(
      projectRoot,
      "docs/index.mdx",
      `---
title: "Home"
---

# Home
`,
    );

    const firstStamp = computeManagedSourceStamp(projectRoot);
    writeFile(
      projectRoot,
      "docs/index.mdx",
      `---
title: "Home"
---

# Updated Home
`,
    );
    const secondStamp = computeManagedSourceStamp(projectRoot);

    expect(firstStamp).not.toBe(secondStamp);
  });

  it("still accepts the legacy managed framework flag", () => {
    const projectRoot = makeTempProject();

    writeFile(
      projectRoot,
      "docs.cloud.json",
      JSON.stringify(
        {
          docs: {
            framework: "managed",
          },
        },
        null,
        2,
      ),
    );
    writeFile(
      projectRoot,
      "docs/index.mdx",
      `---
title: "Home"
---

# Home
`,
    );

    const runtime = materializeManagedRuntime(projectRoot);

    expect(runtime.homeTarget).toBe("/docs");
    expect(fs.existsSync(path.join(projectRoot, ".docs/site/app/docs/page.mdx"))).toBe(true);
  });

  it("rejects framework mode for frameworkless dev", () => {
    const projectRoot = makeTempProject();

    writeFile(
      projectRoot,
      "docs.cloud.json",
      JSON.stringify(
        {
          docs: {
            mode: "framework",
            runtime: "nextjs",
            root: "apps/docs",
          },
        },
        null,
        2,
      ),
    );

    expect(() => materializeManagedRuntime(projectRoot)).toThrow(
      'docs.cloud.json uses docs.mode = "framework"',
    );
  });
});

describe("parseNextDevLine", () => {
  it("extracts managed route logs from the preview middleware", () => {
    expect(parseNextDevLine("[docs-page] /docs")).toEqual({
      type: "page",
      pathname: "/docs",
    });
  });

  it("extracts local and network URLs from Next.js output", () => {
    expect(parseNextDevLine("  - Local:        http://localhost:3000")).toEqual({
      type: "local",
      url: "http://localhost:3000",
    });
    expect(parseNextDevLine("  - Network:      http://192.168.1.20:3000")).toEqual({
      type: "network",
      url: "http://192.168.1.20:3000",
    });
  });

  it("classifies ready and compile lifecycle lines", () => {
    expect(parseNextDevLine(" ✓ Ready in 1432ms")).toEqual({
      type: "ready",
      duration: "1432ms",
    });
    expect(parseNextDevLine(" ○ Compiling /docs ...")).toEqual({
      type: "compiling",
      target: "/docs",
    });
    expect(parseNextDevLine(" ✓ Compiled /docs in 823ms")).toEqual({
      type: "compiled",
      target: "/docs",
      duration: "823ms",
    });
  });

  it("surfaces warning and error lines we should show to the user", () => {
    expect(parseNextDevLine("Warning: deprecated option in use")).toEqual({
      type: "warning",
      message: "deprecated option in use",
    });
    expect(parseNextDevLine("Module not found: Can't resolve './missing'")).toEqual({
      type: "error",
      message: "Module not found: Can't resolve './missing'",
    });
  });
});
