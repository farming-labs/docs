import { defineConfig } from "bumpp";

export default defineConfig({
  commit: "chore: release v%s",
  tag: "v%s",
  push: true,
  files: [
    "packages/docs/package.json",
    "packages/fumadocs/package.json",
    "packages/next/package.json",
    "packages/svelte/package.json",
    "packages/svelte-theme/package.json",
    "packages/astro/package.json",
    "packages/astro-theme/package.json",
    "packages/nuxt/package.json",
    "packages/nuxt-theme/package.json",
  ],
  execute: "pnpm build",
});
