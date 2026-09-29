import { describe, expect, it } from "vitest";
import {
  OpenApiContractValidationError,
  assertValidOpenApiContract,
  validateOpenApiContract,
} from "./openapi-contract.js";

describe("validateOpenApiContract", () => {
  it.each(["3.0.4", "3.1.2", "3.2.1"])("accepts OpenAPI %s", (openapi) => {
    expect(
      validateOpenApiContract({
        openapi,
        info: { title: "Example", version: "1.0.0" },
        paths: {},
      }),
    ).toEqual({
      valid: true,
      dialect: "openapi",
      version: openapi,
      operationCount: 0,
      diagnostics: [],
    });
  });

  it("accepts Swagger 2.0", () => {
    expect(
      validateOpenApiContract({
        swagger: "2.0",
        info: { title: "Example", version: "1.0.0" },
        paths: {},
      }),
    ).toMatchObject({
      valid: true,
      dialect: "swagger",
      version: "2.0",
    });
  });

  it.each([
    [{ openapi: "4.0.0" }, "unsupported-version", "/openapi"],
    [{ openapi: "3.1" }, "invalid-version", "/openapi"],
    [{ swagger: "1.2" }, "unsupported-version", "/swagger"],
    [{ paths: {} }, "missing-version", "/"],
    [{ openapi: "3.1.0", swagger: "2.0" }, "conflicting-version-fields", "/"],
  ] as const)("rejects an unsupported contract marker", (document, code, path) => {
    expect(validateOpenApiContract(document)).toMatchObject({
      valid: false,
      diagnostics: [{ code, path }],
    });
  });

  it("returns deterministic duplicate operationId diagnostics across paths and callbacks", () => {
    const result = validateOpenApiContract({
      openapi: "3.1.0",
      paths: {
        "/projects": {
          get: {
            operationId: "listProjects",
            callbacks: {
              updated: {
                "{$request.body#/callbackUrl}": {
                  post: { operationId: "listProjects" },
                },
              },
            },
          },
        },
        "/teams": {
          get: { operationId: "listProjects" },
        },
      },
    });

    expect(result.operationCount).toBe(3);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "duplicate-operation-id",
        path: "/paths/~1projects/get/callbacks/updated/{$request.body#~1callbackUrl}/post/operationId",
        relatedPath: "/paths/~1projects/get/operationId",
      }),
      expect.objectContaining({
        code: "duplicate-operation-id",
        path: "/paths/~1teams/get/operationId",
        relatedPath: "/paths/~1projects/get/operationId",
      }),
    ]);
  });

  it("reports malformed paths and operations without throwing", () => {
    expect(
      validateOpenApiContract({
        openapi: "3.2.0",
        paths: {
          "/projects": { get: "not-an-operation" },
          "/teams": null,
        },
        webhooks: [],
      }).diagnostics,
    ).toEqual([
      expect.objectContaining({
        code: "invalid-operation",
        path: "/paths/~1projects/get",
      }),
      expect.objectContaining({
        code: "invalid-path-item",
        path: "/paths/~1teams",
      }),
      expect.objectContaining({
        code: "invalid-webhooks",
        path: "/webhooks",
      }),
    ]);
  });

  it("throws an error that retains the structured diagnostics", () => {
    expect.assertions(3);
    try {
      assertValidOpenApiContract({ openapi: "4.0.0", paths: {} });
    } catch (error) {
      expect(error).toBeInstanceOf(OpenApiContractValidationError);
      expect(error).toHaveProperty("diagnostics.0.code", "unsupported-version");
      expect(error).toHaveProperty("message", expect.stringContaining("/openapi"));
    }
  });
});
