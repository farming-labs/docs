import { defineConfig } from "@farm.js/core";
import { withDocs } from "@farming-labs/farmjs/config";

const schemaHeaders = (version: string) => ({
  source: `/schema/agent-manifest.${version}.json`,
  headers: [{ key: "Content-Type", value: "application/schema+json; charset=utf-8" }],
});

export default withDocs(
  defineConfig({
    async headers() {
      return [schemaHeaders("v1"), schemaHeaders("v2")];
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
