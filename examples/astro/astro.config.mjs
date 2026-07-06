import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

export default defineConfig({
  output: "server",
  devToolbar: {
    enabled: false,
  },
  adapter: vercel(),
});
