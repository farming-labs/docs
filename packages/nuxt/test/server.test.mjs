import assert from "node:assert/strict";
import test from "node:test";
import { defineDocsHandler } from "../dist/server.js";

const storage = () => ({
  getKeys: async () => [],
  getItem: async () => null,
});

test("defineDocsHandler keeps discovery HEAD responses bodyless", async () => {
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
    const request = { method: "HEAD", url, headers: {} };
    const response = await handler({
      method: "HEAD",
      headers: {},
      node: { req: request },
    });

    assert.ok(response instanceof Response, `${url} should return a web Response`);
    assert.equal(response.status, 200, `${url} should resolve`);
    assert.equal(await response.text(), "", `${url} should not return a HEAD body`);
  }
});
