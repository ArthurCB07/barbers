/** Build estático da demonstração publicada no GitHub Pages */
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: at("./"),
  base: "./", // caminhos relativos: funciona em usuario.github.io/<repositorio>/
  esbuild: { jsx: "automatic" },
  css: { postcss: at("../") },
  resolve: {
    alias: [
      { find: /^\.\/BarberPanel$/, replacement: at("./shims/BarberPanel.tsx") },
      { find: /^next\/dynamic$/, replacement: at("./shims/dynamic.tsx") },
      { find: /^next\/link$/, replacement: at("./shims/link.tsx") },
      { find: /^@\/components\/ui\/client$/, replacement: at("./shims/ui-client.tsx") },
      { find: /^@\//, replacement: at("../src/") },
    ],
  },
  build: { outDir: at("./dist"), emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});
