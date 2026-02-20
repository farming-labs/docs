export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",

  css: ["@farming-labs/nuxt-theme/colorful/css"],

  vite: {
    optimizeDeps: {
      include: ["@farming-labs/docs", "@farming-labs/nuxt", "@farming-labs/nuxt-theme", "sugar-high"],
    },
  },

  nitro: {
    moduleSideEffects: ["@farming-labs/nuxt/server"],
    serverAssets: [
      { baseName: "docs", dir: "../docs" },
    ],
  },
});
