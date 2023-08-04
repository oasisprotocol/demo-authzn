import {defineConfig} from "vite";

export default defineConfig({
optimizeDeps: {
    esbuildOptions: {
        define: {
            // Needed for pbkdf2 module!
            global: 'globalThis'
        }
    }
}
});
