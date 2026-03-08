import type { ImportPortraitMapInput, PortraitEntry, UpdatePortraitMapInput } from "@miu2d/types";
import { parsePortraitIni } from "@miu2d/types";
import type { Prisma } from "@prisma/client";
import { db } from "../../db/client";
import type { Language } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";
import { requireGameIdBySlug } from "../../utils/game";

export class TalkPortraitService {
  /**
   * 获取头像映射（不存在则返回空数组）
   */
  async get(
    gameId: string,
    userId: string,
    language: Language
  ): Promise<{ gameId: string; entries: PortraitEntry[] }> {
    await verifyGameAccess(gameId, userId, language);

    const row = await db.talkPortrait.findFirst({ where: { gameId } });

    return {
      gameId,
      entries: row ? (row.data as PortraitEntry[]) : [],
    };
  }

  /**
   * 公开接口：通过 slug 获取头像映射（无需认证）
   */
  async getPublicByGameId(gameId: string): Promise<PortraitEntry[]> {
    const row = await db.talkPortrait.findFirst({ where: { gameId } });
    return row ? (row.data as PortraitEntry[]) : [];
  }

  async getPublicBySlug(gameSlug: string): Promise<PortraitEntry[]> {
    return this.getPublicByGameId(await requireGameIdBySlug(gameSlug));
  }

  /**
   * 更新头像映射（upsert）
   */
  async update(
    input: UpdatePortraitMapInput,
    userId: string,
    language: Language
  ): Promise<{ gameId: string; entries: PortraitEntry[] }> {
    await verifyGameAccess(input.gameId, userId, language);

    const sorted = [...input.entries].sort((a, b) => a.idx - b.idx);

    const existing = await db.talkPortrait.findFirst({ where: { gameId: input.gameId } });

    if (existing) {
      await db.talkPortrait.update({ where: { id: existing.id }, data: { data: sorted as unknown as Prisma.InputJsonValue, updatedAt: new Date() } });
    } else {
      await db.talkPortrait.create({ data: { gameId: input.gameId, data: sorted as unknown as Prisma.InputJsonValue } });
    }

    return { gameId: input.gameId, entries: sorted };
  }

  /**
   * 从 INI 导入头像映射
   */
  async importFromIni(
    input: ImportPortraitMapInput,
    userId: string,
    language: Language
  ): Promise<{ gameId: string; entries: PortraitEntry[] }> {
    await verifyGameAccess(input.gameId, userId, language);

    const entries = parsePortraitIni(input.iniContent);

    return this.update(
      {
        gameId: input.gameId,
        entries,
      },
      userId,
      language
    );
  }

  /**
   * 清空头像映射
   */
  async clearAll(
    input: { gameId: string },
    userId: string,
    language: Language
  ): Promise<{ deletedCount: number }> {
    await verifyGameAccess(input.gameId, userId, language);
    const result = await db.talkPortrait.deleteMany({ where: { gameId: input.gameId } });
    return { deletedCount: result.count };
  }
}

export const talkPortraitService = new TalkPortraitService();
