/**
 * MPC file parser - matches C# Engine/Mpc.cs implementation
 *
 * MPC files can optionally have associated SHD (shadow) files.
 * When SHD is present, shadow data is used as the base layer,
 * and MPC color pixels are drawn on top.
 *
 * Uses WASM decoder for high performance.
 */

import { logger } from "../core/logger";
import type { Mpc } from "../core/mapTypes";
import { resourceLoader } from "./resourceLoader";
import { type Shd, loadShd } from "./shd";
import {
  initWasmMpcDecoder,
  decodeMpcWasm,
} from "../wasm/wasmMpcDecoder";

// 保存初始化 Promise，确保所有调用都等待同一个 Promise
let wasmInitPromise: Promise<boolean> | null = null;

/**
 * 预初始化 WASM MPC 解码器（可选）
 * 游戏启动时调用可避免首次 MPC 加载延迟
 */
export async function initMpcWasm(): Promise<boolean> {
  if (!wasmInitPromise) {
    wasmInitPromise = initWasmMpcDecoder();
  }
  return wasmInitPromise;
}

/**
 * Load an MPC file from a URL
 */
export async function loadMpc(url: string): Promise<Mpc | null> {
  // 确保 WASM 初始化完成
  await initMpcWasm();

  return resourceLoader.loadParsedBinary<Mpc>(url, decodeMpcWasm, "mpc");
}

/**
 * Load an MPC file with optional SHD shadow file
 * Based on C# Mpc(string path, string shdFileName) constructor
 *
 * When SHD is provided, shadow data serves as the base layer
 * and MPC color pixels are drawn on top (preserving shadow under transparent areas)
 *
 * @param mpcUrl - URL to the MPC file
 * @param shdUrl - Optional URL to the SHD shadow file
 */
export async function loadMpcWithShadow(
  mpcUrl: string,
  shdUrl?: string
): Promise<Mpc | null> {
  // 确保 WASM 初始化完成
  await initMpcWasm();

  // Load SHD first if provided
  let shd: Shd | null = null;
  if (shdUrl) {
    shd = await loadShd(shdUrl);
    if (!shd) {
      logger.warn(`[MPC] SHD file not found: ${shdUrl}, loading MPC without shadow`);
    }
  }

  // Load MPC
  const buffer = await resourceLoader.loadBinary(mpcUrl);
  if (!buffer) {
    logger.error(`[MPC] Failed to load: ${mpcUrl}`);
    return null;
  }

  // TODO: WASM 版本暂不支持 SHD 合成，需要时再实现
  if (shd) {
    logger.warn(`[MPC] SHD shadow merging not yet implemented in WASM, ignoring shadow`);
  }

  return decodeMpcWasm(buffer);
}

/**
 * Clear the MPC cache (delegates to resourceLoader)
 */
export function clearMpcCache(): void {
  resourceLoader.clearCache("mpc");
}
