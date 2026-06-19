import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    // @slidegen/core は自前 ESM のため main チャンクへバンドルする。
    // その重い依存(marp-core 等)は externalize して実行時 require に任せる。
    plugins: [externalizeDepsPlugin({ exclude: ["@slidegen/core"] })],
    build: {
      rollupOptions: {
        input: { index: resolve("src/main/index.js") },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve("src/preload/index.js") },
      },
    },
  },
  renderer: {
    root: resolve("src/renderer"),
    build: {
      rollupOptions: {
        input: { index: resolve("src/renderer/index.html") },
      },
    },
  },
});
