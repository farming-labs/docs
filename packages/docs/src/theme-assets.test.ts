import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("built-in theme assets", () => {
  it("keeps the public Shadcn Docs preview synchronized with the shared theme CSS", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../styles/themes/shadcn.css", import.meta.url)),
      "utf8",
    );
    const preview = readFileSync(
      fileURLToPath(new URL("../../../website/public/themes/shadcn.css", import.meta.url)),
      "utf8",
    );

    expect(preview).toBe(source);
  });

  it("styles the framework-neutral document class contract", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../styles/themes/shadcn.css", import.meta.url)),
      "utf8",
    );

    expect(source).toContain(".fd-page-body");
    expect(source).toContain(".fd-docs-content");
  });
});
