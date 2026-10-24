import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { createDocsMcpServerCard, createDocsMcpServerCardResponse } from "./mcp-server-card.js";

describe("createDocsMcpServerCard", () => {
  it("namespaces a plain server name by the endpoint host and keeps it as the title", () => {
    expect(
      createDocsMcpServerCard({
        endpointUrl: "https://farmjs.dev/api/docs/mcp",
        name: "Farm.js",
        version: "1.2.3",
        websiteUrl: "https://farmjs.dev/docs",
      }),
    ).toEqual({
      $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
      name: "dev.farmjs/docs",
      version: "1.2.3",
      description: "Search and read the Farm.js documentation.",
      title: "Farm.js",
      websiteUrl: "https://farmjs.dev/docs",
      remotes: [
        {
          type: "streamable-http",
          url: "https://farmjs.dev/api/docs/mcp",
          supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
        },
      ],
    });
  });

  it("keeps a reverse-DNS name, truncates long descriptions, and avoids reversing IP hosts", () => {
    const card = createDocsMcpServerCard({
      endpointUrl: "https://example.com/mcp",
      name: "com.example/docs",
      version: "0.0.0",
      description: "x".repeat(150),
    });
    expect(card.name).toBe("com.example/docs");
    expect(card.title).toBeUndefined();
    expect(card.description).toHaveLength(100);
    expect(
      createDocsMcpServerCard({
        endpointUrl: "http://127.0.0.1:3000/mcp",
        name: "Docs",
        version: "1",
      }).name,
    ).toBe("local/docs");
  });
});

describe("createDocsMcpServerCardResponse", () => {
  const card = createDocsMcpServerCard({
    endpointUrl: "https://example.com/mcp",
    name: "Docs",
    version: "1.0.0",
  });

  it("serves the card with CORS and a revalidating ETag", async () => {
    const response = createDocsMcpServerCardResponse(
      new Request("https://example.com/mcp/server-card"),
      card,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/mcp-server-card+json; charset=utf-8",
    );
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(await response.json()).toEqual(card);

    const etag = response.headers.get("etag");
    expect(etag).toBeTruthy();
    const revalidated = createDocsMcpServerCardResponse(
      new Request("https://example.com/mcp/server-card", { headers: { "If-None-Match": etag! } }),
      card,
    );
    expect(revalidated.status).toBe(304);
  });

  it("answers preflight, HEAD, and rejects writes", async () => {
    const preflight = createDocsMcpServerCardResponse(
      new Request("https://example.com/mcp/server-card", { method: "OPTIONS" }),
      card,
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toBe("GET, HEAD, OPTIONS");

    const head = createDocsMcpServerCardResponse(
      new Request("https://example.com/mcp/server-card", { method: "HEAD" }),
      card,
    );
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");

    const post = createDocsMcpServerCardResponse(
      new Request("https://example.com/mcp/server-card", { method: "POST", body: "{}" }),
      card,
    );
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
  });
});
