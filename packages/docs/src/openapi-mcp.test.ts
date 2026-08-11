import { describe, expect, it } from "vitest";
import { resolveDocsOpenApiMcpBaseUrl, resolveDocsOpenApiMcpOperations } from "./openapi-mcp.js";

const document = {
  openapi: "3.1.0",
  servers: [{ url: "https://api.example.com/v1" }],
  security: [{ bearerAuth: ["read:users"] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
      unusedKey: { type: "apiKey", in: "header", name: "x-unused" },
    },
  },
  paths: {
    "/users/{id}": {
      parameters: [{ name: "id", in: "path", required: true }],
      get: {
        operationId: "getUser",
        summary: "Get a user",
        parameters: [{ name: "expand", in: "query" }],
      },
      delete: {
        operationId: "deleteUser",
        summary: "Delete a user",
      },
    },
    "/health": {
      get: {
        operationId: "healthCheck",
        "x-farming-labs-mcp": true,
      },
    },
  },
};

describe("OpenAPI MCP projection", () => {
  it("is deny-by-default and requires an explicit config", () => {
    expect(resolveDocsOpenApiMcpOperations(document)).toEqual([]);
    expect(resolveDocsOpenApiMcpOperations(document, { enabled: true, operations: [] })).toEqual([
      expect.objectContaining({ operationId: "healthCheck", readOnly: true }),
    ]);
  });

  it("projects only allowed safe operations with security metadata", () => {
    const operations = resolveDocsOpenApiMcpOperations(document, {
      enabled: true,
      operations: ["getUser", "deleteUser"],
    });

    expect(operations.map((operation) => operation.operationId)).toEqual([
      "getUser",
      "healthCheck",
    ]);
    expect(operations.find((operation) => operation.operationId === "getUser")).toMatchObject({
      toolName: "api_getUser",
      method: "GET",
      parameters: [
        { name: "id", in: "path", required: true },
        { name: "expand", in: "query", required: false },
      ],
      security: [{ bearerAuth: ["read:users"] }],
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      readOnly: true,
      destructive: false,
      idempotent: true,
    });
  });

  it("requires a second opt-in before exposing mutations", () => {
    const operations = resolveDocsOpenApiMcpOperations(document, {
      enabled: true,
      operations: ["deleteUser"],
      allowMutations: true,
    });

    expect(operations.find((operation) => operation.operationId === "deleteUser")).toMatchObject({
      method: "DELETE",
      destructive: true,
      idempotent: true,
    });
  });

  it("resolves an explicit base URL before the OpenAPI servers list", () => {
    expect(
      resolveDocsOpenApiMcpBaseUrl(document, { baseUrl: "https://override.example.com" }),
    ).toBe("https://override.example.com");
    expect(resolveDocsOpenApiMcpBaseUrl(document, {})).toBe("https://api.example.com/v1");
  });
});
