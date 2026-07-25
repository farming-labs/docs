const TAR_BLOCK_BYTES = 512;
const TAR_NAME_BYTES = 100;
const TAR_PREFIX_OFFSET = 345;
const TAR_PREFIX_BYTES = 155;

export const AGENT_SKILL_ARCHIVE_MAX_UNCOMPRESSED_BYTES = 10 * 1024 * 1024;
export const AGENT_SKILL_DOCUMENT_MAX_BYTES = 1024 * 1024;

function isZeroBlock(block: Uint8Array): boolean {
  return block.every((byte) => byte === 0);
}

function readTarText(header: Uint8Array, offset: number, length: number, field: string): string {
  const bytes = header.subarray(offset, offset + length);
  const terminator = bytes.indexOf(0);
  const value = terminator < 0 ? bytes : bytes.subarray(0, terminator);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    throw new Error(`Agent Skill archive has invalid UTF-8 in its ${field}.`);
  }
}

function readTarOctal(header: Uint8Array, offset: number, length: number, field: string): number {
  const value = readTarText(header, offset, length, field).trim();
  if (!/^[0-7]+$/u.test(value)) {
    throw new Error(`Agent Skill archive has an invalid ${field}.`);
  }
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Agent Skill archive has an unsafe ${field}.`);
  }
  return parsed;
}

function validateTarChecksum(header: Uint8Array): void {
  const expected = readTarOctal(header, 148, 8, "header checksum");
  const actual = header.reduce((sum, byte, index) => {
    return sum + (index >= 148 && index < 156 ? 0x20 : byte);
  }, 0);
  if (actual !== expected) {
    throw new Error("Agent Skill archive has an invalid tar header checksum.");
  }
}

/**
 * Extract the root SKILL.md from an uncompressed Agent Skill tar archive.
 *
 * Only the regular-file payload is returned; duplicate, oversized, malformed,
 * or non-UTF-8 documents are rejected before frontmatter validation.
 */
export function readAgentSkillDocumentFromTar(archive: Uint8Array): string {
  if (archive.byteLength > AGENT_SKILL_ARCHIVE_MAX_UNCOMPRESSED_BYTES) {
    throw new Error(
      `Agent Skill archive exceeds ${AGENT_SKILL_ARCHIVE_MAX_UNCOMPRESSED_BYTES} uncompressed bytes.`,
    );
  }

  let skillDocument: Uint8Array | undefined;
  let offset = 0;
  let foundEndOfArchive = false;
  while (offset < archive.byteLength) {
    if (offset + TAR_BLOCK_BYTES > archive.byteLength) {
      throw new Error("Agent Skill archive contains a truncated tar header.");
    }
    const header = archive.subarray(offset, offset + TAR_BLOCK_BYTES);
    if (isZeroBlock(header)) {
      const secondZeroBlockStart = offset + TAR_BLOCK_BYTES;
      const secondZeroBlockEnd = secondZeroBlockStart + TAR_BLOCK_BYTES;
      if (secondZeroBlockEnd > archive.byteLength) {
        throw new Error("Agent Skill archive contains a truncated end-of-archive marker.");
      }
      const secondZeroBlock = archive.subarray(secondZeroBlockStart, secondZeroBlockEnd);
      if (!isZeroBlock(secondZeroBlock)) {
        throw new Error("Agent Skill archive is missing the second end-of-archive block.");
      }
      const trailingBytes = archive.subarray(secondZeroBlockEnd);
      if (!trailingBytes.every((byte) => byte === 0)) {
        throw new Error("Agent Skill archive contains non-zero bytes after its end marker.");
      }
      foundEndOfArchive = true;
      break;
    }

    validateTarChecksum(header);
    const name = readTarText(header, 0, TAR_NAME_BYTES, "file name");
    const prefix = readTarText(header, TAR_PREFIX_OFFSET, TAR_PREFIX_BYTES, "file prefix");
    const path = prefix ? `${prefix}/${name}` : name;
    const size = readTarOctal(header, 124, 12, "file size");
    const contentStart = offset + TAR_BLOCK_BYTES;
    const contentEnd = contentStart + size;
    if (contentEnd > archive.byteLength) {
      throw new Error(`Agent Skill archive entry ${JSON.stringify(path)} is truncated.`);
    }

    const typeFlag = header[156];
    if (path === "SKILL.md") {
      if (typeFlag !== 0 && typeFlag !== "0".charCodeAt(0)) {
        throw new Error("Agent Skill archive root SKILL.md must be a regular file.");
      }
      if (skillDocument) {
        throw new Error("Agent Skill archive contains more than one root SKILL.md.");
      }
      if (size > AGENT_SKILL_DOCUMENT_MAX_BYTES) {
        throw new Error(
          `Agent Skill archive SKILL.md exceeds ${AGENT_SKILL_DOCUMENT_MAX_BYTES} bytes.`,
        );
      }
      skillDocument = archive.subarray(contentStart, contentEnd);
    }

    const paddedSize = Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
    const nextOffset = contentStart + paddedSize;
    if (nextOffset > archive.byteLength) {
      throw new Error(`Agent Skill archive entry ${JSON.stringify(path)} has truncated padding.`);
    }
    offset = nextOffset;
  }

  if (!foundEndOfArchive) {
    throw new Error("Agent Skill archive is missing its end-of-archive marker.");
  }
  if (!skillDocument) {
    throw new Error("Agent Skill archive does not contain a root SKILL.md.");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(skillDocument);
  } catch {
    throw new Error("Agent Skill archive SKILL.md is not valid UTF-8.");
  }
}
