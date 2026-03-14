/**
 * LumMask - 局部光照系统
 *
 * 使用 off-screen 光照缓冲实现逐光源光照合成：
 *
 * 1. 创建与屏幕等大的 OffscreenCanvas（每帧复用）
 * 2. 用环境暗色填满缓冲（对应 mainLum + mapTime 的颜色调）
 * 3. 对每个发光物体，用 additive 在缓冲内叠加白色椭圆渐变
 *    → 光源正下方缓冲趋近 rgb(255,255,255)
 * 4. 将缓冲以 multiply 混合绘制到主 canvas
 *    out = scene × buffer
 *    → 无光处：scene × dark_tint（与 SetMapTime 暗化效果相同）
 *    → 光源处：scene × white = scene（颜色完全还原）
 *    → 过渡带：平滑插值
 *
 * 这替代了旧的两步方案（drawDarkOverlay + drawElementLum），
 * 使光照"融合"而非"叠加"。
 *
 * C++ reference:
 * - Weather::drawElementLum() (Weather.cpp:88)
 * - EngineBase::createLumMask() (EngineBase.cpp:804)
 */

import type { MagicSprite } from "../magic/magic-sprite";
import type { Npc } from "../npc/npc";
import type { Obj } from "../obj/obj";
import type { Renderer } from "./renderer";

/** 光照蒙版宽高（与 C++ 一致） */
const LUM_MASK_WIDTH = 800;
const LUM_MASK_HEIGHT = 400;

/** 发光元素的屏幕位置信息 */
interface LumSource {
  screenX: number;
  screenY: number;
}

// ============= 环境暗色计算（与 screen-effects.ts mainLumMultiplyColor 保持一致）=============

/**
 * 计算当前 mainLum + mapTime 对应的 multiply 暗色
 * 返回 null 表示场景全亮（mainLum >= 31），无需光照 pass
 */
export function computeAmbientDarkColor(
  mainLum: number,
  mapTime: number
): { r: number; g: number; b: number } | null {
  if (mainLum >= 31) return null;
  const br = ((mainLum + 1) * 7 + 32) / 255;
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  switch (mapTime) {
    case 1:
      return { r: c(br * 0.55), g: c(br * 0.82), b: c(br * 1.0) }; // 夜晚：青蓝
    case 2:
      return { r: c(br * 1.0), g: c(br * 0.82), b: c(br * 0.55) }; // 黄昏：暖琥珀
    case 3:
      return { r: c(br * 0.8), g: c(br * 0.75), b: c(br * 1.0) }; // 黎明：紫色
    default:
      return { r: c(br), g: c(br), b: c(br) }; // 白天：中性暗
  }
}

// ============= 光晕资源（按光晕峰值色缓存）=============

/**
 * 缓存：key = `${r},${g},${b}`，value = OffscreenCanvas
 *
 * glow 峰值色由调用方传入（= tint - combinedDark），additive 叠加后
 * buffer 在光源中心刚好到 tint，过渡区平滑插值，无 overshoot。
 *
 * 组合数极少（< 32 × 4 × tint 种类），缓存大小可接受。
 */
const lightGlowCache = new Map<string, OffscreenCanvas>();

/**
 * 创建椭圆渐变光晕
 * 中心颜色 = (gr, gg, gb) alpha=1，边缘 alpha=0
 */
function createLightGlow(gr: number, gg: number, gb: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(LUM_MASK_WIDTH, LUM_MASK_HEIGHT);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const cx = LUM_MASK_WIDTH / 2;
  const cy = LUM_MASK_HEIGHT / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(LUM_MASK_WIDTH / 2, LUM_MASK_HEIGHT / 2);

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, 1.0)`);
  gradient.addColorStop(0.5, `rgba(${gr}, ${gg}, ${gb}, 0)`);
  gradient.addColorStop(1, `rgba(${gr}, ${gg}, ${gb}, 0)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return canvas;
}

function getLightGlow(glow: { r: number; g: number; b: number }): OffscreenCanvas {
  const key = `${glow.r},${glow.g},${glow.b}`;
  let canvas = lightGlowCache.get(key);
  if (!canvas) {
    canvas = createLightGlow(glow.r, glow.g, glow.b);
    lightGlowCache.set(key, canvas);
  }
  return canvas;
}

