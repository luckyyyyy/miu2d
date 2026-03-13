/**
 * Region Sprite Factory - 区域武功精灵创建
 * 从 SpriteFactory 提取，负责创建各种区域形状的武功精灵
 *
 * Reference: MagicManager.AddRegionBasedMagicSprite + private helpers
 */

import { logger } from "../../core/logger";
import type { Vector2 } from "../../core/types";
import { pixelToTile, tileToPixel } from "../../utils";
import { getDirectionIndex } from "../../utils/direction";
import { findNeighborInDirection } from "../../utils/path-finder";
import { MagicSprite } from "../magic-sprite";
import type { MagicData } from "../types";

/** 区域工厂所需的回调（最小子集） */
export interface RegionSpriteCallbacks {
  addMagicSprite(sprite: MagicSprite): void;
  addWorkItem(delayMs: number, sprite: MagicSprite): void;
}

/**
 * 区域武功精灵创建器
 * 处理 region 1-6 的各种区域形状
 */
export class RegionSpriteFactory {
  constructor(private callbacks: RegionSpriteCallbacks) {}

  /**
   * 区域武功分发入口（region switch）
   */
  addRegionBasedMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    switch (magic.region) {
      case 1:
        this.addSquare(userId, magic, destination, destroyOnEnd);
        break;
      case 2:
        this.addCross(userId, magic, origin, destroyOnEnd);
        break;
      case 3:
        this.addRectangle(userId, magic, origin, destination, destroyOnEnd);
        break;
      case 4:
        this.addIsoscelesTriangle(userId, magic, origin, destination, destroyOnEnd);
        break;
      case 5:
        this.addVType(userId, magic, origin, destination, destroyOnEnd);
        break;
      case 6:
        this.addRegionFile(userId, magic, destination, destroyOnEnd);
        break;
      default:
        logger.warn(`[SpriteFactory] Unknown Region: ${magic.region}`);
        break;
    }
  }

  // ========== 区域形状实现 ==========

  /** 方形区域 */
  private addSquare(
    userId: string,
    magic: MagicData,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const count = getRegionCount(magic.effectLevel);
    const offsetRow = { x: 32, y: 16 };
    const offsetColumn = { x: 32, y: -16 };
    const halfCount = Math.floor(count / 2);

    let pos = {
      x: destination.x - halfCount * offsetRow.x,
      y: destination.y - halfCount * offsetRow.y,
    };

    for (let i = 0; i < count; i++) {
      // C++ ref: Magic::addSquareEffect — if (i % 3 != 1 || j % 3 != 1) noLum = true
      const rowIdx = i;
      const noLumFn = (colIdx: number): boolean => rowIdx % 3 !== 1 || colIdx % 3 !== 1;
      addFixedWallAtPosition(
        this.callbacks,
        userId,
        magic,
        pos,
        offsetColumn,
        count,
        destroyOnEnd,
        undefined,
        noLumFn
      );
      pos = {
        x: pos.x + offsetRow.x,
        y: pos.y + offsetRow.y,
      };
    }
  }

  /** 十字区域 */
  private addCross(userId: string, magic: MagicData, origin: Vector2, destroyOnEnd: boolean): void {
    const count = getRegionCount(magic.effectLevel);
    const magicDelayMs = 60;
    const crossOffsets = [
      { x: 32, y: 16 },
      { x: 32, y: -16 },
      { x: -32, y: 16 },
      { x: -32, y: -16 },
    ];

    for (let i = 0; i < count; i++) {
      const delay = i * magicDelayMs;
      for (const offset of crossOffsets) {
        const pos = {
          x: origin.x + (i + 1) * offset.x,
          y: origin.y + (i + 1) * offset.y,
        };
        const sprite = MagicSprite.createFixed(userId, magic, pos, destroyOnEnd);
        this.callbacks.addWorkItem(delay, sprite);
      }
    }
  }

  /** 矩形区域（C++ addWaveEffect → mrWave = 3） */
  private addRectangle(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const directionIndex = getDirectionIndex(direction, 8);
    const columnCount = 5;
    const count = getRegionCount(magic.effectLevel);
    const magicDelayMs = 60;

    // C++ ref: Magic::addWaveEffect — if (i % 2 == 0 || j % 2 == 0) noLum = true
    const makeNoLumFn =
      (rowIdx: number) =>
      (colIdx: number): boolean =>
        rowIdx % 2 === 0 || colIdx % 2 === 0;

    switch (directionIndex) {
      case 1:
      case 3:
      case 5:
      case 7: {
        let beginPosition = { ...origin };
        let offsetColumn: Vector2;
        let offsetRow: Vector2;

        switch (directionIndex) {
          case 1:
            offsetColumn = { x: 32, y: 16 };
            offsetRow = { x: -32, y: 16 };
            break;
          case 3:
            offsetColumn = { x: 32, y: -16 };
            offsetRow = { x: -32, y: -16 };
            break;
          case 5:
            offsetColumn = { x: 32, y: 16 };
            offsetRow = { x: 32, y: -16 };
            break;
          default:
            offsetColumn = { x: 32, y: -16 };
            offsetRow = { x: 32, y: 16 };
            break;
        }

        for (let i = 0; i < count; i++) {
          beginPosition = {
            x: beginPosition.x + offsetRow.x,
            y: beginPosition.y + offsetRow.y,
          };
          addFixedWallAtPosition(
            this.callbacks,
            userId,
            magic,
            beginPosition,
            offsetColumn,
            columnCount,
            destroyOnEnd,
            i * magicDelayMs,
            makeNoLumFn(i)
          );
        }
        break;
      }
      case 0:
      case 4: {
        const offsetRow = directionIndex === 0 ? { x: 0, y: 32 } : { x: 0, y: -32 };
        let beginPosition = { ...origin };

        for (let i = 0; i < count; i++) {
          beginPosition = {
            x: beginPosition.x + offsetRow.x,
            y: beginPosition.y + offsetRow.y,
          };
          addHorizontalFixedWall(
            this.callbacks,
            userId,
            magic,
            beginPosition,
            columnCount,
            destroyOnEnd,
            i * magicDelayMs,
            makeNoLumFn(i)
          );
        }
        break;
      }
      case 2: {
        let beginPosition = { ...origin };
        const offsetColumn = { x: 0, y: 32 };

        for (let i = 0; i < count; i++) {
          if (i % 2 === 0) {
            beginPosition = { x: beginPosition.x - 32, y: beginPosition.y - 16 };
          } else {
            beginPosition = { x: beginPosition.x - 32, y: beginPosition.y + 16 };
          }
          addFixedWallAtPosition(
            this.callbacks,
            userId,
            magic,
            beginPosition,
            offsetColumn,
            columnCount,
            destroyOnEnd,
            i * magicDelayMs,
            makeNoLumFn(i)
          );
        }
        break;
      }
      case 6: {
        let beginPosition = { ...origin };
        const offsetColumn = { x: 0, y: 32 };

        for (let i = 0; i < count; i++) {
          if (i % 2 === 0) {
            beginPosition = { x: beginPosition.x + 32, y: beginPosition.y + 16 };
          } else {
            beginPosition = { x: beginPosition.x + 32, y: beginPosition.y - 16 };
          }
          addFixedWallAtPosition(
            this.callbacks,
            userId,
            magic,
            beginPosition,
            offsetColumn,
            columnCount,
            destroyOnEnd,
            i * magicDelayMs,
            makeNoLumFn(i)
          );
        }
        break;
      }
    }
  }

  /** 等腰三角形区域 */
  private addIsoscelesTriangle(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const directionIndex = getDirectionIndex(direction, 8);

    const rowOffsets = [
      { x: 0, y: 32 },
      { x: -32, y: 16 },
      { x: -64, y: 0 },
      { x: -32, y: -16 },
      { x: 0, y: -32 },
      { x: 32, y: -16 },
      { x: 64, y: 0 },
      { x: 32, y: 16 },
    ];
    const columnOffsets = [
      { x: 64, y: 0 },
      { x: -32, y: -16 },
      { x: 0, y: 32 },
      { x: -32, y: 16 },
      { x: 64, y: 0 },
      { x: 32, y: 16 },
      { x: 0, y: 32 },
      { x: 32, y: -16 },
    ];

    const rowOffset = rowOffsets[directionIndex];
    const columnOffset = columnOffsets[directionIndex];

    const count = getRegionCount(magic.effectLevel);
    const magicDelayMs = 60;

    let beginPos = { ...origin };
    for (let i = 0; i < count; i++) {
      beginPos = {
        x: beginPos.x + rowOffset.x,
        y: beginPos.y + rowOffset.y,
      };
      addFixedWallAtPosition(
        this.callbacks,
        userId,
        magic,
        beginPos,
        columnOffset,
        1 + i * 2,
        destroyOnEnd,
        i * magicDelayMs
      );
    }
  }

  /** V形区域 */
  private addVType(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = { x: destination.x - origin.x, y: destination.y - origin.y };
    const directionIndex = getDirectionIndex(direction, 8);

    const count = getRegionCount(magic.effectLevel);
    const magicDelayMs = 60;

    const originTile = pixelToTile(origin.x, origin.y);
    const startTile = findNeighborInDirection(originTile, directionIndex);
    const startPos = tileToPixel(startTile.x, startTile.y);

    const sprite = MagicSprite.createFixed(userId, magic, startPos, destroyOnEnd);
    this.callbacks.addMagicSprite(sprite);

    let leftTile = { ...startTile };
    let rightTile = { ...startTile };

    for (let i = 1; i < count; i++) {
      leftTile = findNeighborInDirection(leftTile, (directionIndex + 7) % 8);
      rightTile = findNeighborInDirection(rightTile, (directionIndex + 1) % 8);

      const leftPos = tileToPixel(leftTile.x, leftTile.y);
      const rightPos = tileToPixel(rightTile.x, rightTile.y);

      const leftSprite = MagicSprite.createFixed(userId, magic, leftPos, destroyOnEnd);
      this.callbacks.addWorkItem(i * magicDelayMs, leftSprite);

      const rightSprite = MagicSprite.createFixed(userId, magic, rightPos, destroyOnEnd);
      this.callbacks.addWorkItem(i * magicDelayMs, rightSprite);
    }
  }

  /** 区域文件（未完全实现，回退到固定位置） */
  private addRegionFile(
    userId: string,
    magic: MagicData,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    logger.log(`[SpriteFactory] RegionFile magic not fully implemented: ${magic.name}`);
    const sprite = MagicSprite.createFixed(userId, magic, destination, destroyOnEnd);
    this.callbacks.addMagicSprite(sprite);
  }
}

