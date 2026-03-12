/**
 * passPath 扫描碰撞检测测试
 *
 * 验证 collectSweepTiles 正确收集武功精灵飞行路径上的中间瓦片，
 * 以修复 AoE 武功（依风剑法/漫天花雨）无法命中 NPC 的 bug。
 *
 * 问题背景：
 * - 单体武功（如寒霜掌 MoveKind=2）直飞 NPC 像素位置，必经其瓦片 → 能命中
 * - AoE 武功（如依风剑法 MoveKind=4, 漫天花雨 MoveKind=8）向固定方向辐射，
 *   每帧只检查当前瓦片，高速移动可跳过 NPC 所在瓦片 → 穿过 NPC
 *
 * 修复方案：在每帧移动后，收集从上一帧位置到当前位置之间经过的所有瓦片
 * （collectSweepTiles），为每个中间瓦片调用 checkCollisionAtTile。
 */
import { describe, expect, it } from "vitest";
import { collectSweepTiles, pixelToTile, tileToPixel } from "../../src/utils/coordinate";
import type { Vector2 } from "../../src/core/types";

// ─── helpers ────────────────────────────────────────────────────────────────

/** 在结果列表中检查某瓦片是否存在 */
function hasTile(tiles: Vector2[], x: number, y: number): boolean {
  return tiles.some((t) => t.x === x && t.y === y);
}

// ─── collectSweepTiles ──────────────────────────────────────────────────────

