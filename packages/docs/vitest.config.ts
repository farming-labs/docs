import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@farming-labs/docs/client/react": resolve(rootDir, "src/client/react.ts"),
      "@farming-labs/docs/cloud/server": resolve(rootDir, "src/docs-cloud-server.ts"),
      "@farming-labs/docs/server": resolve(rootDir, "src/server.ts"),
      "@farming-labs/docs": resolve(rootDir, "src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
