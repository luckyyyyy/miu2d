/**
 * 一次性迁移脚本：将旧格式存档（magics/xiuLianIndex/bottomSlots/goods/equips）
 * 转换为新格式（magicContainer/goodsContainer）
 *
 * 用法：
 *   cd packages/server && pnpm tsx ../../scripts/migrate-saves-magic-container.ts
 */

import { Pool } from "pg";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../packages/server/.env") });

interface OldMagicItem {
  fileName: string;
  level: number;
  exp: number;
  index: number;
  hideCount?: number;
  isHidden?: boolean;
  lastIndexWhenHide?: number;
}

interface OldGoodsItem {
  fileName: string;
  count: number;
  index?: number;
}

interface NewMagicSaveItem {
  fileName: string;
  level: number;
  exp: number;
  hideCount?: number;
  lastPanelSlot?: number;
}

interface NewMagicContainer {
  panelMagics: (NewMagicSaveItem | null)[];
  xiuLianMagic: NewMagicSaveItem | null;
  bottomMagics: (NewMagicSaveItem | null)[];
  hiddenMagics: NewMagicSaveItem[];
}

interface NewGoodsContainer {
  bagItems: { fileName: string; count: number }[];
  equipItems: ({ fileName: string; count: number } | null)[];
  bottomItems: ({ fileName: string; count: number } | null)[];
}

function migrateData(data: Record<string, unknown>): Record<string, unknown> {
  const magics = (data.magics as OldMagicItem[] | undefined) ?? [];
  const xiuLianIndex = (data.xiuLianIndex as number | undefined) ?? 0;
  const bottomSlots = (data.bottomSlots as (number | null)[] | undefined) ?? [];
  const goods = (data.goods as OldGoodsItem[] | undefined) ?? [];
  const equips = (data.equips as (OldGoodsItem | null)[] | undefined) ?? [];

  // ── 武功容器 ──

  // 找出隐藏武功
  const hiddenMagics: NewMagicSaveItem[] = magics
    .filter((m) => m.isHidden)
    .map((m) => ({
      fileName: m.fileName,
      level: m.level,
      exp: m.exp,
      hideCount: m.hideCount,
      lastPanelSlot: m.lastIndexWhenHide,
    }));

  // 修炼武功（xiuLianIndex>0 时从面板魔法列表取）
  // 兼容旧旧格式：index=61 也表示修炼魔法
  const xiuLianMagicItem = magics.find(
    (m) => !m.isHidden && (m.index === xiuLianIndex && xiuLianIndex > 0 || m.index === 61)
  ) ?? null;

  const xiuLianMagic: NewMagicSaveItem | null = xiuLianMagicItem
    ? { fileName: xiuLianMagicItem.fileName, level: xiuLianMagicItem.level, exp: xiuLianMagicItem.exp }
    : null;

  // 面板武功（排除隐藏和修炼）
  const panelMagicsList = magics.filter(
    (m) => !m.isHidden && m !== xiuLianMagicItem && m.index !== 61
  );

  // 计算面板最大索引（至少 maxIndex，但最小填到 panelMagicsList 中最大的 index）
  const maxIndex = panelMagicsList.reduce((max, m) => Math.max(max, m.index), 0);
  const panelMagics: (NewMagicSaveItem | null)[] = new Array(maxIndex).fill(null);
  for (const m of panelMagicsList) {
    if (m.index >= 1 && m.index <= maxIndex) {
      panelMagics[m.index - 1] = {
        fileName: m.fileName,
        level: m.level,
        exp: m.exp,
        hideCount: m.hideCount !== 1 ? m.hideCount : undefined,
      };
    }
  }

  // 快捷栏武功：从 bottomSlots 引用还原
  const bottomMagics: (NewMagicSaveItem | null)[] = bottomSlots.map((slotIndex) => {
    if (slotIndex == null || slotIndex <= 0) return null;
    const m = magics.find((x) => !x.isHidden && x.index === slotIndex);
    if (!m) return null;
    return { fileName: m.fileName, level: m.level, exp: m.exp };
  });

  const magicContainer: NewMagicContainer = {
    panelMagics,
    xiuLianMagic,
    bottomMagics,
    hiddenMagics,
  };

  // ── 物品容器 ──
  const bagItems = goods.map((g) => ({ fileName: g.fileName, count: g.count }));

  // equips 固定 7 个槽位
  const equipItems: ({ fileName: string; count: number } | null)[] = [];
  for (let i = 0; i < 7; i++) {
    const e = equips[i] ?? null;
    equipItems.push(e ? { fileName: e.fileName, count: e.count ?? 1 } : null);
  }

  // bottomItems 3 个槽位（旧格式无此数据，全部置 null）
  const bottomItems: (null)[] = [null, null, null];

  const goodsContainer: NewGoodsContainer = { bagItems, equipItems, bottomItems };

  // ── 组装新存档数据（移除旧字段）──
  const { magics: _m, xiuLianIndex: _x, bottomSlots: _b, goods: _g, equips: _e, ...rest } = data;
  return { ...rest, magicContainer, goodsContainer };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows } = await pool.query<{ id: string; data: Record<string, unknown> }>(
      "SELECT id, data FROM saves WHERE data ? 'magics' AND NOT (data ? 'magicContainer')"
    );

    console.log(`找到 ${rows.length} 条需要迁移的存档`);
    if (rows.length === 0) {
      console.log("无需迁移，退出");
      return;
    }

    let migrated = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const newData = migrateData(row.data);
        await pool.query("UPDATE saves SET data = $1::jsonb WHERE id = $2", [
          JSON.stringify(newData),
          row.id,
        ]);
        migrated++;
        console.log(`✓ ${row.id}`);
      } catch (err) {
        failed++;
        console.error(`✗ ${row.id}:`, err);
      }
    }

    console.log(`\n迁移完成：成功 ${migrated} 条，失败 ${failed} 条`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("迁移失败:", err);
  process.exit(1);
});
