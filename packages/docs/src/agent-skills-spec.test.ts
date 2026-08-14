import { describe, expect, it } from "vitest";
import {
  AGENT_SKILL_FRONTMATTER_FIELDS,
  DocsAgentSkillFrontmatterError,
  isDocsAgentSkillName,
  parseDocsAgentSkillFrontmatter,
  validateDocsAgentSkillFrontmatter,
} from "./agent-skills-spec.js";

function skillDocument(frontmatter: string, body = "# Test skill\n"): string {
  return `---\n${frontmatter}\n---\n\n${body}`;
}

function issueMessages(document: string, directoryName?: string): string[] {
  const validation = validateDocsAgentSkillFrontmatter(document, { directoryName });
  return validation.valid ? [] : validation.issues.map((issue) => issue.message);
}

describe("Agent Skills frontmatter validation", () => {
  it("parses every standard field without changing its values", () => {
    const document = skillDocument(`name: release-helper
description: Prepare and verify a release. Use when publishing packages.
license: Apache-2.0
compatibility: Requires Node.js 22+ and pnpm.
metadata:
  author: farming-labs
  version: "1.0"
allowed-tools: Bash(git:*) Bash(pnpm:*) Read
`);

    expect(
      parseDocsAgentSkillFrontmatter(document, {
        directoryName: "release-helper",
      }),
    ).toEqual({
      name: "release-helper",
      description: "Prepare and verify a release. Use when publishing packages.",
      license: "Apache-2.0",
      compatibility: "Requires Node.js 22+ and pnpm.",
      metadata: {
        author: "farming-labs",
        version: "1.0",
      },
      "allowed-tools": "Bash(git:*) Bash(pnpm:*) Read",
    });
  });

  it("normalizes and accepts Unicode lowercase alphanumeric names", () => {
    const decomposedName = "cafe\u0301-tools";
    const validation = validateDocsAgentSkillFrontmatter(
      skillDocument(`name: ${decomposedName}
description: Handle localized documentation tools.
`),
      { directoryName: "café-tools" },
    );

    expect(validation).toMatchObject({
      valid: true,
      data: { name: "café-tools" },
    });
    expect(isDocsAgentSkillName("文档-工具2")).toBe(true);
    expect(isDocsAgentSkillName("PDF-tools")).toBe(false);
  });

  it("preserves accepted description whitespace exactly as YAML parsed it", () => {
    const parsed = parseDocsAgentSkillFrontmatter(
      skillDocument(`name: spaced-description
description: " Keep deliberate spacing. "
`),
    );

    expect(parsed.description).toBe(" Keep deliberate spacing. ");
  });

  it("rejects unknown top-level fields and points extensions to the standard field set", () => {
    const messages = issueMessages(
      skillDocument(`name: extra-fields
description: Exercise strict top-level field validation.
version: "1.0"
author: farming-labs
`),
    );

    expect(messages).toContain(
      `Unexpected fields in frontmatter: author, version. Only ${JSON.stringify([
        ...AGENT_SKILL_FRONTMATTER_FIELDS,
      ])} are allowed.`,
    );
  });

  it.each([
    {
      label: "a mapping-valued license",
      fields: "license:\n  name: MIT\n",
      message: "Field 'license' must be a string",
    },
    {
      label: "an empty compatibility value",
      fields: 'compatibility: "   "\n',
      message: "Field 'compatibility' must contain at least 1 character",
    },
    {
      label: "an oversized compatibility value",
      fields: `compatibility: ${"x".repeat(501)}\n`,
      message: "Compatibility exceeds 500 character limit (501 chars)",
    },
    {
      label: "a list-valued metadata field",
      fields: "metadata:\n  - author\n",
      message: "Field 'metadata' must be a mapping from string keys to string values",
    },
    {
      label: "a timestamp-valued metadata field",
      fields: "metadata: 2020-01-01\n",
      message: "Field 'metadata' must be a mapping from string keys to string values",
    },
    {
      label: "a non-string metadata key",
      fields: "metadata:\n  1: release\n",
      message: "Field 'metadata' keys must be strings",
    },
    {
      label: "a non-string metadata value",
      fields: "metadata:\n  version: 1\n",
      message: "Field 'metadata.version' must be a string",
    },
    {
      label: "a list-valued allowed-tools field",
      fields: "allowed-tools:\n  - Read\n",
      message: "Field 'allowed-tools' must be a space-separated string",
    },
  ])("rejects $label", ({ fields, message }) => {
    expect(
      issueMessages(
        skillDocument(`name: optional-fields
description: Exercise optional field validation.
${fields}`),
      ),
    ).toContain(message);
  });

  it.each([
    ["uppercase characters", "Release-helper", "must be lowercase"],
    ["a leading hyphen", "-release-helper", "cannot start or end with a hyphen"],
    ["a trailing hyphen", "release-helper-", "cannot start or end with a hyphen"],
    ["consecutive hyphens", "release--helper", "cannot contain consecutive hyphens"],
    ["unsupported punctuation", "release_helper", "contains invalid characters"],
    ["surrounding whitespace", '" release-helper "', "contains invalid characters"],
    ["more than 64 characters", "a".repeat(65), "exceeds 64 character limit"],
  ])("rejects names with %s", (_label, name, expectedMessage) => {
    expect(
      issueMessages(
        skillDocument(`name: ${name}
description: Exercise name validation.
`),
      ).some((message) => message.includes(expectedMessage)),
    ).toBe(true);
  });

  it("requires the normalized name to match the parent directory", () => {
    expect(
      issueMessages(
        skillDocument(`name: release-helper
description: Exercise directory matching.
`),
        "other-directory",
      ),
    ).toContain(
      'Agent Skill frontmatter name "release-helper" must match its directory "other-directory".',
    );
  });

  it("enforces required string fields and their character limits", () => {
    const missing = issueMessages(skillDocument("license: MIT\n"));
    expect(missing).toEqual(
      expect.arrayContaining([
        "Missing required field in frontmatter: name",
        "Missing required field in frontmatter: description",
      ]),
    );

    const typed = issueMessages(
      skillDocument(`name: 123
description: false
`),
    );
    expect(typed).toEqual(
      expect.arrayContaining([
        "Field 'name' must be a non-empty string",
        "Field 'description' must be a non-empty string",
      ]),
    );

    expect(
      issueMessages(
        skillDocument(`name: long-description
description: ${"x".repeat(1025)}
`),
      ),
    ).toContain("Description exceeds 1024 character limit (1025 chars)");
  });

  it.each([
    ["missing opening delimiter", "# No frontmatter\n", "must start with YAML frontmatter"],
    [
      "a byte-order mark",
      `\uFEFF${skillDocument("name: bom\ndescription: A BOM-prefixed document.\n")}`,
      "must start with YAML frontmatter",
    ],
    [
      "missing closing delimiter",
      "---\nname: unclosed\ndescription: Missing the closing delimiter.\n",
      "not properly closed",
    ],
    [
      "a non-mapping document",
      "---\n- name: list\n- description: Not a mapping.\n---\n",
      "must be a YAML mapping",
    ],
    [
      "duplicate YAML keys",
      "---\nname: first\nname: second\ndescription: Duplicate name.\n---\n",
      "Invalid YAML in frontmatter",
    ],
  ])("rejects %s", (_label, document, expectedMessage) => {
    expect(issueMessages(document).some((message) => message.includes(expectedMessage))).toBe(true);
  });

  it("throws a structured error with the source and every issue", () => {
    const document = skillDocument(`name: BROKEN--name
description: Valid description.
owner: farming-labs
`);

    try {
      parseDocsAgentSkillFrontmatter(document, { source: "/workspace/skills/broken/SKILL.md" });
      throw new Error("Expected frontmatter parsing to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(DocsAgentSkillFrontmatterError);
      expect(error).toMatchObject({
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "unexpected-field" }),
          expect.objectContaining({ code: "invalid-name" }),
        ]),
      });
      expect(String(error)).toContain(
        "Invalid Agent Skill frontmatter in /workspace/skills/broken/SKILL.md",
      );
      expect(String(error)).toContain("Unexpected fields in frontmatter: owner");
      expect(String(error)).toContain("must be lowercase");
      expect(String(error)).toContain("cannot contain consecutive hyphens");
    }
  });
});
