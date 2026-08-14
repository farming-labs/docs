import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { digestDocsRetrievalContent } from "./retrieval-digest.js";

function expectedDigest(value: string): string {
  const normalized = value
    .replace(/\r\n?/gu, "\n")
    .replace(/^\uFEFF/u, "")
    .trimEnd();
  return `sha256:${createHash("sha256").update(normalized, "utf8").digest("hex")}`;
}

describe("retrieval digest", () => {
  it.each(["", "abc", "Café 配置 💡", "\uFEFFline one\r\nline two  \r\n"])(
    "matches SHA-256 for normalized UTF-8 content: %j",
    (value) => {
      expect(digestDocsRetrievalContent(value)).toBe(expectedDigest(value));
    },
  );

  it("normalizes line endings and trailing whitespace deterministically", () => {
    expect(digestDocsRetrievalContent("one\r\ntwo\n\n")).toBe(
      digestDocsRetrievalContent("one\ntwo"),
    );
  });

  it.each([55, 56, 63, 64, 65, 129])(
    "matches SHA-256 across the %i-byte block boundary",
    (length) => {
      const value = "a".repeat(length);
      expect(digestDocsRetrievalContent(value)).toBe(expectedDigest(value));
    },
  );

  it("matches the standard one-million-a multi-block vector", () => {
    const value = "a".repeat(1_000_000);
    expect(digestDocsRetrievalContent(value)).toBe(
      "sha256:cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
    );
  });
});
