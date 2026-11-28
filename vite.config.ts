import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "aurora-core/session-error": path.resolve(rootDir, "../aurora_core/src/sessionError.ts"),
      "aurora-core/retry-info": path.resolve(rootDir, "../aurora_core/src/retryInfo.ts"),
      "aurora-core": path.resolve(rootDir, "../aurora_core/src/public-api.ts"),
      react: path.resolve(rootDir, "node_modules/react"),
      "react-dom": path.resolve(rootDir, "node_modules/react-dom"),
      zustand: path.resolve(rootDir, "node_modules/zustand"),
    },
    dedupe: ["react", "react-dom", "zustand"],
    preserveSymlinks: true,
  },
  plugins: [react()],
  build: {
    lib: {
      entry: "src/public-api.ts",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["aurora-core", "aurora-core/retry-info", "aurora-core/session-error", "react", "react-dom", "react-dom/client", "react-dom/server"],
    },
  },
});
