import { describe, expect, it } from "vitest";
import { defineDocsHandler, defineDocsPublicHandler } from "../src/server.js";

const storage = () => ({
  getKeys: async () => [],
  getItem: async () => null,
});

function createEvent(method: string, url: string) {
  const request = { method, url, headers: {} };
  return {
    method,
    headers: {},
    node: { req: request },
  } as any;
}

describe("defineDocsHandler discovery requests", () => {
  it("keeps discovery HEAD responses bodyless", async () => {
    const handler = defineDocsHandler({ entry: "docs", title: "Example Docs" }, storage);
    const routes = [
      "/api/docs?format=api-catalog",
      "/api/docs?format=agent-skills",
      "/api/docs?format=agent-skill&name=docs",
      "/api/docs?agent=spec",
      "/api/docs?format=config",
      "/api/docs?format=diagnostics",
    ];

    for (const url of routes) {
      const response = await handler(createEvent("HEAD", url));

      expect(response).toBeInstanceOf(Response);
      expect(response.status, `${url} should resolve`).toBe(200);
      expect(await response.text(), `${url} should not return a HEAD body`).toBe("");
    }
  });

  it("keeps configured API URLs in diagnostics requested through a public route", async () => {
    const handler = defineDocsHandler(
      {
        entry: "docs",
        title: "Example Docs",
        cloud: { apiRoute: "/api/internal/docs" },
        apiReference: true,
      },
      storage,
    );
    const response = await handler(
      createEvent("GET", "/.well-known/api-catalog?format=diagnostics"),
    );
    const diagnostics = await response.json();

    expect(diagnostics.routes).toMatchObject({
      api: "/api/internal/docs",
      config: "/api/internal/docs?format=config",
      diagnostics: "/api/internal/docs?format=diagnostics",
      search: "/api/internal/docs?query={query}",
    });

    const llmsResponse = await handler(createEvent("GET", "/llms.txt"));
    const llms = await llmsResponse.text();
    expect(llms).toContain("/api/internal/docs?format=openapi");
    expect(llms).not.toContain("/api/docs?format=openapi");
  });

  it("uses an inferred API route in generated llms discovery", async () => {
    const handler = defineDocsHandler(
      {
        entry: "docs",
        title: "Example Docs",
        apiReference: true,
      },
      storage,
    );
    const defaultResponse = await handler(createEvent("GET", "/api/docs?format=llms"));
    expect(await defaultResponse.text()).toContain("/api/docs?format=openapi");

    const response = await handler(createEvent("GET", "/api/internal/docs?format=llms"));
    const llms = await response.text();

    expect(response.status).toBe(200);
    expect(llms).toContain("/api/internal/docs?format=openapi");
    expect(llms).not.toContain("/api/docs?format=openapi");
  });

  it("rejects unsupported discovery methods without coercing them to GET", async () => {
    const handler = defineDocsHandler({ entry: "docs", title: "Example Docs" }, storage);

    for (const method of ["POST", "PUT", "TRACE", "CONNECT"]) {
      const response = await handler(createEvent(method, "/api/docs?format=agent-skills"));

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD");
      expect(await response.text()).toBe("Method Not Allowed");
    }

    const unrelated = await handler(createEvent("PUT", "/api/docs?query=docs"));
    expect(unrelated.status).toBe(405);
    expect(unrelated.headers.get("allow")).toBe("GET, HEAD, POST");

    const forbiddenMethod = await handler(createEvent("TRACE", "/api/docs?query=docs"));
    expect(forbiddenMethod.status).toBe(405);
    expect(forbiddenMethod.headers.get("allow")).toBe("GET, HEAD, POST");
  });
});

describe("defineDocsPublicHandler discovery requests", () => {
  it("uses bodyless HEAD and shared method rejection for public discovery", async () => {
    const handler = defineDocsPublicHandler({ entry: "docs", title: "Example Docs" }, storage);

    for (const url of [
      "/.well-known/api-catalog",
      "/.well-known/agent-skills/index.json",
      "/.well-known/agent.json",
      "/AGENTS.md",
      "/skill.md",
    ]) {
      const response = await handler(createEvent("HEAD", url));

      expect(response).toBeInstanceOf(Response);
      expect(response.status, `${url} should resolve`).toBe(200);
      expect(await response.text(), `${url} should not return a HEAD body`).toBe("");
    }

    for (const method of ["POST", "PUT", "TRACE", "CONNECT"]) {
      const response = await handler(createEvent(method, "/.well-known/api-catalog"));

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD");
      expect(await response.text()).toBe("Method Not Allowed");
    }

    expect(await handler(createEvent("TRACE", "/unrelated"))).toBeUndefined();
  });

  it("screens query discovery against the configured API route", async () => {
    const handler = defineDocsPublicHandler(
      {
        entry: "docs",
        title: "Example Docs",
        cloud: { apiRoute: "/api/internal/docs" },
      },
      storage,
    );

    const defaultRoute = await handler(createEvent("PUT", "/api/docs?format=agent-skills"));
    expect(defaultRoute).toBeUndefined();

    const configuredRoute = await handler(
      createEvent("PUT", "/api/internal/docs?format=agent-skills"),
    );
    expect(configuredRoute).toBeInstanceOf(Response);
    expect(configuredRoute.status).toBe(405);
    expect(configuredRoute.headers.get("allow")).toBe("GET, HEAD");
  });
});
