import { describe, expect, it } from "vitest";
import { buildNormalizedOpenApiModel } from "./openapi-operations.js";

describe("buildNormalizedOpenApiModel", () => {
  it("builds stable operations with referenced schemas, examples, and security", () => {
    const model = buildNormalizedOpenApiModel({
      openapi: "3.1.0",
      info: { title: "Pets", version: "2.0.0" },
      servers: [{ url: "https://api.example.com" }],
      security: [{ bearerAuth: ["pets:read"] }],
      paths: {
        "/pets/{id}": { $ref: "#/components/pathItems/Pet" },
        "/health": { get: { responses: { "204": { description: "Healthy" } } } },
      },
      components: {
        pathItems: {
          Pet: {
            parameters: [{ $ref: "#/components/parameters/PetId" }],
            get: {
              operationId: "getPet",
              summary: "Get a pet",
              tags: ["Pets"],
              parameters: [
                { name: "id", in: "path", required: true, description: "Override" },
                { name: "expand", in: "query", example: "owner" },
              ],
              responses: {
                "200": { $ref: "#/components/responses/Pet" },
              },
            },
          },
        },
        parameters: {
          PetId: { name: "id", in: "path", required: true, description: "Pet ID" },
        },
        responses: {
          Pet: {
            description: "A pet",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Pet" },
                examples: {
                  cat: { summary: "Cat", value: { id: "cat-1" } },
                },
              },
            },
          },
        },
        schemas: { Pet: { type: "object" } },
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer" },
          unused: { type: "apiKey", in: "header", name: "x-unused" },
        },
      },
    });

    expect(model).toMatchObject({
      title: "Pets",
      version: "2.0.0",
      specificationVersion: "3.1.0",
      operationCount: 2,
      servers: ["https://api.example.com"],
      tags: ["Health", "Pets"],
    });
    const operation = model.operations.find((item) => item.operationId === "getPet");
    expect(operation).toMatchObject({
      id: "getPet",
      operationIdSource: "explicit",
      slug: expect.stringMatching(/^get-pet-[a-z0-9]+$/),
      selector: "GET /pets/{id}",
      pointer: "/paths/~1pets~1{id}/get",
      tags: ["Pets"],
      parameters: [
        { name: "id", in: "path", required: true, description: "Override" },
        { name: "expand", in: "query", required: false },
      ],
      responses: [
        {
          status: "200",
          content: [
            {
              mediaType: "application/json",
              schema: { $ref: "#/components/schemas/Pet" },
            },
          ],
        },
      ],
      security: [{ bearerAuth: ["pets:read"] }],
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      examples: [
        expect.objectContaining({ name: "default", location: "parameter", value: "owner" }),
        expect.objectContaining({ name: "cat", location: "response", status: "200" }),
      ],
    });

    const generated = model.operations.find((item) => item.path === "/health");
    expect(generated).toMatchObject({
      operationId: "get__health",
      operationIdSource: "generated",
      selector: "GET /health",
      tags: ["Health"],
    });
  });

  it("normalizes Swagger 2.0 body schemas, responses, and servers", () => {
    const model = buildNormalizedOpenApiModel({
      swagger: "2.0",
      info: { title: "Legacy", version: "1" },
      host: "api.example.com",
      basePath: "/v1",
      schemes: ["https"],
      consumes: ["application/json"],
      produces: ["application/json"],
      paths: {
        "/pets": {
          post: {
            operationId: "createPet",
            parameters: [
              { name: "pet", in: "body", required: true, schema: { $ref: "#/definitions/Pet" } },
            ],
            responses: {
              "201": {
                description: "Created",
                schema: { $ref: "#/definitions/Pet" },
                examples: { "application/json": { id: "pet-1" } },
              },
            },
          },
        },
      },
      definitions: { Pet: { type: "object" } },
    });

    expect(model.servers).toEqual(["https://api.example.com/v1"]);
    expect(model.operations[0]).toMatchObject({
      requestBody: {
        required: true,
        content: [{ mediaType: "application/json", schema: { $ref: "#/definitions/Pet" } }],
      },
      responses: [
        {
          status: "201",
          content: [
            {
              mediaType: "application/json",
              examples: [{ value: { id: "pet-1" } }],
            },
          ],
        },
      ],
    });
  });

  it("rejects duplicate explicit and generated operation IDs deterministically", () => {
    expect(() =>
      buildNormalizedOpenApiModel({
        openapi: "3.1.0",
        paths: {
          "/health": { get: {} },
          "/other": { get: { operationId: "get__health" } },
        },
      }),
    ).toThrow("`get__health` is used at /paths/~1health/get and /paths/~1other/get");
  });
});
