import { describe, expect, it } from "vitest";
import {
  buildDowngradeCommand,
  compareSemver,
  getPreviousVersion,
  parsePublishedVersions,
} from "./downgrade.js";

describe("downgrade", () => {
  describe("compareSemver", () => {
    it("orders patch versions", () => {
      expect(compareSemver("0.1.103", "0.1.104")).toBeLessThan(0);
      expect(compareSemver("0.1.105", "0.1.104")).toBeGreaterThan(0);
      expect(compareSemver("0.1.104", "0.1.104")).toBe(0);
    });

    it("orders prerelease versions below stable versions", () => {
      expect(compareSemver("0.1.104-beta.1", "0.1.104")).toBeLessThan(0);
      expect(compareSemver("0.1.104-beta.2", "0.1.104-beta.1")).toBeGreaterThan(0);
    });
  });

  describe("getPreviousVersion", () => {
    it("returns the highest published version below the current version", () => {
      expect(getPreviousVersion(["0.1.102", "0.1.103", "0.1.104"], "0.1.104")).toBe("0.1.103");
    });

    it("returns null when there is no lower published version", () => {
      expect(getPreviousVersion(["0.1.104", "0.1.105"], "0.1.104")).toBeNull();
    });
  });

  describe("parsePublishedVersions", () => {
    it("parses npm view JSON output", () => {
      expect(parsePublishedVersions('["0.1.103","0.1.104"]')).toEqual(["0.1.103", "0.1.104"]);
    });

    it("drops non-version values", () => {
      expect(parsePublishedVersions('["latest","0.1.104"]')).toEqual(["0.1.104"]);
    });
  });

  describe("buildDowngradeCommand", () => {
    it("builds install command with the exact downgrade version", () => {
      const cmd = buildDowngradeCommand("nextjs", "0.1.103", "pnpm");

      expect(cmd).toContain("pnpm add");
      expect(cmd).toContain("@farming-labs/docs@0.1.103");
      expect(cmd).toContain("@farming-labs/theme@0.1.103");
      expect(cmd).toContain("@farming-labs/next@0.1.103");
    });
  });
});
