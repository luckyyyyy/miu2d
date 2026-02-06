/**
 * NPC 管理器
 * 管理所有 NPC 的创建、更新、查询
 */

import type { Character } from "../character";
import type { CharacterBase } from "../character/base";
import { loadNpcConfig } from "../character/resFile";
import { ResourcePath } from "../config/resourcePaths";
import { getEngineContext } from "../core/engineContext";
import { logger } from "../core/logger";
import type { CharacterConfig, Vector2 } from "../core/types";
import { CharacterKind, type CharacterState, type Direction, RelationType } from "../core/types";
import { type DropCharacter, getDropObj } from "../drop/goodDrop";
import type { ObjManager } from "../obj/objManager";
import { resourceLoader } from "../resource/resourceLoader";
import type { NpcSaveItem } from "../game/storage";
import { distance, getNeighbors, getViewTileDistance, parseIni } from "../utils";
import { Npc } from "./npc";

// Type alias for position (use Vector2 for consistency)
type Position = Vector2;

/** 死亡信息 - 跟踪最近死亡的角色 */
export class DeathInfo {
  theDead: Character;
  leftFrameToKeep: number;

  constructor(theDead: Character, leftFrameToKeep: number = 2) {
    this.theDead = theDead;
    this.leftFrameToKeep = leftFrameToKeep;
  }
}

/** 视野区域类型 */
export interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** NpcManager 类*/
export class NpcManager {
  // Internal storage uses Npc class instances
  private npcs: Map<string, Npc> = new Map();
  // Note: NPC config is loaded from API cache (npcConfigLoader)
  // Store loaded NPC file name
  private fileName: string = "";

  /**
   * NPC 分组存储
   * 模拟 C# 原版的 save/game/{fileName} 文件系统
   * 脚本调用 SaveNpc() 时将当前 NPC 列表序列化存入，LoadNpc() 时优先从此读取
   * 存档时持久化到 localStorage，读档时恢复
   */
  private npcGroups: Map<string, NpcSaveItem[]> = new Map();

  // List of dead NPCs
  private _deadNpcs: Npc[] = [];

  // tracks recently dead characters for CheckKeepDistanceWhenFriendDeath
  private _deathInfos: DeathInfo[] = [];

  // === 全局 AI 控制 ===
  private _globalAIDisabled: boolean = false;

  /** 检查全局 AI 是否禁用 */
  get isGlobalAIDisabled(): boolean {
    return this._globalAIDisabled;
  }

  // === 性能优化：预计算视野内 NPC ===
  // NpcManager._npcInView, UpdateNpcsInView()
  // 在 Update 阶段预计算，Render 阶段直接使用，避免每帧重复遍历
  private _npcsInView: Npc[] = [];
  private _npcsByRow: Map<number, Npc[]> = new Map();

  /**
   * 获取 Player（通过 IEngineContext）
   */
  private get _player(): Character {
    const ctx = getEngineContext();
    return ctx.player as unknown as Character;
  }

  /**
   * Run death script for an NPC (called from NPC.onDeath)
   * 使用 ScriptExecutor 的队列系统确保多个 NPC 同时死亡时脚本按顺序执行
   * -> ScriptManager.RunScript(DeathScript)
   */
  runDeathScript(scriptPath: string, npc: Npc): void {
    if (!scriptPath) return;

    const engine = getEngineContext();
    if (!engine) return;

    const basePath = engine.getScriptBasePath();
    const fullPath = scriptPath.startsWith("/") ? scriptPath : `${basePath}/${scriptPath}`;

    // 使用 ScriptExecutor 的队列系统
    logger.log(`[NpcManager] Queueing death script for ${npc.name}: ${fullPath}`);
    engine.queueScript(fullPath);
  }

  /**
   * Add NPC to dead list and death info
   * Used for CheckKeepDistanceWhenFriendDeath AI behavior
   */
  addDead(npc: Npc): void {
    if (!this._deadNpcs.includes(npc)) {
      this._deadNpcs.push(npc);
    }
    // DeathInfos.AddLast(new DeathInfo(dead, 2))
    // Add to death infos for friend death detection with 2 frame lifetime
    this._deathInfos.push(new DeathInfo(npc, 2));
  }

  /**
   * Get death infos list (for debug/inspection)
   */
  getDeathInfos(): DeathInfo[] {
    return this._deathInfos;
  }

  /**
   * Find a friend that was killed by a live character within vision distance
   *
   *
   * @param finder The character looking for dead friends
   * @param maxTileDistance Maximum tile distance to search
   * @returns The dead friend character, or null if not found
   */
  findFriendDeadKilledByLiveCharacter(
    finder: Character,
    maxTileDistance: number
  ): Character | null {
    for (const deadInfo of this._deathInfos) {
      const theDead = deadInfo.theDead;

      // Check distance
      if (getViewTileDistance(finder.tilePosition, theDead.tilePosition) > maxTileDistance) {
        continue;
      }

      // Check if killed by a live character with MagicSprite
      // We check lastAttacker instead since we don't have MagicSprite system yet
      const lastAttacker = (theDead as unknown as { _lastAttacker?: Character | null })
        ._lastAttacker;
      if (!lastAttacker || lastAttacker.isDeathInvoked) {
        continue;
      }

      // Check if finder and dead are on same side
      // Enemy finds dead enemy, FighterFriend finds dead FighterFriend
      if (
        (finder.isEnemy && theDead.isEnemy) ||
        (finder.isFighterFriend && theDead.isFighterFriend)
      ) {
        return theDead;
      }
    }
    return null;
  }

  /**
   * Get dead NPCs list
   */
  getDeadNpcs(): Npc[] {
    return this._deadNpcs;
  }

  // Player 现在由 NPC 通过 IEngineContext.player 获取，不再需要 setPlayer

  /**
   * Get current NPC file name
   */
  getFileName(): string {
    return this.fileName;
  }

  /**
   * Get all NPC instances
   */
  getAllNpcs(): Map<string, Npc> {
    return this.npcs;
  }

  // === 性能优化：预计算视野内 NPC ===

  /**
   * 在 Update 阶段预计算视野内 NPC（每帧调用一次）
   * Reference: NpcManager.UpdateNpcsInView()
   * 同时按行分组，供交错渲染使用
   */
  updateNpcsInView(viewRect: ViewRect): void {
    // 清空上一帧的缓存
    this._npcsInView.length = 0;
    this._npcsByRow.clear();

    const viewRight = viewRect.x + viewRect.width;
    const viewBottom = viewRect.y + viewRect.height;

    for (const [, npc] of this.npcs) {
      // if (viewRegion.Intersects(npc.RegionInWorld))
      const region = npc.regionInWorld;
      const regionRight = region.x + region.width;
      const regionBottom = region.y + region.height;

      // AABB 交集检测
      if (
        region.x < viewRight &&
        regionRight > viewRect.x &&
        region.y < viewBottom &&
        regionBottom > viewRect.y
      ) {
        this._npcsInView.push(npc);

        // 同时按行分组（用于交错渲染）
        if (npc.isVisible) {
          const row = npc.tilePosition.y;
          let list = this._npcsByRow.get(row);
          if (!list) {
            list = [];
            this._npcsByRow.set(row, list);
          }
          list.push(npc);
        }
      }
    }
  }

  /**
   * 获取预计算的视野内 NPC 列表（只读）
   * property
   * 在 Render 阶段使用，避免重复计算
   */
  get npcsInView(): readonly Npc[] {
    return this._npcsInView;
  }

  /**
   * 获取指定行的 NPC 列表（用于交错渲染）
   * 返回预计算的结果，避免每帧重建 Map
   */
  getNpcsAtRow(row: number): readonly Npc[] {
    return this._npcsByRow.get(row) ?? [];
  }

  /**
   * Get NPCs within a view region
   * Reference: NpcManager.GetNpcsInView()
   * Returns NPCs whose RegionInWorld intersects with viewRect
   * 注意：渲染时优先使用预计算的 npcsInView 和 getNpcsAtRow
   */
  getNpcsInView(viewRect: ViewRect): Npc[] {
    const result: Npc[] = [];
    const viewRight = viewRect.x + viewRect.width;
    const viewBottom = viewRect.y + viewRect.height;

    for (const [, npc] of this.npcs) {
      // if (viewRegion.Intersects(npc.RegionInWorld))
      const region = npc.regionInWorld;
      const regionRight = region.x + region.width;
      const regionBottom = region.y + region.height;

      // Check AABB intersection
      if (
        region.x < viewRight &&
        regionRight > viewRect.x &&
        region.y < viewBottom &&
        regionBottom > viewRect.y
      ) {
        result.push(npc);
      }
    }
    return result;
  }

