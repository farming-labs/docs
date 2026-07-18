import { describe, expect, it } from "vitest";
import {
  getPageAgentFrontmatterIssues,
  hasStructuredPageAgentContract,
  normalizePageAgentFrontmatter,
  renderPageAgentContractMarkdown,
  renderPageAgentFrontmatterYamlLines,
  PAGE_AGENT_CONTRACT_END_MARKER,
  PAGE_AGENT_CONTRACT_START_MARKER,
  stripGeneratedPageAgentContractMarkdown,
  upsertPageAgentContractMarkdown,
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
    expect(markdown).toContain(PAGE_AGENT_CONTRACT_START_MARKER);
    expect(markdown).toContain(PAGE_AGENT_CONTRACT_END_MARKER);
  });

  it("pads CommonMark code spans so edge backticks round-trip", () => {
    const values = ["`docs.config.ts`", "`leading", "trailing`", "``"];
    const markdown = renderPageAgentContractMarkdown({
      task: "Render exact file names",
      files: values,
    });
    const renderedSpans = markdown
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2));

    expect(renderedSpans).toEqual([
      "`` `docs.config.ts` ``",
      "`` `leading ``",
      "`` trailing` ``",
      "``` `` ```",
    ]);

    const decoded = renderedSpans.map((span) => {
      const opening = /^(`+)/.exec(span)?.[1];
      expect(opening).toBeDefined();
      const content = span.slice(opening!.length, -opening!.length).replace(/\r?\n/g, " ");
      return content.startsWith(" ") && content.endsWith(" ") && content.trim().length > 0
        ? content.slice(1, -1)
        : content;
    });
    expect(decoded).toEqual(values);
  });

  it("reports unknown top-level and nested keys with typo suggestions", () => {
    const issues = getPageAgentFrontmatterIssues({
      task: "Configure MCP",
      verfication: ["Tests pass"],
      appliesTo: { framwork: "nextjs" },
      commands: [{ run: "pnpm test", descrption: "Run tests" }],
      failureModes: [{ symptom: "Tests fail", resoluton: "Inspect the log" }],
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        {
          path: "agent.verfication",
          message: 'is not recognized; did you mean "agent.verification"?',
        },
        {
          path: "agent.appliesTo.framwork",
          message: 'is not recognized; did you mean "agent.appliesTo.framework"?',
        },
        {
          path: "agent.commands[0].descrption",
          message: 'is not recognized; did you mean "agent.commands[0].description"?',
        },
        {
          path: "agent.failureModes[0].resoluton",
          message: 'is not recognized; did you mean "agent.failureModes[0].resolution"?',
        },
      ]),
    );
  });

  it("upserts one generated contract and preserves handwritten contract sections", () => {
    const first = upsertPageAgentContractMarkdown("# Instructions\n\nDo the work.", input);
    const second = upsertPageAgentContractMarkdown(first, input);
    expect(second.match(/## Agent Contract/g)).toHaveLength(1);
    expect(second.match(/farming-labs:agent-contract:start/g)).toHaveLength(1);

    const handwritten = upsertPageAgentContractMarkdown(
      "# Instructions\n\n## Agent Contract\n\nCustom contract guidance.",
      input,
    );
    expect(handwritten.match(/## Agent Contract/g)).toHaveLength(1);
    expect(handwritten).toContain("Custom contract guidance.");
    expect(handwritten).not.toContain(PAGE_AGENT_CONTRACT_START_MARKER);

    expect(stripGeneratedPageAgentContractMarkdown(first)).toBe("# Instructions\n\nDo the work.");
  });

  it("strips complete marker blocks without altering fenced examples or following indentation", () => {
    const generated = renderPageAgentContractMarkdown(input);
    const markdown = [
      "# Instructions",
      "",
      generated,
      "",
      "    keep this indented content",
      "",
      "```md",
      PAGE_AGENT_CONTRACT_START_MARKER,
      "## Agent Contract",
      PAGE_AGENT_CONTRACT_END_MARKER,
      "```",
      "",
      generated,
      "",
      "Done.",
    ].join("\n");

    expect(stripGeneratedPageAgentContractMarkdown(markdown)).toBe(
      [
        "# Instructions",
        "",
        "    keep this indented content",
        "",
        "```md",
        PAGE_AGENT_CONTRACT_START_MARKER,
        "## Agent Contract",
        PAGE_AGENT_CONTRACT_END_MARKER,
        "```",
        "",
        "Done.",
      ].join("\n"),
    );
  });

  it("recognizes handwritten Setext headings but ignores headings inside fences", () => {
    const setext = upsertPageAgentContractMarkdown(
      "Agent Contract\n--------------\n\nCustom contract guidance.",
      input,
    );
    expect(setext).not.toContain(PAGE_AGENT_CONTRACT_START_MARKER);

    const fencedExamples = upsertPageAgentContractMarkdown(
      "```md\n## Agent Contract\n\nAgent Contract\n--------------\n```\n\nExample only.",
      input,
    );
    expect(fencedExamples).toContain(PAGE_AGENT_CONTRACT_START_MARKER);
  });
});
