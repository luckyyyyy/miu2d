/**
 * Zstd 解压器注册表
 *
 * 放在 core/ 中以消除 wasm ↔ resource 循环依赖：
 * - wasm-manager.ts 调用 setZstdDecompressor()（wasm → core，无循环）
 * - resource/format/mmf.ts 调用 getZstdDecompressor()（resource → core，无循环）
 */

let _zstdDecompress: ((data: Uint8Array) => Uint8Array) | null = null;

/**
 * 注册 zstd 解压函数（引擎初始化时由 wasm-manager 调用）
 */
export function setZstdDecompressor(fn: (data: Uint8Array) => Uint8Array): void {
  _zstdDecompress = fn;
}

/**
 * 获取已注册的 zstd 解压函数，未注册则返回 null
 */
export function getZstdDecompressor(): ((data: Uint8Array) => Uint8Array) | null {
  return _zstdDecompress;
}
