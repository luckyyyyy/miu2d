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
  SceneManifest,
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
import { batchCheckPaths } from "../../utils/file";
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

    // 检查是否存在（直接查 DB，避免重复触发 verifyGameAccess）
    const existing = await db.scene.findFirst({ where: { id: input.id, gameId: input.gameId }, select: { id: true } });
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

  /**
   * 获取场景资源清单（公开接口）
   *
   * 返回：
   * - tiles: 地图瓦片 MSF 路径列表（来自 MMF msfEntries，全部在 DB 中定义）
   * - missing: 已知不存在于文件存储的精灵 MSF 路径（客户端可跳过请求）
   *
   * 缓存策略：HTTP Cache-Control max-age=30（短 TTL，后台修改 NPC/OBJ 后最多延迟 30 秒）
   */
  async getSceneManifestBySlug(gameSlug: string, sceneKey: string): Promise<SceneManifest | null> {
    const gameId = await getGameIdBySlug(gameSlug);
    if (!gameId) return null;

    const row = await db.scene.findFirst({
      where: { gameId, key: sceneKey },
      select: { mmfData: true, data: true, mapFileName: true },
    });
    if (!row) return null;

    // 1. 从 MMF 提取瓦片列表
    const tiles: string[] = [];
    if (row.mmfData && row.mapFileName) {
      const dto = parseMmfToDto(row.mmfData);
      if (dto) {
        const mapName = row.mapFileName.replace(/\.(mmf|map)$/i, "");
        for (const entry of dto.msfEntries) {
          tiles.push(`msf/map/${mapName}/${entry.name}`);
        }
      }
    }

    // 2. 收集场景里所有 NPC/OBJ 引用的精灵候选路径
    const sceneData = row.data as SceneData | null;
    const candidatePaths = new Set<string>();

    if (sceneData?.npc) {
      // 收集所有 npcIni 键（去重）
      const npcIniKeys = new Set<string>();
      for (const npcData of Object.values(sceneData.npc)) {
        for (const entry of npcData.entries) {
          if (entry.npcIni) npcIniKeys.add(entry.npcIni.toLowerCase());
        }
      }

      if (npcIniKeys.size > 0) {
        const npcResRows = await db.npcResource.findMany({
          where: { gameId, key: { in: [...npcIniKeys] } },
          select: { data: true },
        });

        for (const resRow of npcResRows) {
          const resources = (resRow.data as { resources?: Record<string, { image?: string | null }> })?.resources;
          if (!resources) continue;
          for (const stateRes of Object.values(resources)) {
            const img = stateRes?.image;
            if (!img) continue;
            // 如果已含路径前缀（asf/ 或 mpc/ 开头），直接转为 .msf
            const lower = img.toLowerCase().replace(/\.(asf|mpc)$/i, ".msf");
            if (lower.startsWith("asf/") || lower.startsWith("mpc/")) {
              candidatePaths.add(lower);
            } else {
              // 裸名：character 和 interlude 两个候选
              const name = img.replace(/\.(asf|mpc)$/i, ".msf").toLowerCase();
              candidatePaths.add(`asf/character/${name}`);
              candidatePaths.add(`asf/interlude/${name}`);
            }
          }
        }
      }
    }

    if (sceneData?.obj) {
      const objIniKeys = new Set<string>();
      for (const objData of Object.values(sceneData.obj)) {
        for (const entry of objData.entries) {
          if (entry.objFile) objIniKeys.add(entry.objFile.toLowerCase());
        }
      }

      if (objIniKeys.size > 0) {
        const objResRows = await db.objResource.findMany({
          where: { gameId, key: { in: [...objIniKeys] } },
          select: { data: true },
        });

        for (const resRow of objResRows) {
          const resources = (resRow.data as { resources?: Record<string, { image?: string | null }> })?.resources;
          if (!resources) continue;
          for (const stateRes of Object.values(resources)) {
            const img = stateRes?.image;
            if (!img) continue;
            const lower = img.toLowerCase().replace(/\.(asf|mpc)$/i, ".msf");
            if (lower.startsWith("asf/") || lower.startsWith("mpc/")) {
              candidatePaths.add(lower);
            } else {
              const name = img.replace(/\.(asf|mpc)$/i, ".msf").toLowerCase();
              candidatePaths.add(`asf/object/${name}`);
              candidatePaths.add(`asf/effect/${name}`);
            }
          }
        }
      }
    }

    // 3. 批量检查候选路径，找出缺失的
    const missing: string[] = [];
    if (candidatePaths.size > 0) {
      const existingPaths = await batchCheckPaths(gameId, [...candidatePaths]);
      for (const candidate of candidatePaths) {
        if (!existingPaths.has(candidate)) {
          missing.push(candidate);
        }
      }
    }

    // 4. 脚本与陷阱脚本分字段下发，引擎分别预热到 parsedCache
    const scripts: Record<string, string> = sceneData?.scripts ?? {};
    const traps: Record<string, string> = sceneData?.traps ?? {};

    return { tiles, missing, scripts, traps };
  }
}

export const sceneService = new SceneService();
