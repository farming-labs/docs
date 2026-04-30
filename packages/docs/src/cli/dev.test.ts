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
            framework: "managed",
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
      path.join(projectRoot, ".docs-cloud/site/app/docs/page.mdx"),
      "utf-8",
    );
    const installationPage = fs.readFileSync(
      path.join(projectRoot, ".docs-cloud/site/app/docs/installation/page.mdx"),
      "utf-8",
    );
    const apiConfig = fs.readFileSync(
      path.join(projectRoot, ".docs-cloud/site/api-reference.config.ts"),
      "utf-8",
    );
    const authenticationPage = fs.readFileSync(
      path.join(projectRoot, ".docs-cloud/site/app/api-reference/authentication/page.mdx"),
      "utf-8",
    );
    const proxy = fs.readFileSync(
      path.join(projectRoot, ".docs-cloud/site/proxy.ts"),
      "utf-8",
    );

    expect(docsIndex).toContain("[Installation](installation)");
    expect(docsIndex).toContain("[Authentication](../api-reference/authentication)");
    expect(installationPage).toContain("[Back home](..)");
    expect(authenticationPage).toContain("# Authentication");
    expect(apiConfig).toContain('entry: "api-reference"');
    expect(apiConfig).toContain('from "@farming-labs/theme/colorful"');
    expect(proxy).toContain('matcher: ["/docs/:path*", "/api-reference/:path*"]');
    expect(proxy).toContain('console.log(`${LOG_PREFIX} ${pathname}`)');
    expect(
      fs.existsSync(path.join(projectRoot, ".docs-cloud/site/app/docs/installation/diagram.png")),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(projectRoot, ".docs-cloud/site/app/api-reference/authentication/page.mdx"),
      ),
    ).toBe(true);
  });

  it("tracks source changes through the computed stamp", () => {
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
