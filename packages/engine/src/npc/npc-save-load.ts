/**
 * NPC 存档与加载 — Save/Load/Merge/Groups/Partner 管理
 *
 * 从 NpcManager 提取，NpcManager 通过薄委托方法调用这些函数。
 */

import { applyFlatDataToCharacter } from "../character/character-config";
import { getDefaultNpcLevelKey, loadLevelConfig } from "../character/level/level-config-loader";
import { getNpcLevelDetail } from "../character/level/level-manager";
import { logger } from "../core/logger";
import type { CharacterConfig, Direction, Vector2 } from "../core/types";
import { getGameSlug, loadSceneNpcEntries } from "../data/game-data-api";
import type { NpcSaveItem } from "../storage/save-types";
import type { Npc } from "./npc";
import { collectNpcSnapshot, parseNpcData } from "./npc-persistence";

/** 存档/加载操作所需的 NpcManager 回调 */
export interface NpcSaveLoadDeps {
  readonly npcs: Map<string, Npc>;
  readonly npcGroups: Map<string, NpcSaveItem[]>;
  getFileName(): string;
  setFileName(name: string): void;
  clearAllNpcAndKeepPartner(): void;
  removeAllPartner(): void;
  addNpcWithConfig(
    config: CharacterConfig,
    mapX: number,
    mapY: number,
    dir?: Direction
  ): Promise<Npc>;
  getCurrentMapName(): string;
}

// ============= 快照 / Groups =============

export function collectSnapshot(npcs: Map<string, Npc>, partnersOnly: boolean): NpcSaveItem[] {
  return collectNpcSnapshot(npcs, partnersOnly);
}

export function saveNpc(deps: NpcSaveLoadDeps, fileName?: string): void {
  const saveFileName = fileName || deps.getFileName();
  if (!saveFileName) {
    logger.warn("[NpcManager] SaveNpc: No file name provided and no file loaded");
    return;
  }
  deps.setFileName(saveFileName);
  const items = collectSnapshot(deps.npcs, false);
  deps.npcGroups.set(saveFileName, items);
  logger.log(`[NpcManager] SaveNpc: ${saveFileName} (${items.length} NPCs saved to groups)`);
}

export function savePartner(deps: NpcSaveLoadDeps, fileName: string): void {
  if (!fileName) {
    logger.warn("[NpcManager] SavePartner: No file name provided");
    return;
  }
  const items = collectSnapshot(deps.npcs, true);
  deps.npcGroups.set(fileName, items);
  logger.log(`[NpcManager] SavePartner: ${fileName} (${items.length} partners saved to groups)`);
}

export function setNpcGroups(
  npcGroups: Map<string, NpcSaveItem[]>,
  store: Record<string, NpcSaveItem[]>
): void {
  npcGroups.clear();
  for (const [key, value] of Object.entries(store)) {
    npcGroups.set(key, value);
  }
}

// ============= 加载 =============

export async function loadPartner(deps: NpcSaveLoadDeps, filePath: string): Promise<void> {
  try {
    deps.removeAllPartner();
    await loadNpcFileInternal(deps, filePath, false);
    logger.log(`[NpcManager] LoadPartner: ${filePath}`);
  } catch (error) {
    logger.error(`[NpcManager] Error loading partner file: ${filePath}`, error);
  }
}

export async function mergeNpc(deps: NpcSaveLoadDeps, fileName: string): Promise<void> {
  logger.log(`[NpcManager] Merging NPC file: ${fileName}`);
  await loadNpcFileInternal(deps, fileName, false);
}

export async function loadNpcFile(
  deps: NpcSaveLoadDeps,
  fileName: string,
  clearCurrentNpcs: boolean = true
): Promise<boolean> {
  return loadNpcFileInternal(deps, fileName, clearCurrentNpcs);
}

/**
 * Internal: load NPC file with clear option
 * NpcManager.Load(fileName, clearCurrentNpcs, randOne)
 */
async function loadNpcFileInternal(
  deps: NpcSaveLoadDeps,
  fileName: string,
  clearCurrentNpcs: boolean
): Promise<boolean> {
  logger.log(`[NpcManager] Loading NPC file: ${fileName} (clear=${clearCurrentNpcs})`);

  if (!fileName) {
    if (clearCurrentNpcs) {
      deps.clearAllNpcAndKeepPartner();
    }
    deps.setFileName(fileName);
    return true;
  }

  // 1. 优先从 NPC 分组存储加载
  const storedData = deps.npcGroups.get(fileName);
  if (storedData) {
    if (clearCurrentNpcs) {
      deps.clearAllNpcAndKeepPartner();
    }

    logger.log(`[NpcManager] Loading ${storedData.length} NPCs from groups: ${fileName}`);
    const loadPromises: Promise<void>[] = [];
    for (const npcData of storedData) {
      if (npcData.isDeath && npcData.isDeathInvoked) continue;
      loadPromises.push(
        createNpcFromData(deps, npcData as unknown as Record<string, unknown>).then(() => {})
      );
    }
    await Promise.all(loadPromises);
    deps.setFileName(fileName);
    logger.log(`[NpcManager] Loaded ${deps.npcs.size} NPCs from groups: ${fileName}`);
    return true;
  }

  // 2. 从 Scene API 加载（数据库存储的 NPC JSON 数据）
  const gameSlug = getGameSlug();
  const sceneKey = deps.getCurrentMapName();
  if (gameSlug && sceneKey) {
    try {
      const entries = await loadSceneNpcEntries(sceneKey, fileName);
      if (entries) {
        if (clearCurrentNpcs) {
          deps.clearAllNpcAndKeepPartner();
        }
        if (entries.length > 0) {
          logger.log(`[NpcManager] Loading ${entries.length} NPCs from Scene API: ${fileName}`);
          const loadPromises: Promise<void>[] = [];
          for (const entry of entries) {
            loadPromises.push(createNpcFromData(deps, entry).then(() => {}));
          }
          await Promise.all(loadPromises);
        }
        deps.setFileName(fileName);
        logger.log(`[NpcManager] Loaded ${deps.npcs.size} NPCs from Scene API: ${fileName}`);
        return true;
      }
    } catch (error) {
      logger.error(`[NpcManager] Scene API error for ${fileName}:`, error);
    }
  } else {
    logger.warn(`[NpcManager] Cannot load from API: gameSlug=${gameSlug}, sceneKey=${sceneKey}`);
  }

  logger.error(`[NpcManager] Failed to load NPC file: ${fileName}`);
  return false;
}

