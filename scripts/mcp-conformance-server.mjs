#!/usr/bin/env node

import { createServer } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

export const MCP_CONFORMANCE_ADAPTERS = ["next", "tanstack-start", "nuxt", "astro", "svelte"];

const FIXTURE_PAGE = `---
title: MCP conformance
description: Adapter-neutral MCP conformance fixture.
---

# MCP conformance

Use this page to verify that every framework adapter exposes the same MCP transport.
`;

function readArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function createSharedConfig() {
  return {
    entry: "docs",
    nav: { title: "Farming Labs MCP conformance" },
    baseUrl: "http://localhost",
    mcp: {
      enabled: true,
      name: "farming-labs-mcp-conformance",
    },
    _preloadedContent: {
      "/docs/page.mdx": FIXTURE_PAGE,
    },
    _preloadedAgentSkills: [],
  };
}

async function createAdapterHandler(adapter) {
  const config = createSharedConfig();

  if (adapter === "next") {
    const rootDir = await mkdtemp(join(tmpdir(), "farming-labs-mcp-conformance-next-"));
    await mkdir(join(rootDir, "app", "docs"), { recursive: true });
    await writeFile(join(rootDir, "app", "docs", "page.mdx"), FIXTURE_PAGE);

    const { createDocsMCPAPI } = await import("../packages/next/dist/api.mjs");
    const handlers = createDocsMCPAPI({ ...config, rootDir });

    return {
      async handle(request) {
        const method = request.method.toUpperCase();
        const handler = handlers[method];
        return handler
          ? handler(request)
          : new Response("Method not allowed", {
              status: 405,
              headers: { Allow: "GET, POST, DELETE, OPTIONS" },
            });
      },
      async close() {
        await rm(rootDir, { recursive: true, force: true });
      },
    };
  }

  const modulePaths = {
    "tanstack-start": "../packages/tanstack-start/dist/server.js",
    nuxt: "../packages/nuxt/dist/server.js",
    astro: "../packages/astro/dist/server.js",
    svelte: "../packages/svelte/dist/server.js",
  };
  const modulePath = modulePaths[adapter];
  if (!modulePath) {
    throw new Error(
      `Unknown adapter ${JSON.stringify(adapter)}. Expected one of: ${MCP_CONFORMANCE_ADAPTERS.join(", ")}`,
    );
  }

  const { createDocsServer } = await import(modulePath);
  const server = createDocsServer(config);

  return {
    async handle(request) {
      const method = request.method.toUpperCase();
      const handler = server.MCP[method === "HEAD" ? "GET" : method];
      return handler
        ? handler({ request })
        : new Response("Method not allowed", {
            status: 405,
            headers: { Allow: "GET, HEAD, POST, DELETE, OPTIONS" },
          });
    },
    async close() {
      await server.MCP.close();
    },
  };
}

async function toWebRequest(request, origin) {
  const method = request.method?.toUpperCase() ?? "GET";
  let body;
  if (method !== "GET" && method !== "HEAD") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    if (chunks.length > 0) body = Buffer.concat(chunks);
  }

  return new Request(new URL(request.url ?? "/", origin), {
    method,
    headers: request.headers,
    ...(body ? { body } : {}),
  });
}

async function sendWebResponse(response, target) {
  target.statusCode = response.status;
  target.statusMessage = response.statusText;
  response.headers.forEach((value, name) => target.setHeader(name, value));

  if (!response.body) {
    target.end();
    return;
  }

  await new Promise((resolve, reject) => {
    Readable.fromWeb(response.body).once("error", reject).pipe(target).once("finish", resolve);
  });
}

export async function startMcpConformanceServer({
  adapter,
  hostname = "127.0.0.1",
  port = 0,
} = {}) {
  if (!MCP_CONFORMANCE_ADAPTERS.includes(adapter)) {
    throw new Error(
      `Unknown adapter ${JSON.stringify(adapter)}. Expected one of: ${MCP_CONFORMANCE_ADAPTERS.join(", ")}`,
    );
  }

  const adapterHandler = await createAdapterHandler(adapter);
  let origin = `http://${hostname}:${port}`;
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", origin);
      if (url.pathname === "/healthz") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ adapter, ready: true }));
        return;
      }
      if (url.pathname !== "/mcp") {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      const webRequest = await toWebRequest(request, origin);
      const webResponse = await adapterHandler.handle(webRequest);
      await sendWebResponse(webResponse, response);
    } catch (error) {
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "application/json" });
      }
      response.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, hostname, resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not resolve the MCP conformance server address.");
  }
  origin = `http://${hostname}:${address.port}`;

  return {
    adapter,
    origin,
    mcpUrl: `${origin}/mcp`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections?.();
      });
      await adapterHandler.close();
    },
  };
}

async function main() {
  const adapter = readArgument("--adapter", process.env.DOCS_MCP_CONFORMANCE_ADAPTER);
  const hostname = readArgument("--hostname", "127.0.0.1");
  const port = Number(readArgument("--port", process.env.PORT ?? "3100"));
  const running = await startMcpConformanceServer({ adapter, hostname, port });

  console.log(JSON.stringify({ adapter, mcpUrl: running.mcpUrl, ready: true }));

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await running.close();
    process.exitCode = 0;
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