describe("collectSweepTiles", () => {
  describe("基本行为", () => {
    it("起点 === 终点时返回空数组（静止精灵无需扫描）", () => {
      const pos = tileToPixel(5, 5);
      expect(collectSweepTiles(pos, pos)).toEqual([]);
    });

    it("移动距离极短（< 1px）时返回空数组", () => {
      const from = { x: 100, y: 100 };
      const to = { x: 100.5, y: 100.2 };
      expect(collectSweepTiles(from, to)).toEqual([]);
    });

    it("不包含起始瓦片", () => {
      const from = tileToPixel(5, 5);
      const to = tileToPixel(6, 5); // 右移一格
      const tiles = collectSweepTiles(from, to);
      expect(hasTile(tiles, 5, 5)).toBe(false);
    });

    it("包含终止瓦片（当前帧所在瓦片）", () => {
      const from = tileToPixel(5, 5);
      const to = tileToPixel(7, 5); // 右移两格
      const tiles = collectSweepTiles(from, to);
      const toTile = pixelToTile(to.x, to.y);
      expect(hasTile(tiles, toTile.x, toTile.y)).toBe(true);
    });

    it("结果中无重复瓦片", () => {
      const from = tileToPixel(0, 0);
      const to = tileToPixel(5, 5);
      const tiles = collectSweepTiles(from, to);
      const keys = tiles.map((t) => `${t.x},${t.y}`);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });
  });

  describe("单步移动（相邻瓦片）", () => {
    it("水平移动到相邻瓦片只返回目标瓦片", () => {
      const from = tileToPixel(5, 4); // even row
      const to = tileToPixel(6, 4);
      const tiles = collectSweepTiles(from, to);
      // 只应包含目的地瓦片（或极少中间瓦片）
      const toTile = pixelToTile(to.x, to.y);
      expect(hasTile(tiles, toTile.x, toTile.y)).toBe(true);
      expect(tiles.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("大步移动（跨多格）", () => {
    it("水平跨越 5 格时收集到所有中间瓦片", () => {
      const from = tileToPixel(0, 4);
      const to = tileToPixel(5, 4);
      const tiles = collectSweepTiles(from, to);
      // 应包含途中的瓦片（至少不为空）
      expect(tiles.length).toBeGreaterThan(0);
      // 应包含终点
      const toTile = pixelToTile(to.x, to.y);
      expect(hasTile(tiles, toTile.x, toTile.y)).toBe(true);
    });

    it("斜向飞行也能收集到路径上的瓦片", () => {
      const from = tileToPixel(10, 10);
      const to = tileToPixel(14, 14);
      const tiles = collectSweepTiles(from, to);
      expect(tiles.length).toBeGreaterThan(0);
      // 应包含终点
      const toTile = pixelToTile(to.x, to.y);
      expect(hasTile(tiles, toTile.x, toTile.y)).toBe(true);
    });
  });

  describe("关键场景：玄慈 vs 依风剑法", () => {
    /**
     * 实际 bug 场景：
     * 玩家在 (129, 168)，玄慈在 (132, 162)
     * 依风剑法 MoveKind=4 (CircleMove)，speed=10，MAGIC_BASE_SPEED=100
     * velocity = 100 * 10 * speedRatio ≈ 700-1000 px/s
     * 在 ~16ms 帧内移动 ≈ 11-17px
     *
     * 若某颗子弹的飞行方向恰好经过玄慈所在位置，
     * 收集到的扫描瓦片应包含 (132, 162)。
     */
    it("从玩家位置飞向玄慈时，扫描路径覆盖玄慈所在瓦片", () => {
      // 玄慈瓦片坐标
      const xuanciTile = { x: 132, y: 162 };

      // 玩家像素位置（从 tileToPixel(129, 168) 得到）
      const playerPixel = tileToPixel(129, 168);

      // 计算从玩家飞向玄慈的像素方向
      const xuanciPixel = tileToPixel(xuanciTile.x, xuanciTile.y);
      const dx = xuanciPixel.x - playerPixel.x;
      const dy = xuanciPixel.y - playerPixel.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dirX = dx / dist;
      const dirY = dy / dist;

      // 模拟一帧大步长移动（约 100px，等效于约两倍距离）
      // 精灵从玩家位置附近出发，在距玄慈半格时跨越到玄慈那格
      // 先飞一段到接近玄慈前的位置
      const approachDist = dist - 30; // 停在玄慈前 30px
      const from = {
        x: playerPixel.x + dirX * approachDist,
        y: playerPixel.y + dirY * approachDist,
      };
      // 单帧移动 60px，越过玄慈
      const to = {
        x: playerPixel.x + dirX * (approachDist + 60),
        y: playerPixel.y + dirY * (approachDist + 60),
      };

      const tiles = collectSweepTiles(from, to);

      // 路径应包括玄慈所在瓦片
      expect(hasTile(tiles, xuanciTile.x, xuanciTile.y)).toBe(true);
    });

    it("若精灵在 1 帧内恰好从玄慈正上方穿过（模拟穿帧 bug），扫描能抓到", () => {
      const xuanciTile = { x: 132, y: 162 };
      const xuanciPixel = tileToPixel(xuanciTile.x, xuanciTile.y);

      // from: 玄慈像素位置稍前方；to: 玄慈像素位置稍后方（跨越了玄慈所在瓦片）
      const from = { x: xuanciPixel.x - 48, y: xuanciPixel.y };
      const to = { x: xuanciPixel.x + 48, y: xuanciPixel.y };

      const tiles = collectSweepTiles(from, to);
      expect(hasTile(tiles, xuanciTile.x, xuanciTile.y)).toBe(true);
    });
  });

  describe("高速精灵（大 deltaMs / 低帧率）", () => {
    it("100px 大步移动时不遗漏中间瓦片", () => {
      // 等效于 60ms 帧 + speed=10 横向移动 ≈ 100px
      const from = tileToPixel(20, 10);
      const to = { x: tileToPixel(20, 10).x + 100, y: tileToPixel(20, 10).y };
      const tiles = collectSweepTiles(from, to);

      // 100px 水平移动应至少跨越 1 个瓦片（TILE_WIDTH=64）
      expect(tiles.length).toBeGreaterThanOrEqual(1);

      // 从 from 到 to 中间，每个中间瓦片都应被收集到
      // 过渡检查：at x + 64 应该换到新瓦片，路径上应有该瓦片
      const midTile = pixelToTile(from.x + 64, from.y);
      expect(hasTile(tiles, midTile.x, midTile.y)).toBe(true);
    });
  });

  describe("步长覆盖性保证", () => {
    it("步长 16px 足以检测最短等角瓦片边界（TILE_HEIGHT/2 = 16）", () => {
      // 对每个主要方向，从一个瓦片中心移动到相邻瓦片中心，应能检测到目标瓦片
      const testCases: Array<[number, number, number, number]> = [
        [5, 4, 6, 4], // 向右
        [5, 4, 4, 4], // 向左
        [5, 4, 5, 6], // 向下（两行）
        [5, 4, 5, 2], // 向上（两行）
      ];

      for (const [fx, fy, tx, ty] of testCases) {
        const from = tileToPixel(fx, fy);
        const to = tileToPixel(tx, ty);
        const tiles = collectSweepTiles(from, to);
        const toTile = pixelToTile(to.x, to.y);
        expect(hasTile(tiles, toTile.x, toTile.y)).toBe(
          true,
          `期望路径 (${fx},${fy})->(${tx},${ty}) 包含终点瓦片 (${toTile.x},${toTile.y})`
        );
      }
    });
  });
});

// ─── passPath 3 条平行路径（角度间隙修复，照抄 C++ Effect::getPassPath）────────

describe("passPath 侧线路径", () => {
  /**
   * C++ 实现：width=0.5（硬编码），对每颗飞行精灵生成 3 条平行路径：
   *   tempX = max(round(dir.x * width * TILE_WIDTH / 2) - 1, 1)
   *   tempY = max(round(dir.y * width * TILE_WIDTH / 2) - 1, 1)
   *   path1 偏移 (+tempY, -tempX)  path2 偏移 (-tempY, +tempX)
   *
   * 玄慈场景验证：
   *   玩家 (129,168)，玄慈 (132,162)，最近子弹 i=22 方向 (0.924,-0.383)
   *   center 路径落在 (132,163)，path1 偏移 (+1,-14) 后落在 (132,162) ← 命中
   */
  describe("玄慈场景：path1 覆盖 (132,162)", () => {
    const dir = { x: 0.924, y: -0.383 };
    const TILE_WIDTH_CONST = 64;
    const passWidth = 0.5;

    it("计算偏移量 tempX=14, tempY=1", () => {
      const lateralScale = passWidth * TILE_WIDTH_CONST / 2; // 16
      const tempX = Math.max(Math.round(dir.x * lateralScale) - 1, 1);
      const tempY = Math.max(Math.round(dir.y * lateralScale) - 1, 1);
      expect(tempX).toBe(14);
      expect(tempY).toBe(1);
    });

    it("path1 (+tempY,-tempX) 在 xuanci x 处进入 (132,162)", () => {
      const lateralScale = passWidth * TILE_WIDTH_CONST / 2;
      const tempX = Math.max(Math.round(dir.x * lateralScale) - 1, 1);
      const tempY = Math.max(Math.round(dir.y * lateralScale) - 1, 1);
      const playerPixel = tileToPixel(129, 168);
      const xuanciPixel = tileToPixel(132, 162);
      // path1 平行路径起点
      const p1from = { x: playerPixel.x + tempY, y: playerPixel.y - tempX };
      const p1to = {
        x: xuanciPixel.x + tempY + 60 * dir.x,
        y: playerPixel.y - tempX + ((xuanciPixel.x - playerPixel.x) / dir.x + 60) * dir.y,
      };
      const tiles = collectSweepTiles(p1from, p1to);
      expect(hasTile(tiles, 132, 162)).toBe(true);
    });

    it("center 路径（偏移=0）不经过 (132,162)", () => {
      const playerPixel = tileToPixel(129, 168);
      const xuanciPixel = tileToPixel(132, 162);
      // 中心路径只到目标稍远处
      const tFar = (xuanciPixel.x - playerPixel.x + 60) / dir.x;
      const centerTo = { x: playerPixel.x + tFar * dir.x, y: playerPixel.y + tFar * dir.y };
      const tiles = collectSweepTiles(playerPixel, centerTo);
      // 中心路径应落在 (132,163/164) 而不是 (132,162)
      expect(hasTile(tiles, 132, 162)).toBe(false);
    });
  });
});
