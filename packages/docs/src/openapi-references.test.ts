import { describe, expect, it, vi } from "vitest";
import {
  OPENAPI_BUNDLED_REFERENCES_EXTENSION,
  resolveOpenApiReferences,
  resolveOpenApiReferencesSync,
} from "./openapi-references.js";

describe("OpenAPI reference resolution", () => {
  it("validates and preserves internal JSON Pointer references", () => {
    const document = {
      openapi: "3.1.0",
      paths: {
        "/pets": { $ref: "#/components/pathItems/Pets" },
      },
      components: {
        pathItems: {
          Pets: { get: { operationId: "listPets" } },
        },
      },
    };

    expect(
      resolveOpenApiReferencesSync(document, {
        sourceUri: "file:///project/openapi.yaml",
      }),
    ).toEqual(document);
    expect(() =>
      resolveOpenApiReferencesSync(
        { ...document, paths: { "/pets": { $ref: "#/components/pathItems/Missing" } } },
        { sourceUri: "file:///project/openapi.yaml" },
      ),
    ).toThrow("target was not found");
  });

  it("bundles each external document once and rewrites nested references", () => {
    const loadDocument = vi.fn((uri: URL) => {
      if (uri.href === "file:///project/paths.yaml") {
        return {
          uri: uri.href,
          document: {
            Pets: {
              get: {
                operationId: "listPets",
                responses: { "200": { $ref: "./responses.yaml#/PetList" } },
              },
            },
          },
        };
      }
      if (uri.href === "file:///project/responses.yaml") {
        return {
          uri: uri.href,
          document: {
            PetList: {
              description: "Pet list",
              content: {
                "application/json": { schema: { $ref: "#/PetListSchema" } },
              },
            },
            PetListSchema: { type: "array", items: { type: "string" } },
          },
        };
      }
      throw new Error(`Unexpected URI: ${uri.href}`);
    });

    const resolved = resolveOpenApiReferencesSync(
      {
        openapi: "3.1.0",
        paths: {
          "/pets": { $ref: "./paths.yaml#/Pets" },
          "/animals": { $ref: "./paths.yaml#/Pets" },
        },
      },
      { sourceUri: "file:///project/openapi.yaml", loadDocument },
    );
    const bundle = resolved[OPENAPI_BUNDLED_REFERENCES_EXTENSION] as Record<string, unknown>;
    const serialized = JSON.stringify(resolved);

    expect(loadDocument).toHaveBeenCalledTimes(2);
    expect(Object.keys(bundle)).toHaveLength(2);
    expect(serialized).not.toContain("./paths.yaml");
    expect(serialized).not.toContain("./responses.yaml");
    expect(serialized).toContain(`/${OPENAPI_BUNDLED_REFERENCES_EXTENSION}/ref-`);
  });

  it("uses the final retrieval URI and document $self as reference bases", async () => {
    const loadDocument = vi.fn(async (uri: URL) => {
      expect(uri.href).toBe("https://canonical.example.com/schemas/pet.yaml");
      return {
        uri: "https://cdn.example.com/v2/pet.yaml",
        document: { Pet: { type: "object" } },
      };
    });

    const resolved = await resolveOpenApiReferences(
      {
        openapi: "3.2.1",
        $self: "https://canonical.example.com/contracts/root.yaml",
        paths: {},
        components: {
          schemas: { Pet: { $ref: "../schemas/pet.yaml#/Pet" } },
        },
      },
      { sourceUri: "https://cdn.example.com/v1/root.yaml", loadDocument },
    );

    expect(loadDocument).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(resolved)).toContain(`/${OPENAPI_BUNDLED_REFERENCES_EXTENSION}/ref-`);
  });

  it("handles circular external documents without creating cyclic JavaScript objects", () => {
    const resolved = resolveOpenApiReferencesSync(
      {
        openapi: "3.1.0",
        paths: {},
        components: { schemas: { Node: { $ref: "./node.yaml#/Node" } } },
      },
      {
        sourceUri: "file:///project/openapi.yaml",
        loadDocument: (uri) => ({
          uri: uri.href,
          document: {
            Node: {
              type: "object",
              properties: { child: { $ref: "#/Node" } },
            },
          },
        }),
      },
    );

    expect(() => JSON.stringify(resolved)).not.toThrow();
    expect(JSON.stringify(resolved)).toContain(`/${OPENAPI_BUNDLED_REFERENCES_EXTENSION}/ref-`);
  });

  it("rejects unsupported anchors and excessive external documents", () => {
    expect(() =>
      resolveOpenApiReferencesSync(
        { openapi: "3.1.0", paths: {}, components: { schemas: { Pet: { $ref: "#Pet" } } } },
        { sourceUri: "file:///project/openapi.yaml" },
      ),
    ).toThrow("anchors are not supported yet");

    expect(() =>
      resolveOpenApiReferencesSync(
        {
          openapi: "3.1.0",
          paths: {},
          components: { schemas: { Pet: { $ref: "#/components/schemas/Pet~2" } } },
        },
        { sourceUri: "file:///project/openapi.yaml" },
      ),
    ).toThrow("invalid JSON Pointer fragment");

    expect(() =>
      resolveOpenApiReferencesSync(
        {
          openapi: "3.1.0",
          paths: {},
          components: {
            schemas: {
              One: { $ref: "./one.yaml" },
              Two: { $ref: "./two.yaml" },
            },
          },
        },
        {
          sourceUri: "file:///project/openapi.yaml",
          maxDocuments: 2,
          loadDocument: (uri) => ({ uri: uri.href, document: { type: "string" } }),
        },
      ),
    ).toThrow("2-document limit");
  });
});