  /**
   * Get NPC by name (returns first match)
   */
  getNpc(name: string): Npc | null {
    for (const [, npc] of this.npcs) {
      if (npc.name === name) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Get all NPCs with the specified name
   * returns all NPCs with matching name
   * Multiple NPCs can have the same name (e.g., guards, enemies)
   */
  getAllNpcsByName(name: string): Npc[] {
    const result: Npc[] = [];
    for (const [, npc] of this.npcs) {
      if (npc.name === name) {
        result.push(npc);
      }
    }
    return result;
  }

  /**
   * Get NPC by ID
   */
  getNpcById(id: string): Npc | null {
    return this.npcs.get(id) || null;
  }

  /**
   * Get character with Kind=Player from NPC list
   * NpcManager.GetPlayerKindCharacter()
   * Returns the first NPC with CharacterKind.Player, or null
   */
  getPlayerKindCharacter(): Npc | null {
    for (const [, npc] of this.npcs) {
      if (npc.kind === CharacterKind.Player) {
        return npc;
      }
    }
    return null;
  }

  /**
   * Add NPC from config file
   * Config is loaded from API cache (npcConfigLoader)
   */
  async addNpc(
    configPath: string,
    tileX: number,
    tileY: number,
    direction: Direction = 4
  ): Promise<Npc | null> {
    // loadNpcConfig 从 API 缓存获取配置
    const config = await loadNpcConfig(configPath);

    if (!config) {
      // loadNpcConfig already logged the error, just return null
      return null;
    }

    const npc = Npc.fromConfig(config, tileX, tileY, direction);
    this.npcs.set(npc.id, npc);

    // NPC 通过 IEngineContext 获取 NpcManager、Player、MagicManager、AudioManager

    logger.log(
      `[NpcManager] Created NPC: ${config.name} at (${tileX}, ${tileY}), dir=${direction}, npcIni=${config.npcIni || "none"}`
    );

    // Auto-load sprites using Npc's own method (must await so appearance is ready)
    if (config.npcIni) {
      try {
        await npc.loadSpritesFromNpcIni(config.npcIni);
        logger.log(`[NpcManager] Sprites loaded for NPC ${config.name} from ${config.npcIni}`);
      } catch (err: unknown) {
        logger.warn(`[NpcManager] Failed to load sprites for NPC ${config?.name}:`, err);
      }
    } else {
      logger.warn(`[NpcManager] NPC ${config.name} has no npcIni, sprites not loaded`);
    }

    // Preload NPC magics (async, non-blocking)
    npc
      .loadAllMagics()
      .catch((err: unknown) =>
        logger.warn(`[NpcManager] Failed to preload magics for NPC ${config?.name}:`, err)
      );

    return npc;
  }

  /**
   * Add NPC with existing config
   */
  async addNpcWithConfig(
    config: CharacterConfig,
    tileX: number,
    tileY: number,
    direction: Direction = 4
  ): Promise<Npc> {
    const npc = Npc.fromConfig(config, tileX, tileY, direction);
    this.npcs.set(npc.id, npc);

    // NPC 通过 IEngineContext 获取 NpcManager、Player、MagicManager、AudioManager

    // Log NPC creation for debugging
    // logger.log(
    //   `[NpcManager] Created NPC (with config): ${config.name} at (${tileX}, ${tileY}), id=${npc.id}, npcIni=${config.npcIni || "none"}`
    // );

    // Auto-load sprites using Npc's own method (must await so appearance is ready)
    if (config.npcIni) {
      try {
        await npc.loadSpritesFromNpcIni(config.npcIni);
      } catch (err: unknown) {
        logger.warn(`[NpcManager] Failed to load sprites for NPC ${config.name}:`, err);
      }
    }

    // Preload NPC magics (async, non-blocking)
    npc
      .loadAllMagics()
      .catch((err: unknown) =>
        logger.warn(`[NpcManager] Failed to preload magics for NPC ${config.name}:`, err)
      );

    return npc;
  }

  /**
   * Delete NPC by name
   */
  deleteNpc(name: string): boolean {
    for (const [id, npc] of this.npcs) {
      if (npc.name === name) {
        this.npcs.delete(id);
        return true;
      }
    }
    return false;
  }

  /**
   * Delete NPC by ID
   */
  deleteNpcById(id: string): boolean {
    return this.npcs.delete(id);
  }

  /**
   * Clear all NPCs
   *
   */
  clearAllNpc(keepPartner: boolean = false): void {
    if (keepPartner) {
      const toDelete: string[] = [];
      for (const [id, npc] of this.npcs) {
        if (!npc.isPartner) {
          toDelete.push(id);
        } else {
          // npc.CancleAttackTarget()
          npc.cancleAttackTarget();
        }
      }
      for (const id of toDelete) {
        this.npcs.delete(id);
      }
      // DeathInfos.Clear()
      this._deathInfos.length = 0;
      this._deadNpcs.length = 0;
    } else {
      this.npcs.clear();
    }
  }

  /**
   * Clear all NPCs but keep partners (followers)
   *
   */
  clearAllNpcAndKeepPartner(): void {
    this.clearAllNpc(true);
  }

  /**
   * 重新加载所有 NPC 的武功缓存（用于热重载武功配置）
   * 清除旧缓存并重新从 API 加载
   */
  async reloadAllMagicCaches(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const npc of this.npcs.values()) {
      npc.clearMagicCache();
      // 重新加载武功
      promises.push(npc.loadAllMagics());
    }
    await Promise.all(promises);
    logger.info(`[NpcManager] Reloaded magic caches for ${this.npcs.size} NPCs`);
  }

  /**
   * Remove all partner NPCs
   *
   */
  removeAllPartner(): void {
    const toDelete: string[] = [];
    for (const [id, npc] of this.npcs) {
      if (npc.isPartner) {
        toDelete.push(id);
      }
    }
    for (const id of toDelete) {
      this.npcs.delete(id);
    }
    logger.debug(`[NpcManager] Removed ${toDelete.length} partners`);
  }

  /**
   * Set NPC position
   */
  setNpcPosition(name: string, tileX: number, tileY: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.setPosition(tileX, tileY);
    return true;
  }

  /**
   * Make NPC walk to position
   */
  npcGoto(name: string, tileX: number, tileY: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    return npc.walkTo({ x: tileX, y: tileY });
  }

  /**
   * Make NPC walk in a direction for a number of steps
   * Matches Character.WalkToDirection(direction, steps)
   */
  npcGotoDir(name: string, direction: number, steps: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    // Use Character's walkToDirection method
    npc.walkToDirection(direction, steps);
    return true;
  }

  /**
   * Get closest interactable NPC to a position
   */
  getClosestInteractableNpc(position: Vector2, maxDistance: number = 100): Npc | null {
    let closest: Npc | null = null;
    let closestDist = Infinity;

    for (const [, npc] of this.npcs) {
      if (!npc.isVisible) continue;
      // Only eventer NPCs are interactable
      if (npc.kind !== CharacterKind.Eventer) continue;

      const npcPos = { x: npc.positionInWorld.x, y: npc.positionInWorld.y };
      const dist = distance(position, npcPos);
      if (dist < closestDist && dist < maxDistance) {
        closest = npc;
        closestDist = dist;
      }
    }

    return closest;
  }

  // =============================================
  // === 通用瓦片查询方法 ===
  // =============================================

  /**
   * 通用 NPC 查询：在指定瓦片查找满足条件的 NPC
   * @param tile 瓦片坐标
   * @param predicate 过滤条件
   */
  private findNpcAt(tile: Vector2, predicate?: (npc: Npc) => boolean): Npc | null {
    for (const [, npc] of this.npcs) {
      if (npc.mapX === tile.x && npc.mapY === tile.y) {
        if (!predicate || predicate(npc)) {
          return npc;
        }
      }
    }
    return null;
  }

  /**
   * 通用角色查询：在指定瓦片查找满足条件的角色（包括玩家）
   * @param tile 瓦片坐标
   * @param predicate 过滤条件
   * @param includePlayer 是否包含玩家检查
   */
  private findCharacterAt(
    tile: Vector2,
    predicate: (char: Character) => boolean,
    includePlayer = true
  ): Character | null {
    // 先检查玩家
    if (includePlayer && this._player) {
      if (this._player.mapX === tile.x && this._player.mapY === tile.y) {
        if (predicate(this._player)) {
          return this._player;
        }
      }
    }
    // 再检查 NPC
    return this.findNpcAt(tile, predicate as (npc: Npc) => boolean);
  }

  // =============================================
  // === 具体瓦片查询方法 ===
  // =============================================

  /**
   * Get NPC at tile position
   */
  getNpcAtTile(tileX: number, tileY: number): Npc | null {
    return this.findNpcAt({ x: tileX, y: tileY });
  }

  /**
   * Get Eventer NPC at tile position
   * Reference: NpcManager.GetEventer(tilePosition)
   * Used for jump obstacle check - if there's an eventer at the tile, can't jump there
   */
  getEventer(tile: Vector2): Npc | null {
    return this.findNpcAt(tile, (npc) => npc.kind === CharacterKind.Eventer);
  }

  /**
   * Get enemy NPC at tile position
   * tileX, int tileY, bool withNeutral)
   */
  getEnemy(tileX: number, tileY: number, withNeutral: boolean = false): Npc | null {
    return this.findNpcAt(
      { x: tileX, y: tileY },
      (npc) => npc.isEnemy || (withNeutral && npc.isNoneFighter)
    );
  }

  /**
   * 获取所有敌人的位置信息（调试用）
   */
  getEnemyPositions(): string {
    const enemies: string[] = [];
    for (const [, npc] of this.npcs) {
      if (npc.isEnemy) {
        enemies.push(`${npc.name}@(${npc.mapX},${npc.mapY})`);
      }
    }
    return enemies.join(", ");
  }

  /**
   * Get player or fighter friend at tile position
   * tilePosition, bool withNeutral)
   */
  getPlayerOrFighterFriend(
    tileX: number,
    tileY: number,
    withNeutral: boolean = false
  ): Character | null {
    const tile = { x: tileX, y: tileY };
    // 玩家始终是友方
    if (this._player?.mapX === tileX && this._player?.mapY === tileY) {
      return this._player;
    }
    return this.findNpcAt(tile, (npc) => npc.isFighterFriend || (withNeutral && npc.isNoneFighter));
  }

  /**
   * Get other group enemy at tile position
   * group, Vector2 tilePosition)
   */
  getOtherGroupEnemy(group: number, tileX: number, tileY: number): Character | null {
    return this.findNpcAt(
      { x: tileX, y: tileY },
      (npc) => npc.group !== group && npc.isEnemy
    );
  }

  /**
   * Get fighter (any combat-capable character) at tile position
   * tilePosition)
   */
  getFighter(tileX: number, tileY: number): Character | null {
    return this.findCharacterAt(
      { x: tileX, y: tileY },
      (char) => char.isPlayer || char.isFighter
    );
  }

  /**
   * Get non-neutral fighter at tile position
   * tilePosition)
   */
  getNonneutralFighter(tileX: number, tileY: number): Character | null {
    return this.findCharacterAt(
      { x: tileX, y: tileY },
      (char) => char.isPlayer || (char.isFighter && !char.isNoneFighter)
    );
  }

  /**
   * Get neutral fighter at tile position
   * tilePosition)
   */
  getNeutralFighter(tileX: number, tileY: number): Character | null {
    return this.findNpcAt({ x: tileX, y: tileY }, (npc) => npc.isNoneFighter);
  }

  /**
   * Get neighbor enemies of a character
   * character)
   * Find enemies in neighboring tiles (8-direction)
   */
  getNeighborEnemy(character: Character): Character[] {
    const list: Character[] = [];
    if (!character) return list;

    const neighbors = getNeighbors(character.tilePosition);
    for (const neighbor of neighbors) {
      const enemy = this.getEnemy(neighbor.x, neighbor.y, false);
      if (enemy) {
        list.push(enemy);
      }
    }
    return list;
  }

  /**
   * Get neighbor neutral fighters of a character
   * character)
   * Find neutral fighters in neighboring tiles (8-direction)
   */
  getNeighborNeutralFighter(character: Character): Character[] {
    const list: Character[] = [];
    if (!character) return list;

    const neighbors = getNeighbors(character.tilePosition);
    for (const neighbor of neighbors) {
      const fighter = this.getNeutralFighter(neighbor.x, neighbor.y);
      if (fighter) {
        list.push(fighter);
      }
    }
    return list;
  }

  /**
   * Check if two characters are enemies
   * a, Character b)
   */
  static isEnemy(a: CharacterBase, b: CharacterBase): boolean {
    // 非战斗者不是敌人
    if ((!a.isPlayer && !a.isFighter) || (!b.isPlayer && !b.isFighter)) return false;
    // 玩家或友方 vs 非玩家、非伙伴、非友方
    if ((a.isPlayer || a.isFighterFriend) && !b.isPlayer && !b.isPartner && !b.isFighterFriend)
      return true;
    // 反过来
    if ((b.isPlayer || b.isFighterFriend) && !a.isPlayer && !a.isPartner && !a.isFighterFriend)
      return true;
    // 不同组
    return a.group !== b.group;
  }

  /**
   * Check if tile is blocked by NPC
   */
  isObstacle(tileX: number, tileY: number): boolean {
    return this.findNpcAt({ x: tileX, y: tileY }) !== null;
  }

  /**
   * Update all NPCs
   *
   */
  update(deltaTime: number): void {
    // Update each NPC and handle death body addition
    const npcsToDelete: string[] = [];

    // 通过 IEngineContext 获取 ObjManager 和 isDropEnabled
    const engineContext = getEngineContext();
    const objManager = engineContext.getManager("obj") as ObjManager;
    const isDropEnabled = engineContext.isDropEnabled();

    for (const [id, npc] of this.npcs) {
      if (!npc.isVisible) continue;
      // Npc class handles its own update (movement, animation, AI)
      npc.update(deltaTime);

      // Handle dead NPC body addition
      if (npc.isDeath && npc.isBodyIniAdded === 0) {
        npc.isBodyIniAdded = 1;

        // Add body object only if valid and not a special death or summoned NPC
        // if (npc.IsBodyIniOk && !npc.IsNodAddBody && npc.SummonedByMagicSprite == null)
        const isSummoned = npc.summonedByMagicSprite !== null;
        if (npc.isBodyIniOk && !npc.notAddBody && !isSummoned && objManager) {
          const bodyObj = npc.bodyIniObj!;
          bodyObj.positionInWorld = { ...npc.positionInWorld };
          bodyObj.currentDirection = npc.currentDirection;

          if (npc.reviveMilliseconds > 0) {
            bodyObj.isRemoved = false;
            bodyObj.millisecondsToRemove = npc.leftMillisecondsToRevive;
          }

          // 直接添加到列表
          objManager.addObj(bodyObj);
          logger.log(`[NpcManager] Added body object for dead NPC: ${npc.name}`);
        }

        // 掉落物品
        // 注意：中掉落逻辑不检查是否为召唤 NPC，所有满足条件的 NPC 都可以掉落
        // GoodDrop.GetDropObj 内部会检查 IsEnemy 和 NoDropWhenDie
        const dropCharacter: DropCharacter = {
          name: npc.name,
          level: npc.level,
          tilePosition: { ...npc.tilePosition },
          isEnemy: npc.isEnemy,
          expBonus: npc.expBonus,
          noDropWhenDie: npc.noDropWhenDie,
          dropIni: npc.dropIni,
        };

        // 异步获取掉落物品并添加到场景
        // 使用 void 操作符表明我们有意不等待这个 Promise
        void getDropObj(dropCharacter, isDropEnabled).then((dropObj) => {
          if (dropObj && objManager) {
            objManager.addObj(dropObj);
          }
        });

        // if (npc.ReviveMilliseconds == 0) { DeleteNpc(node); }
        // Remove NPC if no revive time
        if (npc.reviveMilliseconds === 0) {
          npcsToDelete.push(id);
        }
      }
    }

    // Delete NPCs marked for removal (must be done after iteration)
    for (const id of npcsToDelete) {
      this.npcs.delete(id);
      logger.log(`[NpcManager] Removed dead NPC with id: ${id}`);
    }

    // Update death infos - decrease leftFrameToKeep and remove expired entries
    // Used for CheckKeepDistanceWhenFriendDeath AI behavior
    for (let i = this._deathInfos.length - 1; i >= 0; i--) {
      this._deathInfos[i].leftFrameToKeep--;
      if (this._deathInfos[i].leftFrameToKeep <= 0) {
        this._deathInfos.splice(i, 1);
      }
    }
  }

  /**
   * Get visible NPCs in area
   */
  getVisibleNpcs(centerX: number, centerY: number, radius: number): Npc[] {
    const result: Npc[] = [];
    for (const [, npc] of this.npcs) {
      if (!npc.isVisible) continue;
      const npcPos = { x: npc.positionInWorld.x, y: npc.positionInWorld.y };
      const dist = distance({ x: centerX, y: centerY }, npcPos);
      if (dist <= radius) {
        result.push(npc);
      }
    }
    return result;
  }

  /**
   * Get all partner NPCs
   * NpcManager.GetAllPartner()
   */
  getAllPartner(): Npc[] {
    const partners: Npc[] = [];
    for (const [, npc] of this.npcs) {
      if (npc.isPartner) {
        partners.push(npc);
      }
    }
    return partners;
  }

  /**
   * Move all partners to destination
   * NpcManager.PartnersMoveTo(destinationTilePosition)
   */
  partnersMoveTo(destinationTilePosition: Vector2): void {
    const partners = this.getAllPartner();
    for (const partner of partners) {
      if (partner.isStanding()) {
        partner.partnerMoveTo(destinationTilePosition);
      }
    }
  }

  /**
   * Execute action for each partner
   * NpcManager.ForEachPartner(Action<Character> action)
   */
  forEachPartner(action: (partner: Npc) => void): void {
    for (const [, npc] of this.npcs) {
      if (npc.isPartner) {
        action(npc);
      }
    }
  }

  /**
   * Clear follow target for all NPCs if equal to target
   * NpcManager.CleartFollowTargetIfEqual(target)
   */
  cleartFollowTargetIfEqual(target: Character): void {
    for (const [, npc] of this.npcs) {
      if (npc.followTarget === target) {
        npc.clearFollowTarget();
      }
    }
  }

  /**
   * Disable AI for NPC (used in cutscenes)
   */
  disableNpcAI(name: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.isAIDisabled = true;
    }
  }

