import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@farming-labs/docs/server": resolve(__dirname, "../docs/src/server.ts"),
      "@farming-labs/docs": resolve(__dirname, "../docs/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
