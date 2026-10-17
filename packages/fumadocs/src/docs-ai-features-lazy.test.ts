import React, { Suspense } from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DocsAIFeatures } from "./docs-ai-features-lazy.js";

const { load, render } = vi.hoisted(() => ({ load: vi.fn(), render: vi.fn() }));

vi.mock("./docs-ai-features.js", () => {
  load();
  return {
    DocsAIFeatures: (props: object) => {
      render(props);
      return React.createElement("span", null, "Configured AI");
    },
  };
});

describe("Next AI loading boundary", () => {
  it("does not initialize the AI implementation just by importing the boundary", () => {
    expect(load).not.toHaveBeenCalled();
  });

  it.each(["search", "sidebar-icon", "floating"] as const)(
    "preserves server rendering and all props for %s mode",
    async (mode) => {
      const props = {
        mode,
        api: "/custom/docs?lang=fr",
        requestMode: "docs-cloud" as const,
        requestHeaders: { "X-Docs-Project": "public-project" },
        requestStream: false,
        locale: "fr",
        position: "bottom-left" as const,
        floatingStyle: "full-modal" as const,
        triggerComponentHtml: "<span>Assistant</span>",
        suggestedQuestions: ["How do I install?"],
        aiLabel: "Assistant",
        loaderVariant: "dots",
        loadingComponentHtml: "<span>Working</span>",
        models: [{ id: "test-model", label: "Test model" }],
        defaultModelId: "test-model",
        analytics: true,
        feedbackEnabled: false,
      };
      const stream = await renderToReadableStream(
        React.createElement(
          Suspense,
          { fallback: null },
          React.createElement(DocsAIFeatures, props),
        ),
      );
      await stream.allReady;
      expect(await new Response(stream).text()).toContain("Configured AI");
      expect(render).toHaveBeenLastCalledWith(props);
      expect(load).toHaveBeenCalledTimes(1);
    },
  );
});