/**
 * 从存档/API 数据创建 NPC
 */
export async function createNpcFromData(
  deps: NpcSaveLoadDeps,
  data: Record<string, unknown>
): Promise<Npc | null> {
  const { config, extraState, mapX, mapY, dir } = parseNpcData(data);

  // Skip dead NPCs that have been fully removed
  if (extraState.isDeath && extraState.isDeathInvoked) {
    logger.log(`[NpcManager] Skipping dead NPC: ${config.name}`);
    return null;
  }

  // Create NPC with config (loads ini + sprites)
  const npc = await deps.addNpcWithConfig(config, mapX, mapY, dir as Direction);

  // 字段名已统一，直接赋值
  applyFlatDataToCharacter(data, npc, false);
  npc.applyConfigSetters();

  // === NPC 特有字段（不在 FIELD_DEFS 中） ===
  npc.isHide = extraState.isHide;
  npc.isAIDisabled = extraState.isAIDisabled;
  if (extraState.actionPathTilePositions && extraState.actionPathTilePositions.length > 0) {
    npc.actionPathTilePositions = extraState.actionPathTilePositions.map((p: Vector2) => ({
      x: p.x,
      y: p.y,
    }));
  }

  // 等级配置（异步加载配置文件）
  if (npc.levelIniFile) {
    await npc.levelManager.setLevelFile(npc.levelIniFile);
  }

  // 从等级配置重算属性
  // - 敌对 NPC：仅在 lifeMax === 0 时恢复血量（兼容旧逻辑）
  // - 伙伴 NPC：始终重算，与 Player.recalculateBaseStats() 对齐
  //   参考 JxqyHD/Engine/Character.cs - SetPropToLevel()
  logger.debug(
    `[NpcManager] NPC ${npc.name} check: isEnemy=${npc.isEnemy} isPartner=${npc.isPartner} lifeMax=${npc.lifeMax} level=${npc.level}`
  );
  if (npc.isPartner) {
    let levelDetail = npc.levelManager.getLevelDetail(npc.level) ?? getNpcLevelDetail(npc.level);
    if (!levelDetail) {
      const cfg = await loadLevelConfig(getDefaultNpcLevelKey());
      levelDetail = cfg?.get(npc.level) ?? null;
    }
    if (levelDetail) {
      const restoredLife = levelDetail.life || levelDetail.lifeMax;
      const savedLife = npc.life;

      npc.lifeMax = restoredLife;
      npc.thewMax = levelDetail.thewMax;
      npc.manaMax = levelDetail.manaMax;
      npc.attack = levelDetail.attack;
      npc.attack2 = levelDetail.attack2;
      npc.attack3 = levelDetail.attack3;
      npc.defend = levelDetail.defend;
      npc.defend2 = levelDetail.defend2;
      npc.defend3 = levelDetail.defend3;
      npc.evade = levelDetail.evade;
      npc.levelUpExp = levelDetail.levelUpExp;

      npc.life = Math.min(savedLife, npc.lifeMax);
      npc.thew = Math.min(npc.thew, npc.thewMax);
      npc.mana = Math.min(npc.mana, npc.manaMax);

      logger.log(
        `[NpcManager] Partner ${npc.name} stats recalculated from level ${npc.level}: attack=${npc.attack} defend=${npc.defend} lifeMax=${npc.lifeMax} evade=${npc.evade}`
      );
    } else {
      logger.warn(`[NpcManager] Partner ${npc.name} at level ${npc.level}, no level data found`);
    }
  } else if (npc.isEnemy && npc.lifeMax === 0) {
    let levelDetail = npc.levelManager.getLevelDetail(npc.level) ?? getNpcLevelDetail(npc.level);
    if (!levelDetail) {
      const cfg = await loadLevelConfig(getDefaultNpcLevelKey());
      levelDetail = cfg?.get(npc.level) ?? null;
    }
    const restoredLife = levelDetail?.life ?? levelDetail?.lifeMax ?? 0;
    if (restoredLife > 0) {
      npc.setLifeMax(restoredLife);
      npc.life = npc.lifeMax;
      logger.log(
        `[NpcManager] NPC ${npc.name} lifeMax=0, restored from level ${npc.level}: lifeMax=${npc.lifeMax}`
      );
    } else {
      logger.warn(
        `[NpcManager] NPC ${npc.name} lifeMax=0 at level ${npc.level}, no level data found`
      );
    }
  }

  return npc;
}
