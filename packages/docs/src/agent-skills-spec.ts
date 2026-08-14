import { isMap, isScalar, parseDocument, type YAMLMap } from "yaml";

export const AGENT_SKILL_FRONTMATTER_FIELDS = [
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
] as const;

export const AGENT_SKILL_NAME_MAX_LENGTH = 64;
export const AGENT_SKILL_DESCRIPTION_MAX_LENGTH = 1024;
export const AGENT_SKILL_COMPATIBILITY_MAX_LENGTH = 500;

export type DocsAgentSkillFrontmatterField =
  | (typeof AGENT_SKILL_FRONTMATTER_FIELDS)[number]
  | "frontmatter";

export interface DocsAgentSkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  "allowed-tools"?: string;
}

export interface DocsAgentSkillFrontmatterIssue {
  code:
    | "missing-frontmatter"
    | "unclosed-frontmatter"
    | "invalid-yaml"
    | "invalid-mapping"
    | "unexpected-field"
    | "missing-field"
    | "invalid-type"
    | "invalid-length"
    | "invalid-name"
    | "directory-mismatch";
  field: DocsAgentSkillFrontmatterField;
  message: string;
}

export interface DocsAgentSkillFrontmatterValidationOptions {
  /** Parent directory name, when the document came from a skill directory. */
  directoryName?: string;
  /** Human-readable file or generated-document label used in thrown diagnostics. */
  source?: string;
}

export type DocsAgentSkillFrontmatterValidation =
  | {
      valid: true;
      data: DocsAgentSkillFrontmatter;
      issues: readonly [];
    }
  | {
      valid: false;
      data: null;
      issues: readonly DocsAgentSkillFrontmatterIssue[];
    };

const AGENT_SKILL_FRONTMATTER_FIELD_SET = new Set<string>(AGENT_SKILL_FRONTMATTER_FIELDS);
const FRONTMATTER_OPEN_PATTERN = /^---[ \t]*(?:\r?\n)/u;
const FRONTMATTER_CLOSE_PATTERN = /^---[ \t]*(?:\r?\n|$)/mu;
const UNICODE_ALPHANUMERIC_PATTERN = /^[\p{L}\p{N}]$/u;

function characterCount(value: string): number {
  return Array.from(value).length;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function hasOwn(value: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function yamlErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim() || "unknown YAML parser error";
}

function findYamlMappingValue(mapping: YAMLMap, field: string): unknown {
  return mapping.items.find((pair) => isScalar(pair.key) && pair.key.value === field)?.value;
}

/**
 * Check the Agent Skills name grammar after NFKC normalization.
 *
 * The official reference validator accepts Unicode lowercase letters and numbers
 * in addition to the ASCII examples documented by the specification.
 */
export function isDocsAgentSkillName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.normalize("NFKC");
  const characters = Array.from(normalized);
  return (
    characters.length > 0 &&
    characters.length <= AGENT_SKILL_NAME_MAX_LENGTH &&
    normalized === normalized.toLowerCase() &&
    !normalized.startsWith("-") &&
    !normalized.endsWith("-") &&
    !normalized.includes("--") &&
    characters.every(
      (character) => character === "-" || UNICODE_ALPHANUMERIC_PATTERN.test(character),
    )
  );
}

function validateName(
  data: Record<string, unknown>,
  options: DocsAgentSkillFrontmatterValidationOptions,
  issues: DocsAgentSkillFrontmatterIssue[],
): string | null {
  if (!hasOwn(data, "name")) {
    issues.push({
      code: "missing-field",
      field: "name",
      message: "Missing required field in frontmatter: name",
    });
    return null;
  }

  if (typeof data.name !== "string" || data.name.trim().length === 0) {
    issues.push({
      code: "invalid-type",
      field: "name",
      message: "Field 'name' must be a non-empty string",
    });
    return null;
  }

  const name = data.name.normalize("NFKC");
  const length = characterCount(name);
  if (length > AGENT_SKILL_NAME_MAX_LENGTH) {
    issues.push({
      code: "invalid-length",
      field: "name",
      message: `Skill name '${name}' exceeds ${AGENT_SKILL_NAME_MAX_LENGTH} character limit (${length} chars)`,
    });
  }
  if (name !== name.toLowerCase()) {
    issues.push({
      code: "invalid-name",
      field: "name",
      message: `Skill name '${name}' must be lowercase`,
    });
  }
  if (name.startsWith("-") || name.endsWith("-")) {
    issues.push({
      code: "invalid-name",
      field: "name",
      message: "Skill name cannot start or end with a hyphen",
    });
  }
  if (name.includes("--")) {
    issues.push({
      code: "invalid-name",
      field: "name",
      message: "Skill name cannot contain consecutive hyphens",
    });
  }
  if (
    !Array.from(name).every(
      (character) => character === "-" || UNICODE_ALPHANUMERIC_PATTERN.test(character),
    )
  ) {
    issues.push({
      code: "invalid-name",
      field: "name",
      message: `Skill name '${name}' contains invalid characters. Only letters, digits, and hyphens are allowed.`,
    });
  }

  if (options.directoryName !== undefined && options.directoryName.normalize("NFKC") !== name) {
    issues.push({
      code: "directory-mismatch",
      field: "name",
      message: `Agent Skill frontmatter name "${name}" must match its directory "${options.directoryName}".`,
    });
  }

  return name;
}

