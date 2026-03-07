import type { GameConfig, GameConfigData, UpdateGameConfigInput } from "@miu2d/types";
import { createDefaultGameConfig, GameConfigDataSchema } from "@miu2d/types";
import type { GameConfig as PrismaGameConfig } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { db } from "../../db/client";
import type { Language } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";

export class GameConfigService {
  /**
   * 将数据库记录转换为 GameConfig 类型
   * 旧记录可能缺少后来新增的字段，用 Zod parse 补全默认值
   */
  private toGameConfig(row: PrismaGameConfig): GameConfig {
    const defaults = createDefaultGameConfig();
    const raw = row.data as Record<string, unknown>;
    const merged = { ...defaults, ...raw };
    const data = GameConfigDataSchema.parse(merged);
    return {
      id: row.id,
      gameId: row.gameId,
      data,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * 获取游戏配置（不存在则创建默认配置）
   */
  async get(gameId: string, userId: string, language: Language): Promise<GameConfig> {
    await verifyGameAccess(gameId, userId, language);

    const row = await db.gameConfig.findFirst({ where: { gameId } });

    if (row) {
      return this.toGameConfig(row);
    }

    // 不存在则创建默认配置
    const defaultData = createDefaultGameConfig();
    const newRow = await db.gameConfig.create({
      data: { gameId, data: defaultData as unknown as Prisma.InputJsonValue },
    });

    return this.toGameConfig(newRow);
  }

  /**
   * 更新游戏配置（不存在则创建）
   */
  async update(
    input: UpdateGameConfigInput,
    userId: string,
    language: Language
  ): Promise<GameConfig> {
    await verifyGameAccess(input.gameId, userId, language);

    const existing = await db.gameConfig.findFirst({ where: { gameId: input.gameId } });

    if (existing) {
      const updated = await db.gameConfig.update({
        where: { gameId: input.gameId },
        data: { data: input.data as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
      });
      return this.toGameConfig(updated);
    }

    // 不存在则创建
    const newRow = await db.gameConfig.create({
      data: { gameId: input.gameId, data: input.data as unknown as Prisma.InputJsonValue },
    });

    return this.toGameConfig(newRow);
  }

  /**
   * 仅更新 uiTheme 字段（JSON 主题）
   */
  async patchUiTheme(
    gameId: string,
    uiTheme: unknown,
    userId: string,
    language: Language
  ): Promise<GameConfig> {
    const current = await this.get(gameId, userId, language);
    return this.update(
      { gameId, data: { ...current.data, uiTheme } },
      userId,
      language
    );
  }

  /**
   * 公开接口：通过 slug 获取游戏配置（无需认证）
   * 游戏不存在或未开放 → 仅返回 { gameEnabled: false }
   * 游戏存在且已开放 → 返回完整配置
   */
  async getPublicBySlug(gameSlug: string): Promise<GameConfigData> {
    const game = await db.game.findFirst({
      where: { slug: gameSlug },
      select: { id: true, name: true, slug: true },
    });

    // 游戏不存在 → 返回 gameEnabled: false（不暴露是否存在）
    if (!game) {
      return { gameEnabled: false } as GameConfigData;
    }

    const row = await db.gameConfig.findFirst({ where: { gameId: game.id } });

    if (row) {
      const config = this.toGameConfig(row).data;
      // gameEnabled 为 false → 也只返回 { gameEnabled: false }
      if (!config.gameEnabled) {
        return { gameEnabled: false } as GameConfigData;
      }
      // workspace name/logo override config fields
      const overrides = { gameName: game.name, logoUrl: `/game/${game.slug}/api/logo` };
      // playerKey 未设置时，不返回 player/drop/magicExp 配置
      if (!config.playerKey) {
        const { player: _, drop: __, magicExp: ___, ...rest } = config;
        return { ...rest, ...overrides };
      }
      return { ...config, ...overrides };
    }

    // 无配置记录 → 默认未开放
    return { gameEnabled: false } as GameConfigData;
  }
}

export const gameConfigService = new GameConfigService();
