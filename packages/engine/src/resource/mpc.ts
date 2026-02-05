/**
 * MPC file parser - matches Engine/Mpc.cs implementation
 *
 * MPC files can optionally have associated SHD (shadow) files.
 * When SHD is present, shadow data is used as the base layer,
 * and MPC color pixels are drawn on top.
 *
 * Uses WASM decoder for high performance.
 * 注意：使用前需在应用启动时调用 await initWasm()
 */

import { logger } from "../core/logger";
import type { Mpc } from "../core/mapTypes";
import { decodeMpcWasm } from "../wasm/wasmMpcDecoder";
import { resourceLoader } from "./resourceLoader";
import { loadShd, type Shd } from "./shd";

/**
 * Load an MPC file from a URL
 */
export async function loadMpc(url: string): Promise<Mpc | null> {
  return resourceLoader.loadParsedBinary<Mpc>(url, decodeMpcWasm, "mpc");
}

/**
 * Load an MPC file with optional SHD shadow file
 * (string path, string shdFileName) constructor
 *
 * When SHD is provided, shadow data serves as the base layer
 * and MPC color pixels are drawn on top (preserving shadow under transparent areas)
 *
 * @param mpcUrl - URL to the MPC file
 * @param shdUrl - Optional URL to the SHD shadow file
 */
export async function loadMpcWithShadow(mpcUrl: string, shdUrl?: string): Promise<Mpc | null> {
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
