import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/server.ts",
    "src/agent-skills-bundle.ts",
    "src/agent-skills-vite.ts",
    "src/docs-cloud-server.ts",
    "src/client/react.ts",
    "src/mcp.ts",
    "src/cli/index.ts",
  ],
  format: "esm",
  dts: true,
  clean: true,
  outDir: "dist",
});
