import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/server.ts",
    "src/runtime.ts",
    "src/markdown-rendering.ts",
    "src/agent-skills-spec.ts",
    "src/agent-skills-bundle.ts",
    "src/agent-skills-vite.ts",
    "src/docs-cloud-server.ts",
    "src/client/react.ts",
    "src/browser.ts",
    "src/mcp.ts",
    "src/cli/index.ts",
  ],
  format: "esm",
  dts: true,
  clean: true,
  outDir: "dist",
  outputOptions: {
    // Keep the marker through Rolldown, then emit the exact directive consumed
    // by Next's production tracer.
    legalComments: "inline",
    plugins: [
      {
        name: "preserve-turbopack-ignore-directives",
        renderChunk(code) {
          if (!code.includes("/*! turbopackIgnore: true */")) return null;
          return {
            code: code.replaceAll("/*! turbopackIgnore: true */", "/* turbopackIgnore: true */"),
            map: null,
          };
        },
      },
    ],
  },
});
