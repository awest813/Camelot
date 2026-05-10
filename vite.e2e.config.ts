/**
 * Separate Vite configuration used ONLY by Playwright E2E tests.
 *
 * Key differences from the main vite.config.ts:
 * - Uses port 8099 to avoid conflicting with the dev server.
 * - Omits vite-plugin-html (which injects app.ts into all HTML pages).
 * - Sets appType: 'mpa' so Vite serves each HTML file as-is (no SPA fallback).
 * - Uses a simple base path so asset URLs resolve correctly in the harness.
 */

import { defineConfig } from "vite";
import glsl from "vite-plugin-glsl";
import { resolve } from "path";

export default defineConfig({
  base: "/",
  appType: "mpa",
  root: process.cwd(),

  plugins: [glsl()],

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
    extensions: [".js", ".ts", ".json"],
  },

  server: {
    host: "0.0.0.0",
    port: 8099,
    open: false,
    hmr: false,
  },

  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
});
