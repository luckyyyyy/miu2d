/**
 * LumMask - 局部光照系统
 *
 * 当 mainLum < 31（场景变暗）时，发光物体（Obj/NPC/武功精灵）
 * 会在其位置绘制一个径向渐变光晕，使用 additive blend 叠加，
 * 视觉上"照亮"周围区域。
 *
 * C++ reference:
 * - Weather::drawElementLum() (Weather.cpp:88)
 * - EngineBase::createLumMask() (EngineBase.cpp:804)
 * - Effect::getLum() (Effect.cpp:283)
 *
 * C++ 常量：
 * - LUM_MASK_WIDTH = 800, LUM_MASK_HEIGHT = 400
 * - LUM_MASK_MAX_ALPHA = 80 (白色最大 alpha ~31%)
 * - 径向距离 0.5 内有效，超过全透明
 * - SDL_BLENDMODE_ADD 加法混合
 */

import type { MagicSprite } from "../magic/magic-sprite";
import type { Npc } from "../npc/npc";
import type { Obj } from "../obj/obj";
import type { Renderer } from "./renderer";

/** 光照蒙版宽高（与 C++ 一致） */
const LUM_MASK_WIDTH = 800;
const LUM_MASK_HEIGHT = 400;
/** 最大 alpha 值（0-255 范围，C++ LUM_MASK_MAX_ALPHA = 80） */
const LUM_MASK_MAX_ALPHA = 80;

/** 缓存的光照蒙版 canvas */
let lumMaskCanvas: OffscreenCanvas | null = null;

/**
 * 创建椭圆形径向渐变光照蒙版
 *
 * C++ ref: EngineBase::createLumMask()
 * 生成白色径向渐变：中心 alpha=LUM_MASK_MAX_ALPHA，半径 0.5 处衰减到 0
 * 超过 0.5 的区域全透明
 */
function createLumMask(): OffscreenCanvas {
  const canvas = new OffscreenCanvas(LUM_MASK_WIDTH, LUM_MASK_HEIGHT);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // 使用径向渐变模拟椭圆形光晕
  // C++ 原始算法: distance = abs(hypot(dy/(H/2), dx/(W/2)))
  // 在 Canvas 中，先缩放坐标系让椭圆变成圆，再用径向渐变
  const cx = LUM_MASK_WIDTH / 2;
  const cy = LUM_MASK_HEIGHT / 2;

  // 创建径向渐变（归一化到单位圆）
  // 使用变换让 800x400 矩形映射成圆形渐变
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(LUM_MASK_WIDTH / 2, LUM_MASK_HEIGHT / 2);

  // 渐变半径 0 → 0.5（有效范围），0.5 → 1.0（全透明）
  // C++ 公式: alpha = (0.5 - distance) * LUM_MASK_MAX_ALPHA
  // 在中心 distance=0 时 alpha = 0.5 * 80 = 40，不是 80
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  const centerAlphaNorm = (0.5 * LUM_MASK_MAX_ALPHA) / 255;
  gradient.addColorStop(0, `rgba(255, 255, 255, ${centerAlphaNorm})`);
  gradient.addColorStop(0.5, `rgba(255, 255, 255, 0)`);
  gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return canvas;
}

/**
 * 获取（或创建）光照蒙版 canvas
 */
function getLumMask(): OffscreenCanvas {
  if (!lumMaskCanvas) {
    lumMaskCanvas = createLumMask();
  }
  return lumMaskCanvas;
}

/** 发光元素的屏幕位置信息 */
interface LumSource {
  /** 屏幕 X 坐标（元素像素位置 - 相机偏移） */
  screenX: number;
  /** 屏幕 Y 坐标 */
  screenY: number;
}

