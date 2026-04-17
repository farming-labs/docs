import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  /**
   * In GitHub Actions, boot the app automatically. Locally, run `pnpm dev` in
   * `examples/next` first (or set PLAYWRIGHT_BASE_URL to a running server).
   */
  ...(process.env.CI
    ? {
        webServer: {
          command: "pnpm exec next dev --turbopack -p 3000",
          url: "http://127.0.0.1:3000",
          reuseExistingServer: false,
          timeout: 120_000,
        },
      }
    : {}),
});
