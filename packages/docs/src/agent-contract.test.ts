import { describe, expect, it } from "vitest";
import {
  getPageAgentFrontmatterIssues,
  hasStructuredPageAgentContract,
  normalizePageAgentFrontmatter,
  renderPageAgentContractMarkdown,
  renderPageAgentFrontmatterYamlLines,
} from "./agent-contract.js";

describe("page agent contracts", () => {
  const input = {
    tokenBudget: 899.2,
    task: " Configure authenticated MCP ",
    outcome: "The MCP endpoint rejects unauthenticated requests.",
    appliesTo: {
      framework: ["nextjs", "nextjs"],
      version: ">=16",
      package: "@farming-labs/next",
    },
    prerequisites: ["An MCP route is enabled", "An MCP route is enabled"],
    files: ["docs.config.ts"],
    commands: [
      "pnpm test",
      {
        run: "pnpm typecheck",
        cwd: "website",
        description: "Check the integration",
      },
    ],
    sideEffects: ["Requires a valid session for MCP requests"],
    verification: [
      {
        run: "curl https://docs.example.com/mcp",
        expect: "HTTP 401",
      },
    ],
    rollback: ["Remove the authenticate callback"],
    failureModes: [
      {
        symptom: "Every request returns 401",
        resolution: "Verify the callback returns an identity object",
      },
    ],
  };

  it("normalizes valid author input into a stable shape", () => {
    expect(normalizePageAgentFrontmatter(input)).toEqual({
      tokenBudget: 900,
      task: "Configure authenticated MCP",
      outcome: "The MCP endpoint rejects unauthenticated requests.",
      appliesTo: {
        framework: ["nextjs"],
        version: [">=16"],
        package: ["@farming-labs/next"],
      },
      prerequisites: ["An MCP route is enabled"],
      files: ["docs.config.ts"],
      commands: [
        "pnpm test",
        {
          run: "pnpm typecheck",
          cwd: "website",
          description: "Check the integration",
        },
      ],
      sideEffects: ["Requires a valid session for MCP requests"],
      verification: [
        {
          run: "curl https://docs.example.com/mcp",
          expect: "HTTP 401",
        },
      ],
      rollback: ["Remove the authenticate callback"],
      failureModes: [
        {
          symptom: "Every request returns 401",
          resolution: "Verify the callback returns an identity object",
        },
      ],
    });
    expect(hasStructuredPageAgentContract(input)).toBe(true);
    expect(hasStructuredPageAgentContract({ tokenBudget: 500 })).toBe(false);
  });

  it("omits malformed fields at runtime and returns author-facing issues", () => {
    const malformed = {
      tokenBudget: -1,
      task: 42,
      outcome: "",
      appliesTo: { framework: [] },
      prerequisites: "Install Node.js",
      commands: [{ description: "Missing run" }],
      verification: [{}],
      failureModes: [{ resolution: "Missing symptom" }],
    };

    expect(normalizePageAgentFrontmatter(malformed)).toBeUndefined();
    expect(getPageAgentFrontmatterIssues(malformed).map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        "agent.tokenBudget",
        "agent.task",
        "agent.outcome",
        "agent.appliesTo",
        "agent.prerequisites",
        "agent.commands[0]",
        "agent.verification[0]",
        "agent.failureModes[0]",
      ]),
    );
    expect(normalizePageAgentFrontmatter("invalid")).toBeUndefined();
    expect(getPageAgentFrontmatterIssues("invalid")).toEqual([
      { path: "agent", message: "must be an object" },
    ]);
  });

  it("renders deterministic YAML metadata and Markdown guidance", () => {
    const yaml = renderPageAgentFrontmatterYamlLines(input).join("\n");
    expect(yaml).toMatchInlineSnapshot(`
      "agent:
        tokenBudget: 900
        task: \"Configure authenticated MCP\"
        outcome: \"The MCP endpoint rejects unauthenticated requests.\"
        appliesTo:
          framework:
            - \"nextjs\"
          version:
            - \">=16\"
          package:
            - \"@farming-labs/next\"
        prerequisites:
          - \"An MCP route is enabled\"
        files:
          - \"docs.config.ts\"
        commands:
          - \"pnpm test\"
          - run: \"pnpm typecheck\"
            cwd: \"website\"
            description: \"Check the integration\"
        sideEffects:
          - \"Requires a valid session for MCP requests\"
        verification:
          - run: \"curl https://docs.example.com/mcp\"
            expect: \"HTTP 401\"
        rollback:
          - \"Remove the authenticate callback\"
        failureModes:
          - symptom: \"Every request returns 401\"
            resolution: \"Verify the callback returns an identity object\""
    `);

    const markdown = renderPageAgentContractMarkdown(input);
    expect(markdown).toContain("## Agent Contract");
    expect(markdown).toContain("Task: Configure authenticated MCP");
    expect(markdown).toContain("- Framework: `nextjs`");
    expect(markdown).toContain("- `pnpm typecheck` — cwd `website`; Check the integration");
    expect(markdown).toContain("  - Expected: HTTP 401");
    expect(markdown).toContain(
      "- Every request returns 401 — Recovery: Verify the callback returns an identity object",
    );
  });
});
