import { describe, expect, it } from "vitest";
import {
  filterDocsPagesByAccess,
  isDocsPageAccessAllowed,
  normalizeDocsPageAccessPolicy,
} from "./access.js";
import {
  getPageAgentFrontmatterIssues,
  normalizePageAgentFrontmatter,
  renderPageAgentFrontmatterYamlLines,
} from "./agent-contract.js";

describe("docs page access policies", () => {
  it("normalizes bounded declarative policies", () => {
    expect(
      normalizeDocsPageAccessPolicy({
        visibility: "authenticated",
        scopes: ["docs:read", "docs:read", ""],
        claims: { role: ["admin", "editor"], plan: "enterprise", ignored: {} },
      }),
    ).toEqual({
      visibility: "authenticated",
      scopes: ["docs:read"],
      claims: { role: ["admin", "editor"], plan: "enterprise" },
    });
  });

  it("keeps malformed authored access policies fail closed", () => {
    expect(normalizePageAgentFrontmatter({ access: "private" })).toEqual({
      access: { visibility: "authenticated" },
    });
    expect(normalizePageAgentFrontmatter({ access: {} })).toEqual({
      access: { visibility: "authenticated" },
    });
    expect(getPageAgentFrontmatterIssues({ access: "private" })).toContainEqual({
      path: "agent.access",
      message: "must be an object",
    });
  });

  it("preserves access policies in normalized agent YAML", () => {
    const yaml = renderPageAgentFrontmatterYamlLines({
      access: { scopes: ["docs:private"], claims: { role: ["admin", "editor"] } },
    }).join("\n");
    expect(yaml).toContain("access:");
    expect(yaml).toContain('"role":');
    expect(yaml).toContain('  - "docs:private"');
  });

  it("denies protected pages without all scopes and claims", () => {
    const policy = normalizeDocsPageAccessPolicy({
      scopes: ["docs:read", "tenant:read"],
      claims: { role: ["admin", "editor"], tenant: "acme" },
    });
    expect(isDocsPageAccessAllowed(policy)).toBe(false);
    expect(
      isDocsPageAccessAllowed(policy, {
        id: "user-1",
        scopes: ["docs:read", "tenant:read"],
        claims: { role: "editor", tenant: "acme" },
      }),
    ).toBe(true);
    expect(
      isDocsPageAccessAllowed(policy, {
        id: "user-2",
        scopes: ["docs:read"],
        claims: { role: "admin", tenant: "acme" },
      }),
    ).toBe(false);
  });

  it("filters protected pages from public corpora", () => {
    const pages = [
      { title: "Public", agent: { task: "Read" } },
      { title: "Private", agent: { access: { scopes: ["docs:private"] } } },
    ];
    expect(filterDocsPagesByAccess(pages).map((page) => page.title)).toEqual(["Public"]);
    expect(
      filterDocsPagesByAccess(pages, { id: "agent", scopes: ["docs:private"] }).map(
        (page) => page.title,
      ),
    ).toEqual(["Public", "Private"]);
  });
});
