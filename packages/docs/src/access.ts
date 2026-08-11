import type {
  DocsAccessClaimValue,
  DocsAccessPrincipal,
  DocsPageAccessPolicy,
  PageAgentFrontmatter,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = Array.from(
    new Set(
      value.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : [])),
    ),
  );
  return strings.length > 0 ? strings : undefined;
}

function normalizeClaimValue(value: unknown): DocsAccessClaimValue | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return normalizeStrings(value);
}

export function normalizeDocsPageAccessPolicy(value: unknown): DocsPageAccessPolicy | undefined {
  if (!isRecord(value)) return undefined;
  const visibility =
    value.visibility === "public" || value.visibility === "authenticated"
      ? value.visibility
      : undefined;
  const scopes = normalizeStrings(value.scopes);
  const rawClaims = isRecord(value.claims) ? value.claims : undefined;
  const claims = rawClaims
    ? Object.fromEntries(
        Object.entries(rawClaims).flatMap(([name, rawValue]) => {
          const normalizedName = name.trim();
          const normalizedValue = normalizeClaimValue(rawValue);
          return normalizedName && normalizedValue !== undefined
            ? [[normalizedName, normalizedValue]]
            : [];
        }),
      )
    : undefined;
  const normalizedClaims = claims && Object.keys(claims).length > 0 ? claims : undefined;
  if (!visibility && !scopes && !normalizedClaims) return undefined;
  return {
    ...(visibility ? { visibility } : {}),
    ...(scopes ? { scopes } : {}),
    ...(normalizedClaims ? { claims: normalizedClaims } : {}),
  };
}

function claimMatches(expected: DocsAccessClaimValue, actual: unknown): boolean {
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  const actualValues = Array.isArray(actual) ? actual : [actual];
  return expectedValues.some((expectedValue) =>
    actualValues.some((actualValue) => actualValue === expectedValue),
  );
}

export function isDocsPageAccessAllowed(
  policy: DocsPageAccessPolicy | undefined,
  principal?: DocsAccessPrincipal,
): boolean {
  if (!policy) return true;
  const requiresPrincipal =
    policy.visibility !== "public" ||
    Boolean(policy.scopes?.length) ||
    Boolean(policy.claims && Object.keys(policy.claims).length > 0);
  if (!requiresPrincipal) return true;
  if (!principal) return false;

  const scopes = new Set(principal.scopes ?? []);
  if (policy.scopes?.some((scope) => !scopes.has(scope))) return false;
  for (const [name, expected] of Object.entries(policy.claims ?? {})) {
    if (!claimMatches(expected, principal.claims?.[name])) return false;
  }
  return true;
}

export function isDocsAgentPageAccessible(
  page: { agent?: PageAgentFrontmatter },
  principal?: DocsAccessPrincipal,
): boolean {
  return isDocsPageAccessAllowed(page.agent?.access, principal);
}

export function filterDocsPagesByAccess<T extends { agent?: PageAgentFrontmatter }>(
  pages: readonly T[],
  principal?: DocsAccessPrincipal,
): T[] {
  return pages.filter((page) => isDocsAgentPageAccessible(page, principal));
}
