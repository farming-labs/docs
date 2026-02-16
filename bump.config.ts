import { defineConfig } from "bumpp";

export default defineConfig({
  commit: "release: v%s",
  tag: "v%s",
  push: true,
  files: [
    "packages/docs/package.json",
    "packages/fumadocs/package.json",
    "packages/next/package.json",
  ],
  execute: "pnpm build",
});
