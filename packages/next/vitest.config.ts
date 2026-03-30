import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@farming-labs/docs/server": resolve(rootDir, "../docs/src/server.ts"),
      "@farming-labs/docs": resolve(rootDir, "../docs/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
