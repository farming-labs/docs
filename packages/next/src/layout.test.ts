import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNextDocsLayout } from "./layout.js";

function clearDocsCloudEnv() {
  delete process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID;
  delete process.env.PUBLIC_DOCS_CLOUD_PROJECT_ID;
  delete process.env.DOCS_CLOUD_PROJECT_ID;
  delete process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT;
  delete process.env.PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT;
  delete process.env.DOCS_CLOUD_ANALYTICS_ENDPOINT;
  delete process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED;
  delete process.env.PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED;
  delete process.env.DOCS_CLOUD_ANALYTICS_ENABLED;
}

function getClientCallbackProps(node: React.ReactNode): Record<string, unknown> | undefined {
  if (!React.isValidElement(node)) return undefined;

  const children = React.Children.toArray((node.props as { children?: React.ReactNode }).children);
  const callback = children.find(
    (child) =>
      React.isValidElement(child) &&
      typeof child.type === "function" &&
      child.type.name === "DocsClientCallbacks",
  );

  return React.isValidElement(callback) ? (callback.props as Record<string, unknown>) : undefined;
}

describe("createNextDocsLayout Docs Cloud analytics", () => {
  beforeEach(clearDocsCloudEnv);
  afterEach(clearDocsCloudEnv);

  it("passes public Docs Cloud analytics config into the client layout callbacks", () => {
    process.env.DOCS_CLOUD_PROJECT_ID = "project_server";
    process.env.DOCS_CLOUD_ANALYTICS_ENDPOINT = "https://cloud.example.com/events";

    const Layout = createNextDocsLayout({
      entry: "docs",
      analytics: true,
    });
    const props = getClientCallbackProps(
      Layout({ children: React.createElement("div", null, "child") }),
    );

    expect(props?.docsCloud).toMatchObject({
      projectId: "project_server",
      endpoint: "https://cloud.example.com/events",
      metadata: {
        framework: "next",
      },
    });
  });

  it("does not pass Docs Cloud client config when analytics is disabled", () => {
    process.env.DOCS_CLOUD_PROJECT_ID = "project_server";

    const Layout = createNextDocsLayout({
      entry: "docs",
      analytics: false,
    });
    const props = getClientCallbackProps(
      Layout({ children: React.createElement("div", null, "child") }),
    );

    expect(props?.docsCloud).toBe(false);
  });
});
