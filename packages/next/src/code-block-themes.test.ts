import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCodeBlockThemes } from "./code-block-themes.js";

describe("resolveCodeBlockThemes", () => {
  it("uses the shadcn syntax themes when docs.config imports the preset", () => {
    const root = mkdtempSync(join(tmpdir(), "farming-docs-code-theme-"));
    const configPath = "docs.config.ts";
    try {
      writeFileSync(
        join(root, configPath),
        'import { shadcn } from "@farming-labs/theme/shadcn";\nexport default { theme: shadcn() };\n',
      );

      expect(resolveCodeBlockThemes({ root, configPath })).toEqual({
        light: "github-light-default",
        dark: "vesper",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prefers code block themes supplied by the live docs theme", () => {
    expect(
      resolveCodeBlockThemes({
        root: tmpdir(),
        configPath: "missing-docs.config.ts",
        theme: {
          ui: {
            codeBlock: {
              theme: "min-light",
              darkTheme: "min-dark",
            },
          },
        },
      }),
    ).toEqual({
      light: "min-light",
      dark: "min-dark",
    });
  });

  it("preserves the existing GitHub themes for other presets", () => {
    expect(
      resolveCodeBlockThemes({
        root: tmpdir(),
        configPath: "missing-docs.config.ts",
      }),
    ).toEqual({
      light: "github-light",
      dark: "github-dark",
    });
  });
});
