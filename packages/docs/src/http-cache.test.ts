import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDocsCacheableResponse, formatDocsContentDigest } from "./http-cache.js";

describe("agent surface HTTP cache integrity", () => {
  it("hashes the exact UTF-8 response bytes and preserves validators on HEAD and 304", async () => {
    const url = "https://docs.example.com/llms.txt";
    const content = "# Café ☕\n";
    const lastModified = "2026-07-31T12:00:00.000Z";
    const get = createDocsCacheableResponse({
      request: new Request(url),
      content,
      lastModified,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
    const sha256 = createHash("sha256").update(content, "utf8").digest("hex");

    expect(get.headers.get("etag")).toBe(`"${sha256}"`);
    expect(get.headers.get("content-digest")).toBe(
      `sha-256=:${createHash("sha256").update(content, "utf8").digest("base64")}:`,
    );
    expect(get.headers.get("last-modified")).toBe("Fri, 31 Jul 2026 12:00:00 GMT");
    expect(await get.text()).toBe(content);

    const head = createDocsCacheableResponse({
      request: new Request(url, { method: "HEAD" }),
      content,
      lastModified,
    });
    expect(head.headers.get("etag")).toBe(get.headers.get("etag"));
    expect(head.headers.get("content-digest")).toBe(get.headers.get("content-digest"));
    expect(await head.text()).toBe("");

    const notModified = createDocsCacheableResponse({
      request: new Request(url, { headers: { "If-None-Match": `W/"${sha256}"` } }),
      content,
      lastModified,
    });
    expect(notModified.status).toBe(304);
    expect(notModified.headers.get("content-digest")).toBe(get.headers.get("content-digest"));
  });

  it("honors If-None-Match precedence and formats binary SHA-256 digests", () => {
    const url = "https://docs.example.com/.well-known/agent-skills/example.tar.gz";
    const content = new Uint8Array([0, 1, 2, 254, 255]);
    const sha256 = createHash("sha256").update(content).digest("hex");
    expect(formatDocsContentDigest(sha256)).toBe(
      `sha-256=:${createHash("sha256").update(content).digest("base64")}:`,
    );

    const response = createDocsCacheableResponse({
      request: new Request(url, {
        headers: {
          "If-None-Match": '"different"',
          "If-Modified-Since": "Sat, 01 Aug 2026 00:00:00 GMT",
        },
      }),
      content,
      lastModified: "2026-07-31T12:00:00.000Z",
    });
    expect(response.status).toBe(200);
  });
});
