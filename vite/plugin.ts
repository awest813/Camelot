import viteCompression from 'vite-plugin-compression'
import { createHtmlPlugin } from 'vite-plugin-html'
import glsl from 'vite-plugin-glsl'

const vitePlugins: any = (env: any) => {
  return [
    glsl(), // Convenient for you to write shader
    // Pre-compressed copies for hosts that serve them (gzip everywhere, brotli
    // where supported). The physics engine's WebAssembly (2 MB) compresses
    // about 3x and is fetched before the title, so .wasm is included.
    viteCompression({
      verbose: false,
      disable: false, // Do not disable compression
      deleteOriginFile: false, // Whether to delete the original file after compression
      threshold: 10240, // Only files of 10 KB or more
      filter: /\.(js|mjs|json|css|html|wasm|svg)$/i,
      ext: '.gz', // file type
      algorithm: 'gzip' // Compression algorithm
    }),
    viteCompression({
      verbose: false,
      disable: false,
      deleteOriginFile: false,
      threshold: 10240,
      filter: /\.(js|mjs|json|css|html|wasm|svg)$/i,
      ext: '.br',
      algorithm: 'brotliCompress'
    }),
    createHtmlPlugin({
      inject: {
        data: {
          title: env.VITE_APP_TITLE // Need to reference environment variables in html
        }
      }
    })
  ]
}

export { vitePlugins }