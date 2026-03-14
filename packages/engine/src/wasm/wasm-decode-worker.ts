/**
 * WASM Decode Worker
 *
 * 在 Worker 线程中执行 CPU 密集的 MSF/ASF/MPC 解码，释放主线程渲染。
 * 解码结果以可转移的 ArrayBuffer 返回，主线程再组装 ImageData。
 *
 * 消息协议：
 *   请求: { id, type: 'decode-asf' | 'decode-mpc', buffer: ArrayBuffer }
 *   回复: { id, ok: true, payload: AsfPayload | MpcPayload }
 *        { id, ok: false }
 */

import type { WasmModule } from "./wasm-manager";

const MSF_MAGIC = 0x3246534d; // "MSF2" LE

let wasmModule: WasmModule | null = null;
let wasmInitPromise: Promise<void> | null = null;

async function ensureWasm(): Promise<void> {
  if (wasmModule) return;
  if (wasmInitPromise) {
    await wasmInitPromise;
    return;
  }
  wasmInitPromise = (async () => {
    const wasm = await import("@miu2d/engine-wasm");
    await wasm.default();
    wasmModule = wasm as unknown as WasmModule;
  })();
  await wasmInitPromise;
}

// ===================== ASF 解码 =====================

export interface AsfPayload {
  kind: "asf";
  /** Canvas width (used for anchor positioning) */
  width: number;
  /** Canvas height (used for anchor positioning) */
  height: number;
  frameCount: number;
  directions: number;
  colorCount: number;
  interval: number;
  left: number;
  bottom: number;
  framesPerDirection: number;
  pixelFormat: number;
  /** 所有帧的像素数据（RGBA，连续存储） */
  pixelBuffer: ArrayBuffer;
  /** Per-frame sizes [w0,h0,w1,h1,...] — tight bounding box. Absent → all frames are width×height */
  frameSizesBuffer?: ArrayBuffer;
  /** Per-frame pixel offsets in pixelBuffer [off0,off1,...] */
  frameOffsetsBuffer?: ArrayBuffer;
  /** Per-frame canvas offsets [ox0,oy0,ox1,oy1,...] — position of tight bbox within canvas */
  canvasOffsetsBuffer?: ArrayBuffer;
}

function decodeAsfInWorker(data: Uint8Array): AsfPayload | null {
  const wasm = wasmModule;
  if (!wasm) return null;

  const magic = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);

  if (magic === MSF_MAGIC) {
    const header = wasm.parse_msf_header(data);
    if (!header) return null;

    // Decode as tight-bbox individual frames instead of canvas-sized
    const pixelOutput = new Uint8Array(header.total_individual_pixel_bytes);
    const frameSizesOutput = new Uint8Array(header.frame_count * 2 * 4);
    const frameOffsetsOutput = new Uint8Array(header.frame_count * 4);
    const canvasOffsetsOutput = new Uint8Array(header.frame_count * 2 * 2); // i16 pairs

    const decoded = wasm.decode_msf_individual_frames(
      data,
      pixelOutput,
      frameSizesOutput,
      frameOffsetsOutput,
      canvasOffsetsOutput
    );
    if (decoded === 0) return null;

    const interval = header.fps > 0 ? Math.round(1000 / header.fps) : 67;
    return {
      kind: "asf",
      width: header.canvas_width,
      height: header.canvas_height,
      frameCount: header.frame_count,
      directions: header.directions,
      colorCount: header.palette_size,
      interval,
      left: header.anchor_x,
      bottom: header.anchor_y,
      framesPerDirection: header.frames_per_direction,
      pixelFormat: header.pixel_format,
      pixelBuffer: pixelOutput.buffer,
      frameSizesBuffer: frameSizesOutput.buffer,
      frameOffsetsBuffer: frameOffsetsOutput.buffer,
      canvasOffsetsBuffer: canvasOffsetsOutput.buffer,
    };
  }

  // 原始 ASF 格式
  const header = wasm.parse_asf_header(data);
  if (!header) return null;

  const frameSize = header.width * header.height * 4;
  const allPixels = new Uint8Array(frameSize * header.frame_count);

  const decoded = wasm.decode_asf_frames(data, allPixels);
  if (decoded === 0) return null;

  return {
    kind: "asf",
    width: header.width,
    height: header.height,
    frameCount: header.frame_count,
    directions: header.directions,
    colorCount: header.color_count,
    interval: header.interval || 67,
    left: header.left,
    bottom: header.bottom,
    framesPerDirection: header.frames_per_direction,
    pixelFormat: 0,
    pixelBuffer: allPixels.buffer,
  };
}

// ===================== MPC 解码 =====================

