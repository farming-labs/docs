import { describe, expect, it } from "vitest";
import { shadcn } from "./index.js";

describe("shadcn theme", () => {
  it("owns the syntax highlighting defaults", () => {
    expect(shadcn().ui?.codeBlock).toEqual({
      showCopyButton: true,
      showLineNumbers: false,
      theme: "github-light-default",
      darkTheme: "vesper",
    });
  });
});
