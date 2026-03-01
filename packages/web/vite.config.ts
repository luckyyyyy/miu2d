import * as fs from "node:fs";
import * as path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-oxc";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * Custom plugin to return 404 for missing resources
 * This prevents Vite from returning 200 OK with index.html for missing files
 */
function resources404Plugin(): Plugin {
  return {
    name: "resources-404",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Only check paths under /resources/
        if (req.url?.startsWith("/resources/")) {
          // Decode the URL to handle Chinese characters
          const decodedUrl = decodeURIComponent(req.url);
          // Remove query string if present
          const urlPath = decodedUrl.split("?")[0];
          // Resolve to actual file path (resources are served from public folder)
          const filePath = path.join(process.cwd(), "./", urlPath);

          // Check if file exists
          if (!fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Resource not found", path: urlPath }));
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    resources404Plugin(),
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "prompt",
      // Registration is handled manually by PWAUpdatePrompt via useRegisterSW hook
      injectRegister: null,
      // Manifest is authored manually in public/manifest.webmanifest and linked in index.html
      manifest: false,
      strategies: "generateSW",
      workbox: {
        // Precache all static assets produced by Vite build
        globPatterns: ["**/*.{js,css,html,wasm}"],
        // Don't precache large game resource files (fetched at runtime via CacheFirst below)
        globIgnores: ["**/resources/**"],
        // ts.worker is ~7 MB; raise the limit to cover it and the main bundle (~6 MB)
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        runtimeCaching: [
          // WASM files: CacheFirst (content-hashed by build)
          {
            urlPattern: /\.wasm$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "wasm-cache",
              expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Game binary resources (maps, sprites, audio): CacheFirst
          {
            urlPattern: /^https?:\/\/.*\/game\/[^/]+\/resources\//i,
            handler: "CacheFirst",
            options: {
              cacheName: "game-resources-cache",
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Game data API: NetworkFirst (data changes with engine iterations)
          {
            urlPattern: /^https?:\/\/.*\/game\/[^/]+\/api\//i,
            handler: "NetworkFirst",
            options: {
              cacheName: "game-api-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          // tRPC / auth API: NetworkOnly (must not serve stale auth data)
          {
            urlPattern: /^https?:\/\/.*\/trpc\//i,
            handler: "NetworkOnly",
          },
          // Static image assets in public/icons and public/screenshot
          {
            urlPattern: /\/(icons|screenshot)\/.+\.(png|jpg|webp|svg)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "static-images-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // @miu2d/engine — game engine core (large, changes independently)
          if (id.includes("/packages/engine/src/")) return "engine";
          // @miu2d/game — game runtime / GameScreen
          if (id.includes("/packages/game/src/")) return "game";
          // @miu2d/dashboard — admin / dashboard
          if (id.includes("/packages/dashboard/src/")) return "dashboard";
          // @miu2d/shared + @miu2d/ui + @miu2d/types — shared utilities
          if (
            id.includes("/packages/shared/src/") ||
            id.includes("/packages/ui/src/") ||
            id.includes("/packages/types/src/")
          )
            return "shared";
          // Monaco editor (shared by game and dashboard)
          if (
            id.includes("node_modules/monaco-editor/") ||
            id.includes("node_modules/@monaco-editor/")
          )
            return "monaco";
          // React ecosystem
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/scheduler/")
          )
            return "vendor-react";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    proxy: {
      // tRPC API 代理到后端 4000 端口
      "/trpc": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      // MinIO presigned URL 代理：/s3/* → MinIO 9000
      // changeOrigin 确保 Host 头匹配 presigned URL 签名
      "/s3": {
        target: "http://localhost:9000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/s3/, ""),
      },
      // 代理后端 API 路径到后端 4000 端口
      // 注意：/game/:gameSlug 是前端路由，不代理
      // 只代理 /game/*/api/* 和 /game/*/resources/* 到后端
      "/game": {
        target: "http://localhost:4000",
        changeOrigin: true,
        bypass: (req) => {
          const url = req.url || "";
          // 匹配 /game/{gameSlug}/api/* 或 /game/{gameSlug}/resources/*
          const isBackendPath = /^\/game\/[^/]+\/(api|resources)(\/|$)/.test(url);
          if (!isBackendPath) {
            // 返回前端路由，让 Vite 处理（返回 index.html）
            return "/index.html";
          }
          // 返回 undefined 表示代理到后端
          return undefined;
        },
      },
    },
  },
});