// ============= 光照缓冲（每帧复用，尺寸变化时重建）=============

let lightingBufferCanvas: OffscreenCanvas | null = null;
let lightingBufferW = 0;
let lightingBufferH = 0;

function getLightingBuffer(width: number, height: number): OffscreenCanvas {
  if (!lightingBufferCanvas || lightingBufferW !== width || lightingBufferH !== height) {
    lightingBufferCanvas = new OffscreenCanvas(width, height);
    lightingBufferW = width;
    lightingBufferH = height;
  }
  return lightingBufferCanvas;
}

// ============= 光照收集工具 =============

function collectLumSources(
  mainLum: number,
  mapTime: number,
  cameraX: number,
  cameraY: number,
  objsInView: readonly Obj[],
  npcsInView: readonly Npc[],
  magicSprites: Map<number, MagicSprite>,
  effectSprites: Map<number, MagicSprite>,
  playerLum: number,
  playerTile: { x: number; y: number } | null,
  playerPixel: { x: number; y: number } | null
): LumSource[] {
  // 每个 tile 最多绘制一次光晕（与 C++ break 行为一致，防止同 tile 多精灵叠亮）
  const drawnTiles = new Set<string>();
  const sources: LumSource[] = [];
  // lum >= mainLum：自身亮度不低于环境；mapTime===1：夜晚时有 lum 的物体都发光
  const shouldGlow = (lum: number) => lum > 0 && (lum >= mainLum || mapTime === 1);

  const tryAdd = (tileX: number, tileY: number, screenX: number, screenY: number): void => {
    const key = `${tileX},${tileY}`;
    if (drawnTiles.has(key)) return;
    drawnTiles.add(key);
    sources.push({ screenX, screenY });
  };

  for (const obj of objsInView) {
    if (shouldGlow(obj.lum)) {
      const tile = obj.tilePosition;
      const pos = obj.positionInWorld;
      tryAdd(tile.x, tile.y, pos.x - cameraX, pos.y - cameraY);
    }
  }

  for (const npc of npcsInView) {
    if (shouldGlow(npc.lum)) {
      const tile = npc.tilePosition;
      const pos = npc.pixelPosition;
      tryAdd(tile.x, tile.y, pos.x - cameraX, pos.y - cameraY);
    }
  }

  for (const [, sprite] of magicSprites) {
    if (shouldGlow(sprite.getLum())) {
      const tile = sprite.tilePosition;
      const pos = sprite.position;
      tryAdd(tile.x, tile.y, pos.x - cameraX, pos.y - cameraY);
    }
  }

  for (const [, sprite] of effectSprites) {
    if (shouldGlow(sprite.getLum())) {
      const tile = sprite.tilePosition;
      const pos = sprite.position;
      tryAdd(tile.x, tile.y, pos.x - cameraX, pos.y - cameraY);
    }
  }

  // 玩家自身光源（SetPlayerLum）
  if (playerTile !== null && playerPixel !== null && shouldGlow(playerLum)) {
    tryAdd(playerTile.x, playerTile.y, playerPixel.x - cameraX, playerPixel.y - cameraY);
  }

  return sources;
}

// ============= 主入口 =============

/**
 * 绘制局部光照 pass（替代旧的 drawDarkOverlay + drawElementLum 两步）
 *
 * 原理：
 *   light_buffer = ambient_dark + Σ additive(light_glow_i)
 *   out = scene × light_buffer          (multiply blend)
 *
 * 调用时机：在场景交错渲染完成后、drawFade() 之前。
 *
 * @param renderer     渲染器
 * @param mainLum      场景亮度 (0-32)；>= 31 时直接返回（场景全亮）
 * @param mapTime      时间段 (0=白天 1=夜晚 2=黄昏 3=黎明)，影响暗色调
 * @param tint         ChangeMapColor 色调（null 表示无色调 = 255,255,255）
 * @param screenWidth  屏幕（视口）宽度
 * @param screenHeight 屏幕（视口）高度
 * @param cameraX      相机 X 偏移
 * @param cameraY      相机 Y 偏移
 */
