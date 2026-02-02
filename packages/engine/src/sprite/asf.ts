/**
 * ASF 加载器 - 游戏的精灵动画格式
 * 格式: Header(16) + Metadata(64) + Palette(colors*4) + FrameOffsets(frames*8) + RLE压缩帧数据
 *
 * 使用 WASM 解码器，性能比 TypeScript 快 2x+
 */

import { resourceLoader } from "../resource/resourceLoader";
import {
  initWasmAsfDecoder,
  isWasmAsfDecoderAvailable,
  decodeAsfWasm,
} from "../wasm/wasmAsfDecoder";

export interface AsfFrame {
  width: number;
  height: number;
  imageData: ImageData;
  canvas: HTMLCanvasElement | null;
}

export interface AsfData {
  width: number;
  height: number;
  frameCount: number;
  directions: number;
  colorCount: number;
  interval: number;
  left: number;
  bottom: number;
  framesPerDirection: number;
  frames: AsfFrame[];
  isLoaded: boolean;
}

let wasmInitAttempted = false;

/**
 * 预初始化 WASM（可选，异步加载）
 * 游戏启动时调用可避免首次 ASF 加载延迟
 */
export async function initAsfWasm(): Promise<boolean> {
  if (wasmInitAttempted) {
    return isWasmAsfDecoderAvailable();
  }
  wasmInitAttempted = true;
  return initWasmAsfDecoder();
}

export function clearAsfCache(): void {
  resourceLoader.clearCache("asf");
}

/**
 * 同步获取已缓存的 ASF
 * 必须先通过 loadAsf 加载过才能获取
 */
export function getCachedAsf(url: string): AsfData | null {
  return resourceLoader.getFromCache<AsfData>(url, "asf");
}

export async function loadAsf(url: string): Promise<AsfData | null> {
  // 确保 WASM 初始化已尝试
  if (!wasmInitAttempted) {
    wasmInitAttempted = true;
    await initWasmAsfDecoder();
  }

  return resourceLoader.loadParsedBinary<AsfData>(url, decodeAsfWasm, "asf");
}

/** 获取帧的 canvas（延迟创建） */
export function getFrameCanvas(frame: AsfFrame): HTMLCanvasElement {
  if (frame.canvas) return frame.canvas;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, frame.width);
  canvas.height = Math.max(1, frame.height);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.putImageData(frame.imageData, 0, 0);
  frame.canvas = canvas;
  return canvas;
}

/** 获取帧索引 */
export function getFrameIndex(asf: AsfData, direction: number, animFrame: number): number {
  if (!asf || asf.frameCount === 0) return 0;
  const dir = Math.min(direction, Math.max(0, asf.directions - 1));
  const framesPerDir = asf.framesPerDirection || 1;
  return Math.min(dir * framesPerDir + (animFrame % framesPerDir), asf.frames.length - 1);
}

/** 绘制 ASF 帧 */
export function drawAsfFrame(
  ctx: CanvasRenderingContext2D,
  asf: AsfData,
  frameIndex: number,
  x: number,
  y: number,
  flipX: boolean = false
): void {
  if (!asf || frameIndex < 0 || frameIndex >= asf.frames.length) return;

  const canvas = getFrameCanvas(asf.frames[frameIndex]);
  ctx.save();
  if (flipX) {
    ctx.translate(x + asf.width, y);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, 0, 0);
  } else {
    ctx.drawImage(canvas, x, y);
  }
  ctx.restore();
}