export interface MpcPayload {
  kind: "mpc";
  framesDataLengthSum: number;
  globalWidth: number;
  globalHeight: number;
  frameCount: number;
  direction: number;
  colorCount: number;
  interval: number;
  bottom: number;
  left: number;
  /** 所有帧的像素数据（RGBA，按帧偏移索引） */
  pixelBuffer: ArrayBuffer;
  /** Uint32Array 视图：[w0, h0, w1, h1, …] */
  frameSizesBuffer: ArrayBuffer;
  /** Uint32Array 视图：[offset0, offset1, …] */
  frameOffsetsBuffer: ArrayBuffer;
}

function decodeMpcInWorker(data: Uint8Array): MpcPayload | null {
  const wasm = wasmModule;
  if (!wasm) return null;

  const magic = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);

  if (magic === MSF_MAGIC) {
    // MSF → MPC 路径
    const header = wasm.parse_msf_header(data);
    if (!header) return null;

    const pixelOutput = new Uint8Array(header.total_individual_pixel_bytes);
    const frameSizesOutput = new Uint8Array(header.frame_count * 2 * 4);
    const frameOffsetsOutput = new Uint8Array(header.frame_count * 4);

    const frameCount = wasm.decode_msf_individual_frames(
      data,
      pixelOutput,
      frameSizesOutput,
      frameOffsetsOutput
    );
    if (frameCount === 0) return null;

    return {
      kind: "mpc",
      framesDataLengthSum: 0,
      globalWidth: header.canvas_width,
      globalHeight: header.canvas_height,
      frameCount: header.frame_count,
      direction: header.directions,
      colorCount: header.palette_size,
      interval: Math.round(1000 / Math.max(header.fps, 1)),
      bottom: header.anchor_y,
      left: header.anchor_x,
      pixelBuffer: pixelOutput.buffer,
      frameSizesBuffer: frameSizesOutput.buffer,
      frameOffsetsBuffer: frameOffsetsOutput.buffer,
    };
  }

  // 原始 MPC 格式
  const header = wasm.parse_mpc_header(data);
  if (!header) return null;

  const pixelOutput = new Uint8Array(header.total_pixel_bytes);
  const frameSizesOutput = new Uint8Array(header.frame_count * 2 * 4);
  const frameOffsetsOutput = new Uint8Array(header.frame_count * 4);

  const frameCount = wasm.decode_mpc_frames(
    data,
    pixelOutput,
    frameSizesOutput,
    frameOffsetsOutput
  );
  if (frameCount === 0) return null;

  return {
    kind: "mpc",
    framesDataLengthSum: header.frames_data_length_sum,
    globalWidth: header.global_width,
    globalHeight: header.global_height,
    frameCount: header.frame_count,
    direction: header.direction,
    colorCount: header.color_count,
    interval: header.interval,
    bottom: header.bottom,
    left: header.left,
    pixelBuffer: pixelOutput.buffer,
    frameSizesBuffer: frameSizesOutput.buffer,
    frameOffsetsBuffer: frameOffsetsOutput.buffer,
  };
}

// ===================== 消息循环 =====================

export type WorkerRequest = {
  id: number;
  type: "decode-asf" | "decode-mpc";
  buffer: ArrayBuffer;
};

export type WorkerResponse =
  | { id: number; ok: true; payload: AsfPayload | MpcPayload }
  | { id: number; ok: false };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, type, buffer } = e.data;

  try {
    await ensureWasm();
    const data = new Uint8Array(buffer);

    if (type === "decode-asf") {
      const payload = decodeAsfInWorker(data);
      if (!payload) {
        (self as unknown as Worker).postMessage({ id, ok: false } satisfies WorkerResponse);
        return;
      }
      const transfers: Transferable[] = [payload.pixelBuffer];
      if (payload.frameSizesBuffer) transfers.push(payload.frameSizesBuffer);
      if (payload.frameOffsetsBuffer) transfers.push(payload.frameOffsetsBuffer);
      if (payload.canvasOffsetsBuffer) transfers.push(payload.canvasOffsetsBuffer);
      (self as unknown as Worker).postMessage(
        { id, ok: true, payload } satisfies WorkerResponse,
        transfers
      );
    } else {
      const payload = decodeMpcInWorker(data);
      if (!payload) {
        (self as unknown as Worker).postMessage({ id, ok: false } satisfies WorkerResponse);
        return;
      }
      const transfers: Transferable[] = [
        payload.pixelBuffer,
        payload.frameSizesBuffer,
        payload.frameOffsetsBuffer,
      ];
      (self as unknown as Worker).postMessage(
        { id, ok: true, payload } satisfies WorkerResponse,
        transfers
      );
    }
  } catch {
    (self as unknown as Worker).postMessage({ id, ok: false } satisfies WorkerResponse);
  }
};
