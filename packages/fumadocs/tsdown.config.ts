import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/mdx.ts",
    "src/search.ts",
    "src/default/index.ts",
    "src/darksharp/index.ts",
    "src/pixel-border/index.ts",
  ],
  format: "esm",
  dts: true,
  clean: true,
  outDir: "dist",
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "next",
    "next/navigation",
    "@farming-labs/docs",
    "fumadocs-ui",
    "fumadocs-core",
    "gray-matter",
  ],
});
