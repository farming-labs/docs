import { describe, expect, it } from "vitest";
import {
  hashGeneratedAgentContent,
  parseGeneratedAgentDocument,
  serializeGeneratedAgentDocument,
  type GeneratedAgentProvenance,
} from "./agent-provenance.js";

function hashUtf8Bytes(value: string): string {
  const bytes = new TextEncoder().encode(value.trimEnd());
  let hash = 0xcbf29ce484222325n;

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }

  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

describe("agent provenance", () => {
  it("hashes normalized UTF-8 bytes for non-ascii content", () => {
    expect(hashGeneratedAgentContent("Hello, élan\n")).toBe(hashUtf8Bytes("Hello, élan"));
    expect(hashGeneratedAgentContent("💡 docs")).toBe(hashUtf8Bytes("💡 docs"));
  });

  it("serializes and parses generated documents", () => {
    const provenance: GeneratedAgentProvenance = {
      version: 1,
      sourceKind: "resolved-page",
      sourceHash: "fnv1a64:1111111111111111",
      settingsHash: "fnv1a64:2222222222222222",
      outputHash: "fnv1a64:3333333333333333",
      generatedAt: "2026-04-27T15:39:36.829Z",
    };

    const raw = serializeGeneratedAgentDocument("# Hello\n", provenance);
    expect(parseGeneratedAgentDocument(raw)).toEqual({
      provenance,
      content: "# Hello\n",
    });
  });
});
