/**
 * PathFinderService - 统一的寻路服务
 * 
 * 使用 WASM 实现，自动管理障碍物同步
 * 替代原来的 pathFinder.ts 中的 findPath
 */

import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import {
  initWasmPathfinder,
  findPathWasm,
  setObstacle,
  isWasmPathfinderAvailable,
  disposeWasmPathfinder,
  WasmPathType,
} from "./wasmPathFinder";
import { PathType, findPath as findPathTS } from "../core/pathFinder";

// 地图障碍物缓存
interface ObstacleCache {
  mapWidth: number;
  mapHeight: number;
  // 动态障碍物 (NPC/Obj 位置)
  dynamicObstacles: Map<string, { isHard: boolean }>;
}

let obstacleCache: ObstacleCache | null = null;
let useWasm = false;
let mapObstacleChecker: ((tile: Vector2) => boolean) | null = null;
let hardObstacleChecker: ((tile: Vector2) => boolean) | null = null;

/**
 * 初始化寻路服务
 * @param mapWidth 地图宽度
 * @param mapHeight 地图高度
 * @param isMapObstacle 地图静态障碍物检查函数
 * @param isHardObstacle 硬障碍物检查函数
 */
export async function initPathFinderService(
  mapWidth: number,
  mapHeight: number,
  isMapObstacle: (tile: Vector2) => boolean,
  isHardObstacle: (tile: Vector2) => boolean
): Promise<boolean> {
  mapObstacleChecker = isMapObstacle;
  hardObstacleChecker = isHardObstacle;

  // 尝试初始化 WASM
  const wasmReady = await initWasmPathfinder(mapWidth, mapHeight);

  if (wasmReady) {
    obstacleCache = {
      mapWidth,
      mapHeight,
      dynamicObstacles: new Map(),
    };

    // 同步静态障碍物到 WASM
    syncStaticObstacles(mapWidth, mapHeight, isMapObstacle, isHardObstacle);
    useWasm = true;
    logger.info(`[PathFinderService] Using WASM implementation`);
  } else {
    useWasm = false;
    logger.info(`[PathFinderService] Fallback to TypeScript implementation`);
  }

  return wasmReady;
}

/**
 * 同步地图静态障碍物到 WASM
 */
function syncStaticObstacles(
  mapWidth: number,
  mapHeight: number,
  isMapObstacle: (tile: Vector2) => boolean,
  isHardObstacle: (tile: Vector2) => boolean
): void {
  let obstacleCount = 0;

  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const tile = { x, y };
      const isObstacle = isMapObstacle(tile);
      const isHard = isHardObstacle(tile);

      if (isObstacle || isHard) {
        setObstacle(x, y, isObstacle, isHard);
        if (isObstacle) obstacleCount++;
      }
    }
  }

  logger.debug(`[PathFinderService] Synced ${obstacleCount} static obstacles`);
}

/**
 * 添加动态障碍物（NPC、Obj 等）
 */
export function addDynamicObstacle(x: number, y: number, isHard: boolean = false): void {
  if (!obstacleCache) return;

  const key = `${x},${y}`;
  obstacleCache.dynamicObstacles.set(key, { isHard });

  if (useWasm) {
    setObstacle(x, y, true, isHard);
  }
}

/**
 * 移除动态障碍物
 */
export function removeDynamicObstacle(x: number, y: number): void {
  if (!obstacleCache) return;

  const key = `${x},${y}`;
  obstacleCache.dynamicObstacles.delete(key);

  if (useWasm && mapObstacleChecker && hardObstacleChecker) {
    // 恢复为静态障碍物状态
    const tile = { x, y };
    const isStatic = mapObstacleChecker(tile);
    const isHard = hardObstacleChecker(tile);
    setObstacle(x, y, isStatic, isHard);
  }
}

/**
 * 批量更新动态障碍物
 */
export function updateDynamicObstacles(
  obstacles: Array<{ x: number; y: number; isHard?: boolean }>
): void {
  if (!obstacleCache) return;

  // 清除旧的动态障碍物
  for (const [key] of obstacleCache.dynamicObstacles) {
    const [x, y] = key.split(",").map(Number);
    if (useWasm && mapObstacleChecker && hardObstacleChecker) {
      const tile = { x, y };
      const isStatic = mapObstacleChecker(tile);
      const isHard = hardObstacleChecker(tile);
      setObstacle(x, y, isStatic, isHard);
    }
  }
  obstacleCache.dynamicObstacles.clear();

  // 添加新的动态障碍物
  for (const obs of obstacles) {
    const key = `${obs.x},${obs.y}`;
    obstacleCache.dynamicObstacles.set(key, { isHard: obs.isHard ?? false });

    if (useWasm) {
      setObstacle(obs.x, obs.y, true, obs.isHard ?? false);
    }
  }
}

/**
 * 转换 PathType 到 WasmPathType
 */
function toWasmPathType(pathType: PathType): WasmPathType {
  switch (pathType) {
    case PathType.PathOneStep:
      return WasmPathType.PathOneStep;
    case PathType.SimpleMaxNpcTry:
      return WasmPathType.SimpleMaxNpcTry;
    case PathType.PerfectMaxNpcTry:
      return WasmPathType.PerfectMaxNpcTry;
    case PathType.PerfectMaxPlayerTry:
      return WasmPathType.PerfectMaxPlayerTry;
    case PathType.PathStraightLine:
      return WasmPathType.PathStraightLine;
    default:
      return WasmPathType.PerfectMaxPlayerTry;
  }
}

/**
 * 统一寻路接口 - 自动选择 WASM 或 TS 实现
 * 
 * 注意：当使用 WASM 时，hasObstacle/isMapObstacle/isHardObstacle 参数会被忽略，
 * 因为障碍物状态已经在 WASM 中维护。
 */
export function findPath(
  startTile: Vector2,
  endTile: Vector2,
  pathType: PathType,
  hasObstacle: (tile: Vector2) => boolean,
  isMapObstacle: (tile: Vector2) => boolean,
  isHardObstacle: (tile: Vector2) => boolean,
  canMoveDirectionCount: number = 8
): Vector2[] {
  if (useWasm && isWasmPathfinderAvailable()) {
    return findPathWasm(
      startTile.x,
      startTile.y,
      endTile.x,
      endTile.y,
      toWasmPathType(pathType),
      canMoveDirectionCount
    );
  }

  // Fallback to TypeScript
  return findPathTS(
    startTile,
    endTile,
    pathType,
    hasObstacle,
    isMapObstacle,
    isHardObstacle,
    canMoveDirectionCount
  );
}

/**
 * 检查寻路服务是否使用 WASM
 */
export function isUsingWasm(): boolean {
  return useWasm && isWasmPathfinderAvailable();
}

/**
 * 销毁寻路服务
 */
export function disposePathFinderService(): void {
  obstacleCache = null;
  mapObstacleChecker = null;
  hardObstacleChecker = null;
  useWasm = false;
  disposeWasmPathfinder();
}

// 重新导出 PathType 以便直接使用
export { PathType } from "../core/pathFinder";
