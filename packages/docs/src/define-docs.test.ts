import { describe, expect, it, vi } from "vitest";
import { defineDocs } from "./define-docs.js";

describe("defineDocs", () => {
  it("preserves feedback and copy callbacks in the normalized config", () => {
    const onCopyClick = vi.fn();
    const onFeedback = vi.fn();

    const config = defineDocs({
      entry: "docs",
      onCopyClick,
      feedback: {
        enabled: true,
        onFeedback,
      },
    });

    expect(config.onCopyClick).toBe(onCopyClick);
    expect(config.feedback).toEqual({
      enabled: true,
      onFeedback,
    });
  });
});
