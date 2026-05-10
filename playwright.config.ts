import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the Camelot skill-tree audit suite.
 *
 * The test harness (`tests/e2e/harness/skill-tree-harness.html`) is served
 * by the Vite dev server so that TypeScript module imports are compiled on
 * the fly — no separate build step is required.
 *
 * Run: npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /* Retry once on CI to absorb transient timing issues. */
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],

  use: {
    baseURL: "http://127.0.0.1:8099",
    headless: true,
    trace: "retain-on-failure",
  },

  /*
   * Start a dedicated Vite dev server for E2E tests using vite.e2e.config.ts.
   * This separate config omits vite-plugin-html (which injects app.ts into all
   * HTML pages) and sets appType:'mpa' so each HTML file is served as-is.
   */
  webServer: {
    command: "npx vite --config vite.e2e.config.ts",
    url: "http://127.0.0.1:8099",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
