import { defineConfig } from "vitest/config";
import glsl from "vite-plugin-glsl";
import { resolve } from "path";

/**
 * Vitest configuration — excludes Playwright E2E tests.
 *
 * `tests/e2e/` contains Playwright spec files that must NOT be run by Vitest.
 */
export default defineConfig({
  plugins: [glsl()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
    extensions: [".js", ".ts", ".json"],
  },
  test: {
    environment: "jsdom",
    exclude: [
      "tests/e2e/**",
      "**/node_modules/**",
    ],
  },
});
