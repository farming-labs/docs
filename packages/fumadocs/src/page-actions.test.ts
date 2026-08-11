import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockRouterState = vi.hoisted(() => ({
  pathname: "/docs/installation",
}));

vi.mock("fumadocs-core/framework", () => ({
  usePathname: () => mockRouterState.pathname,
}));

import {
  buildMcpSetupInstruction,
  formatCopyMarkdownContent,
  PageActions,
} from "./page-actions.js";

describe("PageActions agent setup", () => {
  it("builds copyable setup for supported MCP clients", () => {
    const endpoint = "https://docs.example.com/mcp";
    expect(buildMcpSetupInstruction("copy", endpoint)).toBe(endpoint);
    expect(buildMcpSetupInstruction("claude-code", endpoint)).toContain(
      "claude mcp add --transport http docs",
    );
    expect(buildMcpSetupInstruction("codex", endpoint)).toBe(
      `codex mcp add docs --url ${endpoint}`,
    );
    expect(JSON.parse(buildMcpSetupInstruction("cursor", endpoint))).toEqual({
      mcpServers: { docs: { url: endpoint } },
    });
    expect(JSON.parse(buildMcpSetupInstruction("vscode", endpoint))).toEqual({
      servers: { docs: { type: "http", url: endpoint } },
    });
  });

  it("renders MCP and Agent Skills setup actions", () => {
    const html = renderToStaticMarkup(
      React.createElement(PageActions, {
        connectMcp: { label: "Add docs MCP" },
        installSkills: { label: "Add docs skills" },
        providers: [],
      }),
    );
    expect(html).toContain("Add docs MCP");
    expect(html).toContain("Add docs skills");
  });
});

describe("PageActions alignment", () => {
  beforeEach(() => {
    mockRouterState.pathname = "/docs/installation";
  });

  it("applies the alignment attribute to the rendered actions container", () => {
    const html = renderToStaticMarkup(
      React.createElement(PageActions, {
        copyMarkdown: true,
        alignment: "right",
        providers: [],
      }),
    );

    expect(html).toContain('data-page-actions="true"');
    expect(html).toContain('data-actions-alignment="right"');
  });

  it("uses /index.md for root markdown links", () => {
    mockRouterState.pathname = "/";

    const html = renderToStaticMarkup(
      React.createElement(PageActions, {
        copyMarkdown: false,
        openDocs: true,
        providers: [],
        variant: "rail",
      }),
    );

    expect(html).toContain('href="/index.md"');
  });

  it("keeps the rail Ask AI action when copy and open docs are disabled", () => {
    const html = renderToStaticMarkup(
      React.createElement(PageActions, {
        copyMarkdown: false,
        openDocs: false,
        providers: [],
        variant: "rail",
      }),
    );

    expect(html).toContain('data-page-actions-variant="rail"');
    expect(html).toContain("Ask AI");
  });
});

describe("PageActions copy markdown labels", () => {
  it("renders a custom copy button label", () => {
    const html = renderToStaticMarkup(
      React.createElement(PageActions, {
        copyMarkdown: true,
        copyMarkdownLabel: "Copy docs",
        providers: [],
      }),
    );

    expect(html).toContain("Copy docs");
    expect(html).not.toContain("Copy page");
  });

  it("marks the configured copy format", () => {
    const html = renderToStaticMarkup(
      React.createElement(PageActions, {
        copyMarkdown: true,
        copyMarkdownFormat: "text",
        providers: [],
      }),
    );

    expect(html).toContain('data-copy-markdown-format="text"');
  });

  it("marks when copied content should include the page title", () => {
    const html = renderToStaticMarkup(
      React.createElement(PageActions, {
        copyMarkdown: true,
        copyMarkdownIncludeTitle: true,
        providers: [],
      }),
    );

    expect(html).toContain('data-copy-markdown-include-title="true"');
  });

  it("prepends a markdown title when requested", () => {
    expect(
      formatCopyMarkdownContent({
        content: "Body copy",
        format: "markdown",
        includeTitle: true,
        title: "Install",
      }),
    ).toBe("# Install\n\nBody copy");
  });

  it("prepends a plain title for text copies", () => {
    expect(
      formatCopyMarkdownContent({
        content: "Body copy",
        format: "text",
        includeTitle: true,
        title: "Install",
      }),
    ).toBe("Install\n\nBody copy");
  });

  it("does not duplicate an existing copied title", () => {
    expect(
      formatCopyMarkdownContent({
        content: "# Install\n\nBody copy",
        format: "markdown",
        includeTitle: true,
        title: "Install",
      }),
    ).toBe("# Install\n\nBody copy");
  });

  it("does not duplicate a plain title when markdown falls back to page text", () => {
    expect(
      formatCopyMarkdownContent({
        content: "Install\n\nBody copy",
        format: "markdown",
        includeTitle: true,
        title: "Install",
      }),
    ).toBe("Install\n\nBody copy");
  });
});
