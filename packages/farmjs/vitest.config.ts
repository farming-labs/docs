import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@farming-labs/docs/client/react": resolve(rootDir, "../docs/src/client/react.ts"),
      "@farming-labs/docs/cloud/server": resolve(rootDir, "../docs/src/docs-cloud-server.ts"),
      "@farming-labs/docs/browser": resolve(rootDir, "../docs/src/browser.ts"),
      "@farming-labs/docs/server": resolve(rootDir, "../docs/src/server.ts"),
      "@farming-labs/docs/build": resolve(rootDir, "../docs/src/build.ts"),
      "@farming-labs/docs/agent-skills-bundle": resolve(
        rootDir,
        "../docs/src/agent-skills-bundle.ts",
      ),
      "@farming-labs/docs": resolve(rootDir, "../docs/src/index.ts"),
      "@farming-labs/farmjs/shell": resolve(rootDir, "src/shell.tsx"),
      "@farming-labs/theme/client-hooks": resolve(rootDir, "../fumadocs/src/docs-client-hooks.tsx"),
      "@farming-labs/theme/browser": resolve(rootDir, "../fumadocs/src/browser.tsx"),
      "@farming-labs/theme/mdx": resolve(rootDir, "../fumadocs/src/mdx.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
