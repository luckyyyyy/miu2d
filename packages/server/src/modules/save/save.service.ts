/**
 * 存档服务
 *
 * 处理存档的 CRUD、分享、管理员操作
 */

import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { Save as PrismaSave } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { db } from "../../db/client";
import { verifyGameOwnerAccess } from "../../utils/gameAccess";

function generateShareCode(): string {
  return randomBytes(6).toString("base64url"); // 8 chars
}

export class SaveService {
  /**
   * 列出当前用户在某个游戏下的所有存档
   */
  async listByUser(gameSlug: string, userId: string) {
    const game = await this.resolveGame(gameSlug);

    const rows = await db.save.findMany({
      where: { gameId: game.id, userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, gameId: true, userId: true, name: true, mapName: true, level: true, playerName: true, screenshot: true, isShared: true, shareCode: true, createdAt: true, updatedAt: true },
    });

    return rows.map((r) => this.toOutput(r));
  }

  /**
   * 获取完整存档数据
   */
  async get(saveId: string, userId: string) {
    const row = await db.save.findFirst({ where: { id: saveId, userId } });

    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    return {
      ...this.toOutput(row),
      data: row.data as unknown as Prisma.InputJsonValue,
    };
  }

  /**
   * 创建或覆盖存档
   */
  async upsert(
    input: {
      gameSlug: string;
      saveId?: string;
      name: string;
      mapName?: string;
      level?: number;
      playerName?: string;
      screenshot?: string;
      data: Record<string, unknown>;
    },
    userId: string
  ) {
    const game = await this.resolveGame(input.gameSlug);

    const values = {
      gameId: game.id,
      userId,
      name: input.name,
      mapName: input.mapName ?? null,
      level: input.level ?? null,
      playerName: input.playerName ?? null,
      screenshot: input.screenshot ?? null,
      data: input.data as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    };

    // 覆盖已有存档
    if (input.saveId) {
      const existing = await db.save.findFirst({ where: { id: input.saveId }, select: { id: true, userId: true } });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
      }

      if (existing.userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权覆盖此存档" });
      }

      const updated = await db.save.update({ where: { id: input.saveId }, data: values });

      return {
        ...this.toOutput(updated),
      };
    }

    // 创建新存档
    const created = await db.save.create({ data: values });

