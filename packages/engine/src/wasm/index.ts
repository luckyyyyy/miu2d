/**
 * WASM 模块统一导出
 *
 * 提供高性能的 WebAssembly 实现，自动回退到 JavaScript 版本
 */

export {
  decodeAsfWasm,
  initWasmAsfDecoder,
  isWasmAsfDecoderAvailable,
} from "./wasmAsfDecoder";
export {
  checkAabbCollision,
  checkCircleCollision,
  initWasmCollision,
  isWasmCollisionAvailable,
  pointInCircle,
  pointInRect,
  WasmSpatialHashWrapper,
} from "./wasmCollision";
export {
  disposeWasmPathfinder,
  findPathWasm,
  initWasmPathfinder,
  isWasmPathfinderAvailable,
  setObstacle,
  updateObstacleBitmap,
  WasmPathType,
} from "./wasmPathFinder";

/**
 * 初始化所有 WASM 模块
 */
export async function initAllWasmModules(
  mapWidth?: number,
  mapHeight?: number
): Promise<{ pathfinder: boolean; asfDecoder: boolean; collision: boolean }> {
  const { initWasmPathfinder } = await import("./wasmPathFinder");
  const { initWasmAsfDecoder } = await import("./wasmAsfDecoder");
  const { initWasmCollision } = await import("./wasmCollision");

  const [pathfinder, asfDecoder, collision] = await Promise.all([
    mapWidth && mapHeight ? initWasmPathfinder(mapWidth, mapHeight) : Promise.resolve(false),
    initWasmAsfDecoder(),
    initWasmCollision(),
  ]);

  return { pathfinder, asfDecoder, collision };
}
