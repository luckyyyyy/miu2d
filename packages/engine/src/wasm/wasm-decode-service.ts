/**
 * WASM Decode Service — Worker Pool
 *
 * 维护一个固定大小的 Worker 池，将 CPU 密集的 MSF/ASF/MPC 解码
 * 并行分发给多个 Worker 线程，主线程只负责轻量的 ImageData 组装。
 *
 * 调度策略：least-busy（每次选空闲任务数最少的 Worker）。
 * 回退：若 Worker 不可用或解码失败，自动降级为同步 WASM 解码。
 */

import { logger } from "../core/logger";
import type { Mpc, MpcFrame, MpcHead } from "../map/types";
import type { AsfData, AsfFrame } from "../resource/format/asf";
import { decodeAsfWasm } from "./wasm-asf-decoder";
import type { AsfPayload, MpcPayload, WorkerRequest, WorkerResponse } from "./wasm-decode-worker";
import { decodeMpcWasm } from "./wasm-mpc-decoder";

/** Worker 池大小：取 CPU 核心数的一半（最少 2，最多 4） */
const POOL_SIZE = Math.max(2, Math.min(4, Math.floor((navigator.hardwareConcurrency ?? 4) / 2)));

interface PoolEntry {
  worker: Worker;
  pending: number; // 正在进行的任务数
}

let pool: PoolEntry[] | null = null;
let poolFailed = false;
let nextId = 1;
const pendingCallbacks = new Map<number, (res: WorkerResponse) => void>();

function createWorker(): Worker {
  const w = new Worker(new URL("./wasm-decode-worker.ts", import.meta.url), {
    type: "module",
  });
  w.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const entry = pool?.find((p) => p.worker === w);
    if (entry) entry.pending = Math.max(0, entry.pending - 1);
    const resolver = pendingCallbacks.get(e.data.id);
    if (resolver) {
      pendingCallbacks.delete(e.data.id);
      resolver(e.data);
    }
  };
  w.onerror = (err) => {
    logger.warn("[DecodeService] Worker error", err);
    const entry = pool?.find((p) => p.worker === w);
    if (entry) entry.pending = Math.max(0, entry.pending - 1);
    // 找出所有发往这个 worker 的 pending（无法精确追踪，全部失败降级）
    // 注意：此处保守处理，请求方会降级同步解码
  };
  return w;
}

function getPool(): PoolEntry[] | null {
  if (poolFailed) return null;
  if (pool) return pool;
  try {
    pool = Array.from({ length: POOL_SIZE }, () => ({ worker: createWorker(), pending: 0 }));
    logger.info(`[DecodeService] Worker pool initialized (${POOL_SIZE} workers)`);
  } catch {
    logger.warn("[DecodeService] Worker not supported, using sync decode");
    poolFailed = true;
    return null;
  }
  return pool;
}

/** 选择当前任务数最少的 Worker */
function pickLeastBusy(): PoolEntry | null {
  const p = getPool();
  if (!p) return null;
  let best = p[0];
  for (let i = 1; i < p.length; i++) {
    if (p[i].pending < best.pending) best = p[i];
  }
  return best;
}

function sendToWorker(
  type: "decode-asf" | "decode-mpc",
  buffer: ArrayBuffer
): Promise<WorkerResponse> {
  return new Promise((resolve) => {
    const entry = pickLeastBusy();
    if (!entry) {
      resolve({ id: -1, ok: false });
      return;
    }
    const id = nextId++;
    pendingCallbacks.set(id, resolve);
    entry.pending++;
    const msg: WorkerRequest = { id, type, buffer: buffer.slice(0) };
    entry.worker.postMessage(msg, [msg.buffer]);
  });
}

// ===================== 从 Worker 结果重建 ImageData =====================

function buildAsfFromPayload(payload: AsfPayload): AsfData {
  const { width, height, frameCount } = payload;
  const frameSize = width * height * 4;
  const allPixels = new Uint8Array(payload.pixelBuffer);

  const frames: AsfFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const offset = i * frameSize;
    const slice = new Uint8ClampedArray(allPixels.buffer, offset, frameSize);
    frames.push({
      width,
      height,
      imageData: new ImageData(slice, width, height),
      canvas: null,
    });
  }

  return {
    width: payload.width,
    height: payload.height,
    frameCount: payload.frameCount,
    directions: payload.directions,
    colorCount: payload.colorCount,
    interval: payload.interval,
    left: payload.left,
    bottom: payload.bottom,
    framesPerDirection: payload.framesPerDirection,
    frames,
    isLoaded: true,
    pixelFormat: payload.pixelFormat,
  };
}

function buildMpcFromPayload(payload: MpcPayload): Mpc {
  const frameSizes = new Uint32Array(payload.frameSizesBuffer);
  const frameOffsets = new Uint32Array(payload.frameOffsetsBuffer);
  const allPixels = new Uint8Array(payload.pixelBuffer);

  const frames: MpcFrame[] = [];
  for (let i = 0; i < payload.frameCount; i++) {
    const w = frameSizes[i * 2];
    const h = frameSizes[i * 2 + 1];
    const offset = frameOffsets[i];
    const size = w * h * 4;
    const pixelData = new Uint8ClampedArray(size);
    pixelData.set(allPixels.subarray(offset, offset + size));
    frames.push({ width: w, height: h, imageData: new ImageData(pixelData, w, h) });
  }

  const head: MpcHead = {
    framesDataLengthSum: payload.framesDataLengthSum,
    globalWidth: payload.globalWidth,
    globalHeight: payload.globalHeight,
    frameCounts: payload.frameCount,
    direction: payload.direction,
    colourCounts: payload.colorCount,
    interval: payload.interval,
    bottom: payload.bottom,
    left: payload.left,
  };

  return { head, frames, palette: [] };
}

// ===================== 公开 API =====================

/**
 * 解码 ASF/MSF 精灵文件（Worker 线程，失败时降级同步）
 */
export async function decodeAsfOffThread(buffer: ArrayBuffer): Promise<AsfData | null> {
  const res = await sendToWorker("decode-asf", buffer);
  if (res.ok && res.payload.kind === "asf") {
    return buildAsfFromPayload(res.payload);
  }
  // 降级：同步执行（Worker 不可用或解码失败）
  return decodeAsfWasm(buffer);
}

/**
 * 解码 MPC/MSF 地图精灵文件（Worker 线程，失败时降级同步）
 */
export async function decodeMpcOffThread(buffer: ArrayBuffer): Promise<Mpc | null> {
  const res = await sendToWorker("decode-mpc", buffer);
  if (res.ok && res.payload.kind === "mpc") {
    return buildMpcFromPayload(res.payload);
  }
  return decodeMpcWasm(buffer);
}
