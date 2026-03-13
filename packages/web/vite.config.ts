import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

function getGitCommit(): string {
  // Docker build injects COMMIT_HASH env var; fall back to git for local dev
  if (process.env.COMMIT_HASH) return process.env.COMMIT_HASH;
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

function getAppVersion(): string {
  // Docker build injects APP_VERSION env var; fall back to package.json for local dev
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    const pkgPath = path.join(__dirname, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * 监听 monorepo 其他包的源码变更，确保 Vite 在文件修改后重新编译相关模块。
 * （Vite 默认只监听自身包根目录，packages/engine 等变更需手动添加）
 */
function watchWorkspacePackagesPlugin(): Plugin {
  return {
    name: "watch-workspace-packages",
    configureServer(server) {
      const engineSrc = path.resolve(__dirname, "../../packages/engine/src");
      server.watcher.add(engineSrc);
    },
  };
}

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
  define: {
    __COMMIT_HASH__: JSON.stringify(getGitCommit()),
    __APP_VERSION__: JSON.stringify(getAppVersion()),
  },
  plugins: [
    watchWorkspacePackagesPlugin(),
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
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          // @miu2d/engine, @miu2d/game, @miu2d/dashboard, @miu2d/shared, @miu2d/ui, @miu2d/types:
          // No explicit rule — Rolldown creates lazy auto-chunks for game and dashboard
          // based on the React.lazy() dynamic import boundaries in App.tsx.
          // Explicitly naming these caused Rolldown to absorb @miu2d/shared into the
          // named chunk (making it statically preloaded with the entry).
          // Monaco editor: no explicit rule — it's only used by the dashboard
          // (via ScriptEditor, lazy-loaded). Rolldown will auto-chunk it with
          // the dashboard chunk based on the dynamic import boundary.
          // React ecosystem
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/scheduler/")
          )
            return "LibsReact";
          // tRPC + TanStack React Query — loaded at startup via TRPCProvider
          // Must be extracted from "dashboard" so dashboard remains lazy
          if (
            id.includes("node_modules/@trpc/") ||
            id.includes("node_modules/@tanstack/") ||
            id.includes("node_modules/use-sync-external-store/")
          )
            return "LibsTrpc";
          // i18n — loaded at startup; keep separate for cache granularity
          if (id.includes("node_modules/i18next") || id.includes("node_modules/react-i18next"))
            return "LibsI18n";
          // Zod — used by @miu2d/types which is in the shared chunk
          if (id.includes("node_modules/zod/")) return "LibsZod";
          // framer-motion — used by @miu2d/ui + landing pages at startup
          if (
            id.includes("node_modules/framer-motion/") ||
            id.includes("node_modules/motion-dom/") ||
            id.includes("node_modules/motion-utils/")
          )
            return "LibsMotion";
          // react-icons — used by landing pages at startup
          if (id.includes("node_modules/react-icons/")) return "LibsIcons";
        },
      },
    },
  },
  optimizeDeps: {
    // Exclude from pre-bundling so Rolldown processes them as raw modules.
    // This allows manualChunks to route them to dedicated chunks,
    // preventing them from being bundled into "dashboard" and causing
    // the entry to preload the whole dashboard chunk at startup.
    exclude: ["framer-motion", "react-icons"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5274,
    proxy: {
      // tRPC API 代理到后端 4000 端口
      "/trpc": {
        target: "http://localhost:4100",
        changeOrigin: true,
      },
      // MinIO presigned URL 代理：/s3/* → MinIO 9100
      // changeOrigin 确保 Host 头匹配 presigned URL 签名
      "/s3": {
        target: "http://localhost:9100",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/s3/, ""),
      },
      // 代理后端 API 路径到后端 4000 端口
      // 注意：/game/:gameSlug 是前端路由，不代理
      // 只代理 /game/*/api/* 和 /game/*/resources/* 到后端
      "/game": {
        target: "http://localhost:4100",
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