// ========== 纯工具函数 ==========

/** 根据 effectLevel 计算区域武功数量 */
function getRegionCount(effectLevel: number): number {
  let count = 3;
  if (effectLevel > 3) {
    count += Math.floor((effectLevel - 1) / 3) * 2;
  }
  return count;
}

/** 在指定位置添加固定墙（支持可选延迟和 noLum 判断）
 *
 * @param noLumFn 可选。接收列索引 (0-based)，返回 true 表示该精灵应设置 noLum
 * C++ ref: Magic::addSquareEffect / addWaveEffect 中对子弹 noLum 的稀疏采样
 */
function addFixedWallAtPosition(
  callbacks: RegionSpriteCallbacks,
  userId: string,
  magic: MagicData,
  center: Vector2,
  offset: Vector2,
  count: number,
  destroyOnEnd: boolean,
  delay?: number,
  noLumFn?: (colIndex: number) => boolean
): void {
  const add = (s: MagicSprite) =>
    delay != null ? callbacks.addWorkItem(delay, s) : callbacks.addMagicSprite(s);
  const halfCount = Math.floor((count - 1) / 2);

  const centerSprite = MagicSprite.createFixed(userId, magic, center, destroyOnEnd);
  if (noLumFn?.(halfCount)) centerSprite.noLum = true;
  add(centerSprite);

  for (let i = 1; i <= halfCount; i++) {
    const pos1 = { x: center.x + offset.x * i, y: center.y + offset.y * i };
    const pos2 = { x: center.x - offset.x * i, y: center.y - offset.y * i };

    const sprite1 = MagicSprite.createFixed(userId, magic, pos1, destroyOnEnd);
    if (noLumFn?.(halfCount + i)) sprite1.noLum = true;
    add(sprite1);

    const sprite2 = MagicSprite.createFixed(userId, magic, pos2, destroyOnEnd);
    if (noLumFn?.(halfCount - i)) sprite2.noLum = true;
    add(sprite2);
  }
}

