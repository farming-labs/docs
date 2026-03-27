const exampleOpenApiSpec = {
  openapi: "3.0.4",
  info: {
    title: "Example Store API",
    version: "1.0.0",
    description:
      "Hosted OpenAPI JSON served from the same Next.js app so the API reference example works in local dev and production.",
  },
  servers: [{ url: "https://api.example.dev" }],
  tags: [
    {
      name: "Orders",
      description: "Checkout and order management endpoints.",
    },
    {
      name: "Users",
      description: "User profile endpoints.",
    },
  ],
  paths: {
    "/orders": {
      get: {
        tags: ["Orders"],
        summary: "List orders",
        description: "Returns the most recent orders for the current workspace.",
        responses: {
          "200": {
            description: "Orders loaded successfully.",
          },
        },
      },
    },
    "/orders/{orderId}": {
      get: {
        tags: ["Orders"],
        summary: "Get order",
        description: "Loads a single order by id.",
        parameters: [
          {
            name: "orderId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "Order found.",
          },
          "404": {
            description: "Order not found.",
          },
        },
      },
    },
    "/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Get user profile",
        description: "Returns a single user profile and permissions summary.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            description: "User loaded successfully.",
          },
        },
      },
    },
  },
} as const;

export async function GET() {
  return Response.json(exampleOpenApiSpec, {
    headers: {
      "Cache-Control": "public, max-age=60",
    },
  });
}
