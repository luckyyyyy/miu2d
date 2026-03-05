/**
 * 游戏查询工具函数
 *
 * 将 slug → gameId 的重复查询提取为共享工具，避免在每个 service 中 copy-paste
 */

import { db } from "../db/client";

/**
 * 通过 slug 查询 gameId，找不到返回 null
 */
export async function getGameIdBySlug(gameSlug: string): Promise<string | null> {
  const game = await db.game.findFirst({
    where: { slug: gameSlug },
    select: { id: true },
  });
  return game?.id ?? null;
}

/**
 * 通过 slug 查询 gameId，游戏不存在时抛出 Error("Game not found")
 */
export async function requireGameIdBySlug(gameSlug: string): Promise<string> {
  const id = await getGameIdBySlug(gameSlug);
  if (!id) throw new Error("Game not found");
  return id;
}
