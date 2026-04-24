import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspectAgentReadiness, parseDoctorArgs } from "./doctor.js";

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
});

describe("inspectAgentReadiness", () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "docs-doctor-"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("scores a healthy Next.js docs app as agent-optimized", async () => {
    writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        name: "doctor-next",
        private: true,
        dependencies: {
          next: "16.0.0",
        },
      }),
      "utf-8",
    );

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
    expect(report.checks.find((check) => check.id === "skill")?.status).toBe("pass");
    expect(report.checks.find((check) => check.id === "feedback")?.status).toBe("pass");
    expect(report.checks.find((check) => check.id === "compact")?.status).toBe("pass");
  });

  it("returns a failing report when docs config is missing", async () => {
    writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        name: "doctor-missing-config",
        private: true,
        dependencies: {
          next: "16.0.0",
        },
      }),
      "utf-8",
    );

    process.chdir(tmpDir);

    const report = await inspectAgentReadiness();

    expect(report.score).toBe(0);
    expect(report.grade).toBe("Needs work");
    expect(report.checks).toHaveLength(1);
    expect(report.checks[0]?.status).toBe("fail");
    expect(report.checks[0]?.title).toBe("Docs config");
  });
});
