/**
 * SnowFlake - 雪花粒子
 * 基于JxqyHD/Engine/Weather/SnowFlake.cs
 *
 * 雪花是带有速度和方向的精灵，随风飘落
 */

import type { IRenderer } from "../webgl/IRenderer";

/** 雪花形状类型（对应4 种纹理） */
export type SnowFlakeType = 0 | 1 | 2 | 3;

export class SnowFlake {
  /** 在世界中的位置 */
  positionInWorld: { x: number; y: number };

  /** 移动方向（归一化向量） */
  private direction: { x: number; y: number };

  /** 移动速度（像素/秒） */
  private velocity: number;

  /** 已移动的 Y 距离（用于判断是否飘出屏幕） */
  movedYDistance: number = 0;

  /** 雪花类型（决定外观） */
  readonly type: SnowFlakeType;

  constructor(
    positionInWorld: { x: number; y: number },
    direction: { x: number; y: number },
    velocity: number,
    type: SnowFlakeType
  ) {
    this.positionInWorld = { ...positionInWorld };
    this.velocity = velocity;
    this.type = type;

    // 归一化方向向量
    const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (len > 0) {
      this.direction = { x: direction.x / len, y: direction.y / len };
    } else {
      this.direction = { x: 0, y: 1 };
    }
  }

  /**
   * 更新雪花位置
   * MoveTo(_direction, elapsedSeconds)
   */
  update(deltaTime: number): void {
    const moveX = this.direction.x * this.velocity * deltaTime;
    const moveY = this.direction.y * this.velocity * deltaTime;

    this.positionInWorld.x += moveX;
    this.positionInWorld.y += moveY;
    this.movedYDistance += Math.abs(moveY);
  }

  /**
   * 绘制雪花（调用方应统一设置颜色）
   * 使用 4 种不同的雪花纹理
   * 性能优化：由调用方批量设置颜色
   */
  draw(renderer: IRenderer, cameraX: number, cameraY: number, color: string): void {
    const screenX = this.positionInWorld.x - cameraX;
    const screenY = this.positionInWorld.y - cameraY;

    switch (this.type) {
      case 0:
        // 3x3 十字形
        renderer.fillRect({ x: screenX + 1, y: screenY, width: 1, height: 1, color });
        renderer.fillRect({ x: screenX, y: screenY + 1, width: 3, height: 1, color });
        renderer.fillRect({ x: screenX + 1, y: screenY + 2, width: 1, height: 1, color });
        break;

      case 1:
        // 2x2 对角线（左上-右下）
        renderer.fillRect({ x: screenX + 1, y: screenY, width: 1, height: 1, color });
        renderer.fillRect({ x: screenX, y: screenY + 1, width: 1, height: 1, color });
        break;

      case 2:
        // 2x2 对角线（右上-左下）
        renderer.fillRect({ x: screenX, y: screenY, width: 1, height: 1, color });
        renderer.fillRect({ x: screenX + 1, y: screenY + 1, width: 1, height: 1, color });
        break;

      case 3:
        // 1x1 单点
        renderer.fillRect({ x: screenX, y: screenY, width: 1, height: 1, color });
        break;
    }
  }
}
