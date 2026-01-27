/**
 * MagicSprites - 武功精灵创建和添加逻辑
 * 提取自 MagicManager，对应各种 MoveKind 的武功添加方法
 */

import type { Vector2 } from "../core/types";
import type { MagicData, MagicSpriteState } from "./types";
import { MagicMoveKind } from "./types";
import { pixelToTile } from "../core/utils";
import {
  MAGIC_BASE_SPEED,
  normalizeVector,
  getDirectionIndex,
  getDirection8,
  getDirection32List,
  getSpeedRatio,
  getVOffsets,
  getDirectionOffset8,
} from "./magicUtils";

// 工作项 - 延迟添加的武功
export interface WorkItem {
  leftMilliseconds: number;
  sprite: MagicSpriteState;
  spriteIndex: number;
}

/**
 * 武功精灵创建器
 * 负责创建和配置不同类型的武功精灵
 */
export class MagicSpriteFactory {
  private spriteIndex: number = 0;

  /**
   * 获取下一个精灵ID
   */
  nextSpriteId(): number {
    return this.spriteIndex++;
  }

  /**
   * 重置精灵ID计数器
   */
  resetSpriteIndex(): void {
    this.spriteIndex = 0;
  }

  /**
   * 创建武功精灵状态
   * C# Reference: MagicSprite constructor and Init method
   */
  createMagicSprite(
    userId: string,
    magic: MagicData,
    position: Vector2,
    velocity: number,
    direction: Vector2,
    destroyOnEnd: boolean
  ): MagicSpriteState {
    const normalizedDir = normalizeVector(direction);
    const directionIndex = getDirectionIndex(normalizedDir, 8);

    // C# Reference: MagicSprite.Begin()
    // if (Velocity > 0 && MoveDirection != Vector2.Zero) { Move 30 pixels forward }
    // 这样魔法会从角色前方开始，而不是从脚底开始
    let startPosition = { ...position };
    if (velocity > 0 && (normalizedDir.x !== 0 || normalizedDir.y !== 0)) {
      const initialOffset = 30; // C# 中是移动 30 像素
      startPosition = {
        x: position.x + normalizedDir.x * initialOffset,
        y: position.y + normalizedDir.y * initialOffset,
      };
    }

    // C# Reference: MagicSprite.ResetPlay()
    // LifeFrame 表示播放的帧数，LifeFrame=0 时默认播放一轮动画（FrameCountsPerDirection）
    // 假设每方向4帧，这个值之后会被 ASF 数据覆盖
    const framesPerDirection = 4; // 默认值，之后由渲染器根据实际 ASF 数据更新

    // C# 中 LifeFrame 就是要播放的总帧数
    // 如果 LifeFrame == 0，则播放一轮（FrameCountsPerDirection）
    // 重要：LifeFrame=0 时，totalFrames 初始设为很大的值，等待渲染器从 ASF 获取正确的帧数后更新
    // 这样可以避免在 ASF 加载前就因为 playedFrames >= totalFrames 而提前结束
    //
    // 特殊处理 MoveKind=13 (FollowCharacter) 的帧数计算：
    // C# Reference: MagicSprite.ResetPlay()
    // else if (BelongMagic.MoveKind == 13)
    // {
    //     var interval = Interval == 0 ? 1000 / 60 : Interval;
    //     framesToPlay = (int)(BelongMagic.LifeFrame * 10f / interval);
    // }
    // 对于跟随角色的武功，LifeFrame 是以毫秒*0.1为单位的持续时间
    let totalFrames: number;
    if (magic.moveKind === MagicMoveKind.FollowCharacter || magic.moveKind === MagicMoveKind.TimeStop) {
      // MoveKind=13, 23: LifeFrame 是持续时间参数
      // interval 默认约 16.67ms (60fps)
      const interval = 1000 / 60; // ~16.67ms
      totalFrames = magic.lifeFrame > 0 ? Math.floor(magic.lifeFrame * 10 / interval) : 999999;
    } else {
      totalFrames = magic.lifeFrame > 0 ? magic.lifeFrame : 999999;
    }

    const frameInterval = 50; // 每帧50ms (20fps)

    return {
      id: this.spriteIndex++,
      magic,
      belongCharacterId: userId,
      position: startPosition,
      tilePosition: pixelToTile(startPosition.x, startPosition.y),
      direction: normalizedDir,
      velocity,
      destination: { x: position.x + direction.x * 1000, y: position.y + direction.y * 1000 },
      currentFrame: 0,
      framesPerDirection,
      vanishFramesPerDirection: framesPerDirection, // 默认与飞行动画相同
      totalFrames,
      playedFrames: 0,
      frameInterval,
      frameElapsed: 0,
      isDestroyed: false,
      isInDestroy: false,
      destroyOnEnd,
      elapsedMilliseconds: 0,
      waitMilliseconds: magic.waitFrame * 16, // 约60fps
      currentEffect: magic.effect,
      currentEffect2: magic.effect2,
      currentEffect3: magic.effect3,
      currentEffectMana: magic.effectMana,
      movedDistance: 0,
      directionIndex,
      passThroughedTargets: [],
      flyingAsfPath: magic.flyingImage,
      vanishAsfPath: magic.vanishImage,
    };
  }
}

