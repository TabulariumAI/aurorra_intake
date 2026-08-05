import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@radix-ui/react-popover": path.resolve(rootDir, "node_modules/@radix-ui/react-popover"),
      "aurorra-ui": path.resolve(rootDir, "../aurorra_ui/src/public-api.ts"),
      react: path.resolve(rootDir, "node_modules/react"),
      "react-dom": path.resolve(rootDir, "node_modules/react-dom"),
    },
    dedupe: ["@radix-ui/react-popover", "react", "react-dom"],
    preserveSymlinks: true,
  },
  plugins: [react()],
  build: {
    lib: {
      entry: "src/public-api.ts",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["react", "react-dom", "react-dom/client", "react-dom/server"],
    },
  },
});
