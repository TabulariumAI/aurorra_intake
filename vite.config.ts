import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@document-pwa/progress-message-bar": path.resolve(rootDir, "../document_web/src/app/shell/component/ProgressMessageBar.tsx"),
      "@radix-ui/react-dialog": path.resolve(rootDir, "node_modules/@radix-ui/react-dialog"),
      "@radix-ui/react-popover": path.resolve(rootDir, "node_modules/@radix-ui/react-popover"),
      "@radix-ui/react-progress": path.resolve(rootDir, "node_modules/@radix-ui/react-progress"),
      "aurorra-ui": path.resolve(rootDir, "../aurorra_ui/src/index.ts"),
      react: path.resolve(rootDir, "node_modules/react"),
      "react-dom": path.resolve(rootDir, "node_modules/react-dom"),
    },
    dedupe: ["@radix-ui/react-dialog", "@radix-ui/react-popover", "@radix-ui/react-progress", "react", "react-dom"],
    preserveSymlinks: true,
  },
  plugins: [react()],
  build: {
    lib: {
      entry: "src/index.tsx",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["react", "react-dom", "react-dom/client", "react-dom/server"],
    },
  },
});
