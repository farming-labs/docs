import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { McpServer, InMemoryTransport } from "@modelcontextprotocol/server";
import { mountSpecify, resolveSpecify } from "../specify.js";
import { describe, expect, it } from "vitest";
import { specifyArgs } from "./specify.js";

describe("docs spec", () => {
  it("supplies project paths and keeps worker arguments after the separator", () => {
    expect(
      specifyArgs([
        "--specify-package",
        "local/pkg",
        "run",
        "--",
        "worker",
        "--approved",
        "untouched",
      ]),
    ).toEqual({
      packageDir: "local/pkg",
      args: [
        "run",
        "--pages",
        "specs/pages",
        "--approved",
        path.join("specs", "specs.approved.json"),
        "--",
        "worker",
        "--approved",
        "untouched",
      ],
    });
  });

  it("passes explicit approval paths in the format understood by interactive approval and watch", () => {
    expect(
      specifyArgs(["approve", "--pages=private/pages", "--approved=state/a=b.json"]).args,
    ).toEqual(["approve", "--pages", "private/pages", "--approved", "state/a=b.json"]);
    expect(() => specifyArgs(["watch", "--approved"])).toThrow(/--approved/);
  });

  it("honors an external approved file and a custom proposal directory", () => {
    expect(
      specifyArgs(["watch", "--initial", "--approved", "state/file.json", "--specs", "private"]),
    ).toEqual({
      args: ["watch", "--initial", "--approved", "state/file.json"],
    });
    expect(specifyArgs(["list", "--specs", "private", "--json"]).args).toEqual([
      "list",
      "--json",
      "--pages",
      "private/pages",
    ]);
  });
});

it("resolves the project's package and mounts its private registration with read-only defaults", async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "docs-specify-")));
  const dir = path.join(root, "node_modules", "@assistant-ui", "specify");
  try {
    expect(() => resolveSpecify(root)).toThrow(/Install @assistant-ui\/specify/);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "@assistant-ui/specify",
        type: "module",
        exports: { ".": "./index.js", "./mcp": "./mcp.js" },
        bin: { specify: "./cli.js" },
      }),
    );
    await writeFile(path.join(dir, "index.js"), "export {}");
    await writeFile(path.join(dir, "cli.js"), "");
    await writeFile(
      path.join(dir, "mcp.js"),
      'export function registerSpecifyMcp(server, options) { server.registerTool("specify_fixture", {}, async () => ({content:[{type:"text",text:JSON.stringify(options)}]})); }',
    );
    expect(resolveSpecify(root).bin).toBe(path.join(dir, "cli.js"));
    const server = new McpServer({ name: "private-host", version: "1" });
    await mountSpecify(server, root, { directory: "private", packageDir: dir }, "legacy");
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "1" });
    try {
      await server.connect(b);
      await client.connect(a);
      const result = await client.callTool({ name: "specify_fixture" });
      expect(result.content).toEqual([
        {
          type: "text",
          text: JSON.stringify({
            root,
            era: "legacy",
            pages: path.join("private", "pages"),
            approved: path.join("private", "specs.approved.json"),
            allowProposals: false,
          }),
        },
      ]);
    } finally {
      await client.close();
      await server.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
