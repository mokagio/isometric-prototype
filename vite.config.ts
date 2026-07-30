import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { defineConfig } from "vite";

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
