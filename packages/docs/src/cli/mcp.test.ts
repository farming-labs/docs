import { describe, expect, it } from "vitest";
import { readMcpConfig } from "./mcp.js";

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
