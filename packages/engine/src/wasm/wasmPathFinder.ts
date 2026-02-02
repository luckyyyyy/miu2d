/**
 * WASM PathFinder 桥接层
 * 提供与原生 TypeScript pathFinder.ts 相同的接口
 *
 * 使用方式:
 * 1. 调用 initWasmPathfinder() 初始化
 * 2. 使用 findPathWasm() 替代 findPath()
 */

import type { Vector2 } from "../core/types";
import { logger } from "../core/logger";

// WASM 模块类型定义
interface WasmPathFinder {
  new (mapWidth: number, mapHeight: number): WasmPathFinder;
  set_obstacle_bitmap(bitmap: Uint8Array, hardBitmap: Uint8Array): void;
  set_obstacle(x: number, y: number, isObstacle: boolean, isHard: boolean): void;
  find_path(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    pathType: number,
    canMoveDirectionCount: number
  ): Int32Array;
}

interface WasmModule {
  PathFinder: new (mapWidth: number, mapHeight: number) => WasmPathFinder;
  PathType: {
    PathOneStep: number;
    SimpleMaxNpcTry: number;
    PerfectMaxNpcTry: number;
    PerfectMaxPlayerTry: number;
    PathStraightLine: number;
  };
}

let wasmModule: WasmModule | null = null;
let wasmPathfinder: WasmPathFinder | null = null;
let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

/**
 * 初始化 WASM 寻路模块
 */
export async function initWasmPathfinder(
  mapWidth: number,
  mapHeight: number
): Promise<boolean> {
  if (isInitialized && wasmPathfinder) {
    return true;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // 动态导入 WASM 模块
      const wasm = await import("@miu2d/engine-wasm");
      await wasm.default(); // 初始化 WASM

      wasmModule = wasm as unknown as WasmModule;
      wasmPathfinder = new wasmModule.PathFinder(mapWidth, mapHeight);
      isInitialized = true;

      logger.info(`[WasmPathFinder] Initialized with map size ${mapWidth}x${mapHeight}`);
      return true;
    } catch (error) {
      logger.warn("[WasmPathFinder] Failed to initialize, falling back to JS implementation", error);
      return false;
    }
  })();

  return initPromise;
}

/**
 * 检查 WASM 是否可用
 */
export function isWasmPathfinderAvailable(): boolean {
  return isInitialized && wasmPathfinder !== null;
}

/**
 * 更新障碍物位图
 */
export function updateObstacleBitmap(
  bitmap: Uint8Array,
  hardBitmap: Uint8Array
): void {
  if (!wasmPathfinder) return;
  wasmPathfinder.set_obstacle_bitmap(bitmap, hardBitmap);
}

/**
 * 设置单个障碍物
 */
export function setObstacle(
  x: number,
  y: number,
  isObstacle: boolean,
  isHard: boolean
): void {
  if (!wasmPathfinder) return;
  wasmPathfinder.set_obstacle(x, y, isObstacle, isHard);
}

/**
 * PathType 枚举（与 pathFinder.ts 保持一致）
 */
export enum WasmPathType {
  PathOneStep = 0,
  SimpleMaxNpcTry = 1,
  PerfectMaxNpcTry = 2,
  PerfectMaxPlayerTry = 3,
  PathStraightLine = 4,
}

/**
 * WASM 寻路
 * 返回格式与原 findPath 相同
 */
export function findPathWasm(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  pathType: WasmPathType = WasmPathType.PerfectMaxPlayerTry,
  canMoveDirectionCount: number = 8
): Vector2[] {
  if (!wasmPathfinder) {
    logger.warn("[WasmPathFinder] Not initialized");
    return [];
  }

  const result = wasmPathfinder.find_path(
    startX,
    startY,
    endX,
    endY,
    pathType,
    canMoveDirectionCount
  );

  // 转换 Int32Array [x1, y1, x2, y2, ...] 为 Vector2[]
  const path: Vector2[] = [];
  for (let i = 0; i < result.length; i += 2) {
    path.push({ x: result[i], y: result[i + 1] });
  }

  return path;
}

/**
 * 销毁 WASM 模块
 */
export function disposeWasmPathfinder(): void {
  wasmPathfinder = null;
  wasmModule = null;
  isInitialized = false;
  initPromise = null;
}
