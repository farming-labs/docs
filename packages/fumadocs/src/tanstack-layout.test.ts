import React from "react";
import { describe, expect, it } from "vitest";
import { TanstackDocsLayout } from "./tanstack-layout.js";

describe("TanstackDocsLayout", () => {
  it("does not add an extra display: contents wrapper above the docs layout root", () => {
    const tree = TanstackDocsLayout({
      config: {
        entry: "docs",
      },
      tree: {
        name: "Docs",
        children: [],
      },
      children: React.createElement("div", null, "child"),
    });

    expect(React.isValidElement(tree)).toBe(true);
    expect(tree.type).not.toBe("div");
    expect((tree.props as { id?: string; style?: { display?: string } }).id).toBeUndefined();
    expect(
      (tree.props as { id?: string; style?: { display?: string } }).style?.display,
    ).toBeUndefined();
  });
});
