/**
 * NPC 资源服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */

import type {
  CreateNpcResInput,
  ListNpcResInput,
  NpcRes,
  NpcResListItem,
  NpcResource,
  UpdateNpcResInput,
} from "@miu2d/types";
import { createDefaultNpcResource } from "@miu2d/types";
import type { Prisma } from "@prisma/client";
import type { NpcResource as PrismaNpcResource } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { db } from "../../db/client";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";
import { requireGameIdBySlug } from "../../utils/game";
import { verifyGameAccess } from "../../utils/gameAccess";

export class NpcResourceService {
  /**
   * 将数据库记录转换为 NpcRes 类型
   */
  private toNpcRes(row: PrismaNpcResource): NpcRes {
    const data = row.data as { resources?: NpcResource };
    return {
      id: row.id,
      gameId: row.gameId,
      key: row.key,
      name: row.name,
      resources: data.resources ?? createDefaultNpcResource(),
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * 公开接口：通过 slug 列出游戏的所有 NPC 资源配置（无需认证）
   * 用于游戏客户端加载 NPC 资源数据
   */
  async listPublicByGameId(gameId: string): Promise<NpcRes[]> {
    const rows = await db.npcResource.findMany({ where: { gameId }, orderBy: { updatedAt: "desc" } });
    return rows.map((row) => this.toNpcRes(row));
  }

  async listPublicBySlug(gameSlug: string): Promise<NpcRes[]> {
    return this.listPublicByGameId(await requireGameIdBySlug(gameSlug));
  }

  /**
   * 获取单个 NPC 资源配置
   */
  async get(
    gameId: string,
    id: string,
    userId: string,
    language: Language
  ): Promise<NpcRes | null> {
    await verifyGameAccess(gameId, userId, language);

    const row = await db.npcResource.findFirst({ where: { id, gameId } });

    if (!row) return null;
    return this.toNpcRes(row);
  }

  /**
   * 通过 key 获取 NPC 资源配置
   */
  async getByKey(gameId: string, key: string): Promise<NpcRes | null> {
    const row = await db.npcResource.findFirst({
      where: { key: key.toLowerCase(), gameId },
    });

    if (!row) return null;
    return this.toNpcRes(row);
  }

  /**
   * 列出 NPC 资源配置
   */
  async list(
    input: ListNpcResInput,
    userId: string,
    language: Language
  ): Promise<NpcResListItem[]> {
    await verifyGameAccess(input.gameId, userId, language);

    const rows = await db.npcResource.findMany({
      where: { gameId: input.gameId },
      orderBy: { updatedAt: "desc" },
    });

    return rows.map((row) => {
      const data = row.data as { resources?: NpcResource };
      const resources = data.resources;
      return {
        id: row.id,
        key: row.key,
        name: row.name,
        icon: resources?.stand?.image ?? null,
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  }

  /**
   * 创建 NPC 资源配置
   */
  async create(input: CreateNpcResInput, userId: string, language: Language): Promise<NpcRes> {
    await verifyGameAccess(input.gameId, userId, language);

    const resources = input.resources ?? createDefaultNpcResource();

    const row = await db.npcResource.create({
      data: { gameId: input.gameId, key: input.key.toLowerCase(), name: input.name, data: { resources } as unknown as Prisma.InputJsonValue },
    });

    return this.toNpcRes(row);
  }

  /**
   * 创建或更新 NPC 资源配置（用于导入时）
   */
  async upsert(
    gameId: string,
    key: string,
    name: string,
    resources: NpcResource,
    userId: string,
    language: Language
  ): Promise<NpcRes> {
    await verifyGameAccess(gameId, userId, language);

    const keyLower = key.toLowerCase();

    const row = await db.npcResource.upsert({
      where: { npc_resources_game_id_key_unique: { gameId, key: keyLower } },
      create: { gameId, key: keyLower, name, data: { resources } as unknown as Prisma.InputJsonValue },
      update: { name, data: { resources } as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
    });
    return this.toNpcRes(row);
  }

  /**
   * 更新 NPC 资源配置
   */
  async update(input: UpdateNpcResInput, userId: string, language: Language): Promise<NpcRes> {
    await verifyGameAccess(input.gameId, userId, language);

    // 检查是否存在
    const existing = await this.get(input.gameId, input.id, userId, language);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.npc.notFound"),
      });
    }

    // 合并更新
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.key !== undefined) {
      updateData.key = input.key.toLowerCase();
    }
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.resources !== undefined) {
      updateData.data = { resources: input.resources };
    }

    const row = await db.npcResource.update({
      where: { id: input.id },
      data: updateData,
    });

    return this.toNpcRes(row);
  }

  /**
   * 删除 NPC 资源配置
   */
  async delete(
    gameId: string,
    id: string,
    userId: string,
    language: Language
  ): Promise<{ id: string }> {
    await verifyGameAccess(gameId, userId, language);

    await db.npcResource.delete({ where: { id } });

    return { id };
  }
}

export const npcResourceService = new NpcResourceService();