  /**
   * Enable AI for NPC
   */
  enableNpcAI(name: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.isAIDisabled = false;
    }
  }

  /**
   * Hide NPC
   * IsHide property (script-controlled hiding)
   */
  hideNpc(name: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.isHide = true;
    }
  }

  /**
   * Show/Hide NPC by name
   * sets IsHide property
   * Also checks player name for consistency
   */
  showNpc(name: string, show: boolean = true): void {
    // First check if name matches player
    if (this._player && this._player.name === name) {
      this._player.isHide = !show;
      return;
    }
    // Then check NPCs
    const npc = this.getNpc(name);
    if (npc) {
      npc.isHide = !show;
    }
  }

  /**
   * Set NPC script file
   * Sets the ScriptFile property for interaction
   */
  setNpcScript(name: string, scriptFile: string): void {
    const npc = this.getNpc(name);
    if (npc) {
      npc.scriptFile = scriptFile;
      logger.log(`[NpcManager] Set script for ${name}: ${scriptFile}`);
    } else {
      logger.warn(`[NpcManager] NPC not found for SetNpcScript: ${name}`);
    }
  }

  /**
   * Merge NPC file without clearing existing NPCs
   * calls Load with clearCurrentNpcs=false
   */
  async mergeNpc(fileName: string): Promise<void> {
    logger.log(`[NpcManager] Merging NPC file: ${fileName}`);
    await this.loadNpcFileInternal(fileName, false);
  }

  /**
   * Save NPC state
   * 将当前非伙伴 NPC 序列化到内存文件存储中
   * 对应 C# 原版: NpcManager.Save(fileName) -> File.WriteAllText("save/game/" + fileName)
   *
   * 脚本流程: SaveNpc() -> LoadMap() -> LoadNpc(同文件名) -> 读到刚存的数据
   *
   * @param fileName 文件名（可选，默认使用当前加载的文件名）
   */
  async saveNpc(fileName?: string): Promise<void> {
    const saveFileName = fileName || this.fileName;
    if (!saveFileName) {
      logger.warn("[NpcManager] SaveNpc: No file name provided and no file loaded");
      return;
    }

    // 更新 fileName 记录（C#: if (!isSavePartner) { _fileName = fileName; }）
    this.fileName = saveFileName;

    // 序列化当前所有非伙伴 NPC 到内存存储
    const items = this.collectSnapshot(false);
    this.npcGroups.set(saveFileName, items);

    logger.log(`[NpcManager] SaveNpc: ${saveFileName} (${items.length} NPCs saved to groups)`);
  }

  /**
   * 收集当前 NPC 快照为 NpcSaveItem[]
   * 从 Loader.collectNpcData 提取的核心逻辑
   * @param partnersOnly 是否只收集伙伴
   */
  collectSnapshot(partnersOnly: boolean): NpcSaveItem[] {
    const items: NpcSaveItem[] = [];

    for (const [, npc] of this.npcs) {
      // 根据 partnersOnly 参数过滤
      if (partnersOnly !== npc.isPartner) continue;
      // 跳过被魔法召唤的 NPC
      if (npc.summonedByMagicSprite !== null) continue;

      const item: NpcSaveItem = {
        name: npc.name,
        npcIni: npc.npcIni,
        kind: npc.kind,
        relation: npc.relation,
        pathFinder: npc.pathFinder,
        state: npc.state,
        mapX: npc.mapX,
        mapY: npc.mapY,
        dir: npc.currentDirection,
        visionRadius: npc.visionRadius,
        dialogRadius: npc.dialogRadius,
        attackRadius: npc.attackRadius,
        level: npc.level,
        exp: npc.exp,
        levelUpExp: npc.levelUpExp,
        life: npc.life,
        lifeMax: npc.lifeMax,
        thew: npc.thew,
        thewMax: npc.thewMax,
        mana: npc.mana,
        manaMax: npc.manaMax,
        attack: npc.attack,
        attack2: npc.attack2,
        attack3: npc.attack3,
        attackLevel: npc.attackLevel,
        defend: npc.defend,
        defend2: npc.defend2,
        defend3: npc.defend3,
        evade: npc.evade,
        lum: npc.lum,
        action: npc.actionType,
        walkSpeed: npc.walkSpeed,
        addMoveSpeedPercent: npc.addMoveSpeedPercent,
        expBonus: npc.expBonus,
        canLevelUp: npc.canLevelUp,
        fixedPos: npc.fixedPos,
        currentFixedPosIndex: npc.currentFixedPosIndex,
        destinationMapPosX: npc.destinationMoveTilePosition.x,
        destinationMapPosY: npc.destinationMoveTilePosition.y,
        idle: npc.idle,
        group: npc.group,
        noAutoAttackPlayer: npc.noAutoAttackPlayer,
        invincible: npc.invincible,
        poisonSeconds: npc.poisonSeconds,
        poisonByCharacterName: npc.poisonByCharacterName,
        petrifiedSeconds: npc.petrifiedSeconds,
        frozenSeconds: npc.frozenSeconds,
        isPoisonVisualEffect: npc.isPoisonVisualEffect,
        isPetrifiedVisualEffect: npc.isPetrifiedVisualEffect,
        isFrozenVisualEffect: npc.isFrozenVisualEffect,
        isDeath: npc.isDeath,
        isDeathInvoked: npc.isDeathInvoked,
        reviveMilliseconds: npc.reviveMilliseconds,
        leftMillisecondsToRevive: npc.leftMillisecondsToRevive,
        bodyIni: npc.bodyIni || undefined,
        flyIni: npc.flyIni || undefined,
        flyIni2: npc.flyIni2 || undefined,
        flyInis: npc.flyInis || undefined,
        isBodyIniAdded: npc.isBodyIniAdded,
        scriptFile: npc.scriptFile || undefined,
        scriptFileRight: npc.scriptFileRight || undefined,
        deathScript: npc.deathScript || undefined,
        timerScriptFile: npc.timerScript || undefined,
        timerScriptInterval: npc.timerInterval,
        magicToUseWhenLifeLow: npc.magicToUseWhenLifeLow || undefined,
        lifeLowPercent: npc.lifeLowPercent,
        keepRadiusWhenLifeLow: npc.keepRadiusWhenLifeLow,
        keepRadiusWhenFriendDeath: npc.keepRadiusWhenFriendDeath,
        magicToUseWhenBeAttacked: npc.magicToUseWhenBeAttacked || undefined,
        magicDirectionWhenBeAttacked: npc.magicDirectionWhenBeAttacked,
        magicToUseWhenDeath: npc.magicToUseWhenDeath || undefined,
        magicDirectionWhenDeath: npc.magicDirectionWhenDeath,
        buyIniFile: npc.buyIniFile || undefined,
        buyIniString: npc.buyIniString || undefined,
        visibleVariableName: npc.visibleVariableName || undefined,
        visibleVariableValue: npc.visibleVariableValue,
        dropIni: npc.dropIni || undefined,
        canEquip: npc.canEquip,
        headEquip: npc.headEquip || undefined,
        neckEquip: npc.neckEquip || undefined,
        bodyEquip: npc.bodyEquip || undefined,
        backEquip: npc.backEquip || undefined,
        handEquip: npc.handEquip || undefined,
        wristEquip: npc.wristEquip || undefined,
        footEquip: npc.footEquip || undefined,
        backgroundTextureEquip: npc.backgroundTextureEquip || undefined,
        keepAttackX: npc.keepAttackX,
        keepAttackY: npc.keepAttackY,
        hurtPlayerInterval: npc.hurtPlayerInterval,
        hurtPlayerLife: npc.hurtPlayerLife,
        hurtPlayerRadius: npc.hurtPlayerRadius,
        isHide: npc.isHide,
        isAIDisabled: npc.isAIDisabled,
        actionPathTilePositions:
          npc.actionPathTilePositions?.length > 0
            ? npc.actionPathTilePositions.map((p) => ({ x: p.x, y: p.y }))
            : undefined,
        levelIniFile: npc.levelIniFile || undefined,
      };

      items.push(item);
    }

    return items;
  }

  /**
   * 获取 NPC 分组存储（用于 Loader 存档时持久化）
   */
  getNpcGroups(): Map<string, NpcSaveItem[]> {
    return this.npcGroups;
  }

  /**
   * 设置 NPC 分组存储（用于 Loader 读档时恢复）
   */
  setNpcGroups(store: Record<string, NpcSaveItem[]>): void {
    this.npcGroups.clear();
    for (const [key, value] of Object.entries(store)) {
      this.npcGroups.set(key, value);
    }
  }

  /**
   * 清空 NPC 分组存储（新游戏时调用）
   */
  clearNpcGroups(): void {
    this.npcGroups.clear();
  }

  /**
   * Load Partner from file
   * NpcManager.LoadPartner(filePath)
   */
  async loadPartner(filePath: string): Promise<void> {
    try {
      this.removeAllPartner();
      await this.loadNpcFileInternal(filePath, false);
      logger.log(`[NpcManager] LoadPartner: ${filePath}`);
    } catch (error) {
      logger.error(`[NpcManager] Error loading partner file: ${filePath}`, error);
    }
  }

  /**
   * Save Partner state
   * saves partner NPCs to save file
   *
   * 将当前伙伴 NPC 序列化到内存文件存储中
   * 对应 C# 原版: NpcManager.Save(fileName, isSaveParter=true)
   *
   * @param fileName 文件名
   */
  savePartner(fileName: string): void {
    if (!fileName) {
      logger.warn("[NpcManager] SavePartner: No file name provided");
      return;
    }

    // 序列化当前所有伙伴 NPC 到内存存储
    const items = this.collectSnapshot(true);
    this.npcGroups.set(fileName, items);

    logger.log(`[NpcManager] SavePartner: ${fileName} (${items.length} partners saved to groups)`);
  }

  /**
   * Set NPC action file for a specific state
   * C# 参考: ResFile.SetNpcStateImage(NpcIni, state, fileName) 直接修改 NpcIni 字典
   * 我们的 setNpcActionFile 直接加载 ASF 并设置到 _spriteSet
   */
  async setNpcActionFile(name: string, stateType: number, asfFile: string): Promise<boolean> {
    const npc = this.getNpc(name);
    if (!npc) {
      logger.warn(`[NpcManager] NPC not found: ${name}`);
      return false;
    }

    // 调用 NPC 的 setNpcActionFile，等待 ASF 加载完成
    await npc.setNpcActionFile(stateType, asfFile);
    return true;
  }

  /**
   * Set NPC action type
   * Based on Character.SetNpcActionType()
   */
  setNpcActionType(name: string, actionType: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.actionType = actionType;
    return true;
  }

  /**
   * Set NPC level
   */
  setNpcLevel(name: string, level: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.level = level;
    return true;
  }

  /**
   * Kill all enemy NPCs (for debug/cheat system)
   * Uses normal death() method to ensure death scripts are triggered
   * Reference: 通过调用正常死亡流程触发 DeathScript
   * Returns the number of enemies killed
   */
  killAllEnemies(): number {
    let killed = 0;

    for (const [, npc] of this.npcs) {
      // Check if NPC is an enemy (Fighter kind or Flyer, with enemy relation)
      // Skip already dead/dying NPCs
      if (
        (npc.kind === CharacterKind.Fighter || npc.kind === CharacterKind.Flyer) &&
        npc.isEnemy &&
        !npc.isDeathInvoked &&
        !npc.isDeath
      ) {
        // Call normal death method to trigger death scripts
        // 设置状态，运行死亡脚本，播放动画
        npc.death();
        killed++;
      }
    }

    logger.log(`[NpcManager] Killed ${killed} enemies (via death method)`);
    return killed;
  }

  /**
   * Set NPC direction
   */
  setNpcDirection(name: string, direction: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.currentDirection = direction;
    return true;
  }

  /**
   * Set NPC state
   */
  setNpcState(name: string, state: number): boolean {
    const npc = this.getNpc(name);
    if (!npc) return false;

    npc.state = state as CharacterState;
    return true;
  }

  /**
   * Set NPC relation
   * (name, relation) where relation is 0=Friend, 1=Enemy, 2=None
   * GetPlayerAndAllNpcs changes relation for ALL NPCs with the same name
   */
  setNpcRelation(name: string, relation: number): boolean {
    const npcs = this.getAllNpcsByName(name);
    if (npcs.length === 0) {
      logger.warn(`[NpcManager] SetNpcRelation: NPC not found: ${name}`);
      return false;
    }

    const relationNames = ["Friend", "Enemy", "None"];
    for (const npc of npcs) {
      logger.log(
        `[NpcManager] SetNpcRelation: ${name} (id=${npc.id}) relation changed from ${relationNames[npc.relation] || npc.relation} to ${relationNames[relation] || relation}`
      );
      npc.setRelation(relation);
    }
    return true;
  }

  /**
   * Enable global NPC AI
   * sets IsAIDisabled = false
   */
  enableAI(): void {
    logger.log("[NpcManager] Enabling global NPC AI");
    this._globalAIDisabled = false;
  }

  /**
   * Disable global NPC AI
   * sets IsAIDisabled = true and calls NpcManager.CancleFighterAttacking()
   */
  disableAI(): void {
    logger.log("[NpcManager] Disabling global NPC AI");
    this._globalAIDisabled = true;
    this.cancleFighterAttacking();
  }

  /**
   * Load NPCs from a .npc file
   *  and Utils.GetNpcObjFilePath
   * Uses unified resourceLoader for text data fetching
   *
   * @param fileName - The NPC file name (e.g., "wudangshanxia.npc")
   * @param clearCurrentNpcs - Whether to clear existing NPCs (default: true)
   */
  async loadNpcFile(fileName: string, clearCurrentNpcs: boolean = true): Promise<boolean> {
    return this.loadNpcFileInternal(fileName, clearCurrentNpcs);
  }

  /**
   * Internal method to load NPC file with clear option
   * NpcManager.Load(fileName, clearCurrentNpcs, randOne)
   */
  private async loadNpcFileInternal(fileName: string, clearCurrentNpcs: boolean): Promise<boolean> {
    logger.log(`[NpcManager] Loading NPC file: ${fileName} (clear=${clearCurrentNpcs})`);

    // 1. 优先从 NPC 分组存储加载（模拟 C# 的 save/game/ 目录）
    const storedData = this.npcGroups.get(fileName);
    if (storedData) {
      if (clearCurrentNpcs) {
        this.clearAllNpcAndKeepPartner();
      }

      logger.log(`[NpcManager] Loading ${storedData.length} NPCs from groups: ${fileName}`);
      for (const npcData of storedData) {
        if (npcData.isDeath && npcData.isDeathInvoked) continue;
        await this.createNpcFromData(npcData as unknown as Record<string, unknown>);
      }
      this.fileName = fileName;
      logger.log(`[NpcManager] Loaded ${this.npcs.size} NPCs from groups: ${fileName}`);
      return true;
    }

    // 2. Fallback: 从文件系统加载（ini/save/ 静态资源）
    const paths = [ResourcePath.saveGame(fileName), ResourcePath.iniSave(fileName)];

    for (const filePath of paths) {
      try {
        // .npc files have been converted to UTF-8
        // resourceLoader.loadText handles Vite HTML fallback detection
        const content = await resourceLoader.loadText(filePath);

        if (!content) {
          continue;
        }

        // Clear existing NPCs if requested (keep partners)
        if (clearCurrentNpcs) {
          this.clearAllNpcAndKeepPartner();
        }

        logger.log(`[NpcManager] Parsing NPC file from: ${filePath}`);
        await this.parseNpcFile(content);
        this.fileName = fileName; // Store loaded file name
        logger.log(`[NpcManager] Loaded ${this.npcs.size} NPCs from ${fileName}`);
        return true;
      } catch (_error) {
        // Continue to next path
      }
    }

    logger.error(`[NpcManager] Failed to load NPC file: ${fileName} (tried all paths)`);
    return false;
  }

  /**
   * Parse NPC file content
   */
  private async parseNpcFile(content: string): Promise<void> {
    const sections = parseIni(content);

    const loadPromises: Promise<void>[] = [];

    for (const sectionName in sections) {
      // Match NPC followed by digits (e.g., NPC000, NPC001, etc.)
      if (/^NPC\d+$/i.test(sectionName)) {
        const section = sections[sectionName];
        const promise = this.createNpcFromData(section).then(() => {});
        loadPromises.push(promise);
      }
    }

    await Promise.all(loadPromises);
  }

  /**
   * NPC 数据结构（统一的加载格式）
   * - 通用加载方法
   *
   * 这个接口同时支持：
   * 1. .npc 文件加载（INI 格式，解析后变成 Record<string, string>）
   * 2. JSON 存档加载（完整类型的对象）
   */
  private parseNpcData(data: Record<string, unknown>): {
    config: CharacterConfig;
    extraState: {
      // 基本状态
      state?: number;
      action: number;
      /** script-controlled hiding (IsVisible is computed from magic time) */
      isHide: boolean;
      isAIDisabled: boolean;

      // 死亡/复活
      isDeath: boolean;
      isDeathInvoked: boolean;
      invincible: number;
      reviveMilliseconds: number;
      leftMillisecondsToRevive: number;

      // 脚本
      scriptFileRight?: string;
      timerScriptFile?: string;
      timerScriptInterval?: number;

      // 配置
      dropIni?: string;
      buyIniFile?: string;
      buyIniString?: string;
      actionPathTilePositions?: Array<{ x: number; y: number }>;

      // 属性 (存档专用)
      attack3: number;
      defend3: number;
      canLevelUp: number;

      // 位置相关
      currentFixedPosIndex: number;
      destinationMapPosX: number;
      destinationMapPosY: number;

      // INI 文件
      isBodyIniAdded: number;

      // 状态效果
      poisonSeconds: number;
      poisonByCharacterName?: string;
      petrifiedSeconds: number;
      frozenSeconds: number;
      isPoisonVisualEffect: boolean;
      isPetrifiedVisualEffect: boolean;
      isFrozenVisualEffect: boolean;

      // 装备
      canEquip: number;
      headEquip?: string;
      neckEquip?: string;
      bodyEquip?: string;
      backEquip?: string;
      handEquip?: string;
      wristEquip?: string;
      footEquip?: string;
      backgroundTextureEquip?: string;

      // 保持攻击位置
      keepAttackX: number;
      keepAttackY: number;

      // 等级配置
      levelIniFile?: string;
    };
    mapX: number;
    mapY: number;
    dir: number;
  } {
    // 辅助函数：解析数字，兼容 string 和 number
    const parseNum = (val: unknown, def: number): number => {
      if (val === undefined || val === null || val === "") return def;
      return typeof val === "number" ? val : parseInt(String(val), 10);
    };
    const parseStr = (val: unknown, def: string = ""): string => {
      return val !== undefined && val !== null ? String(val) : def;
    };
    const parseBool = (val: unknown, def: boolean = false): boolean => {
      if (val === undefined || val === null) return def;
      if (typeof val === "boolean") return val;
      return val === "1" || val === "true" || val === 1;
    };

    // 基础信息
    const name = parseStr(data.Name ?? data.name);
    const npcIni = parseStr(data.NpcIni ?? data.npcIni);
    const mapX = parseNum(data.MapX ?? data.mapX, 0);
    const mapY = parseNum(data.MapY ?? data.mapY, 0);
    const dir = parseNum(data.Dir ?? data.dir, 4);
    const kind = parseNum(data.Kind ?? data.kind, 0);
    const relation = parseNum(data.Relation ?? data.relation, 0);
    const group = parseNum(data.Group ?? data.group, 0);
    const pathFinder = parseNum(data.PathFinder ?? data.pathFinder, 0);
    const action = parseNum(data.Action ?? data.action, 0);
    const noAutoAttackPlayer = parseNum(data.NoAutoAttackPlayer ?? data.noAutoAttackPlayer, 0);
    const idle = parseNum(data.Idle ?? data.idle, 0);

    // 属性
    const walkSpeed = parseNum(data.WalkSpeed ?? data.walkSpeed, 1);
    const addMoveSpeedPercent = parseNum(data.AddMoveSpeedPercent ?? data.addMoveSpeedPercent, 0);
    const dialogRadius = parseNum(data.DialogRadius ?? data.dialogRadius, 1);
    const visionRadius = parseNum(data.VisionRadius ?? data.visionRadius, 10);
    const attackRadius = parseNum(data.AttackRadius ?? data.attackRadius, 1);

    // 战斗属性
    const life = parseNum(data.Life ?? data.life, 100);
    const lifeMax = parseNum(data.LifeMax ?? data.lifeMax, 100);
    const mana = parseNum(data.Mana ?? data.mana, 100);
    const manaMax = parseNum(data.ManaMax ?? data.manaMax, 100);
    const thew = parseNum(data.Thew ?? data.thew, 100);
    const thewMax = parseNum(data.ThewMax ?? data.thewMax, 100);
    const attack = parseNum(data.Attack ?? data.attack, 10);
    const attack2 = parseNum(data.Attack2 ?? data.attack2, 0);
    const attackLevel = parseNum(data.AttackLevel ?? data.attackLevel, 0);
    // Defence is alias for Defend
    const defend = parseNum(data.Defend ?? data.defend ?? data.Defence ?? data.defence, 10);
    const defend2 = parseNum(data.Defend2 ?? data.defend2, 0);
    const evade = parseNum(data.Evade ?? data.evade, 0);
    const level = parseNum(data.Level ?? data.level, 1);
    const exp = parseNum(data.Exp ?? data.exp, 0);
    const levelUpExp = parseNum(data.LevelUpExp ?? data.levelUpExp, 100);
    const expBonus = parseNum(data.ExpBonus ?? data.expBonus, 0); // Boss判断
    const lum = parseNum(data.Lum ?? data.lum, 0);

    // 脚本和资源
    const scriptFile = parseStr(data.ScriptFile ?? data.scriptFile);
    const scriptFileRight = parseStr(data.ScriptFileRight ?? data.scriptFileRight);
    const deathScript = parseStr(data.DeathScript ?? data.deathScript);
    const bodyIni = parseStr(data.BodyIni ?? data.bodyIni);
    const flyIni = parseStr(data.FlyIni ?? data.flyIni);
    const flyIni2 = parseStr(data.FlyIni2 ?? data.flyIni2);
    const flyInis = parseStr(data.FlyInis ?? data.flyInis);

    // 状态（只有 JSON 存档才有）
    const state = data.state !== undefined ? parseNum(data.state, 0) : undefined;
    // IsHide is script-controlled hiding, IsVisible is magic invisibility (computed)
    // Web 存档兼容：同时支持 isHide 和旧的 isVisible 字段
    // 注意：只有当字段明确存在时才使用，否则默认 isHide = false
    const isHide =
      data.isHide !== undefined
        ? parseBool(data.isHide, false)
        : data.isVisible !== undefined
          ? !parseBool(data.isVisible, true)
          : false;
    const isAIDisabled = parseBool(data.isAIDisabled, false);
    const isDeath = parseBool(data.isDeath, false);
    const isDeathInvoked = parseBool(data.isDeathInvoked, false);
    const invincible = parseNum(data.invincible ?? data.Invincible, 0);
    const reviveMilliseconds = parseNum(data.reviveMilliseconds ?? data.ReviveMilliseconds, 0);
    const leftMillisecondsToRevive = parseNum(
      data.leftMillisecondsToRevive ?? data.LeftMillisecondsToRevive,
      0
    );

    // 额外属性（只有 JSON 存档才有）
    const timerScriptFile = parseStr(data.timerScriptFile ?? data.TimerScriptFile);
    const timerScriptInterval = parseNum(data.timerScriptInterval ?? data.TimerScriptInterval, 0);
    const dropIni = parseStr(data.dropIni ?? data.DropIni);
    const buyIniFile = parseStr(data.buyIniFile ?? data.BuyIniFile);
    const actionPathTilePositions = (data.actionPathTilePositions ?? undefined) as
      | Vector2[]
      | undefined;

    // === AI 相关字段 ===
    const aiType = parseNum(data.AIType ?? data.aiType, 0);
    const keepRadiusWhenLifeLow = parseNum(
      data.KeepRadiusWhenLifeLow ?? data.keepRadiusWhenLifeLow,
      0
    );
    const lifeLowPercent = parseNum(data.LifeLowPercent ?? data.lifeLowPercent, 20);
    const stopFindingTarget = parseNum(data.StopFindingTarget ?? data.stopFindingTarget, 0);
    const keepRadiusWhenFriendDeath = parseNum(
      data.KeepRadiusWhenFriendDeath ?? data.keepRadiusWhenFriendDeath,
      0
    );

    // === Hurt Player (接触伤害) ===
    const hurtPlayerInterval = parseNum(data.HurtPlayerInterval ?? data.hurtPlayerInterval, 0);
    const hurtPlayerLife = parseNum(data.HurtPlayerLife ?? data.hurtPlayerLife, 0);
    const hurtPlayerRadius = parseNum(data.HurtPlayerRadius ?? data.hurtPlayerRadius, 0);

    // === Magic Direction ===
    const magicDirectionWhenBeAttacked = parseNum(
      data.MagicDirectionWhenBeAttacked ?? data.magicDirectionWhenBeAttacked,
      0
    );
    const magicDirectionWhenDeath = parseNum(
      data.MagicDirectionWhenDeath ?? data.magicDirectionWhenDeath,
      0
    );

    // === Visibility Control ===
    const fixedPos = parseStr(data.FixedPos ?? data.fixedPos);
    const visibleVariableName = parseStr(data.VisibleVariableName ?? data.visibleVariableName);
    const visibleVariableValue = parseNum(
      data.VisibleVariableValue ?? data.visibleVariableValue,
      0
    );

    // === Auto Magic ===
    const magicToUseWhenLifeLow = parseStr(
      data.MagicToUseWhenLifeLow ?? data.magicToUseWhenLifeLow
    );
    const magicToUseWhenBeAttacked = parseStr(
      data.MagicToUseWhenBeAttacked ?? data.magicToUseWhenBeAttacked
    );
    const magicToUseWhenDeath = parseStr(data.MagicToUseWhenDeath ?? data.magicToUseWhenDeath);

    // === Drop Control ===
    const noDropWhenDie = parseNum(data.NoDropWhenDie ?? data.noDropWhenDie, 0);

    const config: CharacterConfig = {
      name,
      npcIni,
      kind: kind as CharacterKind,
      relation: relation as RelationType,
      group,
      noAutoAttackPlayer,
      scriptFile: scriptFile || undefined,
      scriptFileRight: scriptFileRight || undefined,
      deathScript: deathScript || undefined,
      bodyIni: bodyIni || undefined,
      flyIni: flyIni || undefined,
      flyIni2: flyIni2 || undefined,
      flyInis: flyInis || undefined,
      idle,
      expBonus, // Boss判断（>0为Boss）
      // === AI/Combat Fields ===
      dropIni: dropIni || undefined,
      buyIniFile: buyIniFile || undefined,
      keepRadiusWhenLifeLow,
      lifeLowPercent,
      stopFindingTarget,
      keepRadiusWhenFriendDeath,
      aiType,
      invincible,
      reviveMilliseconds,
      // === Hurt Player ===
      hurtPlayerInterval,
      hurtPlayerLife,
      hurtPlayerRadius,
      // === Magic Direction ===
      magicDirectionWhenBeAttacked,
      magicDirectionWhenDeath,
      // === Visibility Control ===
      fixedPos: fixedPos || undefined,
      visibleVariableName: visibleVariableName || undefined,
      visibleVariableValue,
      // === Auto Magic ===
      magicToUseWhenLifeLow: magicToUseWhenLifeLow || undefined,
      magicToUseWhenBeAttacked: magicToUseWhenBeAttacked || undefined,
      magicToUseWhenDeath: magicToUseWhenDeath || undefined,
      // === Drop Control ===
      noDropWhenDie,
      stats: {
        life,
        lifeMax,
        mana,
        manaMax,
        thew,
        thewMax,
        attack,
        attack2,
        attack3: 0,
        attackLevel,
        defend,
        defend2,
        defend3: 0,
        evade,
        exp,
        levelUpExp,
        level,
        canLevelUp: 0,
        walkSpeed,
        addMoveSpeedPercent,
        visionRadius,
        attackRadius,
        dialogRadius,
        lum,
        action,
      },
      pathFinder,
    };

    // 解析更多存档专用字段
    const attack3 = parseNum(data.Attack3 ?? data.attack3, 0);
    const defend3 = parseNum(data.Defend3 ?? data.defend3, 0);
    const canLevelUp = parseNum(data.CanLevelUp ?? data.canLevelUp, 0);
    const currentFixedPosIndex = parseNum(
      data.CurrentFixedPosIndex ?? data.currentFixedPosIndex,
      0
    );
    const destinationMapPosX = parseNum(data.DestinationMapPosX ?? data.destinationMapPosX, 0);
    const destinationMapPosY = parseNum(data.DestinationMapPosY ?? data.destinationMapPosY, 0);
    const isBodyIniAdded = parseNum(data.IsBodyIniAdded ?? data.isBodyIniAdded, 0);
    const poisonSeconds = parseNum(data.PoisonSeconds ?? data.poisonSeconds, 0);
    const poisonByCharacterName = parseStr(
      data.PoisonByCharacterName ?? data.poisonByCharacterName
    );
    const petrifiedSeconds = parseNum(data.PetrifiedSeconds ?? data.petrifiedSeconds, 0);
    const frozenSeconds = parseNum(data.FrozenSeconds ?? data.frozenSeconds, 0);
    const isPoisonVisualEffect = parseBool(
      data.IsPoisonVisualEffect ?? data.isPoisonVisualEffect,
      false
    );
    const isPetrifiedVisualEffect = parseBool(
      data.IsPetrifiedVisualEffect ?? data.isPetrifiedVisualEffect,
      false
    );
    const isFrozenVisualEffect = parseBool(
      data.IsFrozenVisualEffect ?? data.isFrozenVisualEffect,
      false
    );
    const buyIniString = parseStr(data.BuyIniString ?? data.buyIniString);
    const canEquip = parseNum(data.CanEquip ?? data.canEquip, 0);
    const headEquip = parseStr(data.HeadEquip ?? data.headEquip);
    const neckEquip = parseStr(data.NeckEquip ?? data.neckEquip);
    const bodyEquip = parseStr(data.BodyEquip ?? data.bodyEquip);
    const backEquip = parseStr(data.BackEquip ?? data.backEquip);
    const handEquip = parseStr(data.HandEquip ?? data.handEquip);
    const wristEquip = parseStr(data.WristEquip ?? data.wristEquip);
    const footEquip = parseStr(data.FootEquip ?? data.footEquip);
    const backgroundTextureEquip = parseStr(
      data.BackgroundTextureEquip ?? data.backgroundTextureEquip
    );
    const keepAttackX = parseNum(data.KeepAttackX ?? data.keepAttackX, 0);
    const keepAttackY = parseNum(data.KeepAttackY ?? data.keepAttackY, 0);
    const levelIniFile = parseStr(data.LevelIni ?? data.LevelIniFile ?? data.levelIniFile);

    return {
      config,
      extraState: {
        // 基本状态
        state,
        action,
        isHide,
        isAIDisabled,

        // 死亡/复活
        isDeath,
        isDeathInvoked,
        invincible,
        reviveMilliseconds,
        leftMillisecondsToRevive,

        // 脚本
        scriptFileRight: scriptFileRight || undefined,
        timerScriptFile: timerScriptFile || undefined,
        timerScriptInterval,

        // 配置
        dropIni: dropIni || undefined,
        buyIniFile: buyIniFile || undefined,
        buyIniString: buyIniString || undefined,
        actionPathTilePositions,

        // 属性 (存档专用)
        attack3,
        defend3,
        canLevelUp,

        // 位置相关
        currentFixedPosIndex,
        destinationMapPosX,
        destinationMapPosY,

        // INI 文件
        isBodyIniAdded,

        // 状态效果
        poisonSeconds,
        poisonByCharacterName: poisonByCharacterName || undefined,
        petrifiedSeconds,
        frozenSeconds,
        isPoisonVisualEffect,
        isPetrifiedVisualEffect,
        isFrozenVisualEffect,

        // 装备
        canEquip,
        headEquip: headEquip || undefined,
        neckEquip: neckEquip || undefined,
        bodyEquip: bodyEquip || undefined,
        backEquip: backEquip || undefined,
        handEquip: handEquip || undefined,
        wristEquip: wristEquip || undefined,
        footEquip: footEquip || undefined,
        backgroundTextureEquip: backgroundTextureEquip || undefined,

        // 保持攻击位置
        keepAttackX,
        keepAttackY,

        // 等级配置
        levelIniFile: levelIniFile || undefined,
      },
      mapX,
      mapY,
      dir,
    };
  }

  /**
   * Create NPC from data object (统一的 NPC 创建方法)
   * + Character.Load()
   *
   * 同时支持：
   * 1. .npc 文件加载（INI Section 解析后的 Record<string, string>）
   * 2. JSON 存档加载（完整类型的对象）
   *
   * 逻辑：有什么字段就读什么字段，不区分来源
   */
  async createNpcFromData(data: Record<string, unknown>): Promise<Npc | null> {
    const { config, extraState, mapX, mapY, dir } = this.parseNpcData(data);

    // Skip dead NPCs that have been fully removed
    if (extraState.isDeath && extraState.isDeathInvoked) {
      logger.log(`[NpcManager] Skipping dead NPC: ${config.name}`);
      return null;
    }

    // Create NPC with config
    const npc = await this.addNpcWithConfig(config, mapX, mapY, dir as Direction);

    // === 基本状态 ===
    npc.actionType = extraState.action;
    npc.isHide = extraState.isHide;
    npc.isAIDisabled = extraState.isAIDisabled;
    if (extraState.state !== undefined) {
      npc.state = extraState.state;
    }

    // === 死亡/复活 ===
    npc.isDeath = extraState.isDeath;
    npc.isDeathInvoked = extraState.isDeathInvoked;
    npc.invincible = extraState.invincible;
    npc.reviveMilliseconds = extraState.reviveMilliseconds;
    npc.leftMillisecondsToRevive = extraState.leftMillisecondsToRevive;

    // === 脚本 ===
    if (extraState.scriptFileRight) {
      npc.scriptFileRight = extraState.scriptFileRight;
    }
    if (extraState.timerScriptFile) {
      npc.timerScript = extraState.timerScriptFile;
    }
    if (extraState.timerScriptInterval !== undefined) {
      npc.timerInterval = extraState.timerScriptInterval;
    }

    // === 配置 ===
    if (extraState.dropIni) npc.dropIni = extraState.dropIni;
    if (extraState.buyIniFile) npc.buyIniFile = extraState.buyIniFile;
    if (extraState.buyIniString) npc.buyIniString = extraState.buyIniString;
    if (extraState.actionPathTilePositions && extraState.actionPathTilePositions.length > 0) {
      npc.actionPathTilePositions = extraState.actionPathTilePositions.map((p) => ({
        x: p.x,
        y: p.y,
      }));
    }

    // === 属性 (存档专用) ===
    if (extraState.attack3) npc.attack3 = extraState.attack3;
    if (extraState.defend3) npc.defend3 = extraState.defend3;
    if (extraState.canLevelUp) npc.canLevelUp = extraState.canLevelUp;

    // === 位置相关 ===
    if (extraState.currentFixedPosIndex) npc.currentFixedPosIndex = extraState.currentFixedPosIndex;
    // destinationMapPosX/Y 通常不需要恢复，因为重新加载时 NPC 会重新计算目标

    // === INI 文件 ===
    if (extraState.isBodyIniAdded) npc.isBodyIniAdded = extraState.isBodyIniAdded;

    // === 状态效果 ===
    if (extraState.poisonSeconds) npc.poisonSeconds = extraState.poisonSeconds;
    if (extraState.poisonByCharacterName)
      npc.poisonByCharacterName = extraState.poisonByCharacterName;
    if (extraState.petrifiedSeconds) npc.petrifiedSeconds = extraState.petrifiedSeconds;
    if (extraState.frozenSeconds) npc.frozenSeconds = extraState.frozenSeconds;
    if (extraState.isPoisonVisualEffect) npc.isPoisonVisualEffect = extraState.isPoisonVisualEffect;
    if (extraState.isPetrifiedVisualEffect)
      npc.isPetrifiedVisualEffect = extraState.isPetrifiedVisualEffect;
    if (extraState.isFrozenVisualEffect) npc.isFrozenVisualEffect = extraState.isFrozenVisualEffect;

    // === 装备 ===
    if (extraState.canEquip) npc.canEquip = extraState.canEquip;
    if (extraState.headEquip) npc.headEquip = extraState.headEquip;
    if (extraState.neckEquip) npc.neckEquip = extraState.neckEquip;
    if (extraState.bodyEquip) npc.bodyEquip = extraState.bodyEquip;
    if (extraState.backEquip) npc.backEquip = extraState.backEquip;
    if (extraState.handEquip) npc.handEquip = extraState.handEquip;
    if (extraState.wristEquip) npc.wristEquip = extraState.wristEquip;
    if (extraState.footEquip) npc.footEquip = extraState.footEquip;
    if (extraState.backgroundTextureEquip)
      npc.backgroundTextureEquip = extraState.backgroundTextureEquip;

    // === 保持攻击位置 ===
    if (extraState.keepAttackX) npc.keepAttackX = extraState.keepAttackX;
    if (extraState.keepAttackY) npc.keepAttackY = extraState.keepAttackY;

    // === 等级配置 ===
    if (extraState.levelIniFile) {
      await npc.levelManager.setLevelFile(extraState.levelIniFile);
    }

    // logger.log(
    //   `[NpcManager] Created NPC: ${config.name} at (${mapX}, ${mapY}), npcIni=${config.npcIni}`
    // );
    return npc;
  }

  /**
   * Set file name (用于从 JSON 存档加载时设置)
   */
  setFileName(fileName: string): void {
    this.fileName = fileName;
  }

  // ============== AI Query Methods ==============
  //  AI-related static methods

  /**
   * Get closest enemy type character
   *
   */
  getClosestEnemyTypeCharacter(
    positionInWorld: Position,
    withNeutral: boolean = false,
    withInvisible: boolean = false,
    ignoreList: Character[] | null = null
  ): Character | null {
    let closest: Character | null = null;
    let closestDistance = 99999999;

    for (const [, npc] of this.npcs) {
      // Check ignore list
      if (ignoreList?.some((item) => item === npc)) continue;
      // Check visibility
      if (!withInvisible && !npc.isVisible) continue;
      // Check if enemy or neutral fighter
      if (!npc.isEnemy && !(withNeutral && npc.isNoneFighter)) continue;
      // Check if dead
      if (npc.isDeathInvoked) continue;

      const dist = distance(positionInWorld, npc.positionInWorld);
      if (dist < closestDistance) {
        closest = npc;
        closestDistance = dist;
      }
    }

    return closest;
  }

  /**
   * Get closest enemy based on finder's relation
   *
   */
  getClosestEnemy(
    finder: Character,
    targetPositionInWorld: Position,
    withNeutral: boolean = false,
    withInvisible: boolean = false,
    ignoreList: Character[] | null = null
  ): Character | null {
    if (!finder) return null;

    if (finder.isEnemy) {
      // Enemy finds player or fighter friends
      let target = this.getLiveClosestPlayerOrFighterFriend(
        targetPositionInWorld,
        withNeutral,
        withInvisible,
        ignoreList
      );
      if (!target) {
        target = this.getLiveClosestOtherGropEnemy(finder.group, targetPositionInWorld);
      }
      return target;
    }

    if (finder.isPlayer || finder.isFighterFriend) {
      return this.getClosestEnemyTypeCharacter(
        targetPositionInWorld,
        withNeutral,
        withInvisible,
        ignoreList
      );
    }

    return null;
  }

  /**
   * Get live closest enemy from a different group
   * NpcManager.GetLiveClosestOtherGropEnemy (typo preserved)
   */
  getLiveClosestOtherGropEnemy(group: number, positionInWorld: Position): Character | null {
    let closest: Character | null = null;
    let closestDistance = 99999999;

    for (const [, npc] of this.npcs) {
      if (npc.group !== group && npc.isVisible && npc.isEnemy) {
        if (npc.isDeathInvoked) continue;
        const dist = distance(positionInWorld, npc.positionInWorld);
        if (dist < closestDistance) {
          closest = npc;
          closestDistance = dist;
        }
      }
    }

    return closest;
  }

  /**
   * Get closest player or fighter friend
   *
   */
  getLiveClosestPlayerOrFighterFriend(
    positionInWorld: Position,
    withNeutral: boolean = false,
    withInvisible: boolean = false,
    ignoreList: Character[] | null = null
  ): Character | null {
    let closest: Character | null = null;
    let closestDistance = 99999999;

    for (const [, npc] of this.npcs) {
      // Check ignore list
      if (ignoreList?.some((item) => item === npc)) continue;
      // Check visibility
      if (!withInvisible && !npc.isVisible) continue;
      // Check if fighter friend or neutral non-fighter
      if (!npc.isFighterFriend && !(withNeutral && npc.isNoneFighter)) continue;
      // Check if dead
      if (npc.isDeathInvoked) continue;

      const dist = distance(positionInWorld, npc.positionInWorld);
      if (dist < closestDistance) {
        closest = npc;
        closestDistance = dist;
      }
    }

    // Also check player
    if (this._player) {
      if (ignoreList?.some((item) => item === this._player)) {
        // Player is in ignore list
      } else if (withInvisible || this._player.isVisible) {
        if (!this._player.isDeathInvoked) {
          const dist = distance(positionInWorld, this._player.positionInWorld);
          if (dist < closestDistance) {
            closest = this._player;
          }
        }
      }
    }

    return closest;
  }

  /**
   * Get closest non-neutral fighter
   * NpcManager.GetLiveClosestNonneturalFighter (typo preserved)
   */
  getLiveClosestNonneturalFighter(
    positionInWorld: Position,
    ignoreList: Character[] | null = null
  ): Character | null {
    let closest: Character | null = null;
    let closestDistance = 99999999;

    for (const [, npc] of this.npcs) {
      // Check ignore list
      if (ignoreList?.some((item) => item === npc)) continue;
      // Check if fighter with non-neutral relation
      if (!npc.isFighter || npc.relation === RelationType.None) continue;
      // Check if dead
      if (npc.isDeathInvoked) continue;

      const dist = distance(positionInWorld, npc.positionInWorld);
      if (dist < closestDistance) {
        closest = npc;
        closestDistance = dist;
      }
    }

    // Also check player
    if (this._player) {
      if (ignoreList?.some((item) => item === this._player)) {
        // Player is in ignore list
      } else if (!this._player.isDeathInvoked) {
        const dist = distance(positionInWorld, this._player.positionInWorld);
        if (dist < closestDistance) {
          closest = this._player;
        }
      }
    }

    return closest;
  }

  /**
   * Get closest fighter
   *
   */
  getClosestFighter(
    targetPositionInWorld: Position,
    ignoreList: Character[] | null = null
  ): Character | null {
    let closest: Character | null = null;
    let closestDistance = 99999999;

    for (const [, npc] of this.npcs) {
      // Check ignore list
      if (ignoreList?.some((item) => item === npc)) continue;
      // Check if fighter
      if (!npc.isFighter) continue;
      // Check if dead
      if (npc.isDeathInvoked) continue;

      const dist = distance(targetPositionInWorld, npc.positionInWorld);
      if (dist < closestDistance) {
        closest = npc;
        closestDistance = dist;
      }
    }

    // Also check player
    if (this._player && this._player.kind === CharacterKind.Player) {
      if (ignoreList?.some((item) => item === this._player)) {
        // Player is in ignore list
      } else if (!this._player.isDeathInvoked) {
        const dist = distance(targetPositionInWorld, this._player.positionInWorld);
        if (dist < closestDistance) {
          closest = this._player;
        }
      }
    }

    return closest;
  }

  /**
   * Find enemies within tile distance
   *
   */
  findEnemiesInTileDistance(
    finder: Character,
    beginTilePosition: Position,
    tileDistance: number
  ): Character[] {
    const enemies: Character[] = [];
    if (!finder || tileDistance < 1) return enemies;

    for (const [, npc] of this.npcs) {
      if (finder.isOpposite(npc)) {
        const viewDist = getViewTileDistance(beginTilePosition, npc.tilePosition);
        if (viewDist <= tileDistance) {
          enemies.push(npc);
        }
      }
    }

    // Check player
    if (this._player && finder.isOpposite(this._player)) {
      const viewDist = getViewTileDistance(beginTilePosition, this._player.tilePosition);
      if (viewDist <= tileDistance) {
        enemies.push(this._player);
      }
    }

    return enemies;
  }

  /**
   * Find fighters within tile distance
   *
   */
  findFightersInTileDistance(beginTilePosition: Position, tileDistance: number): Character[] {
    const fighters: Character[] = [];

    for (const [, npc] of this.npcs) {
      if (npc.isFighter) {
        const viewDist = getViewTileDistance(beginTilePosition, npc.tilePosition);
        if (viewDist <= tileDistance) {
          fighters.push(npc);
        }
      }
    }

    // Check player
    if (this._player && this._player.kind === CharacterKind.Player) {
      const viewDist = getViewTileDistance(beginTilePosition, this._player.tilePosition);
      if (viewDist <= tileDistance) {
        fighters.push(this._player);
      }
    }

    return fighters;
  }

  /**
   * Cancel all fighter attacking (used when global AI is disabled)
   *
   */
  cancleFighterAttacking(): void {
    for (const [, npc] of this.npcs) {
      if (npc.isFighterKind) {
        npc.cancleAttackTarget();
      }
    }
  }

  /**
   * Get all characters including player
   */
  getAllCharacters(): Character[] {
    const chars: Character[] = [...this.npcs.values()];
    if (this._player) {
      chars.push(this._player);
    }
    return chars;
  }
}
