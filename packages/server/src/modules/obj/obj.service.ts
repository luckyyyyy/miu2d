/**
 * Object 服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */

import type {
  BatchImportObjInput,
  BatchImportObjResult,
  CreateObjInput,
  ImportObjInput,
  ListObjInput,
  Obj,
  ObjKind,
  ObjListItem,
  ObjResource,
  UpdateObjInput,
} from "@miu2d/types";
import { createDefaultObj, createDefaultObjResource, ObjKindFromValue } from "@miu2d/types";
import type { Prisma, Obj as PrismaObj } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { db } from "../../db/client";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";
import { requireGameIdBySlug } from "../../utils/game";
import { verifyGameAccess } from "../../utils/gameAccess";
import { objResourceService } from "./objResource.service";

export class ObjService {
  /**
   * 将数据库记录转换为 Obj 类型
   */
  private toObj(row: PrismaObj): Obj {
    const data = row.data as Omit<
      Obj,
      "id" | "gameId" | "key" | "name" | "kind" | "resourceId" | "createdAt" | "updatedAt"
    >;
    return {
      ...data,
      id: row.id,
      gameId: row.gameId,
      key: row.key,
      name: row.name,
      kind: row.kind as Obj["kind"],
      resourceId: row.resourceId ?? null,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * 公开接口：通过 slug 列出游戏的所有 Object（无需认证）
   * 用于游戏客户端加载 Object 数据
   */
  async listPublicByGameId(gameId: string): Promise<Obj[]> {
    const rows = await db.obj.findMany({ where: { gameId }, orderBy: { updatedAt: "desc" } });
    return rows.map((row) => this.toObj(row));
  }

  async listPublicBySlug(gameSlug: string): Promise<Obj[]> {
    return this.listPublicByGameId(await requireGameIdBySlug(gameSlug));
  }

  /**
   * 获取单个 Object
   */
  async get(
    gameId: string,
    objId: string,
    userId: string,
    language: Language
  ): Promise<Obj | null> {
    await verifyGameAccess(gameId, userId, language);

    const row = await db.obj.findFirst({ where: { id: objId, gameId } });

    if (!row) return null;
    return this.toObj(row);
  }

  /**
   * 列出 Object
   */
  async list(input: ListObjInput, userId: string, language: Language): Promise<ObjListItem[]> {
    await verifyGameAccess(input.gameId, userId, language);

    const rows = await db.obj.findMany({
      where: { gameId: input.gameId, ...(input.kind ? { kind: input.kind } : {}) },
      orderBy: { updatedAt: "desc" },
    });

    // 获取关联的资源信息用于显示图标和 resourceKey
    const resourceIds = rows.map((r) => r.resourceId).filter((id): id is string => !!id);
    const resourceMap = new Map<string, { icon: string | null; key: string }>();

    if (resourceIds.length > 0) {
      const resources = await db.objResource.findMany({ where: { id: { in: resourceIds } } });

      for (const res of resources) {
        const data = res.data as { resources?: ObjResource };
        resourceMap.set(res.id, {
          icon: data.resources?.common?.image ?? null,
          key: res.key,
        });
      }
    }

    return rows.map((row) => {
      const data = row.data as Record<string, unknown>;
      const resources = data.resources as ObjResource | undefined;
      const resInfo = row.resourceId ? resourceMap.get(row.resourceId) : null;
      return {
        id: row.id,
        key: row.key,
        name: row.name,
        kind: row.kind as ObjKind,
        objFile: resInfo?.key ?? row.key,
        icon: resInfo?.icon ?? resources?.common?.image ?? null,
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  }

  /**
   * 创建 Object
   */
  async create(input: CreateObjInput, userId: string, language: Language): Promise<Obj> {
    await verifyGameAccess(input.gameId, userId, language);

    const defaultObj = createDefaultObj(input.gameId, input.key);
    const fullObj = {
      ...defaultObj,
      ...input,
    };

    // 分离索引字段和 data 字段
    const { gameId, key, name, kind, resourceId, ...data } = fullObj;

    const row = await db.obj.create({
      data: {
        gameId,
        key,
        name: name ?? "未命名物体",
        kind: kind ?? "Static",
        resourceId: resourceId ?? null,
        data: data as unknown as Prisma.InputJsonValue,
      },
    });

    return this.toObj(row);
  }

  /**
   * 更新 Object
   */
  async update(input: UpdateObjInput, userId: string, language: Language): Promise<Obj> {
    await verifyGameAccess(input.gameId, userId, language);

    // 检查是否存在（直接查 DB，避免重复触发 verifyGameAccess）
    const existingRow = await db.obj.findFirst({ where: { id: input.id, gameId: input.gameId } });
    if (!existingRow) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.obj.notFound"),
      });
    }
    const existing = this.toObj(existingRow);

    // 合并更新
    const { id, gameId, ...inputData } = input;
    const merged = { ...existing, ...inputData };

    // 分离索引字段和 data 字段
    const {
      id: _id,
      gameId: _gameId,
      key,
      name,
      kind,
      resourceId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...data
    } = merged;

    const row = await db.obj.update({
      where: { id },
      data: {
        key,
        name,
        kind,
        resourceId: resourceId ?? null,
        data: data as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return this.toObj(row);
  }

  /**
   * 删除 Object
   */
  async delete(
    gameId: string,
    objId: string,
    userId: string,
    language: Language
  ): Promise<{ id: string }> {
    await verifyGameAccess(gameId, userId, language);

    await db.obj.delete({ where: { id: objId } });

    return { id: objId };
  }

  /**
   * 从 INI 导入 Object
   */
  async importFromIni(input: ImportObjInput, userId: string, language: Language): Promise<Obj> {
    await verifyGameAccess(input.gameId, userId, language);

    if (!input.iniContent) {
      throw new Error("Object 配置内容为空");
    }

    const parsed = this.parseObjIni(input.iniContent);
    let resourceId: string | null = null;

    // 如果有资源配置 INI，创建资源数据并关联
    if (input.objResContent) {
      const resources = this.parseObjResIni(input.objResContent);
      // 从 Obj INI 中解析 ObjFile 字段作为资源的 key
      const objFileField = this.parseObjFileField(input.iniContent);
      const resourceKey = objFileField || input.fileName;
      const resourceName = resourceKey.replace(/\.ini$/i, "");

      const objRes = await objResourceService.upsert(
        input.gameId,
        resourceKey,
        resourceName,
        resources,
        userId,
        language
      );
      resourceId = objRes.id;
    }

    // 使用文件名作为 key
    const key = input.fileName;

    return this.create(
      {
        gameId: input.gameId,
        key,
        name: parsed.name ?? key.replace(/\.ini$/i, ""),
        kind: parsed.kind,
        resourceId,
        ...parsed,
      },
      userId,
      language
    );
  }

  /**
   * 批量导入 Object 和资源（优化版：bulk upsert resources + bulk INSERT objs，一次完成）
   * 支持两种类型：
   * - type="obj": 导入 Object 配置（obj/*.ini），可选关联 objres
   * - type="resource": 导入独立资源配置（objres/*.ini）
   */
  async batchImportFromIni(
    input: BatchImportObjInput,
    userId: string,
    language: Language
  ): Promise<BatchImportObjResult> {
    await verifyGameAccess(input.gameId, userId, language);

    const success: BatchImportObjResult["success"] = [];
    const failed: BatchImportObjResult["failed"] = [];

    // ── 解析阶段（纯内存，无 DB 调用）────────────────────────────────
    type ResInsertRow = {
      gameId: string;
      key: string;
      name: string;
      data: Record<string, unknown>;
    };
    type ObjDbRow = {
      gameId: string;
      key: string;
      name: string;
      kind: string;
      resourceId: string | null;
      data: Record<string, unknown>;
    };

    const resourceRows: ResInsertRow[] = [];
    const resourceKeySet = new Set<string>();
    const resourceOnlyMeta: { fileName: string; resourceKey: string }[] = [];

    const objDbRows: ObjDbRow[] = [];
    const objMeta: {
      fileName: string;
      hasResources: boolean;
      resourceKey: string | null;
      objKey: string;
    }[] = [];

    for (const item of input.items) {
      try {
        const itemType = item.type ?? "obj";

        if (itemType === "resource") {
          if (!item.objResContent) throw new Error("资源配置内容为空");
          const resources = this.parseObjResIni(item.objResContent);
          const resourceKey = item.fileName.toLowerCase();
          const resourceName = item.fileName.replace(/\.ini$/i, "");
          if (!resourceKeySet.has(resourceKey)) {
            resourceRows.push({
              gameId: input.gameId,
              key: resourceKey,
              name: resourceName,
              data: { resources },
            });
            resourceKeySet.add(resourceKey);
          }
          resourceOnlyMeta.push({ fileName: item.fileName, resourceKey });
        } else {
          if (!item.iniContent) throw new Error("Object 配置内容为空");
          const parsed = this.parseObjIni(item.iniContent);
          const hasResources = !!item.objResContent;
          let resourceKey: string | null = null;

          if (item.objResContent) {
            const resources = this.parseObjResIni(item.objResContent);
            const objFileField = this.parseObjFileField(item.iniContent);
            resourceKey = (objFileField || item.fileName).toLowerCase();
            const resourceName = resourceKey.replace(/\.ini$/i, "");
            if (!resourceKeySet.has(resourceKey)) {
              resourceRows.push({
                gameId: input.gameId,
                key: resourceKey,
                name: resourceName,
                data: { resources },
              });
              resourceKeySet.add(resourceKey);
            }
          }

          const objKey = item.fileName;
          const defaultObj = createDefaultObj(input.gameId, objKey);
          const fullObj = { ...defaultObj, ...parsed };
          const { gameId: _g, key: _k, name, kind, resourceId: _r, ...data } = fullObj;

          objDbRows.push({
            gameId: input.gameId,
            key: objKey,
            name: name ?? objKey.replace(/\.ini$/i, ""),
            kind: kind ?? "Static",
            resourceId: null, // 先占位，稍后替换为真实 ID
            data,
          });
          objMeta.push({ fileName: item.fileName, hasResources, resourceKey, objKey });
        }
      } catch (error) {
        failed.push({
          fileName: item.fileName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // ── 批量 upsert objResources（单条 SQL）──────────────────────────
    const keyToResourceId = new Map<string, string>();
    if (resourceRows.length > 0) {
      const objResRowsDeduped = [
        ...new Map(resourceRows.map((r) => [`${r.gameId}::${r.key}`, r])).values(),
      ];
      const upserted = await db.$transaction(
        objResRowsDeduped.map((row) =>
          db.objResource.upsert({
            where: { obj_resources_game_id_key_unique: { gameId: row.gameId, key: row.key } },
            create: {
              gameId: row.gameId,
              key: row.key,
              name: row.name,
              data: row.data as unknown as Prisma.InputJsonValue,
            },
            update: {
              name: row.name,
              data: row.data as unknown as Prisma.InputJsonValue,
              updatedAt: new Date(),
            },
          })
        )
      );
      for (const row of upserted) {
        keyToResourceId.set(row.key, row.id);
      }
    }

    // resource-only 成功项
    for (const { fileName, resourceKey } of resourceOnlyMeta) {
      const id = keyToResourceId.get(resourceKey);
      if (id) {
        success.push({
          fileName,
          id,
          name: resourceKey.replace(/\.ini$/i, ""),
          type: "resource",
          hasResources: true,
        });
      }
    }

    // ── 批量 INSERT objs（单条 SQL）──────────────────────────────────
    if (objDbRows.length > 0) {
      const insertValues = objDbRows.map((row, i) => ({
        ...row,
        resourceId: objMeta[i].resourceKey
          ? (keyToResourceId.get(objMeta[i].resourceKey!) ?? null)
          : null,
      }));

      const insertedObjs = await db.$transaction(
        insertValues.map((row) =>
          db.obj.upsert({
            where: { objs_game_id_key_unique: { gameId: row.gameId, key: row.key } },
            create: {
              gameId: row.gameId,
              key: row.key,
              name: row.name,
              kind: row.kind,
              resourceId: row.resourceId,
              data: row.data as unknown as Prisma.InputJsonValue,
            },
            update: {
              name: row.name,
              kind: row.kind,
              resourceId: row.resourceId,
              data: row.data as unknown as Prisma.InputJsonValue,
              updatedAt: new Date(),
            },
          })
        )
      );

      const keyToObjRow = new Map(insertedObjs.map((r) => [r.key, r]));
      for (const meta of objMeta) {
        const row = keyToObjRow.get(meta.objKey);
        if (row) {
          const obj = this.toObj(row);
          success.push({
            fileName: meta.fileName,
            id: obj.id,
            name: obj.name,
            type: "obj",
            hasResources: meta.hasResources,
          });
        }
      }
    }

    return { success, failed };
  }

  /**
   * 从 Obj INI 中解析 ObjFile 字段
   */
  private parseObjFileField(content: string): string | null {
    const match = content.match(/^\s*ObjFile\s*=\s*(.+?)\s*$/im);
    return match ? match[1].trim() : null;
  }

  /**
   * 解析 Object INI 内容（obj/*.ini）
   */
  private parseObjIni(content: string): Partial<Obj> {
    const result: Partial<Obj> = {};
    const lines = content.split(/\r?\n/);
    let currentSection = "";
    let objFileName: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith(";")) {
        continue;
      }

      const sectionMatch = trimmed.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].toUpperCase();
        continue;
      }

      const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
      if (!kvMatch || currentSection !== "INIT") continue;

      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();

      switch (key) {
        case "ObjName":
          result.name = value;
          break;
        case "ObjFile":
          // 存储原始的 objres 文件名，用于自动关联
          objFileName = value;
          break;
        case "Kind":
          result.kind = ObjKindFromValue[parseInt(value, 10)] ?? "Static";
          break;
        case "Dir":
          result.dir = parseInt(value, 10) || 0;
          break;
        case "Lum":
          result.lum = parseInt(value, 10) || 0;
          break;
        case "Damage":
          result.damage = parseInt(value, 10) || 0;
          break;
        case "Frame":
          result.frame = parseInt(value, 10) || 0;
          break;
        case "Height":
          result.height = parseInt(value, 10) || 0;
          break;
        case "OffX":
          result.offX = parseInt(value, 10) || 0;
          break;
        case "OffY":
          result.offY = parseInt(value, 10) || 0;
          break;
        case "ScriptFile":
          result.scriptFile = value || null;
          break;
        case "ScriptFileRight":
          result.scriptFileRight = value || null;
          break;
        case "CanInteractDirectly":
          result.canInteractDirectly = parseInt(value, 10) || 0;
          break;
        case "ScriptFileJustTouch":
          result.scriptFileJustTouch = parseInt(value, 10) || 0;
          break;
        case "TimerScriptFile":
          result.timerScriptFile = value || null;
          break;
        case "TimerScriptInterval":
          result.timerScriptInterval = parseInt(value, 10) || 3000;
          break;
        case "WavFile":
          result.wavFile = value || null;
          break;
        case "ReviveNpcIni":
          result.reviveNpcIni = value || null;
          break;
        case "MillisecondsToRemove":
          result.millisecondsToRemove = parseInt(value, 10) || 0;
          break;
        // ─── Extension Fields ───
        case "SwitchSound":
          result.switchSound = value || null;
          break;
        case "TriggerRadius":
          result.triggerRadius = parseInt(value, 10) || 0;
          break;
        case "Interval":
          result.interval = parseInt(value, 10) || 0;
          break;
        case "Level":
          result.level = parseInt(value, 10) || 0;
          break;
      }
    }

    return result;
  }

  /**
   * 解析 Object 资源 INI 内容（objres/*.ini）
   */
  private parseObjResIni(content: string): ObjResource {
    const result = createDefaultObjResource();
    const lines = content.split(/\r?\n/);
    let currentSection = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith(";")) {
        continue;
      }

      const sectionMatch = trimmed.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].toLowerCase();
        continue;
      }

      const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
      if (!kvMatch) continue;

      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();

      // 根据 section 名称映射到资源字段
      // 原封不动存储，路径规范化由前端/引擎处理
      const stateKey = currentSection as keyof ObjResource;
      if (stateKey in result) {
        if (key === "Image") {
          result[stateKey] = {
            ...result[stateKey],
            image: value || null,
          };
        } else if (key === "Sound") {
          result[stateKey] = {
            ...result[stateKey],
            sound: value || null,
          };
        }
      }
    }

    return result;
  }

  /**
   * 清空所有 Object 和 Object 资源
   */
  async clearAll(
    input: { gameId: string },
    userId: string,
    language: Language
  ): Promise<{ deletedCount: number }> {
    await verifyGameAccess(input.gameId, userId, language);
    const deletedRes = await db.objResource.deleteMany({ where: { gameId: input.gameId } });
    const deletedObjs = await db.obj.deleteMany({ where: { gameId: input.gameId } });
    return { deletedCount: deletedObjs.count + deletedRes.count };
  }
}

export const objService = new ObjService();