/**
 * 武功添加器
 * 负责添加各种类型的武功
 */
export class MagicSpriteAdder {
  private factory: MagicSpriteFactory;
  private addMagicSprite: (sprite: MagicSpriteState) => void;
  private addWorkItem: (delayMs: number, sprite: MagicSpriteState) => void;

  constructor(
    factory: MagicSpriteFactory,
    addMagicSprite: (sprite: MagicSpriteState) => void,
    addWorkItem: (delayMs: number, sprite: MagicSpriteState) => void
  ) {
    this.factory = factory;
    this.addMagicSprite = addMagicSprite;
    this.addWorkItem = addWorkItem;
  }

  /**
   * 添加固定位置武功
   */
  addFixedPositionMagicSprite(
    userId: string,
    magic: MagicData,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const sprite = this.factory.createMagicSprite(
      userId,
      magic,
      destination,
      0,
      { x: 0, y: 0 },
      destroyOnEnd
    );
    this.addMagicSprite(sprite);
  }

  /**
   * 添加单体移动武功（自由方向）
   * C# Reference: GetMoveMagicSprite - uses destination - origin as direction (NOT quantized to 8 directions)
   * This is for MoveKind=2 (SingleMove)
   */
  addSingleMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    // 使用 destination - origin 作为方向，不做量化
    const direction = {
      x: destination.x - origin.x,
      y: destination.y - origin.y,
    };

    // 计算速度 - 注意这里不需要量化到8方向，直接使用原始方向计算 speedRatio
    const normalizedDir = normalizeVector(direction);
    const speedRatio = getSpeedRatio(normalizedDir);
    const velocity = MAGIC_BASE_SPEED * magic.speed * speedRatio;

    console.log(`[MagicManager] SingleMove calculation:`);
    console.log(`  Origin: (${origin.x.toFixed(0)}, ${origin.y.toFixed(0)})`);
    console.log(`  Destination: (${destination.x.toFixed(0)}, ${destination.y.toFixed(0)})`);
    console.log(`  Direction (free): (${direction.x.toFixed(0)}, ${direction.y.toFixed(0)})`);
    console.log(`  Normalized: (${normalizedDir.x.toFixed(3)}, ${normalizedDir.y.toFixed(3)})`);
    console.log(`  Velocity: ${velocity.toFixed(0)}`);

