import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: { host: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        editor: resolve(import.meta.dirname, "editor.html"),
        credits: resolve(import.meta.dirname, "credits.html"),
      },
    },
  },
});
