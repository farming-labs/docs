import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@farming-labs/docs/server",
        replacement: fileURLToPath(new URL("../docs/src/server.ts", import.meta.url)),
      },
      {
        find: "@farming-labs/docs",
        replacement: fileURLToPath(new URL("../docs/src/index.ts", import.meta.url)),
      },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
