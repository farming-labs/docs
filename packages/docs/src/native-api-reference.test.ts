import { describe, expect, it } from "vitest";
import { Script } from "node:vm";
import { renderNativeApiReferenceHtml } from "./native-api-reference.js";
import { buildNormalizedOpenApiModel } from "./openapi-operations.js";

function createModel() {
  return buildNormalizedOpenApiModel({
    openapi: "3.1.0",
    info: { title: "Widget API", version: "2.0.0" },
    servers: [{ url: "https://api.example.com" }],
    paths: {
      "/widgets/{widgetId}": {
        get: {
          operationId: "getWidget",
          summary: "Get a widget",
          description: "Returns one widget by ID.",
          tags: ["Widgets"],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "widgetId",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Stable widget identifier.",
            },
          ],
          responses: {
            "200": {
              description: "Widget response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { id: { type: "string" } },
                  },
                  example: { id: "widget_123" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
    },
  });
}

describe("renderNativeApiReferenceHtml", () => {
  it("renders a searchable, accessible API reference from the normalized model", () => {
    const html = renderNativeApiReferenceHtml({
      model: createModel(),
      pageTitle: "Widget API reference",
      description: "Production contract for widgets.",
      basePath: "/api-reference/v2",
      openApiUrl: "/api/docs?format=openapi&version=v2",
      activeVersion: "v2",
      versions: [
        { id: "v1", label: "Version 1", href: "/api-reference/v1", active: false },
        { id: "v2", label: "Version 2", href: "/api-reference/v2", active: true },
      ],
    });

    expect(html).toContain('meta name="generator" content="@farming-labs/docs"');
    expect(html).toContain('href="#fl-api-content"');
    expect(html).toContain('id="fl-api-search"');
    expect(html).toContain('data-operation data-search="get /widgets/{widgetid}');
    expect(html).toContain("Get a widget");
    expect(html).toContain("Stable widget identifier.");
    expect(html).toContain("Widget response");
    expect(html).toContain("bearerAuth");
    expect(html).toContain("curl --request GET");
    expect(html).toContain('role="tablist" aria-label="Request tools"');
    expect(html).toContain('data-console-tab="console">Try it</button>');
    expect(html).toContain("data-api-console");
    expect(html).toContain('data-method="GET" data-path="/widgets/{widgetId}"');
    expect(html).toContain('value="https://api.example.com"');
    expect(html).toContain('data-param-name="widgetId" data-param-location="path"');
    expect(html).toContain("data-auth-token");
    expect(html).toContain("Requests run in this browser");
    expect(html).toContain("await fetch(url");
    expect(html).toContain("bodyTarget.textContent = formattedBody");
    expect(html).toContain("/api-reference/v2/operations/get-widget-");
    expect(html).toContain('value="/api-reference/v2" selected');
    expect(html).toContain("prefers-reduced-motion");
    expect(html).toContain('aria-live="polite"');
    const clientScript = /<script>([\s\S]+)<\/script>/.exec(html)?.[1];
    if (!clientScript) throw new Error("Expected the native renderer client script");
    expect(() => new Script(clientScript)).not.toThrow();
  });

  it("renders request bodies, API keys, cookie guidance, and mutation confirmation", () => {
    const model = buildNormalizedOpenApiModel({
      openapi: "3.1.0",
      info: { title: "Widget API", version: "1.0.0" },
      servers: [{ url: "https://api.example.com/v1" }],
      paths: {
        "/widgets": {
          post: {
            operationId: "createWidget",
            security: [{ apiKey: [] }],
            parameters: [
              { name: "trace", in: "query", schema: { type: "boolean" } },
              { name: "session", in: "cookie", required: true, schema: { type: "string" } },
            ],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["name"],
                    properties: { name: { type: "string", example: "Irrigation valve" } },
                  },
                },
              },
            },
            responses: { "201": { description: "Created" } },
          },
        },
      },
      components: {
        securitySchemes: {
          apiKey: { type: "apiKey", in: "header", name: "x-api-key" },
        },
      },
    });

    const html = renderNativeApiReferenceHtml({
      model,
      pageTitle: "Widget API",
      basePath: "/api-reference",
      openApiUrl: "/api/docs?format=openapi",
    });

    expect(html).toContain('name="content-type"');
    expect(html).toContain("application/json");
    expect(html).toContain("Irrigation valve");
    expect(html).toContain('data-auth-api-key data-auth-location="header"');
    expect(html).toContain('data-auth-name="x-api-key"');
    expect(html).toContain("Cookie parameters");
    expect(html).toContain("Include cookies");
    expect(html).toContain("data-console-confirm");
    expect(html).toContain("data-console-send disabled");
    expect(html).toContain("this request may change data");
  });

  it("escapes contract content before placing it into markup or attributes", () => {
    const model = buildNormalizedOpenApiModel({
      openapi: "3.1.0",
      info: { title: "<script>alert(1)</script>", version: "1" },
      paths: {
        "/unsafe": {
          get: {
            operationId: 'unsafe" onmouseover="alert(1)',
            summary: "<img src=x onerror=alert(1)>",
            responses: { "200": { description: "OK" } },
          },
        },
      },
    });

    const html = renderNativeApiReferenceHtml({
      model,
      pageTitle: model.title,
      basePath: "/api-reference",
      openApiUrl: "/api/docs?format=openapi",
    });

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain('data-search="unsafe" onmouseover=');
  });

  it("renders a useful empty state for contracts without operations", () => {
    const model = buildNormalizedOpenApiModel({
      openapi: "3.1.0",
      info: { title: "Empty API", version: "1" },
      paths: {},
    });

    const html = renderNativeApiReferenceHtml({
      model,
      pageTitle: "Empty API",
      basePath: "/api-reference",
      openApiUrl: "/api/docs?format=openapi",
    });

    expect(html).toContain("No operations found.");
    expect(html).toContain("Add paths and operations to the OpenAPI contract");
  });
});
