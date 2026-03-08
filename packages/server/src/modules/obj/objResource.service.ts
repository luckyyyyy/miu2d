/**
 * Object 资源服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */

import type {
  CreateObjResInput,
  ListObjResInput,
  ObjRes,
  ObjResListItem,
  ObjResource,
  UpdateObjResInput,
} from "@miu2d/types";
import { createDefaultObjResource } from "@miu2d/types";
import type { Prisma } from "@prisma/client";
import type { ObjResource as PrismaObjResource } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { db } from "../../db/client";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";
import { requireGameIdBySlug } from "../../utils/game";
import { verifyGameAccess } from "../../utils/gameAccess";

export class ObjResourceService {
  /**
   * 将数据库记录转换为 ObjRes 类型
   */
  private toObjRes(row: PrismaObjResource): ObjRes {
    const data = row.data as { resources?: ObjResource };
    return {
      id: row.id,
      gameId: row.gameId,
      key: row.key,
      name: row.name,
      resources: data.resources ?? createDefaultObjResource(),
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * 公开接口：通过 slug 列出游戏的所有 Object 资源配置（无需认证）
   * 用于游戏客户端加载 Object 资源数据
   */
  async listPublicByGameId(gameId: string): Promise<ObjRes[]> {
    const rows = await db.objResource.findMany({ where: { gameId }, orderBy: { updatedAt: "desc" } });
    return rows.map((row) => this.toObjRes(row));
  }

  async listPublicBySlug(gameSlug: string): Promise<ObjRes[]> {
    return this.listPublicByGameId(await requireGameIdBySlug(gameSlug));
  }

  /**
   * 获取单个 Object 资源配置
   */
  async get(
    gameId: string,
    id: string,
    userId: string,
    language: Language
  ): Promise<ObjRes | null> {
    await verifyGameAccess(gameId, userId, language);

    const row = await db.objResource.findFirst({ where: { id, gameId } });

    if (!row) return null;
    return this.toObjRes(row);
  }

  /**
   * 通过 key 获取 Object 资源配置
   */
  async getByKey(gameId: string, key: string): Promise<ObjRes | null> {
    const row = await db.objResource.findFirst({
      where: { key: key.toLowerCase(), gameId },
    });

    if (!row) return null;
    return this.toObjRes(row);
  }

  /**
   * 列出 Object 资源配置
   */
  async list(
    input: ListObjResInput,
    userId: string,
    language: Language
  ): Promise<ObjResListItem[]> {
    await verifyGameAccess(input.gameId, userId, language);

    const rows = await db.objResource.findMany({
      where: { gameId: input.gameId },
      orderBy: { updatedAt: "desc" },
    });

    return rows.map((row) => {
      const data = row.data as { resources?: ObjResource };
      const resources = data.resources;
      return {
        id: row.id,
        key: row.key,
        name: row.name,
        icon: resources?.common?.image ?? null,
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  }

  /**
   * 创建 Object 资源配置
   */
  async create(input: CreateObjResInput, userId: string, language: Language): Promise<ObjRes> {
    await verifyGameAccess(input.gameId, userId, language);

    const resources = input.resources ?? createDefaultObjResource();

    const row = await db.objResource.create({
      data: { gameId: input.gameId, key: input.key.toLowerCase(), name: input.name, data: { resources } as unknown as Prisma.InputJsonValue },
    });

    return this.toObjRes(row);
  }

  /**
   * 创建或更新 Object 资源配置（用于导入时）
   */
  async upsert(
    gameId: string,
    key: string,
    name: string,
    resources: ObjResource,
    userId: string,
    language: Language
  ): Promise<ObjRes> {
    await verifyGameAccess(gameId, userId, language);

    const keyLower = key.toLowerCase();

    const row = await db.objResource.upsert({
      where: { obj_resources_game_id_key_unique: { gameId, key: keyLower } },
      create: { gameId, key: keyLower, name, data: { resources } as unknown as Prisma.InputJsonValue },
      update: { name, data: { resources } as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
    });

    return this.toObjRes(row);
  }

  /**
   * 更新 Object 资源配置
   */
  async update(input: UpdateObjResInput, userId: string, language: Language): Promise<ObjRes> {
    await verifyGameAccess(input.gameId, userId, language);

    // 检查是否存在
    const existing = await this.get(input.gameId, input.id, userId, language);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.obj.notFound"),
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

    const row = await db.objResource.update({
      where: { id: input.id },
      data: updateData,
    });

    return this.toObjRes(row);
  }

  /**
   * 删除 Object 资源配置
   */
  async delete(
    gameId: string,
    id: string,
    userId: string,
    language: Language
  ): Promise<{ id: string }> {
    await verifyGameAccess(gameId, userId, language);

    await db.objResource.delete({ where: { id } });

    return { id };
  }
}

export const objResourceService = new ObjResourceService();