/** 水平固定墙武功
 *
 * @param noLumFn 可选。接收列索引 (0-based)，返回 true 表示该精灵应设置 noLum
 */
function addHorizontalFixedWall(
  callbacks: RegionSpriteCallbacks,
  userId: string,
  magic: MagicData,
  wallMiddle: Vector2,
  count: number,
  destroyOnEnd: boolean,
  delay: number,
  noLumFn?: (colIndex: number) => boolean
): void {
  const halfCount = Math.floor(count / 2);
  const position = { ...wallMiddle };

  const centerSprite = MagicSprite.createFixed(userId, magic, position, destroyOnEnd);
  if (noLumFn?.(halfCount)) centerSprite.noLum = true;
  callbacks.addWorkItem(delay, centerSprite);

  let newPositionLeft = { ...position };
  let newPositionRight = { ...position };

  for (let i = 0; i < halfCount; i++) {
    if (i % 2 === 0) {
      newPositionLeft = { x: newPositionLeft.x - 32, y: newPositionLeft.y - 16 };
      newPositionRight = { x: newPositionRight.x + 32, y: newPositionRight.y - 16 };
    } else {
      newPositionLeft = { x: newPositionLeft.x - 32, y: newPositionLeft.y + 16 };
      newPositionRight = { x: newPositionRight.x + 32, y: newPositionRight.y + 16 };
    }

    const leftSprite = MagicSprite.createFixed(userId, magic, newPositionLeft, destroyOnEnd);
    if (noLumFn?.(halfCount - i - 1)) leftSprite.noLum = true;
    callbacks.addWorkItem(delay, leftSprite);

    const rightSprite = MagicSprite.createFixed(userId, magic, newPositionRight, destroyOnEnd);
    if (noLumFn?.(halfCount + i + 1)) rightSprite.noLum = true;
    callbacks.addWorkItem(delay, rightSprite);
  }
}
