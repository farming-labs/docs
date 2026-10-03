import { describe, expect, it } from "vitest";
import { DEFAULT_DOCS_JSON_BODY_MAX_BYTES, readDocsJsonBody } from "./http-body.js";

describe("readDocsJsonBody", () => {
  it("rejects an oversized declared content length before reading the body", async () => {
    const request = new Request("https://docs.example.com/api/docs", {
      method: "POST",
      headers: {
        "content-length": String(DEFAULT_DOCS_JSON_BODY_MAX_BYTES + 1),
        "content-type": "application/json",
      },
      body: "{}",
    });

    await expect(readDocsJsonBody(request)).resolves.toEqual({
      ok: false,
      reason: "request_too_large",
      maxBodyBytes: DEFAULT_DOCS_JSON_BODY_MAX_BYTES,
    });
    expect(request.bodyUsed).toBe(false);
  });

  it("enforces the actual byte limit when content length is absent", async () => {
    const request = new Request("https://docs.example.com/api/docs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(DEFAULT_DOCS_JSON_BODY_MAX_BYTES) }),
    });

    await expect(readDocsJsonBody(request)).resolves.toEqual({
      ok: false,
      reason: "request_too_large",
      maxBodyBytes: DEFAULT_DOCS_JSON_BODY_MAX_BYTES,
    });
  });

  it("parses JSON bodies below the limit", async () => {
    const request = new Request("https://docs.example.com/api/docs", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });

    await expect(readDocsJsonBody(request)).resolves.toEqual({
      ok: true,
      value: { messages: [] },
    });
  });
});
