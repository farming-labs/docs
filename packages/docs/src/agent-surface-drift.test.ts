import { describe, expect, it } from "vitest";
import {
  analyzeAgentSurfaceDrift,
  type AnalyzeAgentSurfaceDriftOptions,
} from "./agent-surface-drift.js";
import {
  DEFAULT_DOCS_API_ROUTE,
  DEFAULT_DOCS_CONFIG_ROUTE,
  DOCS_CONFIG_MAP_TOP_LEVEL_KEYS,
  buildDocsAgentDiscoverySpec,
} from "./agent.js";
import { PAGE_AGENT_CONTRACT_FIELDS } from "./agent-contract.js";
import { getDocsConfigSchema, resolveDocsMcpConfig } from "./mcp.js";

function healthyOptions(): AnalyzeAgentSurfaceDriftOptions {
  return {
    configOptionPaths: ["entry", "search", "mcp.tools.readPage"],
    schemaOptions: [
      { path: "entry" },
      { path: "search" },
      {
        path: "mcp",
        children: [
          {
            path: "mcp.tools",
            children: [{ path: "mcp.tools.readPage" }],
          },
        ],
      },
    ],
    agentContractFields: ["task", "outcome", "rollback"],
    discovery: {
      site: { entry: "docs" },
      capabilities: { search: true, mcp: true },
      api: {
        docs: "/api/docs",
        config: "/api/docs?format=config",
      },
      config: { endpoint: "/api/docs?format=config" },
      search: {
        enabled: true,
        endpoint: "/api/docs?query={query}",
      },
      mcp: {
        enabled: true,
        endpoint: "/api/docs/mcp",
        tools: { readPage: true },
      },
      agentContract: {
        fields: {
          task: "string",
          outcome: "string",
          rollback: "string[]",
        },
      },
    },
    expected: {
      entry: "docs",
      search: {
        enabled: true,
        endpoint: "/api/docs?query={query}",
      },
      mcp: {
        enabled: true,
        endpoint: "/api/docs/mcp",
        tools: { readPage: true },
      },
      routes: {
        "api.docs": "/api/docs",
        "api.config": "/api/docs?format=config",
        "config.endpoint": "/api/docs?format=config",
      },
    },
  };
}

