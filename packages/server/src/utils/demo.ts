/**
 * Demo 开发模式工具
 *
 * 在本地开发模式下（NODE_ENV !== "production"），自动 seed demo 用户 + 游戏 + 成员关系。
 * context.ts 为未登录请求注入 DEMO_DEV_USER_ID，所有现有 requireUser / verifyGameAccess
 * 自然通过，无需在每个 service 里做特殊 bypass。
 */
import { db } from "../db/client";

/** Demo 游戏空间的 slug */
export const DEMO_SLUG = "demo";

/** 开发模式下未登录用户的虚拟 userId */
export const DEMO_DEV_USER_ID = "00000000-0000-0000-0000-000000000000";

import { env } from "../env";

/** 是否为非生产环境 */
export function isDev(): boolean {
  return env.isDev;
}

/**
 * 开发模式启动时调用：确保 demo 用户、游戏、成员关系存在。
 * 这样所有 requireUser / verifyGameAccess 中间件自然通过，
 * 不需要在每个 service 中做 bypass。
 */
export async function seedDemoData(): Promise<void> {
  if (!isDev()) return;

  // 1. 确保 demo 用户存在
  const existingUser = await db.user.findFirst({
    where: { id: DEMO_DEV_USER_ID },
    select: { id: true },
  });

  if (!existingUser) {
    await db.user.create({
      data: {
        id: DEMO_DEV_USER_ID,
        name: "Demo Developer",
        email: "demo@dev.local",
        passwordHash: "not-a-real-hash",
        emailVerified: true,
        role: "user",
      },
    });
    console.log("[Demo] Created demo user");
  }

  // 2. 确保 demo 游戏存在
  let demoGame = await db.game.findFirst({
    where: { slug: DEMO_SLUG },
    select: { id: true },
  });

  if (!demoGame) {
    demoGame = await db.game.create({
      data: {
        slug: DEMO_SLUG,
        name: "Demo Game",
        description: "Local development demo workspace",
      },
      select: { id: true },
    });
    console.log("[Demo] Created demo game");
  }

  // 3. 确保 demo 用户是 demo 游戏的成员
  const existingMember = await db.gameMember.findFirst({
    where: { gameId: demoGame.id, userId: DEMO_DEV_USER_ID },
    select: { id: true },
  });

  if (!existingMember) {
    await db.gameMember.create({
      data: {
        gameId: demoGame.id,
        userId: DEMO_DEV_USER_ID,
        role: "owner",
      },
    });
    console.log("[Demo] Added demo user as game member");
  }

  console.log("[Demo] Dev mode ready — slug 'demo' accessible without login");
}
