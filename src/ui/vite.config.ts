import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The Setup UI is a static bundle served by src/server/local-server.js from dist/web.
// `npm run dev:ui` proxies /api to a running Setup server (default 127.0.0.1:51789).
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: fileURLToPath(new URL("../../dist/web", import.meta.url)),
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: { "/api": { target: process.env.SETUP_API || "http://127.0.0.1:51789", changeOrigin: true } },
  },
});
