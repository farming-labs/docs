import { defineConfig } from "@farm.js/core";
import { withDocs } from "@farming-labs/farmjs/config";

export default withDocs(
  defineConfig({
    routeRules: {
      "/schema/agent-manifest.v1.json": {
        headers: { "Content-Type": "application/schema+json; charset=utf-8" },
      },
      "/schema/agent-manifest.v2.json": {
        headers: { "Content-Type": "application/schema+json; charset=utf-8" },
      },
    },
    vite: {
      ssr: {
        // afdocs reads its own package.json beside its files at load time; bundled into the
        // server it looks in the output directory instead, so it stays a node_modules import.
        external: ["afdocs"],
      },
    },
    deploy: {
      target: "vercel",
    },
  }),
  { configPath: "docs.config.tsx", shell: "src/docs-shell.tsx" },
);