    return this.toOutput(created);
  }

  /**
   * 删除存档
   */
  async delete(saveId: string, userId: string) {
    const existing = await db.save.findFirst({ where: { id: saveId }, select: { id: true, userId: true } });

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    if (existing.userId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "无权删除此存档" });
    }

    await db.save.delete({ where: { id: saveId } });
    return { id: saveId };
  }

  /**
   * 设置存档分享状态
   */
  async setShared(saveId: string, isShared: boolean, userId: string) {
    const existing = await db.save.findFirst({ where: { id: saveId }, select: { id: true, userId: true, shareCode: true } });

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    if (existing.userId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "无权操作此存档" });
    }

    const shareCode = isShared ? (existing.shareCode ?? generateShareCode()) : existing.shareCode;

    const updated = await db.save.update({ where: { id: saveId }, data: { isShared, shareCode, updatedAt: new Date() } });

    return this.toOutput(updated);
  }

  /**
   * 通过分享码获取存档（无需登录）
   */
  async getShared(gameSlug: string, shareCode: string) {
    const game = await this.resolveGame(gameSlug);

    const row = await db.save.findFirst({
      where: { gameId: game.id, shareCode, isShared: true },
      include: { user: { select: { name: true } } },
    });

    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "分享存档不存在或已取消分享" });
    }

    return {
      ...this.toOutput(row),
      userName: row.user.name,
      data: row.data as unknown as Prisma.InputJsonValue,
    };
  }

  // ============= 管理员接口 =============

  /**
   * 管理员列出所有存档
   */
  async adminList(
    input: {
      gameSlug?: string;
      userId?: string;
      page: number;
      pageSize: number;
    },
    operatorId: string
  ) {
    let gameId: string | undefined;

    if (input.gameSlug) {
      const game = await this.resolveGame(input.gameSlug);
      await verifyGameOwnerAccess(game.id, operatorId);
      gameId = game.id;
    }

    const where = { ...(gameId ? { gameId } : {}), ...(input.userId ? { userId: input.userId } : {}) };

    const total = await db.save.count({ where });

    const rows = await db.save.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: input.pageSize,
      skip: (input.page - 1) * input.pageSize,
    });

    return {
      items: rows.map((r) => ({ ...this.toOutput(r), userName: r.user.name })),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  /**
   * 管理员获取完整存档数据（可读取任何用户的存档）
   */
  async adminGet(saveId: string, operatorId: string) {
    const row = await db.save.findFirst({
      where: { id: saveId },
      include: { user: { select: { name: true } } },
    });

    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    await verifyGameOwnerAccess(row.gameId, operatorId);

    return {
      ...this.toOutput(row),
      userName: row.user.name,
      data: row.data as unknown as Prisma.InputJsonValue,
    };
  }

  /**
   * 管理员创建存档（以管理员身份创建，通过 JSON 输入）
   */
  async adminCreate(
    input: {
      gameSlug: string;
      name: string;
      mapName?: string;
      level?: number;
      playerName?: string;
      screenshot?: string;
      data: Record<string, unknown>;
    },
    operatorId: string
  ) {
    const game = await this.resolveGame(input.gameSlug);
    await verifyGameOwnerAccess(game.id, operatorId);

    const values = {
      gameId: game.id,
      userId: operatorId,
      name: input.name,
      mapName: input.mapName ?? null,
      level: input.level ?? null,
      playerName: input.playerName ?? null,
      screenshot: input.screenshot ?? null,
      data: input.data as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    };

    const created = await db.save.create({ data: values });

    return this.toOutput(created);
  }

  /**
   * 管理员更新存档数据
   */
  async adminUpdate(
    input: {
      saveId: string;
      name?: string;
      data: Record<string, unknown>;
    },
    operatorId: string
  ) {
    const existing = await db.save.findFirst({ where: { id: input.saveId }, select: { id: true, gameId: true } });

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    await verifyGameOwnerAccess(existing.gameId, operatorId);

    // 从 data 中提取元信息
    const playerData = input.data.player as Record<string, unknown> | undefined;
    const mapName = typeof input.data.mapFileName === "string" ? input.data.mapFileName : undefined;
    const playerName = typeof playerData?.name === "string" ? playerData.name : undefined;
    const level = typeof playerData?.level === "number" ? playerData.level : undefined;

    const setValues: Record<string, unknown> = {
      data: input.data as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    };
    if (input.name) setValues.name = input.name;
    if (mapName !== undefined) setValues.mapName = mapName;
    if (playerName !== undefined) setValues.playerName = playerName;
    if (level !== undefined) setValues.level = level;

    const updated = await db.save.update({ where: { id: input.saveId }, data: setValues });

    return this.toOutput(updated);
  }

  /**
   * 管理员设置存档分享状态（可操作任何用户的存档）
   */
  async adminSetShared(saveId: string, isShared: boolean, operatorId: string) {
    const existing = await db.save.findFirst({ where: { id: saveId }, select: { id: true, gameId: true, shareCode: true } });

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    await verifyGameOwnerAccess(existing.gameId, operatorId);

    const shareCode = isShared ? (existing.shareCode ?? generateShareCode()) : existing.shareCode;

    const updated = await db.save.update({ where: { id: saveId }, data: { isShared, shareCode, updatedAt: new Date() } });

    return this.toOutput(updated);
  }

  /**
   * 管理员删除存档（可删除任何用户的存档）
   */
  async adminDelete(saveId: string, operatorId: string) {
    const existing = await db.save.findFirst({ where: { id: saveId }, select: { id: true, gameId: true } });

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "存档不存在" });
    }

    await verifyGameOwnerAccess(existing.gameId, operatorId);

    await db.save.delete({ where: { id: saveId } });
    return { id: saveId };
  }

  // ============= 内部工具 =============

  private async resolveGame(gameSlug: string) {
    const game = await db.game.findFirst({ where: { slug: gameSlug } });

    if (!game) {
      throw new TRPCError({ code: "NOT_FOUND", message: "游戏不存在" });
    }

    return game;
  }

  private toOutput(row: Omit<PrismaSave, "data">) {
    return {
      id: row.id,
      gameId: row.gameId,
      userId: row.userId,
      name: row.name,
      mapName: row.mapName ?? undefined,
      level: row.level ?? undefined,
      playerName: row.playerName ?? undefined,
      screenshot: row.screenshot ?? undefined,
      isShared: row.isShared,
      shareCode: row.shareCode ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? "",
      updatedAt: row.updatedAt?.toISOString() ?? "",
    };
  }
}

export const saveService = new SaveService();
