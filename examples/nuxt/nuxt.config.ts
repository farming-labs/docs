export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",

  css: ["@farming-labs/nuxt-theme/colorful/css"],

  build: {
    transpile: ["@farming-labs/nuxt-theme"],
  },

  vite: {
    optimizeDeps: {
      include: [
        "@farming-labs/docs",
        "@farming-labs/nuxt",
        "@farming-labs/nuxt-theme",
      ],
    },
  },

  nitro: {
    moduleSideEffects: ["@farming-labs/nuxt/server"],
    serverAssets: [{ baseName: "docs", dir: "docs" }],
  },
});
