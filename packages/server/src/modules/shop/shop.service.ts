/**
 * 商店服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */

import type {
  BatchImportShopInput,
  BatchImportShopResult,
  CreateShopInput,
  ImportShopInput,
  ListShopInput,
  Shop,
  ShopItem,
  ShopListItem,
  UpdateShopInput,
} from "@miu2d/types";
import { createDefaultShop } from "@miu2d/types";
import type { Prisma, Shop as PrismaShop } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { db } from "../../db/client";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";
import { requireGameIdBySlug } from "../../utils/game";
import { verifyGameAccess } from "../../utils/gameAccess";

export class ShopService {
  /**
   * 将数据库记录转换为 Shop 类型
   */
  private toShop(row: PrismaShop): Shop {
    const data = row.data as Partial<
      Omit<Shop, "id" | "gameId" | "key" | "name" | "createdAt" | "updatedAt">
    >;
    return {
      id: row.id,
      gameId: row.gameId,
      key: row.key,
      name: row.name,
      numberValid: data.numberValid ?? false,
      buyPercent: data.buyPercent ?? 100,
      recyclePercent: data.recyclePercent ?? 100,
      items: data.items ?? [],
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * 公开接口：通过 gameId 列出游戏的所有商店（无需认证）
   */
  async listPublicByGameId(gameId: string): Promise<Shop[]> {
    const rows = await db.shop.findMany({ where: { gameId }, orderBy: { updatedAt: "desc" } });
    return rows.map((row) => this.toShop(row));
  }

  /**
   * 公开接口：通过 slug 列出游戏的所有商店（无需认证）
   * 用于游戏客户端加载商店数据
   */
  async listPublicBySlug(gameSlug: string): Promise<Shop[]> {
    return this.listPublicByGameId(await requireGameIdBySlug(gameSlug));
  }

  /**
   * 获取单个商店
   */
  async get(
    gameId: string,
    shopId: string,
    userId: string,
    language: Language
  ): Promise<Shop | null> {
    await verifyGameAccess(gameId, userId, language);

    const row = await db.shop.findFirst({ where: { id: shopId, gameId } });

    if (!row) return null;
    return this.toShop(row);
  }

  /**
   * 列出商店
   */
  async list(input: ListShopInput, userId: string, language: Language): Promise<ShopListItem[]> {
    await verifyGameAccess(input.gameId, userId, language);

    const rows = await db.shop.findMany({
      where: { gameId: input.gameId },
      orderBy: { updatedAt: "desc" },
    });

    return rows.map((row) => {
      const data = row.data as Record<string, unknown>;
      const items = (data.items as ShopItem[] | undefined) ?? [];
      return {
        id: row.id,
        key: row.key,
        name: row.name,
        itemCount: items.length,
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  }

  /**
   * 创建商店
   */
  async create(input: CreateShopInput, userId: string, language: Language): Promise<Shop> {
    await verifyGameAccess(input.gameId, userId, language);

    const defaultShop = createDefaultShop(input.gameId, input.key);
    // 过滤掉 undefined 值，避免覆盖 defaultShop 的默认值
    const cleanInput: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v !== undefined) cleanInput[k] = v;
    }
    const fullShop = {
      ...defaultShop,
      ...cleanInput,
    };

    // 分离索引字段和 data 字段
    const { gameId, key, name, ...data } = fullShop;

    const row = await db.shop.create({
      data: {
        gameId,
        key: key.toLowerCase(),
        name,
        data: data as unknown as Prisma.InputJsonValue,
      },
    });

    return this.toShop(row);
  }

  /**
   * 更新商店
   */
  async update(input: UpdateShopInput, userId: string, language: Language): Promise<Shop> {
    await verifyGameAccess(input.gameId, userId, language);

    // 检查是否存在（直接查 DB，避免重复触发 verifyGameAccess）
    const existingRow = await db.shop.findFirst({ where: { id: input.id, gameId: input.gameId } });
    if (!existingRow) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.common.notFound"),
      });
    }
    const existing = this.toShop(existingRow);

    // 合并更新
    const { id, gameId, createdAt, updatedAt, ...inputData } = input;
    const merged = { ...existing, ...inputData };

    // 分离索引字段和 data 字段
    const {
      id: _id,
      gameId: _gameId,
      key,
      name,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...data
    } = merged;

    const row = await db.shop.update({
      where: { id },
      data: {
        key: key.toLowerCase(),
        name,
        data: data as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return this.toShop(row);
  }

  /**
   * 删除商店
   */
  async delete(
    gameId: string,
    shopId: string,
    userId: string,
    language: Language
  ): Promise<{ id: string }> {
    await verifyGameAccess(gameId, userId, language);

    await db.shop.delete({ where: { id: shopId } });

    return { id: shopId };
  }

  /**
   * 从 INI 导入商店
   */
  async importFromIni(input: ImportShopInput, userId: string, language: Language): Promise<Shop> {
    await verifyGameAccess(input.gameId, userId, language);

    const parsed = this.parseIni(input.iniContent);

    // 使用文件名作为 key，去掉扩展名作为 name
    const key = input.fileName;
    const name = input.fileName.replace(/\.ini$/i, "");

    return this.create(
      {
        gameId: input.gameId,
        key,
        name: parsed.name ?? name,
        numberValid: parsed.numberValid,
        buyPercent: parsed.buyPercent,
        recyclePercent: parsed.recyclePercent,
        items: parsed.items,
      },
      userId,
      language
    );
  }

  /**
   * 批量导入商店
   */
  async batchImportFromIni(
    input: BatchImportShopInput,
    userId: string,
    language: Language
  ): Promise<BatchImportShopResult> {
    await verifyGameAccess(input.gameId, userId, language);

    const success: BatchImportShopResult["success"] = [];
    const failed: BatchImportShopResult["failed"] = [];

    // ── 解析阶段（纯内存，无 DB 调用）────────────────────────────────
    type InsertRow = { gameId: string; key: string; name: string; data: Record<string, unknown> };
    const rows: InsertRow[] = [];
    const keyToFileName = new Map<string, string>();

    for (const item of input.items) {
      try {
        const parsed = this.parseIni(item.iniContent);
        const key = item.fileName.toLowerCase();
        const defaultShop = createDefaultShop(input.gameId, key);
        const fullShop = {
          ...defaultShop,
          ...parsed,
          name: parsed.name ?? item.fileName.replace(/\.ini$/i, ""),
        };
        const { gameId: _g, key: _k, name, ...data } = fullShop;
        rows.push({ gameId: input.gameId, key, name: name ?? "", data });
        keyToFileName.set(key, item.fileName);
      } catch (error) {
        failed.push({
          fileName: item.fileName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // ── 批量写入：一次 SQL 替代 N 次串行 INSERT ──────────────────────
    if (rows.length > 0) {
      const upserted = await db.$transaction(
        rows.map((row) =>
          db.shop.upsert({
            where: { shops_game_id_key_unique: { gameId: row.gameId, key: row.key } },
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
        const s = this.toShop(row);
        const fileName = keyToFileName.get(row.key) ?? row.key;
        success.push({ fileName, id: s.id, name: s.name, itemCount: s.items.length });
      }
    }

    return { success, failed };
  }

  /**
   * 解析商店 INI 文件
   *
   * 格式:
   * [Header]
   * Count=N
   * NumberValid=0/1
   * BuyPercent=100
   * RecyclePercent=100
   *
   * [1]
   * IniFile=Good-xxx.ini
   * Number=1
   */
  private parseIni(content: string): {
    name?: string;
    numberValid: boolean;
    buyPercent: number;
    recyclePercent: number;
    items: ShopItem[];
  } {
    const lines = content.split(/\r?\n/);
    let currentSection = "";
    const sections: Record<string, Record<string, string>> = {};

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith(";")) {
        continue;
      }

      const sectionMatch = trimmed.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        if (!sections[currentSection]) {
          sections[currentSection] = {};
        }
        continue;
      }

      const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
      if (kvMatch && currentSection) {
        sections[currentSection][kvMatch[1].trim()] = kvMatch[2].trim();
      }
    }

    // Parse header
    const header = sections.Header || sections.header || {};
    const count = parseInt(header.Count || "0", 10);
    const numberValid = header.NumberValid === "1";
    const buyPercent = header.BuyPercent ? parseInt(header.BuyPercent, 10) : 100;
    const recyclePercent = header.RecyclePercent ? parseInt(header.RecyclePercent, 10) : 100;

    // Parse items
    const items: ShopItem[] = [];
    for (let i = 1; i <= count; i++) {
      const section = sections[i.toString()];
      if (!section) continue;

      const iniFile = section.IniFile || section.inifile || "";
      if (!iniFile) continue;

      let itemCount = -1; // 默认无限
      if (numberValid) {
        itemCount = parseInt(section.Number || "0", 10);
      }

      items.push({
        goodsKey: iniFile.toLowerCase(),
        count: itemCount,
        price: 0,
      });
    }

    return {
      numberValid,
      buyPercent,
      recyclePercent,
      items,
    };
  }

  /**
   * 清空所有商店
   */
  async clearAll(
    input: { gameId: string },
    userId: string,
    language: Language
  ): Promise<{ deletedCount: number }> {
    await verifyGameAccess(input.gameId, userId, language);
    const result = await db.shop.deleteMany({ where: { gameId: input.gameId } });
    return { deletedCount: result.count };
  }
}

export const shopService = new ShopService();
