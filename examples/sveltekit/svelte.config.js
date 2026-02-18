import adapter from "@sveltejs/adapter-auto";
import { mdsvex } from "mdsvex";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: [".svelte", ".svx", ".md"],

  preprocess: [
    mdsvex({
      extensions: [".svx", ".md"],
    }),
  ],

  kit: {
    adapter: adapter(),
    alias: {
      "$content": "src/content",
      "@/docs.config": "docs.config.ts",
    },
  },
};

export default config;