    const sprite = this.factory.createMagicSprite(
      userId,
      magic,
      origin,
      velocity,
      direction, // 使用原始方向，不是量化后的方向
      destroyOnEnd
    );
    sprite.destination = { ...destination };
    this.addMagicSprite(sprite);
  }

  /**
   * 添加直线移动武功
   */
  addLineMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = {
      x: destination.x - origin.x,
      y: destination.y - origin.y,
    };
    const speedRatio = getSpeedRatio(normalizeVector(direction));
    const velocity = MAGIC_BASE_SPEED * magic.speed * speedRatio;

    const level = magic.effectLevel < 1 ? 1 : magic.effectLevel;
    const magicDelayMs = 60;

    for (let i = 0; i < level; i++) {
      const sprite = this.factory.createMagicSprite(
        userId,
        magic,
        origin,
        velocity,
        direction,
        destroyOnEnd
      );
      sprite.destination = { ...destination };
      this.addWorkItem(magicDelayMs * i, sprite);
    }
  }

  /**
   * 添加V字移动武功
   */
  addVMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = normalizeVector({
      x: destination.x - origin.x,
      y: destination.y - origin.y,
    });
    const directionIndex = getDirectionIndex(direction, 8);
    const dir = getDirection8(directionIndex);
    const speedRatio = getSpeedRatio(dir);
    const velocity = MAGIC_BASE_SPEED * magic.speed * speedRatio;

    const rawDir = { x: destination.x - origin.x, y: destination.y - origin.y };
    // Direction system: 0=South, 1=SW, 2=West, 3=NW, 4=North, 5=NE, 6=East, 7=SE
    const dirNames = ["South", "Southwest", "West", "Northwest", "North", "Northeast", "East", "Southeast"];
    console.log(`[MagicManager] VMove calculation:`);
    console.log(`  Raw direction: (${rawDir.x.toFixed(0)}, ${rawDir.y.toFixed(0)})`);
    console.log(`  |X|=${Math.abs(rawDir.x).toFixed(0)}, |Y|=${Math.abs(rawDir.y).toFixed(0)}`);
    console.log(`  Direction: ${dirNames[directionIndex]} (${directionIndex})`);
    console.log(`  Move vector: (${dir.x.toFixed(2)}, ${dir.y.toFixed(2)}), velocity=${velocity.toFixed(0)}`);

    const level = magic.effectLevel < 1 ? 1 : magic.effectLevel;

    // 中心武功
    const centerSprite = this.factory.createMagicSprite(
      userId,
      magic,
      origin,
      velocity,
      dir,
      destroyOnEnd
    );
    this.addMagicSprite(centerSprite);
    console.log(`[MagicManager] VMove center: pos=(${origin.x.toFixed(0)}, ${origin.y.toFixed(0)})`);

    // 两侧武功 - 根据 C# 代码，level=1 时两侧各1个
    const offsets = getVOffsets(directionIndex);
    for (let i = 1; i <= level; i++) {
      for (const offset of offsets) {
        const offsetPos = {
          x: origin.x + offset.x * i,
          y: origin.y + offset.y * i,
        };
        const sprite = this.factory.createMagicSprite(
          userId,
          magic,
          offsetPos,
          velocity,
          dir,
          destroyOnEnd
        );
        this.addMagicSprite(sprite);
        console.log(`[MagicManager] VMove side: pos=(${offsetPos.x.toFixed(0)}, ${offsetPos.y.toFixed(0)}), offset=(${offset.x}, ${offset.y})`);
      }
    }
  }

  /**
   * 添加圆形移动武功
   */
  addCircleMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): void {
    const directions = getDirection32List();
    for (const dir of directions) {
      const speedRatio = getSpeedRatio(dir);
      const velocity = MAGIC_BASE_SPEED * magic.speed * speedRatio;
      const sprite = this.factory.createMagicSprite(
        userId,
        magic,
        origin,
        velocity,
        dir,
        destroyOnEnd
      );
      this.addMagicSprite(sprite);
    }
  }

  /**
   * 添加扇形移动武功
   */
  addSectorMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = {
      x: destination.x - origin.x,
      y: destination.y - origin.y,
    };
    const directionIndex = getDirectionIndex(direction, 8);
    const dir32Index = directionIndex * 4; // 8方向转32方向
    const directions = getDirection32List();

    let count = 1;
    if (magic.effectLevel > 0) {
      count += Math.floor((magic.effectLevel - 1) / 3);
    }

    // 中心方向
    const centerDir = directions[dir32Index];
    const centerSpeedRatio = getSpeedRatio(centerDir);
    const centerSprite = this.factory.createMagicSprite(
      userId,
      magic,
      origin,
      MAGIC_BASE_SPEED * magic.speed * centerSpeedRatio,
      centerDir,
      destroyOnEnd
    );
    this.addMagicSprite(centerSprite);

    // 两侧
    for (let i = 1; i <= count; i++) {
      const leftIdx = (dir32Index + i * 2) % 32;
      const rightIdx = (dir32Index + 32 - i * 2) % 32;

      const leftDir = directions[leftIdx];
      const rightDir = directions[rightIdx];

      const leftSprite = this.factory.createMagicSprite(
        userId,
        magic,
        origin,
        MAGIC_BASE_SPEED * magic.speed * getSpeedRatio(leftDir),
        leftDir,
        destroyOnEnd
      );
      this.addMagicSprite(leftSprite);

      const rightSprite = this.factory.createMagicSprite(
        userId,
        magic,
        origin,
        MAGIC_BASE_SPEED * magic.speed * getSpeedRatio(rightDir),
        rightDir,
        destroyOnEnd
      );
      this.addMagicSprite(rightSprite);
    }
  }

  /**
   * 添加心形移动武功
   * TODO: 实现心形移动模式
   */
  addHeartMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): void {
    console.warn('[MagicManager] HeartMove not implemented, falling back to CircleMove');
    this.addCircleMoveMagicSprite(userId, magic, origin, destroyOnEnd);
  }

  /**
   * 添加螺旋移动武功
   * TODO: 实现螺旋移动模式
   */
  addSpiralMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    console.warn('[MagicManager] SpiralMove not implemented, falling back to SingleMove');
    this.addSingleMoveMagicSprite(userId, magic, origin, destination, destroyOnEnd);
  }

  /**
   * 添加随机扇形移动武功
   * TODO: 实现随机扇形移动模式
   */
  addRandomSectorMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    console.warn('[MagicManager] RandomSectorMove not implemented, falling back to SectorMove');
    this.addSectorMoveMagicSprite(userId, magic, origin, destination, destroyOnEnd);
  }

  /**
   * 添加墙移动武功
   * TODO: 实现墙移动模式
   */
  addWallMoveMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    console.warn('[MagicManager] WallMove not implemented, falling back to FixedWall');
    this.addFixedWallMagicSprite(userId, magic, origin, destination, destroyOnEnd);
  }

  /**
   * 添加超级模式武功 (MoveKind=15)
   * C# Reference: MagicManager.AddSuperModeMagic
   *
   * 超级模式是全屏攻击：
   * 1. 创建一个固定精灵使用 SuperModeImage
   * 2. 动画结束时对屏幕内所有敌人造成伤害
   * 3. 每个敌人位置显示 VanishImage 特效
   */
  addSuperModeMagic(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean
  ): MagicSpriteState {
    // 使用 SuperModeImage 而非 FlyingImage
    const sprite = this.factory.createMagicSprite(
      userId,
      magic,
      origin,
      0, // 不移动
      { x: 0, y: 0 },
      destroyOnEnd
    );

    // 使用超级模式图像
    if (magic.superModeImage) {
      sprite.flyingAsfPath = magic.superModeImage;
    }

    // 标记为超级模式，供 MagicManager 在 Destroy 时处理
    sprite.isSuperMode = true;

    this.addMagicSprite(sprite);
    return sprite;
  }

  /**
   * 添加固定墙武功
   */
  addFixedWallMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = {
      x: destination.x - origin.x,
      y: destination.y - origin.y,
    };
    const offset = getDirectionOffset8(direction);

    let count = 3;
    if (magic.effectLevel > 1) {
      count += (magic.effectLevel - 1) * 2;
    }
    const halfCount = Math.floor((count - 1) / 2);

    // 中心
    this.addFixedPositionMagicSprite(userId, magic, destination, destroyOnEnd);

    // 两侧
    for (let i = 1; i <= halfCount; i++) {
      const pos1 = {
        x: destination.x + offset.x * i,
        y: destination.y + offset.y * i,
      };
      const pos2 = {
        x: destination.x - offset.x * i,
        y: destination.y - offset.y * i,
      };
      this.addFixedPositionMagicSprite(userId, magic, pos1, destroyOnEnd);
      this.addFixedPositionMagicSprite(userId, magic, pos2, destroyOnEnd);
    }
  }

  /**
   * 添加跟随角色武功（自身增益类）
   * 返回创建的精灵，供调用者添加到 BUFF 列表
   */
  addFollowCharacterMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destroyOnEnd: boolean,
    targetId?: string
  ): MagicSpriteState {
    const sprite = this.factory.createMagicSprite(
      userId,
      magic,
      origin,
      0,
      { x: 0, y: 0 },
      destroyOnEnd
    );

    this.addMagicSprite(sprite);
    return sprite;
  }

  /**
   * 添加跟随敌人武功（追踪类）
   */
  addFollowEnemyMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    const direction = {
      x: destination.x - origin.x,
      y: destination.y - origin.y,
    };
    const velocity = MAGIC_BASE_SPEED * magic.speed;
    const sprite = this.factory.createMagicSprite(
      userId,
      magic,
      origin,
      velocity,
      direction,
      destroyOnEnd
    );
    sprite.destination = { ...destination };
    this.addMagicSprite(sprite);
  }

  /**
   * 添加投掷武功
   */
  addThrowMagicSprite(
    userId: string,
    magic: MagicData,
    origin: Vector2,
    destination: Vector2,
    destroyOnEnd: boolean
  ): void {
    let count = 1;
    if (magic.effectLevel > 1) {
      count += Math.floor((magic.effectLevel - 1) / 3);
    }

    const columnOffset = { x: -32, y: 16 };
    const rowOffset = { x: 32, y: 16 };
    const halfCount = Math.floor(count / 2);

    let dest = {
      x: destination.x - rowOffset.x * halfCount,
      y: destination.y - rowOffset.y * halfCount,
    };

    for (let r = 0; r < count; r++) {
      let rowDest = {
        x: dest.x - columnOffset.x * halfCount,
        y: dest.y - columnOffset.y * halfCount,
      };
      for (let c = 0; c < count; c++) {
        // 投掷武功使用抛物线（简化为直线）
        const direction = {
          x: rowDest.x - origin.x,
          y: rowDest.y - origin.y,
        };
        const velocity = MAGIC_BASE_SPEED * magic.speed;
        const sprite = this.factory.createMagicSprite(
          userId,
          magic,
          origin,
          velocity,
          direction,
          destroyOnEnd
        );
        sprite.destination = { ...rowDest };
        this.addMagicSprite(sprite);

        rowDest = {
          x: rowDest.x + columnOffset.x,
          y: rowDest.y + columnOffset.y,
        };
      }
      dest = {
        x: dest.x + rowOffset.x,
        y: dest.y + rowOffset.y,
      };
    }
  }
}
