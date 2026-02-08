/**
 * WASM 精灵解码器 - 支持 MSF (Miu Sprite Format) 和 ASF (旧格式) 自动检测
 *
 * MSF 格式: 新的高效精灵格式，per-frame tight bbox + indexed8 像素
 * ASF 格式: 旧格式，保留兼容性
 *
 * 使用前需要 await initWasm()
 */

import { logger } from "../core/logger";
import type { AsfData, AsfFrame } from "../resource/asf";
import { getWasmModule } from "./wasmManager";

// MSF magic bytes: "MSF1"
const MSF_MAGIC = 0x3146534d; // little-endian "MSF1"

/**
 * 使用 WASM 解码精灵文件（自动检测 MSF / ASF 格式）
 */
export function decodeAsfWasm(buffer: ArrayBuffer): AsfData | null {
  const wasmModule = getWasmModule();
  if (!wasmModule) {
    logger.warn("[SpriteDecoder] WASM not initialized");
    return null;
  }

  const data = new Uint8Array(buffer);

  // 检测格式：前 4 字节判断是否为 MSF
  if (data.length >= 4) {
    const magic = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
    if (magic === MSF_MAGIC) {
      return decodeMsf(wasmModule, data);
    }
  }

  // 回退到 ASF 解码
  return decodeAsf(wasmModule, data);
}

/** 解码 MSF 格式 */
function decodeMsf(
  wasmModule: NonNullable<ReturnType<typeof getWasmModule>>,
  data: Uint8Array
): AsfData | null {
  const header = wasmModule.parse_msf_header(data);
  if (!header) {
    return null;
  }

  const frameSize = header.canvas_width * header.canvas_height * 4;
  const totalSize = frameSize * header.frame_count;

  // 预分配输出 buffer
  const allPixelData = new Uint8Array(totalSize);

  // 解码所有帧
  const frameCount = wasmModule.decode_msf_frames(data, allPixelData);
  if (frameCount === 0) {
    return null;
  }

  // 切分成各帧
  const frames: AsfFrame[] = [];
  for (let i = 0; i < header.frame_count; i++) {
    const offset = i * frameSize;
    const pixelData = allPixelData.subarray(offset, offset + frameSize);

    const imageData = new ImageData(
      new Uint8ClampedArray(pixelData),
      header.canvas_width,
      header.canvas_height
    );

    frames.push({
      width: header.canvas_width,
      height: header.canvas_height,
      imageData,
      canvas: null,
    });
  }

  // MSF fps → interval (ms)
  const interval = header.fps > 0 ? Math.round(1000 / header.fps) : 67;

  return {
    width: header.canvas_width,
    height: header.canvas_height,
    frameCount: header.frame_count,
    directions: header.directions,
    colorCount: header.palette_size,
    interval,
    left: header.anchor_x,
    bottom: header.anchor_y,
    framesPerDirection: header.frames_per_direction,
    frames,
    isLoaded: true,
  };
}

/** 解码 ASF 格式（旧格式兼容） */
function decodeAsf(
  wasmModule: NonNullable<ReturnType<typeof getWasmModule>>,
  data: Uint8Array
): AsfData | null {
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