describe("agent surface drift", () => {
  it("keeps the shipped config schema, discovery, and contract manifests aligned", () => {
    const mcp = resolveDocsMcpConfig({ enabled: true, tools: { readPage: false } });
    const discovery = buildDocsAgentDiscoverySpec({
      origin: "https://docs.example.com",
      entry: "guide",
      search: true,
      mcp,
    });

    expect(
      analyzeAgentSurfaceDrift({
        configOptionPaths: DOCS_CONFIG_MAP_TOP_LEVEL_KEYS,
        schemaOptions: getDocsConfigSchema().options,
        agentContractFields: PAGE_AGENT_CONTRACT_FIELDS,
        discovery,
        expected: {
          entry: "guide",
          search: { enabled: true, endpoint: `${DEFAULT_DOCS_API_ROUTE}?query={query}` },
          mcp: { enabled: true, endpoint: mcp.route, tools: mcp.tools },
          routes: {
            "api.docs": DEFAULT_DOCS_API_ROUTE,
            "api.config": DEFAULT_DOCS_CONFIG_ROUTE,
            "config.endpoint": DEFAULT_DOCS_CONFIG_ROUTE,
          },
        },
      }),
    ).toEqual([]);
  });

  it("accepts aligned config, schema, contract, discovery, tools, and routes", () => {
    expect(analyzeAgentSurfaceDrift(healthyOptions())).toEqual([]);
  });

  it("reports every supported drift category with stable paths and values", () => {
    const options = healthyOptions();
    options.configOptionPaths = ["review", "entry", "mcp.tools.readPage"];
    options.discovery = {
      site: { entry: "guide" },
      capabilities: { search: false, mcp: false },
      api: {
        docs: "/wrong-api",
        config: "/wrong-config",
      },
      config: { endpoint: "/wrong-config" },
      search: {
        enabled: false,
        endpoint: "/wrong-search",
      },
      mcp: {
        enabled: false,
        endpoint: "/wrong-mcp",
        tools: {
          readPage: false,
          legacyTool: true,
        },
      },
      agentContract: {
        fields: {
          task: "string",
          outcome: "string",
          legacy: "string",
        },
      },
    };
    options.expected = {
      ...options.expected,
      mcp: {
        ...options.expected.mcp,
        tools: {
          readPage: true,
          getContext: true,
        },
      },
    };

    const issues = analyzeAgentSurfaceDrift(options);

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "config-schema-omission",
        "agent-contract-field-missing",
        "agent-contract-field-unexpected",
        "entry-mismatch",
        "search-enabled-mismatch",
        "search-capability-mismatch",
        "search-route-mismatch",
        "mcp-enabled-mismatch",
        "mcp-capability-mismatch",
        "mcp-route-mismatch",
        "mcp-tool-mismatch",
        "mcp-tool-unexpected",
        "route-mismatch",
      ]),
    );
    expect(issues).toEqual(
      [...issues].sort(
        (left, right) =>
          left.path.localeCompare(right.path) ||
          left.code.localeCompare(right.code) ||
          left.message.localeCompare(right.message),
      ),
    );
    expect(issues.find((issue) => issue.path === "review")).toMatchObject({
      code: "config-schema-omission",
      expected: "documented schema option",
      actual: "<missing>",
    });
    expect(issues.find((issue) => issue.path === "agentContract.fields.rollback")).toMatchObject({
      code: "agent-contract-field-missing",
    });
    expect(issues.find((issue) => issue.path === "mcp.tools.getContext")).toMatchObject({
      code: "mcp-tool-mismatch",
      expected: "true",
      actual: "<missing>",
    });
    expect(issues.find((issue) => issue.path === "mcp.tools.legacyTool")).toMatchObject({
      code: "mcp-tool-unexpected",
      expected: "<absent>",
      actual: "true",
    });
  });

  it("normalizes input paths and produces the same output regardless of input ordering", () => {
    const first = healthyOptions();
    first.configOptionPaths = ["/mcp/tools/readPage", " search ", "entry", "missing.option"];
    first.agentContractFields = ["rollback", "task", "outcome"];

    const second = healthyOptions();
    second.configOptionPaths = [...first.configOptionPaths].reverse();
    second.schemaOptions = [...first.schemaOptions].reverse();
    second.agentContractFields = [...first.agentContractFields].reverse();
    second.expected = {
      ...first.expected,
      routes: Object.fromEntries(Object.entries(first.expected.routes).reverse()),
      mcp: {
        ...first.expected.mcp,
        tools: Object.fromEntries(Object.entries(first.expected.mcp.tools).reverse()),
      },
    };

    expect(analyzeAgentSurfaceDrift(first)).toEqual(analyzeAgentSurfaceDrift(second));
    expect(analyzeAgentSurfaceDrift(first)).toContainEqual(
      expect.objectContaining({
        code: "config-schema-omission",
        path: "missing.option",
      }),
    );
  });

  it("normalizes config-map array indexes against published array-item schema paths", () => {
    const options = healthyOptions();
    options.configOptionPaths = [
      "agent.evaluations.tasks[0].expect.examples[1].packageManager",
      "agent.evaluations.tasks[0].expect.relevantSources[0]",
      "agent/evaluations/tasks/0/expect/examples/1/packageManager",
    ];
    options.schemaOptions = [
      {
        path: "agent.evaluations.tasks",
        children: [
          {
            path: "agent.evaluations.tasks[].expect.examples",
            children: [
              {
                path: "agent.evaluations.tasks[].expect.examples[].packageManager",
              },
            ],
          },
          { path: "agent.evaluations.tasks[].expect.relevantSources" },
        ],
      },
    ];

    expect(analyzeAgentSurfaceDrift(options)).toEqual([]);
  });

  it("publishes discoverable nested evaluation and review-rule schema", () => {
    expect(
      getDocsConfigSchema({
        option: "agent.evaluations.tasks[].expect.examples[].packageManager",
      }),
    ).toMatchObject({
      resultCount: 1,
      options: [
        {
          path: "agent.evaluations.tasks[].expect.examples[].packageManager",
          type: "string",
        },
      ],
    });
    expect(getDocsConfigSchema({ option: "review.rules.goldenTasks" })).toMatchObject({
      resultCount: 1,
      options: [
        {
          path: "review.rules.goldenTasks",
          values: ["off", "suggestion", "warn", "error"],
        },
      ],
    });
  });
});
