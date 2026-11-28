import { defineConfig, loadEnv } from "vite";
import { vitePlugins } from "./vite/plugin";
import { resolve } from "path";

function pathResolve(dir: string) {
  return resolve(__dirname, ".", dir);
}

type ModuleInfoLookup = (id: string) => { isEntry: boolean; importers: readonly string[]; dynamicImporters?: readonly string[] } | null;
const staticReachCache = new Map<string, Map<string, boolean>>();

/** The entry modules: the game page and the editor page. */
const GAME_ENTRY = "/index.html";
const EDITOR_ENTRY = "/editor.html";

/**
 * True when `id` is reachable from an entry module (by path suffix): through
 * static imports only, or (`viaDynamic`) through dynamic `import()`s too.
 */
function isStaticallyReachable(id: string, getModuleInfo: ModuleInfoLookup, entry = GAME_ENTRY, viaDynamic = false): boolean {
  const cacheKey = viaDynamic ? `${entry}+dynamic` : entry;
  let cache = staticReachCache.get(cacheKey);
  if (!cache) staticReachCache.set(cacheKey, (cache = new Map()));
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  // Breadth-first walk up the static importer graph.
  const seen = new Set<string>([id]);
  const queue = [id];
  let reachable = false;
  while (queue.length > 0) {
    const current = queue.shift()!;
    const info = getModuleInfo(current);
    if (!info) continue;
    if ((info.isEntry && current.endsWith(entry)) || cache.get(current) === true) {
      reachable = true;
      break;
    }
    for (const importer of viaDynamic ? [...info.importers, ...(info.dynamicImporters ?? [])] : info.importers) {
      if (!seen.has(importer)) {
        seen.add(importer);
        queue.push(importer);
      }
    }
  }
  cache.set(id, reachable);
  return reachable;
}

/**
 * Write dist/.vite/chunk-modules.json: each chunk's modules and imports, so
 * tools/check-bundle.mjs can prove the game page loads no editor code.
 */
function chunkModulesReport() {
  return {
    name: "camelot-chunk-modules",
    apply: "build" as const,
    generateBundle(_: unknown, bundle: Record<string, any>) {
      const report: Record<string, unknown> = {};
      for (const [file, out] of Object.entries(bundle)) {
        if (out.type !== "chunk") continue;
        report[file] = {
          entry: out.isEntry ? out.name : null,
          facade: out.facadeModuleId ?? null,
          imports: out.imports,
          dynamicImports: out.dynamicImports,
          modules: Object.keys(out.modules).map((m: string) => m.replace(process.cwd() + "/", "")),
          sizes: Object.fromEntries(Object.entries(out.modules).map(([m, info]: [string, any]) => [m.replace(process.cwd() + "/", ""), info.renderedLength])),
        };
      }
      (this as any).emitFile({ type: "asset", fileName: ".vite/chunk-modules.json", source: JSON.stringify(report) });
    },
  };
}

/**
 * Preload the physics engine's WebAssembly (2 MB) from the game page's HTML,
 * so it downloads alongside the JavaScript instead of after it (Havok only
 * asks for it once the app code runs). Its file name carries a content hash,
 * so the link is written from the built bundle.
 */
function preloadPhysicsWasm() {
  let base = "/";
  return {
    name: "camelot-preload-physics-wasm",
    apply: "build" as const,
    configResolved(config: { base: string }) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post" as const,
      handler(_html: string, ctx: { filename: string; bundle?: Record<string, unknown> }) {
        if (!ctx.bundle || !/index\.html$/.test(ctx.filename)) return [];
        const wasm = Object.keys(ctx.bundle).find((f) => /HavokPhysics[^/]*\.wasm$/.test(f));
        if (!wasm) return [];
        return [{
          tag: "link",
          attrs: { rel: "preload", href: base + wasm, as: "fetch", type: "application/wasm", crossorigin: "" },
          injectTo: "head" as const,
        }];
      },
    },
  };
}

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) => {
  const root = process.cwd();
  const env = loadEnv(mode, root);
  return defineConfig({
    base: env.VITE_PUBLIC_PATH,
    root,
    // plugin
    plugins: [...vitePlugins(env), chunkModulesReport(), preloadPhysicsWasm()],
    // alias
    resolve: {
      alias: {
        "@": pathResolve("src"),
      },
      // https://github.com/vitejs/vite/issues/178#issuecomment-630138450
      extensions: [".js", ".ts", ".tsx", ".json"],
    },
    // https://vitejs.cn/config/#esbuild
    esbuild: {
      // Preact components: the automatic JSX runtime from preact.
      jsx: "automatic",
      jsxImportSource: "preact",
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
      // ES2022: the browsers that run the game (WebGL2, top-level await,
      // class fields) all have it, and nothing is rewritten into longer
      // older syntax (−33 KB of the game's code, −7 KB of Babylon's).
      target: "es2022",
      outDir: "dist",
      chunkSizeWarningLimit: 550,
      assetsInlineLimit: 4096,
      rollupOptions: {
        // Two apps: the game, and the editor (the game plus the editor suite).
        input: { index: pathResolve("index.html"), editor: pathResolve("editor.html") },
        output: {
          // A manual chunk holds only the modules assigned to it: Rollup would
          // otherwise pull their unassigned dependencies in too (the editor's
          // GUI chunk swallowed Babylon modules the game's lazy glTF loader
          // also needs, so loading a model fetched editor code).
          onlyExplicitManualChunks: true,
          manualChunks(id, { getModuleInfo }) {
            // Only claim Babylon modules reachable through static imports. Babylon
            // lazy-loads large optional code (WebGPU WGSL shaders, glTF FlowGraph
            // interactivity, …) via dynamic import(); pulling those into this
            // eagerly-preloaded chunk shipped ~1 MB the WebGL game never runs.
            if (id.includes("@babylonjs")) {
              if (isStaticallyReachable(id, getModuleInfo)) return "babylon-vendor";
              // Static Babylon code only the editor app loads (GUI, …): its own
              // chunk, so the game page never fetches it.  Code the game also
              // reaches lazily (the glTF loader, fetched with the first model)
              // stays with its lazy importer instead, or loading a model would
              // fetch the editor's chunk.
              if (isStaticallyReachable(id, getModuleInfo, EDITOR_ENTRY) && !isStaticallyReachable(id, getModuleInfo, GAME_ENTRY, true)) return "babylon-editor";
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
      // The lazy glTF loader (src/rendering/gltf-loading.ts): pre-bundled in one
      // pass with its extension registry, so the loader and the registered
      // extensions share one copy of it in the dev server.
      include: [
        "@babylonjs/loaders/glTF/glTFFileLoader.metadata",
        "@babylonjs/loaders/glTF/2.0/glTFLoader",
        "@babylonjs/loaders/glTF/2.0/Extensions/dynamic",
      ],
    },
  });
};
