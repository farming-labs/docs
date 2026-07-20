import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getMDXComponents } from "./mdx.js";

describe("getMDXComponents", () => {
  it("includes audience primitives by default without user registration", () => {
    const components = getMDXComponents();

    expect(typeof components.Agent).toBe("function");
    expect(typeof components.Human).toBe("function");
    expect(typeof components.Audience).toBe("function");

    const AgentComponent = components.Agent as (props: { children?: unknown }) => unknown;
    const HumanComponent = components.Human as React.ComponentType<{
      children?: React.ReactNode;
    }>;
    const AudienceComponent = components.Audience as React.ComponentType<{
      only: "human" | "agent";
      children?: React.ReactNode;
    }>;

    expect(AgentComponent({ children: "hidden agent-only context" })).toBeNull();
    expect(
      renderToStaticMarkup(React.createElement(HumanComponent, null, "visible human-only context")),
    ).toContain("visible human-only context");
    expect(
      renderToStaticMarkup(
        React.createElement(AudienceComponent, { only: "human" }, "visible human context"),
      ),
    ).toContain("visible human context");
    expect(
      renderToStaticMarkup(
        React.createElement(AudienceComponent, { only: "agent" }, "hidden agent context"),
      ),
    ).toBe("");
  });

  it("renders Audience children as shared content when only is invalid", () => {
    const components = getMDXComponents();
    const AudienceComponent = components.Audience as React.ComponentType<{
      only?: string;
      children?: React.ReactNode;
    }>;

    const html = renderToStaticMarkup(
      React.createElement(AudienceComponent, { only: "unknown" }, "shared fallback"),
    );

    expect(html).toContain("shared fallback");
    expect(
      renderToStaticMarkup(React.createElement(AudienceComponent, null, "missing-value fallback")),
    ).toContain("missing-value fallback");
  });

  it("includes a Mintlify-compatible CodeGroup primitive by default without user registration", () => {
    const components = getMDXComponents();

    expect(typeof components.CodeGroup).toBe("function");

    const CodeGroup = components.CodeGroup as React.ComponentType<{
      children?: React.ReactNode;
      dropdown?: boolean;
    }>;
    const Pre = components.pre as React.ComponentType<React.ComponentPropsWithoutRef<"pre">>;

    const html = renderToStaticMarkup(
      React.createElement(
        CodeGroup,
        { dropdown: true },
        React.createElement(
          Pre,
          { title: "npm" },
          React.createElement("code", null, "npm install @farming-labs/docs"),
        ),
        React.createElement(
          Pre,
          { filename: "pnpm" } as React.ComponentPropsWithoutRef<"pre"> & {
            filename: string;
          },
          React.createElement("code", null, "pnpm add @farming-labs/docs"),
        ),
      ),
    );

    expect(html).toContain("data-fd-code-group");
    expect(html).toContain("data-dropdown");
    expect(html).toContain("fd-code-group-panel");
    expect(html).toContain(">npm</button>");
    expect(html).toContain(">pnpm</button>");
    expect(html).toContain("npm install @farming-labs/docs");
    expect(html).toContain("pnpm add @farming-labs/docs");
  });

  it("uses bare code fence metadata as CodeGroup tab labels", () => {
    const components = getMDXComponents({
      pre: (props: React.ComponentPropsWithoutRef<"pre"> & { metastring?: string }) =>
        React.createElement("pre", props),
    });
    const CodeGroup = components.CodeGroup as React.ComponentType<{
      children?: React.ReactNode;
    }>;
    const Pre = components.pre as React.ComponentType<
      React.ComponentPropsWithoutRef<"pre"> & { metastring?: string }
    >;

    const html = renderToStaticMarkup(
      React.createElement(
        CodeGroup,
        null,
        React.createElement(
          Pre,
          { metastring: "javascript helloWorld.js", className: "language-javascript" },
          React.createElement("code", null, "console.log('Hello World');"),
        ),
        React.createElement(
          Pre,
          { metastring: "python hello_world.py", className: "language-python" },
          React.createElement("code", null, "print('Hello World!')"),
        ),
      ),
    );

    expect(html).toContain(">helloWorld.js</button>");
    expect(html).toContain(">hello_world.py</button>");
    expect(html).toContain("console.log");
    expect(html).toContain("print");
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

  it("preserves children for overridden Prompt components", () => {
    const components = getMDXComponents({
      Prompt: ({ children, prompt }: { children?: React.ReactNode; prompt?: string }) =>
        React.createElement("div", { "data-prompt": prompt }, children),
    });
    const PromptComponent = components.Prompt as React.ComponentType<{
      children?: React.ReactNode;
    }>;
    const html = renderToStaticMarkup(
      React.createElement(PromptComponent, null, "Write release notes for this change."),
    );

    expect(html).toContain("Write release notes for this change.");
    expect(html).toContain('data-prompt="Write release notes for this change."');
  });

  it("supports custom provider urlTemplate values for Prompt open actions", () => {
    const components = getMDXComponents(undefined, {
      openDocsProviders: [
        {
          name: "Internal",
          urlTemplate: "https://internal.example/?prompt={prompt}",
        },
      ],
    });
    const PromptComponent = components.Prompt as React.ComponentType<{
      actions?: string[];
      providers?: string[];
      children?: React.ReactNode;
    }>;
    const html = renderToStaticMarkup(
      React.createElement(
        PromptComponent,
        {
          actions: ["open"],
          providers: ["Internal"],
        },
        "Write release notes for this change.",
      ),
    );

    expect(html).toContain("Open in Internal");
  });

  it("renders leading Shiki flag spaces as explicit code spacers", () => {
    const components = getMDXComponents({
      pre: (props: React.ComponentPropsWithoutRef<"pre">) => React.createElement("pre", props),
    });
    const Pre = components.pre as React.ComponentType<React.ComponentPropsWithoutRef<"pre">>;

    const html = renderToStaticMarkup(
      React.createElement(
        Pre,
        null,
        React.createElement(
          "code",
          null,
          React.createElement(
            "span",
            { className: "line" },
            React.createElement("span", null, "lim"),
            React.createElement("span", null, " xcode"),
            React.createElement("span", null, " --upload"),
          ),
        ),
      ),
    );

    expect(html).toContain('data-fd-code-space="gap"');
    expect(html).toContain("--upload");
    expect(html).not.toContain("> --upload</span>");
    expect(html).toContain("> xcode</span>");
  });
});
