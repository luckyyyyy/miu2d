import "reflect-metadata";
import "dotenv/config";

import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

// Import all module routers to register them (side-effect imports)
import "./modules";

import { dataRoutes } from "./routes/data.routes";
import { fileRoutes } from "./routes/file.routes";
import { gameConfigRoutes } from "./routes/gameConfig.routes";
import { levelRoutes } from "./routes/level.routes";
import { sceneRoutes } from "./routes/scene.routes";
import { createContext, setPendingRes } from "./trpc/context";
import { appRouter } from "./trpc/router";
import { seedDemoData } from "./utils/demo";
import { env } from "./env";
import { createRateLimiter } from "./utils/rate-limiter";

const app = new Hono();

// CORS
const ALLOWED_ORIGINS = env.corsOrigins
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  "*",
  cors({
    origin: (origin) => (ALLOWED_ORIGINS.includes(origin) ? origin : ""),
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// REST routes
app.route("/game", fileRoutes);
app.route("/game", gameConfigRoutes);
app.route("/game", dataRoutes);
app.route("/game", sceneRoutes);
app.route("/game", levelRoutes);

// Rate limiting for auth endpoints (must be registered before the tRPC handler)
// Login: 10 attempts per IP per 15 minutes
app.use(
  "/trpc/auth.login",
  createRateLimiter({
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
    message: "Too many login attempts, please try again in 15 minutes.",
  })
);
// Register: 5 attempts per IP per hour
app.use(
  "/trpc/auth.register",
  createRateLimiter({
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
    message: "Too many registration attempts, please try again in 1 hour.",
  })
);

// tRPC
app.use("/trpc/*", async (c, next) => {
  // 注入一个用于设置/删除 Cookie 的辅助对象
  // auth 模块需要它来设置 session cookie
  const pendingCookies: string[] = [];
  setPendingRes({
    setCookie: (name: string, value: string, options: Record<string, unknown>) => {
      const parts = [`${name}=${encodeURIComponent(value)}`];
      if (options.path) parts.push(`Path=${options.path}`);
      if (options.maxAge) parts.push(`Max-Age=${Math.floor((options.maxAge as number) / 1000)}`);
      if (options.httpOnly) parts.push("HttpOnly");
      if (options.secure) parts.push("Secure");
      if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
      pendingCookies.push(parts.join("; "));
    },
    deleteCookie: (name: string, options: Record<string, unknown>) => {
      const parts = [`${name}=`, "Max-Age=0"];
      if (options.path) parts.push(`Path=${options.path}`);
      if (options.httpOnly) parts.push("HttpOnly");
      if (options.secure) parts.push("Secure");
      if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
      pendingCookies.push(parts.join("; "));
    },
  });

  await next();

  // 将 tRPC handler 中产生的 Set-Cookie 添加到响应中
  for (const cookie of pendingCookies) {
    c.header("Set-Cookie", cookie, { append: true });
  }
  setPendingRes(undefined);
});

app.use("/trpc/*", trpcServer({ router: appRouter, createContext }));

async function bootstrap() {
  // 开发模式：seed demo 用户 + 游戏 + 成员，使 "demo" 空间无需登录即可操作
  await seedDemoData();

  const port = env.port;
  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    console.log(`Application is running on: http://0.0.0.0:${port}`);
  });
}

bootstrap();
