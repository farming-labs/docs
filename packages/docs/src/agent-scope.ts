/** Normalize framework aliases used by page metadata, agent contracts, MCP, and evaluations. */
export function normalizeAgentFramework(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/gu, "");
  if (["next", "nextjs", "nextjsapp", "reactnext"].includes(normalized)) return "nextjs";
  if (["tanstack", "tanstackstart", "start"].includes(normalized)) return "tanstackstart";
  if (["svelte", "sveltekit"].includes(normalized)) return "sveltekit";
  if (["nuxt", "nuxtjs"].includes(normalized)) return "nuxt";
  return normalized;
}

export function normalizeAgentLocale(value: string): string {
  return value.trim().toLowerCase().replace(/_/gu, "-");
}

export function normalizeAgentVersion(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^v(?=\d)/u, "");
}

export function normalizeAgentScopeValues(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

type Version = readonly [major: number, minor: number, patch: number];

interface VersionOperand {
  version: Version;
  components: number;
  wildcard: boolean;
}

interface VersionRange {
  minimum?: Version;
  minimumInclusive: boolean;
  maximum?: Version;
  maximumInclusive: boolean;
}

function compareVersions(left: Version, right: Version): number {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

function parseExactVersion(value: string): Version | undefined {
  const match = normalizeAgentVersion(value).match(
    /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-[0-9a-z.-]+)?(?:\+[0-9a-z.-]+)?$/iu,
  );
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function parseVersionOperand(value: string): VersionOperand | undefined {
  const normalized = normalizeAgentVersion(value);
  if (normalized === "*" || normalized === "x") {
    return { version: [0, 0, 0], components: 0, wildcard: true };
  }

  const match = normalized.match(/^(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?$/iu);
  if (!match) return undefined;
  const raw = [match[1], match[2], match[3]];
  const wildcardIndex = raw.findIndex(
    (part, index) => index > 0 && (part?.toLowerCase() === "x" || part === "*"),
  );
  if (
    wildcardIndex >= 0 &&
    raw.slice(wildcardIndex + 1).some((part) => part && part.toLowerCase() !== "x" && part !== "*")
  ) {
    return undefined;
  }

  const components = wildcardIndex >= 0 ? wildcardIndex : raw.filter(Boolean).length;
  return {
    version: [Number(raw[0]), Number(raw[1] ?? 0) || 0, Number(raw[2] ?? 0) || 0],
    components,
    wildcard: wildcardIndex >= 0,
  };
}

function nextVersionBoundary(operand: VersionOperand): Version | undefined {
  const [major, minor] = operand.version;
  if (operand.components <= 0) return undefined;
  if (operand.components === 1) return [major + 1, 0, 0];
  return [major, minor + 1, 0];
}

function operandRange(operand: VersionOperand): VersionRange {
  if (operand.components === 0) {
    return { minimumInclusive: true, maximumInclusive: false };
  }
  if (operand.components < 3 || operand.wildcard) {
    return {
      minimum: operand.version,
      minimumInclusive: true,
      maximum: nextVersionBoundary(operand),
      maximumInclusive: false,
    };
  }
  return {
    minimum: operand.version,
    minimumInclusive: true,
    maximum: operand.version,
    maximumInclusive: true,
  };
}

function caretRange(operand: VersionOperand): VersionRange {
  const [major, minor, patch] = operand.version;
  let maximum: Version;
  if (major > 0) maximum = [major + 1, 0, 0];
  else if (operand.components <= 1) maximum = [1, 0, 0];
  else if (minor > 0 || operand.components === 2) maximum = [0, minor + 1, 0];
  else maximum = [0, 0, patch + 1];
  return {
    minimum: operand.version,
    minimumInclusive: true,
    maximum,
    maximumInclusive: false,
  };
}

function tildeRange(operand: VersionOperand): VersionRange {
  const [major, minor] = operand.version;
  const maximum: Version = operand.components <= 1 ? [major + 1, 0, 0] : [major, minor + 1, 0];
  return {
    minimum: operand.version,
    minimumInclusive: true,
    maximum,
    maximumInclusive: false,
  };
}

function intersectRanges(left: VersionRange, right: VersionRange): VersionRange | undefined {
  let minimum = left.minimum;
  let minimumInclusive = left.minimumInclusive;
  if (!minimum || (right.minimum && compareVersions(right.minimum, minimum) > 0)) {
    minimum = right.minimum;
    minimumInclusive = right.minimumInclusive;
  } else if (right.minimum && compareVersions(right.minimum, minimum) === 0) {
    minimumInclusive = minimumInclusive && right.minimumInclusive;
  }

  let maximum = left.maximum;
  let maximumInclusive = left.maximumInclusive;
  if (!maximum || (right.maximum && compareVersions(right.maximum, maximum) < 0)) {
    maximum = right.maximum;
    maximumInclusive = right.maximumInclusive;
  } else if (right.maximum && compareVersions(right.maximum, maximum) === 0) {
    maximumInclusive = maximumInclusive && right.maximumInclusive;
  }

  if (minimum && maximum) {
    const compared = compareVersions(minimum, maximum);
    if (compared > 0 || (compared === 0 && !(minimumInclusive && maximumInclusive)))
      return undefined;
  }
  return { minimum, minimumInclusive, maximum, maximumInclusive };
}

function comparatorRange(operator: string, operand: VersionOperand): VersionRange {
  if (!operator || operator === "=") return operandRange(operand);
  if (operator === ">=") {
    return {
      minimum: operand.version,
      minimumInclusive: true,
      maximumInclusive: false,
    };
  }
  if (operator === ">") {
    const partialBoundary = operand.components < 3 ? nextVersionBoundary(operand) : undefined;
    return {
      minimum: partialBoundary ?? operand.version,
      minimumInclusive: Boolean(partialBoundary),
      maximumInclusive: false,
    };
  }
  if (operator === "<") {
    return {
      minimumInclusive: true,
      maximum: operand.version,
      maximumInclusive: false,
    };
  }
  const partialBoundary = operand.components < 3 ? nextVersionBoundary(operand) : undefined;
  return {
    minimumInclusive: true,
    maximum: partialBoundary ?? operand.version,
    maximumInclusive: !partialBoundary,
  };
}

function parseVersionRangeBranch(value: string): VersionRange | undefined {
  const branch = normalizeAgentVersion(value).trim();
  if (!branch) return undefined;

  const hyphen = branch.match(/^(.+?)\s+-\s+(.+)$/u);
  if (hyphen) {
    const minimumOperand = parseVersionOperand(hyphen[1]);
    const maximumOperand = parseVersionOperand(hyphen[2]);
    if (!minimumOperand || !maximumOperand) return undefined;
    const maximumBoundary =
      maximumOperand.components < 3 ? nextVersionBoundary(maximumOperand) : maximumOperand.version;
    return intersectRanges(
      {
        minimum: minimumOperand.version,
        minimumInclusive: true,
        maximumInclusive: false,
      },
      {
        minimumInclusive: true,
        maximum: maximumBoundary,
        maximumInclusive: maximumOperand.components === 3,
      },
    );
  }

  const special = branch.match(/^(\^|~)\s*(.+)$/u);
  if (special) {
    const operand = parseVersionOperand(special[2]);
    if (!operand || operand.components === 0) return undefined;
    return special[1] === "^" ? caretRange(operand) : tildeRange(operand);
  }

  const comparatorPattern = /(>=|<=|>|<|=)\s*([^\s]+)/gu;
  const comparators = Array.from(branch.matchAll(comparatorPattern));
  if (comparators.length > 0) {
    const consumed = comparators
      .map((match) => match[0])
      .join(" ")
      .replace(/\s+/gu, " ");
    if (consumed !== branch.replace(/\s+/gu, " ")) return undefined;
    let range: VersionRange = { minimumInclusive: true, maximumInclusive: false };
    for (const comparator of comparators) {
      const operand = parseVersionOperand(comparator[2]);
      if (!operand) return undefined;
      const next = intersectRanges(range, comparatorRange(comparator[1], operand));
      if (!next) return undefined;
      range = next;
    }
    return range;
  }

  const operand = parseVersionOperand(branch);
  return operand ? operandRange(operand) : undefined;
}

function parseVersionRanges(value: string): VersionRange[] {
  return normalizeAgentVersion(value)
    .split("||")
    .map((branch) => parseVersionRangeBranch(branch))
    .filter((range): range is VersionRange => Boolean(range));
}

function rangeContains(range: VersionRange, version: Version): boolean {
  if (range.minimum) {
    const compared = compareVersions(version, range.minimum);
    if (compared < 0 || (compared === 0 && !range.minimumInclusive)) return false;
  }
  if (range.maximum) {
    const compared = compareVersions(version, range.maximum);
    if (compared > 0 || (compared === 0 && !range.maximumInclusive)) return false;
  }
  return true;
}

function rangesOverlap(left: VersionRange, right: VersionRange): boolean {
  return Boolean(intersectRanges(left, right));
}

/** Match an exact requested version against an exact or range-like documented constraint. */
export function agentVersionConstraintMatches(requested: string, constraint: string): boolean {
  if (normalizeAgentVersion(requested) === normalizeAgentVersion(constraint)) {
    return Boolean(normalizeAgentVersion(requested));
  }
  const wanted = parseExactVersion(requested);
  if (!wanted) return false;
  return parseVersionRanges(constraint).some((range) => rangeContains(range, wanted));
}

/** Return true when two exact or range-like documented version constraints can select one version. */
export function agentVersionConstraintsOverlap(left: string, right: string): boolean {
  const normalizedLeft = normalizeAgentVersion(left);
  const normalizedRight = normalizeAgentVersion(right);
  if (normalizedLeft === normalizedRight) return Boolean(normalizedLeft);
  const leftRanges = parseVersionRanges(left);
  const rightRanges = parseVersionRanges(right);
  return leftRanges.some((leftRange) =>
    rightRanges.some((rightRange) => rangesOverlap(leftRange, rightRange)),
  );
}
