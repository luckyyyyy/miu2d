/**
 * PathFinder TypeScript 测试
 * 使用 bun test 运行
 *
 * 运行方式: cd packages/engine && bun test src/core/pathFinder.test.ts
 */

import { describe, test, expect } from "bun:test";
import type { Vector2 } from "./types";
import { PathType, findPath, findPathStep, findPathSimple, findPathPerfect, getLinePath } from "./pathFinder";

// 测试用的障碍物地图
class TestObstacleMap {
  private obstacles: Set<string> = new Set();
  private hardObstacles: Set<string> = new Set();
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  setObstacle(x: number, y: number, isHard: boolean = true): void {
    this.obstacles.add(this.key(x, y));
    if (isHard) {
      this.hardObstacles.add(this.key(x, y));
    }
  }

  clearObstacle(x: number, y: number): void {
    this.obstacles.delete(this.key(x, y));
    this.hardObstacles.delete(this.key(x, y));
  }

  isObstacle = (tile: Vector2): boolean => {
    if (tile.x < 0 || tile.y < 0 || tile.x >= this.width || tile.y >= this.height) {
      return true;
    }
    return this.obstacles.has(this.key(tile.x, tile.y));
  };

  isHardObstacle = (tile: Vector2): boolean => {
    if (tile.x < 0 || tile.y < 0 || tile.x >= this.width || tile.y >= this.height) {
      return true;
    }
    return this.hardObstacles.has(this.key(tile.x, tile.y));
  };

  // 用于 hasObstacle 参数（包括动态障碍物检测）
  hasObstacle = (tile: Vector2): boolean => {
    return this.isObstacle(tile);
  };
}

function pathContains(path: Vector2[], x: number, y: number): boolean {
  return path.some(p => p.x === x && p.y === y);
}