export function drawLightingPass(
  renderer: Renderer,
  mainLum: number,
  mapTime: number,
  tint: { r: number; g: number; b: number } | null,
  screenWidth: number,
  screenHeight: number,
  cameraX: number,
  cameraY: number,
  objsInView: readonly Obj[],
  npcsInView: readonly Npc[],
  magicSprites: Map<number, MagicSprite>,
  effectSprites: Map<number, MagicSprite>,
  playerLum: number,
  playerTile: { x: number; y: number } | null,
  playerPixel: { x: number; y: number } | null
): void {
  const dark = computeAmbientDarkColor(mainLum, mapTime);
  const hasTint = tint !== null && !(tint.r === 255 && tint.g === 255 && tint.b === 255);

  if (!dark && !hasTint) return;

  // mainLum >= 31（场景全亮）但有色调：直接 multiply 一个矩形即可，无需光照缓冲
  if (!dark) {
    renderer.save();
    renderer.setBlendMode("multiply");
    // biome-ignore lint/style/noNonNullAssertion: hasTint 保证 tint != null
    renderer.fillRect({ x: 0, y: 0, width: screenWidth, height: screenHeight, color: `rgb(${tint!.r}, ${tint!.g}, ${tint!.b})` });
    renderer.restore();
    return;
  }

  // 将 ChangeMapColor 色调融入光照缓冲：
  //   combinedDark = tint × dark / 255        → 暗区：scene × combinedDark
  //   glowPeak     = tint - combinedDark       → 光源区：combinedDark + glowPeak = tint → scene × tint
  const t = tint ?? { r: 255, g: 255, b: 255 };
  const cm = (a: number, b: number) => Math.max(0, Math.min(255, Math.round((a * b) / 255)));
  const combinedDark = { r: cm(t.r, dark.r), g: cm(t.g, dark.g), b: cm(t.b, dark.b) };
  const gp = (v: number) => Math.min(255, Math.round(v * 1.5));
  const glowPeak = {
    r: gp(Math.max(0, t.r - combinedDark.r)),
    g: gp(Math.max(0, t.g - combinedDark.g)),
    b: gp(Math.max(0, t.b - combinedDark.b)),
  };

  // --- 准备光照缓冲 ---
  const buffer = getLightingBuffer(screenWidth, screenHeight);
  const ctx = buffer.getContext("2d");
  if (!ctx) return;

  // 1. 用合并暗色填满缓冲
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgb(${combinedDark.r}, ${combinedDark.g}, ${combinedDark.b})`;
  ctx.fillRect(0, 0, screenWidth, screenHeight);

  // 2. 对每个发光光源，additive 叠加椭圆渐变（峰值色 = glowPeak，使光源处 buffer → tint）
  const hasGlow = glowPeak.r > 0 || glowPeak.g > 0 || glowPeak.b > 0;
  const lumSources = collectLumSources(
    mainLum,
    mapTime,
    cameraX,
    cameraY,
    objsInView,
    npcsInView,
    magicSprites,
    effectSprites,
    playerLum,
    playerTile,
    playerPixel
  );

  if (hasGlow && lumSources.length > 0) {
    const glow = getLightGlow(glowPeak);
    ctx.globalCompositeOperation = "lighter";
    for (const src of lumSources) {
      // C++ ref: engine->drawImage(lumMask, pos.x - W/2, pos.y - H/2 - TILE_HEIGHT/2)
      const drawX = src.screenX - LUM_MASK_WIDTH / 2;
      const drawY = src.screenY - LUM_MASK_HEIGHT / 2 - 16;
      ctx.drawImage(glow, drawX, drawY);
    }
  }

  // 3. 通知 WebGL 后端更新缓存的纹理数据（canvas 内容每帧都变）
  renderer.updateSourceTexture(buffer);

  // 4. multiply 混合到主场景：out = scene × buffer
  renderer.save();
  renderer.setBlendMode("multiply");
  renderer.drawSource(buffer, 0, 0);
  renderer.restore();
}
