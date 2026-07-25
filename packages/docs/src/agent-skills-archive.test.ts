import { describe, expect, it } from "vitest";
import { readAgentSkillDocumentFromTar } from "./agent-skills-archive.js";

function writeTarText(header: Uint8Array, offset: number, length: number, value: string): void {
  header.set(new TextEncoder().encode(value).subarray(0, length), offset);
}

function tarEntry(name: string, content: Uint8Array, type = "0"): Uint8Array {
  const header = new Uint8Array(512);
  writeTarText(header, 0, 100, name);
  writeTarText(header, 100, 8, "0000644");
  writeTarText(header, 108, 8, "0000000");
  writeTarText(header, 116, 8, "0000000");
  writeTarText(header, 124, 12, content.byteLength.toString(8).padStart(11, "0"));
  writeTarText(header, 136, 12, "00000000000");
  header.fill(0x20, 148, 156);
  header[156] = type.charCodeAt(0);
  writeTarText(header, 257, 6, "ustar");
  writeTarText(header, 263, 2, "00");
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeTarText(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);

  const entry = new Uint8Array(512 + Math.ceil(content.byteLength / 512) * 512);
  entry.set(header);
  entry.set(content, 512);
  return entry;
}

function tarArchive(entries: readonly Uint8Array[]): Uint8Array {
  const size = entries.reduce((sum, entry) => sum + entry.byteLength, 1024);
  const archive = new Uint8Array(size);
  let offset = 0;
  for (const entry of entries) {
    archive.set(entry, offset);
    offset += entry.byteLength;
  }
  return archive;
}

describe("Agent Skill archive parsing", () => {
  it("returns the exact root SKILL.md bytes while ignoring companion files", () => {
    const document = `---
name: archived
description: Use the archived workflow.
---

# Archived
`;
    const archive = tarArchive([
      tarEntry("SKILL.md", new TextEncoder().encode(document)),
      tarEntry("references/notes.md", new TextEncoder().encode("# Notes\n")),
    ]);

    expect(readAgentSkillDocumentFromTar(archive)).toBe(document);
  });

  it.each([
    {
      label: "a missing root document",
      archive: tarArchive([tarEntry("nested/SKILL.md", new TextEncoder().encode("# Nested\n"))]),
      message: "does not contain a root SKILL.md",
    },
    {
      label: "a duplicate root document",
      archive: tarArchive([
        tarEntry("SKILL.md", new TextEncoder().encode("# One\n")),
        tarEntry("SKILL.md", new TextEncoder().encode("# Two\n")),
      ]),
      message: "more than one root SKILL.md",
    },
    {
      label: "a non-regular root document",
      archive: tarArchive([tarEntry("SKILL.md", new Uint8Array(), "2")]),
      message: "must be a regular file",
    },
  ])("rejects $label", ({ archive, message }) => {
    expect(() => readAgentSkillDocumentFromTar(archive)).toThrow(message);
  });

  it("rejects corrupt headers before trusting their size or path", () => {
    const archive = tarArchive([tarEntry("SKILL.md", new TextEncoder().encode("# Corrupt\n"))]);
    archive[20] ^= 0xff;

    expect(() => readAgentSkillDocumentFromTar(archive)).toThrow("invalid tar header checksum");
  });

  it("rejects archives without the required second end block", () => {
    const entry = tarEntry("SKILL.md", new TextEncoder().encode("# One block\n"));
    const archive = new Uint8Array(entry.byteLength + 512);
    archive.set(entry);

    expect(() => readAgentSkillDocumentFromTar(archive)).toThrow("truncated end-of-archive marker");
  });

  it("rejects non-zero trailing bytes after the end marker", () => {
    const validArchive = tarArchive([
      tarEntry("SKILL.md", new TextEncoder().encode("# Trailing\n")),
    ]);
    const archive = new Uint8Array(validArchive.byteLength + 512);
    archive.set(validArchive);
    archive[archive.byteLength - 1] = 1;

    expect(() => readAgentSkillDocumentFromTar(archive)).toThrow(
      "non-zero bytes after its end marker",
    );
  });
});
