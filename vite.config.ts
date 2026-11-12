import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: { output: { manualChunks: (id: string) => (id.includes("node_modules/three") || id.includes("@react-three") || id.includes("postprocessing") ? "three" : id.includes("node_modules") ? "vendor" : undefined) } },
  },
  test: { include: ["src/**/*.test.ts"] },
} as never);
