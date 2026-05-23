import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_DOCS_REVIEW_WORKFLOW_PATH,
  ensureDocsReviewWorkflow,
  readDocsReviewConfigFromSource,
  resolveDocsReviewConfig,
} from "./review.js";

describe("docs review helpers", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "docs-review-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("enables warn-mode CI by default", () => {
    const review = resolveDocsReviewConfig();

    expect(review.enabled).toBe(true);
    expect(review.ci).toMatchObject({
      enabled: true,
      mode: "warn",
      annotations: true,
      comment: true,
    });
    expect(review.score.threshold).toBe(80);
    expect(review.rules.brokenLinks).toBe("error");
  });

  it("reads review config from TSX source without evaluating the module", () => {
    const review = readDocsReviewConfigFromSource(`
      export default defineDocs({
        entry: "docs",
        nav: {
          logo: <Logo />,
        },
        review: {
          ci: { mode: "block" },
          score: { threshold: 90 },
          rules: {
            agentContext: "warn",
          },
        },
      });
    `);

    expect(resolveDocsReviewConfig(review)).toMatchObject({
      enabled: true,
      ci: { mode: "block", enabled: true },
      score: { threshold: 90 },
      rules: { agentContext: "warn" },
    });
  });

  it("creates the workflow at the repository root for nested docs apps", () => {
    mkdirSync(join(tmpDir, ".git"), { recursive: true });
    mkdirSync(join(tmpDir, "website", "app", "docs"), { recursive: true });
    writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf-8");
    writeFileSync(
      join(tmpDir, "website", "docs.config.ts"),
      `export default {
  entry: "docs",
};
`,
      "utf-8",
    );

    const result = ensureDocsReviewWorkflow({
      rootDir: join(tmpDir, "website"),
      configPath: "docs.config.ts",
    });

    const workflowPath = join(tmpDir, DEFAULT_DOCS_REVIEW_WORKFLOW_PATH);
    expect(result.status).toBe("created");
    expect(existsSync(workflowPath)).toBe(true);

    const workflow = readFileSync(workflowPath, "utf-8");
    expect(workflow).toContain("name: Docs Review");
    expect(workflow).toContain('      - "website/docs.config.ts"');
    expect(workflow).toContain('      - "website/app/docs/**"');
    expect(workflow).toContain("pnpm exec docs review --ci --config docs.config.ts");
    expect(workflow).toContain("working-directory: website");
  });

  it("builds the local docs CLI before review when the repo contains the workspace package", () => {
    mkdirSync(join(tmpDir, ".git"), { recursive: true });
    mkdirSync(join(tmpDir, "website", "app", "docs"), { recursive: true });
    mkdirSync(join(tmpDir, "packages", "docs"), { recursive: true });
    writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf-8");
    writeFileSync(
      join(tmpDir, "packages", "docs", "package.json"),
      JSON.stringify({
        name: "@farming-labs/docs",
        scripts: { build: "tsdown" },
      }),
      "utf-8",
    );
    writeFileSync(join(tmpDir, "website", "docs.config.ts"), "export default { entry: 'docs' };\n");

    ensureDocsReviewWorkflow({
      rootDir: join(tmpDir, "website"),
      configPath: "docs.config.ts",
    });

    const workflow = readFileSync(join(tmpDir, DEFAULT_DOCS_REVIEW_WORKFLOW_PATH), "utf-8");
    expect(workflow).toContain("pnpm --filter @farming-labs/docs run build");
    expect(workflow).toContain(
      "node ../packages/docs/dist/cli/index.mjs review --ci --config docs.config.ts",
    );
    expect(workflow.indexOf("Build docs CLI")).toBeLessThan(workflow.indexOf("Review docs"));
  });

  it("does not create a workflow when review is disabled", () => {
    mkdirSync(join(tmpDir, ".git"), { recursive: true });
    writeFileSync(join(tmpDir, "docs.config.ts"), "export default { review: false };\n", "utf-8");

    const result = ensureDocsReviewWorkflow({
      rootDir: tmpDir,
      configPath: "docs.config.ts",
    });

    expect(result.status).toBe("disabled");
    expect(existsSync(join(tmpDir, DEFAULT_DOCS_REVIEW_WORKFLOW_PATH))).toBe(false);
  });
});
