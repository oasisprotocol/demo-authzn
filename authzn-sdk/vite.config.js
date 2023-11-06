import path from "path";
import {defineConfig} from "vite";

export default defineConfig({
  build: {
    outDir: 'lib',
    lib: {
      entry: path.resolve(__dirname, 'lib/index.js'),
      name: 'authzn-sdk',
      fileName: (format) => `authzn-sdk.${format}.js`,
    },
  }
});
