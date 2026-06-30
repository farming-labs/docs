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
  delete process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ROUTE;
  delete process.env.PUBLIC_DOCS_CLOUD_ANALYTICS_ROUTE;
  delete process.env.DOCS_CLOUD_ANALYTICS_ROUTE;
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

function getDocsCloudAnalyticsProps(node: React.ReactNode): Record<string, unknown> | undefined {
  if (!React.isValidElement(node)) return undefined;

  const children = React.Children.toArray((node.props as { children?: React.ReactNode }).children);
  const analytics = children.find(
    (child) =>
      React.isValidElement(child) &&
      typeof child.type === "function" &&
      child.type.name === "DocsCloudAnalytics",
  );

  return React.isValidElement(analytics) ? (analytics.props as Record<string, unknown>) : undefined;
}

describe("createNextDocsLayout Docs Cloud analytics", () => {
  beforeEach(clearDocsCloudEnv);
  afterEach(clearDocsCloudEnv);

  it("mounts Docs Cloud analytics from public layout config", () => {
    process.env.DOCS_CLOUD_PROJECT_ID = "project_server";
    process.env.DOCS_CLOUD_ANALYTICS_ENDPOINT = "https://cloud.example.com/events";

    const Layout = createNextDocsLayout({
      entry: "docs",
      analytics: true,
    });
    const node = Layout({ children: React.createElement("div", null, "child") });
    const cloudProps = getDocsCloudAnalyticsProps(node);
    const callbackProps = getClientCallbackProps(node);

    expect(cloudProps).toMatchObject({
      projectId: "project_server",
      endpoint: "https://cloud.example.com/events",
      includeInputs: false,
      metadata: {
        framework: "next",
      },
    });
    expect(cloudProps).not.toHaveProperty("analytics");
    expect(callbackProps?.docsCloudEnabled).toBe(true);
  });

  it("passes only serializable analytics options to the client component", () => {
    process.env.DOCS_CLOUD_PROJECT_ID = "project_server";

    const Layout = createNextDocsLayout({
      entry: "docs",
      analytics: {
        includeInputs: true,
        onEvent() {},
      },
    });
    const node = Layout({ children: React.createElement("div", null, "child") });
    const cloudProps = getDocsCloudAnalyticsProps(node);

    expect(cloudProps).toMatchObject({
      projectId: "project_server",
      includeInputs: true,
    });
    expect(cloudProps).not.toHaveProperty("analytics");
  });

  it("defaults Docs Cloud analytics to the local merged docs API route", () => {
    process.env.DOCS_CLOUD_PROJECT_ID = "project_server";

    const Layout = createNextDocsLayout({
      entry: "docs",
      analytics: true,
    });
    const node = Layout({ children: React.createElement("div", null, "child") });
    const cloudProps = getDocsCloudAnalyticsProps(node);

    expect(cloudProps).toMatchObject({
      projectId: "project_server",
      endpoint: "/api/docs?action=analytics",
    });
  });

  it("uses a configured local docs API route for analytics proxying", () => {
    process.env.DOCS_CLOUD_PROJECT_ID = "project_server";

    const Layout = createNextDocsLayout({
      entry: "docs",
      cloud: {
        apiRoute: "/base/internal/docs-cloud",
      },
      analytics: true,
    });
    const node = Layout({ children: React.createElement("div", null, "child") });
    const cloudProps = getDocsCloudAnalyticsProps(node);

    expect(cloudProps).toMatchObject({
      projectId: "project_server",
      endpoint: "/base/internal/docs-cloud?action=analytics",
    });
  });

  it("uses a configured analytics route env for analytics proxying", () => {
    process.env.DOCS_CLOUD_PROJECT_ID = "project_server";
    process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ROUTE = "/tenant/api/docs";

    const Layout = createNextDocsLayout({
      entry: "docs",
      analytics: true,
    });
    const node = Layout({ children: React.createElement("div", null, "child") });
    const cloudProps = getDocsCloudAnalyticsProps(node);

    expect(cloudProps).toMatchObject({
      projectId: "project_server",
      endpoint: "/tenant/api/docs?action=analytics",
    });
  });

  it("does not pass Docs Cloud client config when analytics is disabled", () => {
    process.env.DOCS_CLOUD_PROJECT_ID = "project_server";

    const Layout = createNextDocsLayout({
      entry: "docs",
      analytics: false,
    });
    const node = Layout({ children: React.createElement("div", null, "child") });
    const cloudProps = getDocsCloudAnalyticsProps(node);
    const callbackProps = getClientCallbackProps(node);

    expect(cloudProps).toBeUndefined();
    expect(callbackProps?.docsCloudEnabled).toBe(false);
  });
});
