/**
 * WASM 模块统一导出
 *
 * 使用方式：
 * 1. 应用启动时：await initWasm()
 * 2. 其他地方直接 import 使用解码函数
 */

// 统一的 WASM 初始化（应用启动时调用一次）
export { initWasm, isWasmReady, getWasmModule } from "./wasmManager";

// ASF/MPC 解码器
export { decodeAsfWasm } from "./wasmAsfDecoder";
export { decodeMpcWasm } from "./wasmMpcDecoder";

// 碰撞检测
export {
  checkAabbCollision,
  checkCircleCollision,
  initWasmCollision,
  isWasmCollisionAvailable,
  pointInCircle,
  pointInRect,
  WasmSpatialHashWrapper,
} from "./wasmCollision";

// 寻路
export {
  disposeWasmPathfinder,
  findPathWasm,
  initWasmPathfinder,
  isWasmPathfinderAvailable,
  setObstacle,
  updateObstacleBitmap,
  WasmPathType,
} from "./wasmPathFinder";