/**
 * 绘制局部光照效果
 *
 * C++ ref: Weather::drawElementLum()
 * 在 mainLum < 31 时，遍历所有可见的 Obj、NPC 和武功精灵，
 * 如果它们的 lum > mainLum，就在其位置绘制白色径向渐变（加法混合），
 * 从而在暗色遮罩上产生局部照明效果。
 *
 * 调用时机：在 drawDarkOverlay() 之后、drawFade() 之前
 *
 * @param renderer 渲染器
 * @param mainLum 当前场景亮度等级 (0-32)
 * @param cameraX 相机 X 偏移
 * @param cameraY 相机 Y 偏移
 * @param objsInView 可见物体列表
 * @param npcsInView 可见 NPC 列表
 * @param magicSprites 活跃的武功精灵
 * @param effectSprites 活跃的特效精灵
 */
export function drawElementLum(
  renderer: Renderer,
  mainLum: number,
  cameraX: number,
  cameraY: number,
  objsInView: readonly Obj[],
  npcsInView: readonly Npc[],
  magicSprites: Map<number, MagicSprite>,
  effectSprites: Map<number, MagicSprite>
): void {
  // mainLum >= 31 表示全亮，不需要光照效果
  if (mainLum >= 31) return;

  // C++ ref: Weather::drawElementLum()
  // C++ 按 tile 遍历，每个 tile 最多绘制一个 lumMask（break 跳出循环）。
  // 这样即使 CircleMove 技能（如依风剑法）在多个 tile 上各有精灵，
  // 也不会因为同一 tile 上的多个精灵叠加导致过亮。
  // 我们用 Set<tileKey> 去重模拟同样的"每 tile 最多一次"行为。
  const drawnTiles = new Set<string>();
  const lumSources: LumSource[] = [];

  const tryAdd = (tileX: number, tileY: number, screenX: number, screenY: number): void => {
    const key = `${tileX},${tileY}`;
    if (drawnTiles.has(key)) return;
    drawnTiles.add(key);
    lumSources.push({ screenX, screenY });
  };

  // 检查可见物体
  for (const obj of objsInView) {
    if (obj.lum > mainLum) {
      const tile = obj.tilePosition;
      const pos = obj.positionInWorld;
      tryAdd(tile.x, tile.y, pos.x - cameraX, pos.y - cameraY);
    }
  }

  // 检查可见 NPC
  for (const npc of npcsInView) {
    if (npc.lum > mainLum) {
      const tile = npc.tilePosition;
      const pos = npc.pixelPosition;
      tryAdd(tile.x, tile.y, pos.x - cameraX, pos.y - cameraY);
    }
  }

  // 检查武功精灵
  for (const [, sprite] of magicSprites) {
    if (sprite.getLum() > mainLum) {
      const tile = sprite.tilePosition;
      const pos = sprite.position;
      tryAdd(tile.x, tile.y, pos.x - cameraX, pos.y - cameraY);
    }
  }

  // 检查特效精灵
  for (const [, sprite] of effectSprites) {
    if (sprite.getLum() > mainLum) {
      const tile = sprite.tilePosition;
      const pos = sprite.position;
      tryAdd(tile.x, tile.y, pos.x - cameraX, pos.y - cameraY);
    }
  }

  if (lumSources.length === 0) return;

  // 获取光照蒙版
  const mask = getLumMask();

  // 使用加法混合绘制光照（与 C++ SDL_BLENDMODE_ADD 一致）
  renderer.save();
  renderer.setBlendMode("additive");

  for (const src of lumSources) {
    // C++ ref: engine->drawImage(lumMask, pos.x - LUM_MASK_WIDTH/2, pos.y - LUM_MASK_HEIGHT/2 - TILE_HEIGHT/2)
    // TILE_HEIGHT = 32 in the C++ code
    const drawX = src.screenX - LUM_MASK_WIDTH / 2;
    const drawY = src.screenY - LUM_MASK_HEIGHT / 2 - 16; // 向上偏移半个 tile 高
    renderer.drawSource(mask, drawX, drawY);
  }

  renderer.restore();
}
