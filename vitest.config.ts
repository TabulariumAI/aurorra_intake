import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@document-pwa/progress-message-bar": path.resolve(rootDir, "../document_web/src/app/shell/component/ProgressMessageBar.tsx"),
      "@radix-ui/react-dialog": path.resolve(rootDir, "node_modules/@radix-ui/react-dialog"),
      "@radix-ui/react-popover": path.resolve(rootDir, "node_modules/@radix-ui/react-popover"),
      "@radix-ui/react-progress": path.resolve(rootDir, "node_modules/@radix-ui/react-progress"),
      "aurorra-ui": path.resolve(rootDir, "../aurorra_ui/src/public-api.ts"),
      react: path.resolve(rootDir, "node_modules/react"),
      "react-dom": path.resolve(rootDir, "node_modules/react-dom"),
    },
    dedupe: ["@radix-ui/react-dialog", "@radix-ui/react-popover", "@radix-ui/react-progress", "react", "react-dom"],
    preserveSymlinks: true,
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
    },
  },
});
