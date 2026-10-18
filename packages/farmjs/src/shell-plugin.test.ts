import path from "node:path";
import { describe, expect, it } from "vitest";
import { docsShell } from "./shell-plugin.js";

describe("docsShell", () => {
  it("aliases the adapter's page shell to the app module", () => {
    const plugin = docsShell("src/docs-shell.tsx") as any;

    expect(plugin.config({ root: "/app" })).toEqual({
      resolve: {
        alias: [
          {
            find: /^@farming-labs\/farmjs\/shell$/,
            replacement: path.resolve("/app", "src/docs-shell.tsx"),
          },
        ],
      },
    });
  });

  it("keeps the default pass-through shell when none is configured", () => {
    const plugin = docsShell(undefined) as any;

    expect(plugin.config({ root: "/app" })).toBeUndefined();
  });
});
