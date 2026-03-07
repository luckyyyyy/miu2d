/**
 * 场景服务
 *
 * MMF 地图二进制数据存储在 scenes.mmfData (base64)
 * 解析后的 mapParsed (MiuMapDataDto) 在 API 响应中按需计算
 * 其他数据（脚本/陷阱/NPC/OBJ）解析为 JSON 存储在 scene.data 字段
 */

import type {
  ClearAllScenesInput,
  ClearAllScenesResult,
  CreateSceneInput,
  ImportSceneBatchInput,
  ImportSceneBatchResult,
  ListSceneInput,
  Scene,
  SceneData,
  SceneListItem,
  SceneNpcEntry,
  SceneObjEntry,
  UpdateSceneInput,
} from "@miu2d/types";
import { getSceneDataCounts } from "@miu2d/types";
import { Prisma } from "@prisma/client";
import type { Scene as PrismaScene } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { db } from "../../db/client";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";
import { getGameIdBySlug } from "../../utils/game";
import { verifyGameAccess } from "../../utils/gameAccess";
import { parseMmfToDto, serializeDtoToMmf } from "./mmf-helper";

export class SceneService {
  /**
   * 将数据库记录转换为 Scene 类型
   */
  private toScene(row: PrismaScene): Scene {
    const mmfData = row.mmfData ?? null;
    // 按需解析 MMF 二进制为结构化 DTO
    const mapParsed = mmfData ? parseMmfToDto(mmfData) : null;
    return {
      id: row.id,
      gameId: row.gameId,
      key: row.key,
      name: row.name,
      mapFileName: row.mapFileName,
      mmfData: null, // 不再返回原始二进制，前端使用 mapParsed
      mapParsed,
      data: (row.data as Record<string, unknown>) ?? null,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  // ============= 场景 CRUD =============

  /**
   * 列出场景（从 scene.data 计算子项统计）
   */
  async list(input: ListSceneInput, userId: string, language: Language): Promise<SceneListItem[]> {
    await verifyGameAccess(input.gameId, userId, language);

    const rows = await db.scene.findMany({ where: { gameId: input.gameId }, orderBy: { key: "asc" } });

    return rows.map((row) => {
      const data = (row.data ?? {}) as SceneData;
      const counts = getSceneDataCounts(data);
      return {
        id: row.id,
        key: row.key,
        name: row.name,
        mapFileName: row.mapFileName,
        ...counts,
        scriptKeys: data.scripts ? Object.keys(data.scripts) : [],
        trapKeys: data.traps ? Object.keys(data.traps) : [],
        npcKeys: data.npc ? Object.keys(data.npc) : [],
        objKeys: data.obj ? Object.keys(data.obj) : [],
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  }

  /**
   * 获取单个场景
   */
  async get(
    gameId: string,
    sceneId: string,
    userId: string,
    language: Language
  ): Promise<Scene | null> {
    await verifyGameAccess(gameId, userId, language);

    const row = await db.scene.findFirst({ where: { id: sceneId, gameId } });

    if (!row) return null;
    return this.toScene(row);
  }

  /**
   * 创建场景
   */
  async create(input: CreateSceneInput, userId: string, language: Language): Promise<Scene> {
    await verifyGameAccess(input.gameId, userId, language);

    const row = await db.scene.create({
      data: {
        gameId: input.gameId,
        key: input.key,
        name: input.name,
        mapFileName: input.mapFileName,
        data: (input.data ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    return this.toScene(row);
  }

  /**
   * 更新场景
   */
  async update(input: UpdateSceneInput, userId: string, language: Language): Promise<Scene> {
    await verifyGameAccess(input.gameId, userId, language);

    const existing = await this.get(input.gameId, input.id, userId, language);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.scene.notFound"),
      });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.data !== undefined) updates.data = input.data;

    // 如果前端发送了 mapParsed 更新，序列化回二进制存储
    if (input.mapParsed !== undefined && input.mapParsed !== null) {
      updates.mmfData = serializeDtoToMmf(input.mapParsed);
    }

    const row = await db.scene.update({ where: { id: input.id }, data: updates });

    return this.toScene(row);
  }

  /**
   * 删除场景
   */
  async delete(
    gameId: string,
    sceneId: string,
    userId: string,
    language: Language
  ): Promise<{ id: string }> {
    await verifyGameAccess(gameId, userId, language);

    const existing = await db.scene.findFirst({ where: { id: sceneId, gameId } });
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.scene.notFound"),
      });
    }
    await db.scene.delete({ where: { id: sceneId } });

    return { id: sceneId };
  }

  // ============= 批量导入（逐条） =============

  /**
   * 导入单个场景（前端已解析好全部数据）
   * 包含 MMF base64 + scripts/traps/npc/obj
   */
  async importScene(
    input: ImportSceneBatchInput,
    userId: string,
    language: Language
  ): Promise<ImportSceneBatchResult> {
    await verifyGameAccess(input.gameId, userId, language);

    const { scene } = input;

    try {
      // 若 MMF 的 trapTable 为空且前端提供了 trapOverrides，则重建 trapTable 并重新序列化
      let mmfData = scene.mmfData;
      if (mmfData && scene.trapOverrides && Object.keys(scene.trapOverrides).length > 0) {
        const parsed = parseMmfToDto(mmfData);
        if (parsed && parsed.trapTable.length === 0) {
          parsed.trapTable = Object.entries(scene.trapOverrides).map(([idx, scriptPath]) => ({
            trapIndex: parseInt(idx, 10),
            scriptPath,
          }));
          mmfData = serializeDtoToMmf(parsed);
        }
      }

      // 检查是否已存在
      const existing = await db.scene.findFirst({ where: { gameId: input.gameId, key: scene.key } });

      if (existing) {
        // 更新现有场景
        await db.scene.update({
          where: { id: existing.id },
          data: {
            name: scene.name,
            mapFileName: scene.mapFileName,
            mmfData,
            data: scene.data as unknown as Prisma.InputJsonValue,
            updatedAt: new Date(),
          },
        });

        return { ok: true, action: "updated", sceneName: scene.name };
      }

      // 创建新场景
      await db.scene.create({
        data: {
          gameId: input.gameId,
          key: scene.key,
          name: scene.name,
          mapFileName: scene.mapFileName,
          mmfData,
          data: scene.data as unknown as Prisma.InputJsonValue,
        },
      });

      return { ok: true, action: "created", sceneName: scene.name };
    } catch (e) {
      return {
        ok: false,
        action: "error",
        sceneName: scene.name,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // ============= 清空所有场景 =============

  /**
   * 清空指定游戏的所有场景数据
   */
  async clearAll(
    input: ClearAllScenesInput,
    userId: string,
    language: Language
  ): Promise<ClearAllScenesResult> {
    await verifyGameAccess(input.gameId, userId, language);

    const result = await db.scene.deleteMany({ where: { gameId: input.gameId } });

    return { deletedCount: result.count };
  }

  // ============= 公开 REST API（无需认证） =============

  /**
   * 获取 MMF 地图二进制数据（公开接口）
   *
   * 从 scenes.mmfData (base64) 解码为 Buffer 直接返回
   */
  async getMmfBinaryBySlug(gameSlug: string, sceneKey: string): Promise<Buffer | null> {
    const gameId = await getGameIdBySlug(gameSlug);
    if (!gameId) return null;

    const row = await db.scene.findFirst({ where: { gameId, key: sceneKey }, select: { mmfData: true } });

    if (!row?.mmfData) return null;
    return Buffer.from(row.mmfData, "base64");
  }

  /**
   * 获取 NPC 条目数据（公开接口）
   *
   * 从指定场景的 data.npc 中查找 npcKey，
   * 直接返回 SceneNpcEntry[] JSON 数组
   */
  async getNpcEntriesBySlug(
    gameSlug: string,
    sceneKey: string,
    npcKey: string
  ): Promise<SceneNpcEntry[] | null> {
    const gameId = await getGameIdBySlug(gameSlug);
    if (!gameId) return null;

    const row = await db.scene.findFirst({ where: { gameId, key: sceneKey }, select: { data: true } });

    if (!row) return null;
    const data = row.data as SceneData | null;
    const npcData =
      data?.npc?.[npcKey] ??
      data?.npc?.[npcKey.toLowerCase()] ??
      Object.entries(data?.npc ?? {}).find(
        ([k]) => k.toLowerCase() === npcKey.toLowerCase()
      )?.[1];
    if (npcData?.entries) {
      return npcData.entries;
    }
    return null;
  }

  /**
   * 获取 OBJ 条目数据（公开接口）
   *
   * 从指定场景的 data.obj 中查找 objKey，
   * 直接返回 SceneObjEntry[] JSON 数组
   */
  async getObjEntriesBySlug(
    gameSlug: string,
    sceneKey: string,
    objKey: string
  ): Promise<SceneObjEntry[] | null> {
    const gameId = await getGameIdBySlug(gameSlug);
    if (!gameId) return null;

    const row = await db.scene.findFirst({ where: { gameId, key: sceneKey }, select: { data: true } });

    if (!row) return null;
    const data = row.data as SceneData | null;
    const objData =
      data?.obj?.[objKey] ??
      data?.obj?.[objKey.toLowerCase()] ??
      Object.entries(data?.obj ?? {}).find(
        ([k]) => k.toLowerCase() === objKey.toLowerCase()
      )?.[1];
    if (objData?.entries) {
      return objData.entries;
    }
    return null;
  }
}

export const sceneService = new SceneService();
