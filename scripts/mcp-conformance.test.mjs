import assert from "node:assert/strict";
import { test } from "node:test";

import { MCP_CONFORMANCE_ADAPTERS } from "./mcp-conformance-server.mjs";
import {
  getMcpConformanceScenarios,
  MCP_CONFORMANCE_PACKAGE_VERSION,
  MCP_CONFORMANCE_PROTOCOL_VERSIONS,
} from "./run-mcp-conformance.mjs";

test("covers all five first-party framework adapters", () => {
  assert.deepEqual(MCP_CONFORMANCE_ADAPTERS, ["next", "tanstack-start", "nuxt", "astro", "svelte"]);
});

test("pins the official runner and both supported protocol versions", () => {
  assert.match(MCP_CONFORMANCE_PACKAGE_VERSION, /^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/);
  assert.deepEqual(MCP_CONFORMANCE_PROTOCOL_VERSIONS, ["2025-11-25", "2026-07-28"]);
});

test("selects lifecycle and capability-neutral scenarios for each protocol", () => {
  assert.deepEqual(getMcpConformanceScenarios("2025-11-25"), [
    "server-initialize",
    "ping",
    "tools-list",
    "resources-list",
  ]);
  assert.deepEqual(getMcpConformanceScenarios("2026-07-28"), [
    "server-stateless",
    "tools-list",
    "resources-list",
    "dns-rebinding-protection",
    "http-header-validation",
  ]);
});

test("rejects protocol versions outside the supported matrix", () => {
  assert.throws(() => getMcpConformanceScenarios("2025-06-18"), /Unsupported protocol version/);
});