function validateDescription(
  data: Record<string, unknown>,
  issues: DocsAgentSkillFrontmatterIssue[],
): string | null {
  if (!hasOwn(data, "description")) {
    issues.push({
      code: "missing-field",
      field: "description",
      message: "Missing required field in frontmatter: description",
    });
    return null;
  }

  if (typeof data.description !== "string" || data.description.trim().length === 0) {
    issues.push({
      code: "invalid-type",
      field: "description",
      message: "Field 'description' must be a non-empty string",
    });
    return null;
  }

  const length = characterCount(data.description);
  if (length > AGENT_SKILL_DESCRIPTION_MAX_LENGTH) {
    issues.push({
      code: "invalid-length",
      field: "description",
      message: `Description exceeds ${AGENT_SKILL_DESCRIPTION_MAX_LENGTH} character limit (${length} chars)`,
    });
  }
  return data.description;
}

function validateOptionalFields(
  data: Record<string, unknown>,
  frontmatter: YAMLMap,
  issues: DocsAgentSkillFrontmatterIssue[],
): Pick<DocsAgentSkillFrontmatter, "license" | "compatibility" | "metadata" | "allowed-tools"> {
  const result: Pick<
    DocsAgentSkillFrontmatter,
    "license" | "compatibility" | "metadata" | "allowed-tools"
  > = {};

  if (hasOwn(data, "license")) {
    if (typeof data.license !== "string") {
      issues.push({
        code: "invalid-type",
        field: "license",
        message: "Field 'license' must be a string",
      });
    } else {
      result.license = data.license;
    }
  }

  if (hasOwn(data, "compatibility")) {
    if (typeof data.compatibility !== "string") {
      issues.push({
        code: "invalid-type",
        field: "compatibility",
        message: "Field 'compatibility' must be a string",
      });
    } else {
      const length = characterCount(data.compatibility);
      if (data.compatibility.trim().length === 0) {
        issues.push({
          code: "invalid-length",
          field: "compatibility",
          message: "Field 'compatibility' must contain at least 1 character",
        });
      } else if (length > AGENT_SKILL_COMPATIBILITY_MAX_LENGTH) {
        issues.push({
          code: "invalid-length",
          field: "compatibility",
          message: `Compatibility exceeds ${AGENT_SKILL_COMPATIBILITY_MAX_LENGTH} character limit (${length} chars)`,
        });
      }
      result.compatibility = data.compatibility;
    }
  }

  if (hasOwn(data, "metadata")) {
    const metadataNode = findYamlMappingValue(frontmatter, "metadata");
    const metadata = asRecord(data.metadata);
    if (!isMap(metadataNode) || !metadata) {
      issues.push({
        code: "invalid-type",
        field: "metadata",
        message: "Field 'metadata' must be a mapping from string keys to string values",
      });
    } else {
      if (
        metadataNode.items.some((pair) => !isScalar(pair.key) || typeof pair.key.value !== "string")
      ) {
        issues.push({
          code: "invalid-type",
          field: "metadata",
          message: "Field 'metadata' keys must be strings",
        });
      }
      const invalidKeys = Object.keys(metadata)
        .filter((key) => typeof metadata[key] !== "string")
        .sort();
      for (const key of invalidKeys) {
        issues.push({
          code: "invalid-type",
          field: "metadata",
          message: `Field 'metadata.${key}' must be a string`,
        });
      }
      result.metadata = Object.fromEntries(
        Object.entries(metadata).filter((entry): entry is [string, string] => {
          return typeof entry[1] === "string";
        }),
      );
    }
  }

  if (hasOwn(data, "allowed-tools")) {
    if (typeof data["allowed-tools"] !== "string") {
      issues.push({
        code: "invalid-type",
        field: "allowed-tools",
        message: "Field 'allowed-tools' must be a space-separated string",
      });
    } else {
      result["allowed-tools"] = data["allowed-tools"];
    }
  }

  return result;
}

