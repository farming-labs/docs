import { describe, expect, it } from "vitest";
import { escapeJsonLdForScript } from "./json-ld.js";

describe("escapeJsonLdForScript", () => {
  it("escapes literal script-breaking tags in JSON-LD strings", () => {
    const json = JSON.stringify({
      "@context": "https://schema.org",
      headline: "</script><script>alert(1)</script>",
    });

    expect(escapeJsonLdForScript(json)).toContain("\\u003c/script>");
    expect(escapeJsonLdForScript(json)).not.toContain("</script>");
  });
});
