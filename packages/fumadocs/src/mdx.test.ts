import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getMDXComponents } from "./mdx.js";

describe("getMDXComponents", () => {
  it("includes the Agent primitive by default without user registration", () => {
    const components = getMDXComponents();

    expect(typeof components.Agent).toBe("function");

    const AgentComponent = components.Agent as (props: { children?: unknown }) => unknown;
    expect(AgentComponent({ children: "hidden agent-only context" })).toBeNull();
  });

  it("includes the Prompt primitive by default and applies shared defaults", () => {
    const components = getMDXComponents(undefined, {
      theme: {
        ui: {
          components: {
            Prompt: {
              title: "Ask AI",
              actions: ["copy", "open"],
              providers: ["Cursor"],
              icon: "sparkles",
            },
          },
        },
      },
      icons: {
        sparkles: React.createElement("svg", { viewBox: "0 0 16 16" }),
      },
      openDocsProviders: [
        {
          name: "Cursor",
          urlTemplate: "https://cursor.example/{url}",
          promptUrlTemplate: "https://cursor.example/{prompt}",
        },
      ],
    });

    const PromptComponent = components.Prompt as React.ComponentType<{
      description?: string;
      children?: React.ReactNode;
    }>;
    const html = renderToStaticMarkup(
      React.createElement(
        PromptComponent,
        {
          description: "Reusable prompt block",
        },
        "Write release notes for this change.",
      ),
    );

    expect(html).toContain("Ask AI");
    expect(html).toContain("Copy prompt");
    expect(html).toContain("Open in Cursor");
    expect(html).not.toContain("Write release notes for this change.");
  });

  it("can opt into rendering the prompt body", () => {
    const components = getMDXComponents();
    const PromptComponent = components.Prompt as React.ComponentType<{
      showPrompt?: boolean;
      children?: React.ReactNode;
    }>;
    const html = renderToStaticMarkup(
      React.createElement(
        PromptComponent,
        {
          showPrompt: true,
        },
        "Write release notes for this change.",
      ),
    );

    expect(html).toContain("Write release notes for this change.");
  });
});