/** Validate one SKILL.md document against the complete Agent Skills frontmatter contract. */
export function validateDocsAgentSkillFrontmatter(
  document: string,
  options: DocsAgentSkillFrontmatterValidationOptions = {},
): DocsAgentSkillFrontmatterValidation {
  const issues: DocsAgentSkillFrontmatterIssue[] = [];
  const opening = document.match(FRONTMATTER_OPEN_PATTERN);
  if (!opening) {
    return {
      valid: false,
      data: null,
      issues: [
        {
          code: "missing-frontmatter",
          field: "frontmatter",
          message: "SKILL.md must start with YAML frontmatter (---)",
        },
      ],
    };
  }

  const remainder = document.slice(opening[0].length);
  const closing = FRONTMATTER_CLOSE_PATTERN.exec(remainder);
  if (!closing) {
    return {
      valid: false,
      data: null,
      issues: [
        {
          code: "unclosed-frontmatter",
          field: "frontmatter",
          message: "SKILL.md frontmatter not properly closed with ---",
        },
      ],
    };
  }

  let data: Record<string, unknown> | null;
  let frontmatter: YAMLMap;
  try {
    const parsed = parseDocument(remainder.slice(0, closing.index), {
      uniqueKeys: true,
    });
    if (parsed.errors.length > 0) {
      throw parsed.errors[0];
    }
    if (!isMap(parsed.contents)) {
      return {
        valid: false,
        data: null,
        issues: [
          {
            code: "invalid-mapping",
            field: "frontmatter",
            message: "SKILL.md frontmatter must be a YAML mapping",
          },
        ],
      };
    }
    frontmatter = parsed.contents;
    data = asRecord(parsed.toJS());
  } catch (error) {
    return {
      valid: false,
      data: null,
      issues: [
        {
          code: "invalid-yaml",
          field: "frontmatter",
          message: `Invalid YAML in frontmatter: ${yamlErrorMessage(error)}`,
        },
      ],
    };
  }
  if (!data) {
    return {
      valid: false,
      data: null,
      issues: [
        {
          code: "invalid-mapping",
          field: "frontmatter",
          message: "SKILL.md frontmatter must be a YAML mapping",
        },
      ],
    };
  }

  const unexpectedFields = Object.keys(data)
    .filter((field) => !AGENT_SKILL_FRONTMATTER_FIELD_SET.has(field))
    .sort();
  if (unexpectedFields.length > 0) {
    issues.push({
      code: "unexpected-field",
      field: "frontmatter",
      message: `Unexpected fields in frontmatter: ${unexpectedFields.join(", ")}. Only ${JSON.stringify(
        [...AGENT_SKILL_FRONTMATTER_FIELDS],
      )} are allowed.`,
    });
  }

  const name = validateName(data, options, issues);
  const description = validateDescription(data, issues);
  const optionalFields = validateOptionalFields(data, frontmatter, issues);
  if (issues.length > 0 || name === null || description === null) {
    return { valid: false, data: null, issues };
  }

  return {
    valid: true,
    data: { name, description, ...optionalFields },
    issues: [],
  };
}

export class DocsAgentSkillFrontmatterError extends Error {
  readonly issues: readonly DocsAgentSkillFrontmatterIssue[];

  constructor(
    issues: readonly DocsAgentSkillFrontmatterIssue[],
    options: DocsAgentSkillFrontmatterValidationOptions = {},
  ) {
    const source = options.source ? ` in ${options.source}` : "";
    super(
      `Invalid Agent Skill frontmatter${source}:\n${issues
        .map((issue) => `- ${issue.message}`)
        .join("\n")}`,
    );
    this.name = "DocsAgentSkillFrontmatterError";
    this.issues = issues;
  }
}

/** Parse valid frontmatter or throw a structured, field-specific validation error. */
export function parseDocsAgentSkillFrontmatter(
  document: string,
  options: DocsAgentSkillFrontmatterValidationOptions = {},
): DocsAgentSkillFrontmatter {
  const validation = validateDocsAgentSkillFrontmatter(document, options);
  if (!validation.valid) {
    throw new DocsAgentSkillFrontmatterError(validation.issues, options);
  }
  return validation.data;
}
