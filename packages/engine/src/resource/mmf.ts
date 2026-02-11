/**
 * MMF (Miu Map Format) parser
 *
 * Parses .mmf binary files into MiuMapData.
 * See docs/mmf-format.md for the full specification.
 *
 * Features:
 * - Compact MSF table (variable-length, UTF-8)
 * - Embedded trap table (no external Traps.ini needed)
 * - zstd-compressed tile data blob
 * - Extension chunk support (forward-compatible)
 */

import { logger } from "../core/logger";
import type { MiuMapData, MsfEntry, TrapEntry } from "../map/types";
import { resourceLoader } from "./resource-loader";

/**
 * Parse an MMF file buffer into MiuMapData
 */
export function parseMMF(buffer: ArrayBuffer, mapPath?: string): MiuMapData | null {
  const view = new DataView(buffer);
  const data = new Uint8Array(buffer);

  if (data.length < 20) {
    logger.error(`[MMF] File too small: ${data.length} bytes (path: ${mapPath || "unknown"})`);
    return null;
  }

  // 1. Preamble (8 bytes)
  const magic = String.fromCharCode(data[0], data[1], data[2], data[3]);
  if (magic !== "MMF1") {
    logger.error(`[MMF] Invalid magic: "${magic}" (expected "MMF1", path: ${mapPath || "unknown"})`);
    return null;
  }

  const version = view.getUint16(4, true);
  const flags = view.getUint16(6, true);
  let offset = 8;

  if (version !== 1) {
    logger.error(`[MMF] Unsupported version: ${version} (path: ${mapPath || "unknown"})`);
    return null;
  }

  // 2. Map Header (12 bytes)
  const columns = view.getUint16(offset, true); offset += 2;
  const rows = view.getUint16(offset, true); offset += 2;
  const msfCount = view.getUint16(offset, true); offset += 2;
  const trapCount = view.getUint16(offset, true); offset += 2;
  offset += 4; // reserved

  const mapPixelWidth = (columns - 1) * 64;
  const mapPixelHeight = (Math.floor((rows - 3) / 2) + 1) * 32;

  // 3. MSF Table
  const decoder = new TextDecoder("utf-8");
  const msfEntries: MsfEntry[] = [];

  for (let i = 0; i < msfCount; i++) {
    if (offset >= data.length) break;
    const nameLen = data[offset++];
    const name = decoder.decode(data.slice(offset, offset + nameLen));
    offset += nameLen;
    const entryFlags = data[offset++];
    msfEntries.push({
      name,
      looping: (entryFlags & 1) !== 0,
    });
  }

  // 4. Trap Table
  const trapTable: TrapEntry[] = [];
  if (flags & 0x02) {
    for (let i = 0; i < trapCount; i++) {
      if (offset >= data.length) break;
      const trapIndex = data[offset++];
      const pathLen = view.getUint16(offset, true); offset += 2;
      const scriptPath = decoder.decode(data.slice(offset, offset + pathLen));
      offset += pathLen;
      trapTable.push({ trapIndex, scriptPath });
    }
  }

  // 5. Skip extension chunks until END sentinel
  while (offset + 8 <= data.length) {
    const chunkId = String.fromCharCode(
      data[offset], data[offset + 1], data[offset + 2], data[offset + 3]
    );
    const chunkLen = view.getUint32(offset + 4, true);
    offset += 8;
    if (chunkId === "END\0") break;
    // Skip unknown chunks (forward compatible)
    offset += chunkLen;
  }

  // 6. Decompress tile blob
  const compressed = data.slice(offset);
  let blob: Uint8Array;

  if (flags & 0x01) {
    // zstd compressed - use WASM decoder or JS fallback
    try {
      blob = decompressZstd(compressed);
    } catch (e) {
      logger.error(`[MMF] zstd decompression failed:`, e);
      return null;
    }
  } else {
    blob = compressed;
  }

  // 7. Parse layers from decompressed blob
  const totalTiles = columns * rows;
  const expectedBlobSize = totalTiles * 8; // 3 layers × 2 + barrier + trap

  if (blob.length < expectedBlobSize) {
    logger.error(
      `[MMF] Blob size mismatch: ${blob.length} < ${expectedBlobSize} expected (path: ${mapPath || "unknown"})`
    );
    return null;
  }

  let blobOffset = 0;
  const layer1 = blob.slice(blobOffset, blobOffset + totalTiles * 2); blobOffset += totalTiles * 2;
  const layer2 = blob.slice(blobOffset, blobOffset + totalTiles * 2); blobOffset += totalTiles * 2;
  const layer3 = blob.slice(blobOffset, blobOffset + totalTiles * 2); blobOffset += totalTiles * 2;
  const barriers = blob.slice(blobOffset, blobOffset + totalTiles); blobOffset += totalTiles;
  const traps = blob.slice(blobOffset, blobOffset + totalTiles);

  logger.debug(
    `[MMF] Parsed: ${columns}×${rows} tiles, ${msfEntries.length} MSF, ${trapTable.length} traps (path: ${mapPath || "unknown"})`
  );

  return {
    mapColumnCounts: columns,
    mapRowCounts: rows,
    mapPixelWidth,
    mapPixelHeight,
    msfEntries,
    trapTable,
    layer1,
    layer2,
    layer3,
    barriers,
    traps,
  };
}

/**
 * Load an MMF map file from URL
 */
export async function loadMMF(url: string): Promise<MiuMapData | null> {
  try {
    logger.debug(`[MMF] Fetching map from: ${url}`);
    const buffer = await resourceLoader.loadBinary(url);
    if (!buffer) {
      logger.error(`[MMF] Failed to load: ${url}`);
      return null;
    }
    return parseMMF(buffer, url);
  } catch (error) {
    logger.error(`[MMF] Error loading ${url}:`, error);
    return null;
  }
}

// ============= zstd decompression =============

/**
 * Decompress zstd data.
 * Uses the fzstd library (pure JS, no WASM dependency).
 * We include a minimal zstd decompressor implementation.
 */
let _zstdDecompress: ((data: Uint8Array) => Uint8Array) | null = null;

/**
 * Set the zstd decompression function.
 * Should be called at engine init with the actual zstd implementation.
 */
export function setZstdDecompressor(fn: (data: Uint8Array) => Uint8Array): void {
  _zstdDecompress = fn;
}

function decompressZstd(data: Uint8Array): Uint8Array {
  if (_zstdDecompress) {
    return _zstdDecompress(data);
  }
  // Fallback: try using the WASM zstd decoder if available
  throw new Error("[MMF] No zstd decompressor registered. Call setZstdDecompressor() at engine init.");
}
