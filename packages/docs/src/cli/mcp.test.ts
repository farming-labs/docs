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

    expect(config).toMatchObject({
      mcpServers: {
        "docs-cloud": {
          url: "https://cloud.example.com/api/v1/mcp/deployment-456",
        },
      },
    });
    expect(JSON.stringify(config)).not.toContain('"command"');
    expect(JSON.stringify(config)).not.toContain('"args"');
  });

  it("uses Cursor's environment variable syntax", () => {
    expect(createHostedMcpClientConfig("deployment-123", undefined, "cursor")).toEqual({
      mcpServers: {
        "docs-cloud": {
          url: "https://api.farming-labs.dev/v1/mcp/deployment-123",
          headers: {
            Authorization: "Bearer ${env:DOCS_CLOUD_API_KEY}",
          },
        },
      },
    });
  });

  it("uses VS Code's servers schema and secure input syntax", () => {
    expect(createHostedMcpClientConfig("deployment-123", undefined, "vscode")).toEqual({
      inputs: [
        {
          type: "promptString",
          id: "docs-cloud-api-key",
          description: "Docs Cloud API key",
          password: true,
        },
      ],
      servers: {
        "docs-cloud": {
          type: "http",
          url: "https://api.farming-labs.dev/v1/mcp/deployment-123",
          headers: {
            Authorization: "Bearer ${input:docs-cloud-api-key}",
          },
        },
      },
    });
  });

  it("rejects unknown clients instead of emitting incompatible JSON", () => {
    expect(() => createHostedMcpClientConfig("deployment-123", undefined, "other")).toThrow(
      'Unsupported MCP client "other"',
    );
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
