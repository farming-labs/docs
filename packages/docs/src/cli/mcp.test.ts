import { describe, expect, it } from "vitest";
import { createHostedMcpClientConfig, readMcpConfig } from "./mcp.js";

describe("createHostedMcpClientConfig", () => {
  it("connects directly to the hosted Streamable HTTP endpoint", () => {
    expect(createHostedMcpClientConfig(" deployment-123 ")).toEqual({
      mcpServers: {
        "docs-cloud": {
          type: "http",
          url: "https://api.farming-labs.dev/v1/mcp/deployment-123",
          headers: {
            Authorization: "Bearer ${DOCS_CLOUD_API_KEY}",
          },
        },
      },
    });
  });

  it("normalizes a custom API base URL without generating a setup subprocess", () => {
    const config = createHostedMcpClientConfig(
      "deployment-456",
      " https://cloud.example.com/api/// ",
    );

    expect(config.mcpServers["docs-cloud"].url).toBe(
      "https://cloud.example.com/api/v1/mcp/deployment-456",
    );
    expect(config.mcpServers["docs-cloud"]).not.toHaveProperty("command");
    expect(config.mcpServers["docs-cloud"]).not.toHaveProperty("args");
  });
});

describe("readMcpConfig", () => {
  it("preserves task and context tool opt-outs", () => {
    const config = readMcpConfig(`
      export default defineDocs({
        mcp: {
          enabled: true,
          tools: {
            listTasks: false,
            readTask: false,
            getContext: false,
          },
        },
      });
    `);

    expect(config).toMatchObject({
      enabled: true,
      tools: {
        listTasks: false,
        readTask: false,
        getContext: false,
      },
    });
  });
});
