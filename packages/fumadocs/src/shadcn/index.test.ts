import { describe, expect, it } from "vitest";
import { hardline } from "../hardline/index.js";
import { threadline } from "../threadline/index.js";
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

  it("does not forward theme variants through React's reserved style prop", () => {
    for (const theme of [hardline(), shadcn(), threadline()]) {
      expect(theme.ui?.components?.Tabs).toBeUndefined();
    }
  });
});
