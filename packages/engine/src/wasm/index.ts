/**
 * WASM 模块统一导出
 *
 * 提供高性能的 WebAssembly 实现，自动回退到 JavaScript 版本
 */

export {
  initWasmPathfinder,
  isWasmPathfinderAvailable,
  findPathWasm,
  updateObstacleBitmap,
  setObstacle,
  disposeWasmPathfinder,
  WasmPathType,
} from "./wasmPathFinder";

export {
  initWasmAsfDecoder,
  isWasmAsfDecoderAvailable,
  decodeAsfWasm,
} from "./wasmAsfDecoder";

export {
  initWasmCollision,
  isWasmCollisionAvailable,
  WasmSpatialHashWrapper,
  checkAabbCollision,
  checkCircleCollision,
  pointInRect,
  pointInCircle,
} from "./wasmCollision";

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

// 导出测试工具
export { runPathfinderTests, runPerformanceBenchmark, runAllTests } from "./pathfinderTest";

