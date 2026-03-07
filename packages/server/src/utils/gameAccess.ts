/**
 * 统一的游戏访问权限校验
 *
 * 所有需要验证用户是否有权访问游戏的地方都应使用此模块，
 * 避免在每个 service 中重复实现相同的权限校验逻辑。
 */
import { TRPCError } from "@trpc/server";
import { db } from "../db/client";
import type { Language } from "../i18n";
import { getMessage } from "../i18n";

/**
 * 验证用户是否有权访问游戏（需为游戏成员）
 */
export async function verifyGameAccess(
  gameId: string,
  userId: string,
  language: Language = "zh"
): Promise<void> {
  const member = await db.gameMember.findFirst({
    where: { gameId, userId },
    select: { id: true },
  });

  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: getMessage(language, "errors.file.noAccess"),
    });
  }
}

/**
 * 验证用户是否为游戏创始人（gameMembers.role === "owner"）
 */
export async function verifyGameOwnerAccess(
  gameId: string,
  userId: string,
  language: Language = "zh"
): Promise<void> {
  const member = await db.gameMember.findFirst({
    where: { gameId, userId },
    select: { role: true },
  });

  if (!member || member.role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: getMessage(language, "errors.file.noAccess"),
    });
  }
}
