import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { sharedHead } from "./src/sharedHead";

// Stamped into saved maps, so a file can be traced back to the code that wrote
// it. Marked dirty when the tree has uncommitted changes, since then the commit
// alone does not describe the writer.
function buildCommit(): string {
  try {
    const commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim() !== "";
    return dirty ? `${commit}-dirty` : commit;
  } catch {
    return "unknown"; // built outside a checkout, e.g. from a source tarball
  }
}

export default defineConfig({
  define: { __BUILD_COMMIT__: JSON.stringify(buildCommit()) },
  plugins: [sharedHead()],
  server: { host: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        game: resolve(import.meta.dirname, "game.html"),
        woods: resolve(import.meta.dirname, "woods.html"),
        editor: resolve(import.meta.dirname, "editor.html"),
        woodsEditor: resolve(import.meta.dirname, "woodsEditor.html"),
        library: resolve(import.meta.dirname, "library.html"),
        credits: resolve(import.meta.dirname, "credits.html"),
      },
    },
  },
});
