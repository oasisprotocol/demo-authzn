import { defineConfig } from "vite";
import preact from "@preact/preset-vite"
import EnvironmentPlugin from "vite-plugin-environment";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import rollupNodePolyFill from "rollup-plugin-node-polyfills";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  server: {
    https: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8545',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    }
  },
  plugins: [
    basicSsl(),
    preact(),
    EnvironmentPlugin('all'),
  ],
  optimizeDeps: {
    esbuildOptions: {
      define: {
        // Needed for pbkdf2 module!
        global: 'globalThis'
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: false,
          buffer: true,
        }),
        NodeModulesPolyfillPlugin(),
      ],
    },
  },
  resolve: {
    alias: {
    },
  },
  build: {
    rollupOptions: {
      plugins: [
        // Enable rollup polyfills plugin
        // used during production bundling
        rollupNodePolyFill(),
      ],
    },
  },
});
