/**
 * WASM ASF 解码器
 * 使用无状态函数实现零拷贝输入，性能比 TypeScript 快 2x+
 */

import { logger } from "../core/logger";
import type { AsfData, AsfFrame } from "../resource/asf";

// WASM 模块类型定义
interface WasmAsfHeader {
  width: number;
  height: number;
  frame_count: number;
  directions: number;
  color_count: number;
  interval: number;
  left: number;
  bottom: number;
  frames_per_direction: number;
}

interface WasmModule {
  parse_asf_header(data: Uint8Array): WasmAsfHeader | undefined;
  decode_asf_frames(data: Uint8Array, output: Uint8Array): number;
}

let wasmModule: WasmModule | null = null;
let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

/**
 * 初始化 WASM ASF 解码模块
 */
export async function initWasmAsfDecoder(): Promise<boolean> {
  if (isInitialized) {
    return true;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const wasm = await import("@miu2d/engine-wasm");
      await wasm.default();

      wasmModule = wasm as unknown as WasmModule;
      isInitialized = true;

      logger.info("[WasmAsfDecoder] Initialized");
      return true;
    } catch (error) {
      logger.warn("[WasmAsfDecoder] Failed to initialize", error);
      return false;
    }
  })();

  return initPromise;
}

/**
 * 检查 WASM 是否可用
 */
export function isWasmAsfDecoderAvailable(): boolean {
  return isInitialized && wasmModule !== null;
}

/**
 * 使用 WASM 解码 ASF 文件
 */
export function decodeAsfWasm(buffer: ArrayBuffer): AsfData | null {
  if (!wasmModule) {
    logger.warn("[WasmAsfDecoder] Not initialized");
    return null;
  }

  const data = new Uint8Array(buffer);

  // 解析头信息
  const header = wasmModule.parse_asf_header(data);
  if (!header) {
    return null;
  }

  const frameSize = header.width * header.height * 4;
  const totalSize = frameSize * header.frame_count;

  // 预分配输出 buffer
  const allPixelData = new Uint8Array(totalSize);

  // 解码所有帧
  const frameCount = wasmModule.decode_asf_frames(data, allPixelData);
  if (frameCount === 0) {
    return null;
  }

  // 切分成各帧
  const frames: AsfFrame[] = [];
  for (let i = 0; i < header.frame_count; i++) {
    const offset = i * frameSize;
    const pixelData = allPixelData.subarray(offset, offset + frameSize);

    const imageData = new ImageData(new Uint8ClampedArray(pixelData), header.width, header.height);

    frames.push({
      width: header.width,
      height: header.height,
      imageData,
      canvas: null,
    });
  }

  return {
    width: header.width,
    height: header.height,
    frameCount: header.frame_count,
    directions: header.directions,
    colorCount: header.color_count,
    interval: header.interval,
    left: header.left,
    bottom: header.bottom,
    framesPerDirection: header.frames_per_direction,
    frames,
    isLoaded: true,
  };
}
