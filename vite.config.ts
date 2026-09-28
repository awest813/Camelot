import { defineConfig, loadEnv } from "vite";
import { vitePlugins } from "./vite/plugin";
import { resolve } from "path";

function pathResolve(dir: string) {
  return resolve(__dirname, ".", dir);
}

type ModuleInfoLookup = (id: string) => { isEntry: boolean; importers: readonly string[] } | null;
const staticReachCache = new Map<string, boolean>();

/** True when `id` is reachable from an entry through static imports only. */
function isStaticallyReachable(id: string, getModuleInfo: ModuleInfoLookup): boolean {
  const cached = staticReachCache.get(id);
  if (cached !== undefined) return cached;
  // Breadth-first walk up the static importer graph.
  const seen = new Set<string>([id]);
  const queue = [id];
  let reachable = false;
  while (queue.length > 0) {
    const current = queue.shift()!;
    const info = getModuleInfo(current);
    if (!info) continue;
    if (info.isEntry || staticReachCache.get(current) === true) {
      reachable = true;
      break;
    }
    for (const importer of info.importers) {
      if (!seen.has(importer)) {
        seen.add(importer);
        queue.push(importer);
      }
    }
  }
  staticReachCache.set(id, reachable);
  return reachable;
}

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) => {
  const root = process.cwd();
  const env = loadEnv(mode, root);
  return defineConfig({
    base: env.VITE_PUBLIC_PATH,
    root,
    // plugin
    plugins: vitePlugins(env),
    // alias
    resolve: {
      alias: {
        "@": pathResolve("src"),
      },
      // https://github.com/vitejs/vite/issues/178#issuecomment-630138450
      extensions: [".js", ".ts", ".json"],
    },
    // https://vitejs.cn/config/#esbuild
    esbuild: {
      // pure: env.VITE_DROP_CONSOLE ? ["console.log", "debugger"] : [],
      pure: mode === "production" ? ["console.log"] : [],
      //  drop: ["console", "debugger"],
    },
    // server config
    server: {
      host: env.VITE_HOST || 'localhost',
      port: Number(env.VITE_PORT) || 8088,
      open: env.VITE_OPEN === "true",
      hmr: env.VITE_HMR === "true",
      cors: env.VITE_CORS === "true" ? {
        origin: [
          `http://localhost:${Number(env.VITE_PORT) || 8088}`,
          `http://127.0.0.1:${Number(env.VITE_PORT) || 8088}`,
        ],
      } : false,
      // Cross domain
      // proxy: {
      //     '/api': {
      //         target: 'http://',
      //         changeOrigin: true,
      //         ws: true,
      //         rewrite: (path) => path.replace(/^\/api/, '')
      //     }
      // }
    },

    // build: https://vitejs.cn/config/#build-target
    build: {
      target: "modules",
      outDir: "dist",
      chunkSizeWarningLimit: 550,
      assetsInlineLimit: 4096,
      rollupOptions: {
        output: {
          manualChunks(id, { getModuleInfo }) {
            // Only claim Babylon modules reachable through static imports. Babylon
            // lazy-loads large optional code (WebGPU WGSL shaders, glTF FlowGraph
            // interactivity, …) via dynamic import(); pulling those into this
            // eagerly-preloaded chunk shipped ~1 MB the WebGL game never runs.
            if (id.includes("@babylonjs")) {
              if (isStaticallyReachable(id, getModuleInfo)) return "babylon-vendor";
              // Lazily-loaded shaders: one chunk per language, so WebGL fetches a
              // single GLSL file on first material compile (not a waterfall of
              // tiny chunks) and WGSL is only ever fetched by the WebGPU engine.
              if (id.includes("/ShadersWGSL/")) return "babylon-shaders-wgsl";
              if (id.includes("/Shaders/")) return "babylon-shaders-glsl";
            }

            if (id.includes("recast-detour")) {
              return "recast-vendor";
            }

            return undefined;
          },
          chunkFileNames: "static/js/[name]-[hash].js",
          entryFileNames: "static/js/[name]-[hash].js",
          assetFileNames: "static/[ext]/[name]-[hash].[ext]",
        },
      },
    },

    optimizeDeps: {
      exclude: ["@babylonjs/havok"],
    },
  });
};
