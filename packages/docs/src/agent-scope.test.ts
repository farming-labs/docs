import { describe, expect, it } from "vitest";
import {
  agentVersionConstraintMatches,
  agentVersionConstraintsOverlap,
  normalizeAgentFramework,
  normalizeAgentLocale,
  normalizeAgentScopeValues,
} from "./agent-scope.js";

describe("agent scope", () => {
  it("normalizes framework aliases and scope values consistently", () => {
    expect(normalizeAgentFramework("Next.js App")).toBe("nextjs");
    expect(normalizeAgentFramework("TanStack Start")).toBe("tanstackstart");
    expect(normalizeAgentLocale(" en_US ")).toBe("en-us");
    expect(normalizeAgentScopeValues([" nextjs ", "nextjs", "astro"])).toEqual(["nextjs", "astro"]);
  });

  it("matches exact, range, comparison, wildcard, caret, and tilde constraints", () => {
    expect(agentVersionConstraintMatches("v16", "16")).toBe(true);
    expect(agentVersionConstraintMatches("16.2", ">=16 <17")).toBe(true);
    expect(agentVersionConstraintMatches("15", ">=16")).toBe(false);
    expect(agentVersionConstraintMatches("16.3", "16.x")).toBe(true);
    expect(agentVersionConstraintMatches("16.2.8", "16.2.x")).toBe(true);
    expect(agentVersionConstraintMatches("16.3", "16.2.x")).toBe(false);
    expect(agentVersionConstraintMatches("16.9", "^16.2")).toBe(true);
    expect(agentVersionConstraintMatches("17", "^16.2")).toBe(false);
    expect(agentVersionConstraintMatches("0.2.9", "^0.2.3")).toBe(true);
    expect(agentVersionConstraintMatches("0.3", "^0.2.3")).toBe(false);
    expect(agentVersionConstraintMatches("16.2.9", "~16.2.3")).toBe(true);
    expect(agentVersionConstraintMatches("16.3", "~16.2.3")).toBe(false);
    expect(agentVersionConstraintMatches("17", "16 - 16.9")).toBe(false);
    expect(agentVersionConstraintMatches("16.2.3-beta", "16.2.3-beta")).toBe(true);
    expect(agentVersionConstraintMatches("16.2.3-beta", "16.2.3-rc.1")).toBe(false);
  });

  it("detects version-range overlap symmetrically", () => {
    expect(agentVersionConstraintsOverlap(">=16 <17", "16.2.x")).toBe(true);
    expect(agentVersionConstraintsOverlap("16.2.x", ">=16 <17")).toBe(true);
    expect(agentVersionConstraintsOverlap("^0.2.3", ">=0.3")).toBe(false);
    expect(agentVersionConstraintsOverlap("~16.2", "16.3.x")).toBe(false);
  });
});