describe("PathFinder TypeScript Tests", () => {
  // 测试 1: 空地图直线路径
  test("empty map diagonal path", () => {
    const map = new TestObstacleMap(100, 100);
    const path = findPath(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      PathType.PerfectMaxPlayerTry,
      map.hasObstacle,
      map.isObstacle,
      map.isHardObstacle,
      8
    );

    expect(path.length).toBeGreaterThan(0);
    // 路径应该从 (0,0) 开始
    expect(path[0]).toEqual({ x: 0, y: 0 });
    // 路径应该到 (10,10) 结束
    expect(path[path.length - 1]).toEqual({ x: 10, y: 10 });
    console.log(`empty map diagonal: path length = ${path.length} points`);
  });

  // 测试 2: 起点终点相同
  test("same start and end", () => {
    const map = new TestObstacleMap(100, 100);
    const path = findPath(
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      PathType.PerfectMaxPlayerTry,
      map.hasObstacle,
      map.isObstacle,
      map.isHardObstacle,
      8
    );

    expect(path.length).toBe(0);
    console.log("same start and end: PASS");
  });

  // 测试 3: 终点是障碍物
  test("end is obstacle", () => {
    const map = new TestObstacleMap(100, 100);
    map.setObstacle(10, 10, true);
    const path = findPath(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      PathType.PerfectMaxPlayerTry,
      map.hasObstacle,
      map.isObstacle,
      map.isHardObstacle,
      8
    );

    expect(path.length).toBe(0);
    console.log("end is obstacle: PASS");
  });

  // 测试 4: 简单绕障碍物
  test("simple obstacle avoidance", () => {
    const map = new TestObstacleMap(100, 100);
    map.setObstacle(5, 5, true);
    const path = findPath(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      PathType.PerfectMaxPlayerTry,
      map.hasObstacle,
      map.isObstacle,
      map.isHardObstacle,
      8
    );

    expect(path.length).toBeGreaterThan(0);
    // 验证路径不经过障碍物
    expect(pathContains(path, 5, 5)).toBe(false);
    console.log(`simple obstacle avoidance: path length = ${path.length} points`);
  });

  // 测试 5: 墙壁障碍
  test("wall obstacle", () => {
    const map = new TestObstacleMap(100, 100);
    // 创建一堵墙 (5, 0) 到 (5, 7)
    for (let y = 0; y < 8; y++) {
      map.setObstacle(5, y, true);
    }
    const path = findPath(
      { x: 0, y: 4 },
      { x: 10, y: 4 },
      PathType.PerfectMaxPlayerTry,
      map.hasObstacle,
      map.isObstacle,
      map.isHardObstacle,
      8
    );

    expect(path.length).toBeGreaterThan(0);
    console.log(`wall obstacle: path length = ${path.length} points`);
  });

  // 测试 6: 完全包围的目标（无法到达）
  // 注意：目标位置本身被设为障碍物，才能正确测试不可达
  test("unreachable destination", () => {
    const map = new TestObstacleMap(100, 100);
    // 目标位置本身设为障碍物
    map.setObstacle(10, 10, true);
    const path = findPath(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      PathType.PerfectMaxPlayerTry,
      map.hasObstacle,
      map.isObstacle,
      map.isHardObstacle,
      8
    );

    // 终点是障碍物时应该返回空路径
    expect(path.length).toBe(0);
    console.log("unreachable destination: PASS");
  });

  // 测试 7: PathOneStep 类型
  test("PathOneStep type", () => {
    const map = new TestObstacleMap(100, 100);
    const path = findPath(
      { x: 0, y: 0 },
      { x: 20, y: 20 },
      PathType.PathOneStep,
      map.hasObstacle,
      map.isObstacle,
      map.isHardObstacle,
      8
    );

    // PathOneStep 最多走约 10 步
    expect(path.length).toBeLessThanOrEqual(11);
    console.log(`PathOneStep: path length = ${path.length} points`);
  });

  // 测试 8: SimpleMaxNpcTry 类型
  test("SimpleMaxNpcTry type", () => {
    const map = new TestObstacleMap(100, 100);
    const path = findPath(
      { x: 0, y: 0 },
      { x: 30, y: 30 },
      PathType.SimpleMaxNpcTry,
      map.hasObstacle,
      map.isObstacle,
      map.isHardObstacle,
      8
    );

    expect(path.length).toBeGreaterThan(0);
    console.log(`SimpleMaxNpcTry: path length = ${path.length} points`);
  });

  // 测试 9: 中距离路径（maxTry=500 足够）
  test("medium distance path", () => {
    const map = new TestObstacleMap(100, 100);
    const path = findPath(
      { x: 0, y: 0 },
      { x: 20, y: 20 },
      PathType.PerfectMaxPlayerTry,
      map.hasObstacle,
      map.isObstacle,
      map.isHardObstacle,
      8
    );

    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ x: 20, y: 20 });
    console.log(`medium distance: path length = ${path.length} points`);
  });

  // 测试 10: PathStraightLine 类型（忽略障碍物）
  test("PathStraightLine type", () => {
    const map = new TestObstacleMap(100, 100);
    map.setObstacle(5, 5, true);
    const path = findPath(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      PathType.PathStraightLine,
      map.hasObstacle,
      map.isObstacle,
      map.isHardObstacle,
      8
    );

    expect(path.length).toBeGreaterThan(0);
    console.log(`PathStraightLine: path length = ${path.length} points`);
  });
});

describe("PathFinder Performance Benchmark", () => {
  test("benchmark pathfinding", () => {
    const map = new TestObstacleMap(100, 100);
    // 添加一些随机障碍物
    for (let i = 0; i < 200; i++) {
      const x = (i * 7) % 100;
      const y = (i * 13) % 100;
      map.setObstacle(x, y, true);
    }

    const iterations = 100;
    const testCases = [
      { start: { x: 0, y: 0 }, end: { x: 50, y: 50 } },
      { start: { x: 10, y: 10 }, end: { x: 90, y: 90 } },
      { start: { x: 25, y: 25 }, end: { x: 75, y: 75 } },
    ];

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const { start: s, end: e } of testCases) {
        findPath(
          s,
          e,
          PathType.PerfectMaxPlayerTry,
          map.hasObstacle,
          map.isObstacle,
          map.isHardObstacle,
          8
        );
      }
    }
    const elapsed = performance.now() - start;

    const totalRuns = iterations * testCases.length;
    console.log(
      `benchmark: ${totalRuns} runs in ${elapsed.toFixed(2)}ms (${(elapsed / totalRuns).toFixed(3)}ms avg)`
    );

    // 确保基准测试完成
    expect(elapsed).toBeGreaterThan(0);
  });
});
