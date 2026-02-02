/**
 * WASM MPC 解码器
 * 使用 Rust 实现的高性能 RLE 解码，大文件约 1.5x 加速
 */

import { logger } from "../core/logger";
import type { Mpc, MpcFrame, MpcHead } from "../core/mapTypes";

// WASM 模块类型定义
interface WasmMpcHeader {
  frames_data_length_sum: number;
  global_width: number;
  global_height: number;
  frame_count: number;
  direction: number;
  color_count: number;
  interval: number;
  bottom: number;
  left: number;
  total_pixel_bytes: number;
}

interface WasmModule {
  parse_mpc_header(data: Uint8Array): WasmMpcHeader | undefined;
  decode_mpc_frames(
    data: Uint8Array,
    pixelOutput: Uint8Array,
    frameSizesOutput: Uint8Array,
    frameOffsetsOutput: Uint8Array
  ): number;
}

let wasmModule: WasmModule | null = null;
let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

/**
 * 初始化 WASM MPC 解码模块
 */
export async function initWasmMpcDecoder(): Promise<boolean> {
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

      logger.info("[WasmMpcDecoder] Initialized");
      return true;
    } catch (error) {
      logger.warn("[WasmMpcDecoder] Failed to initialize", error);
      return false;
    }
  })();

  return initPromise;
}

/**
 * 检查 WASM 是否可用
 */
export function isWasmMpcDecoderAvailable(): boolean {
  return isInitialized && wasmModule !== null;
}

/**
 * 使用 WASM 解码 MPC 文件
 * 返回 null 如果 WASM 不可用或解码失败
 */
export function decodeMpcWasm(buffer: ArrayBuffer): Mpc | null {
  if (!wasmModule) {
    return null;
  }

  const data = new Uint8Array(buffer);
  const header = wasmModule.parse_mpc_header(data);
  if (!header) {
    return null;
  }

  // Pre-allocate buffers
  const pixelOutput = new Uint8Array(header.total_pixel_bytes);
  const frameSizesOutput = new Uint8Array(header.frame_count * 2 * 4); // 2 u32 per frame
  const frameOffsetsOutput = new Uint8Array(header.frame_count * 4); // 1 u32 per frame

  const frameCount = wasmModule.decode_mpc_frames(
    data,
    pixelOutput,
    frameSizesOutput,
    frameOffsetsOutput
  );

  if (frameCount === 0) {
    return null;
  }

  // Parse frame sizes and offsets from bytes
  const frameSizes = new Uint32Array(frameSizesOutput.buffer);
  const frameOffsets = new Uint32Array(frameOffsetsOutput.buffer);

  // Read palette from original data
  const palette: Uint8ClampedArray[] = [];
  const paletteStart = 128;
  for (let i = 0; i < header.color_count; i++) {
    const offset = paletteStart + i * 4;
    if (offset + 4 > data.length) break;
    const b = data[offset];
    const g = data[offset + 1];
    const r = data[offset + 2];
    palette.push(new Uint8ClampedArray([r, g, b, 255]));
  }

  // Build frames from result
  const frames: MpcFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const width = frameSizes[i * 2];
    const height = frameSizes[i * 2 + 1];
    const offset = frameOffsets[i];
    const frameSize = width * height * 4;

    // Create ImageData from pixel data
    const pixelData = new Uint8ClampedArray(frameSize);
    pixelData.set(pixelOutput.subarray(offset, offset + frameSize));

    const imageData = new ImageData(pixelData, width, height);

    frames.push({
      width,
      height,
      imageData,
    });
  }

  const head: MpcHead = {
    framesDataLengthSum: header.frames_data_length_sum,
    globleWidth: header.global_width,
    globleHeight: header.global_height,
    frameCounts: header.frame_count,
    direction: header.direction,
    colourCounts: header.color_count,
    interval: header.interval,
    bottom: header.bottom,
    left: header.left,
  };

  return { head, frames, palette };
}
