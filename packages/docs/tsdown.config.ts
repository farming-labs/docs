import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/server.ts",
    "src/build.ts",
    "src/runtime.ts",
    "src/markdown-rendering.ts",
    "src/mdx.ts",
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
  // Keep browser/config helpers separate from the server and MDX module graph.
  unbundle: true,
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
