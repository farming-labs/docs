import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it } from "vitest";
import { createDocsAuthoringMcpServer } from "./authoring-mcp.js";
import { createDocsMcpServer } from "./mcp.js";

describe("protected authoring MCP", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function createProject() {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), "docs-authoring-mcp-"));
    temporaryDirectories.push(rootDir);
    mkdirSync(path.join(rootDir, "docs", "install"), { recursive: true });
    writeFileSync(
      path.join(rootDir, "docs", "install", "page.mdx"),
      "---\ntitle: Install\n---\n\n# Install\n\nRun the installer.\n",
      "utf8",
    );
    execFileSync("git", ["init", "-b", "main"], { cwd: rootDir, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "docs@example.com"], { cwd: rootDir });
    execFileSync("git", ["config", "user.name", "Docs Test"], { cwd: rootDir });
    execFileSync("git", ["add", "."], { cwd: rootDir });
    execFileSync("git", ["commit", "-m", "initial"], { cwd: rootDir, stdio: "ignore" });
    return rootDir;
  }

  it("keeps publishing absent by default and enforces hash-checked docs-only writes", async () => {
    const rootDir = createProject();
    const server = await createDocsAuthoringMcpServer({
      rootDir,
      contentDir: "docs",
      entry: "docs",
      doctorCommand: [process.execPath, "-e", "console.log(JSON.stringify({ok:true}))"],
    });
    const client = new Client({ name: "authoring-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).not.toContain("authoring_publish_draft_pr");
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          "authoring_create_branch",
          "authoring_read_doc",
          "authoring_write_doc",
          "authoring_preview_doc",
          "authoring_run_doctor",
          "authoring_diff",
          "authoring_analyze_feedback",
        ]),
      );

      await client.callTool({
        name: "authoring_create_branch",
        arguments: { branch: "docs/improve-install" },
      });
      const read = await client.callTool({
        name: "authoring_read_doc",
        arguments: { path: "docs/install/page.mdx" },
      });
      const state = read.structuredContent as { sha256: string };
      const staleWrite = await client.callTool({
        name: "authoring_write_doc",
        arguments: {
          path: "docs/install/page.mdx",
          content: "changed",
          expectedSha256: "0".repeat(64),
        },
      });
      expect(staleWrite.isError).toBe(true);
      expect(JSON.stringify(staleWrite)).toMatch(/changed since it was read/i);

      await client.callTool({
        name: "authoring_write_doc",
        arguments: {
          path: "docs/install/page.mdx",
          content: "---\ntitle: Install\n---\n\n# Install\n\nRun pnpm install.\n",
          expectedSha256: state.sha256,
        },
      });
      const outsideRead = await client.callTool({
        name: "authoring_read_doc",
        arguments: { path: "README.md" },
      });
      expect(outsideRead.isError).toBe(true);
      expect(JSON.stringify(outsideRead)).toMatch(/restricted to docs/i);
      writeFileSync(path.join(rootDir, "outside.mdx"), "# Outside\n", "utf8");
      symlinkSync(path.join(rootDir, "outside.mdx"), path.join(rootDir, "docs", "linked.mdx"));
      const symlinkRead = await client.callTool({
        name: "authoring_read_doc",
        arguments: { path: "docs/linked.mdx" },
      });
      expect(symlinkRead.isError).toBe(true);
      expect(JSON.stringify(symlinkRead)).toMatch(/symbolic links/i);

      const preview = await client.callTool({
        name: "authoring_preview_doc",
        arguments: { path: "docs/install/page.mdx" },
      });
      expect(JSON.stringify(preview)).toContain("Run pnpm install");
      const doctor = await client.callTool({ name: "authoring_run_doctor", arguments: {} });
      expect(doctor.structuredContent).toMatchObject({ ok: true, exitCode: 0 });
      const diff = await client.callTool({ name: "authoring_diff", arguments: {} });
      expect(JSON.stringify(diff)).toContain("Run pnpm install");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("registers external publication only with explicit operator permission", async () => {
    const rootDir = createProject();
    const server = await createDocsAuthoringMcpServer({
      rootDir,
      allowPublish: true,
    });
    const client = new Client({ name: "authoring-publish-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain("authoring_publish_draft_pr");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("never adds authoring tools to the public documentation MCP", async () => {
    const server = await createDocsMcpServer({
      source: {
        entry: "docs",
        siteTitle: "Public Docs",
        getPages: () => [],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });
    const client = new Client({ name: "public-mcp-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const tools = await client.listTools();
      expect(
        tools.tools.map((tool) => tool.name).some((name) => name.startsWith("authoring_")),
      ).toBe(false);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
