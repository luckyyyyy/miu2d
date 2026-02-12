/**
 * Loader - 游戏加载器
 *
 * ================== 职责边界 ==================
 *
 * Loader 负责「游戏初始化和存档」：
 * 1. newGame() - 开始新游戏，运行 NewGame.txt 脚本
 * 2. loadGame(index) - 读取存档（从文件或 JSON），加载地图/NPC/物品/武功/玩家等
 * 3. loadGameFromJSON(data) - 从 JSON 数据加载存档
 * 4. collectSaveData() - 收集当前游戏状态用于云端保存
 *
 * 参考实现：
 * - JxqyHD/Engine/Storage/Loader.cs
 * - JxqyHD/Engine/Storage/Saver.cs
 * - JxqyHD/Engine/Storage/StorageBase.cs
 *
 * Loader 不负责：
 * - 游戏逻辑更新（由 GameManager 处理）
 * - 渲染和游戏循环（由 GameEngine 处理）
 *
 * ================================================
 */

import type { AudioManager } from "../audio";
import { logger } from "../core/logger";
import type { ScreenEffects } from "../renderer/screen-effects";
import type { GuiManager } from "../gui/gui-manager";
import type { MemoListManager } from "./memo-list-manager";
import type { MapBase } from "../map/map-base";
import type { NpcManager } from "../npc";
import type { ObjManager } from "../obj";
import type { GoodsListManager } from "../player/goods";
import type { MagicListManager } from "../player/magic/magic-list-manager";
import type { Player } from "../player/player";
import { getGameConfig, getPlayersData } from "../resource/resource-loader";
import type { ScriptExecutor } from "../script/executor";
import { type CharacterSaveSlot, formatSaveTime, type GoodsItemData, type MagicItemData, type NpcSaveItem, type ObjSaveItem, type PlayerSaveData, SAVE_VERSION, type SaveData, type TrapGroupValue } from "./storage";

/**
 * 加载进度回调
 */
export type LoadProgressCallback = (progress: number, text: string) => void;

/**
 * Dependencies for Loader
 */
export interface LoaderDependencies {
  player: Player;
  npcManager: NpcManager;
  objManager: ObjManager;
  audioManager: AudioManager;
  screenEffects: ScreenEffects;
  memoListManager: MemoListManager;
  guiManager: GuiManager;
  map: MapBase;
  getScriptExecutor: () => ScriptExecutor;
  loadMap: (mapPath: string) => Promise<void>;
  clearScriptCache: () => void;
  clearVariables: () => void;
  /** 清理精灵/ASF/武功等资源缓存（新游戏/读档时调用，释放 JS 堆和 GPU 纹理） */
  clearResourceCaches: () => void;
  resetEventId: () => void;
  resetGameTime: () => void;
  loadPlayerSprites: (npcIni: string) => Promise<void>;
  // 用于存档
  getVariables: () => Record<string, number>;
  setVariables: (vars: Record<string, number>) => void;
  getCurrentMapName: () => string;
  // 进度回调（可选，用于报告加载进度）
  onProgress?: LoadProgressCallback;
  // 加载完成回调（可选，用于通知核心加载完成）
  onLoadComplete?: () => void;
  // 立即将摄像机居中到玩家位置（用于加载存档后避免摄像机飞过去）
  centerCameraOnPlayer: () => void;

  // === 游戏选项和计时器 (用于存档) ===
  // 地图时间
  getMapTime: () => number;
  setMapTime: (time: number) => void;
  // 存档/掉落开关
  isSaveEnabled: () => boolean;
  setSaveEnabled: (enabled: boolean) => void;
  isDropEnabled: () => boolean;
  setDropEnabled: (enabled: boolean) => void;
  // 天气
  getWeatherState: () => { isSnowing: boolean; isRaining: boolean };
  setWeatherState: (state: { snowShow: boolean; rainFile: string }) => void;
  // 计时器
  getTimerState: () => {
    isOn: boolean;
    totalSecond: number;
    isHidden: boolean;
    isScriptSet: boolean;
    timerScript: string;
    triggerTime: number;
  };
  setTimerState: (state: {
    isOn: boolean;
    totalSecond: number;
    isHidden: boolean;
    isScriptSet: boolean;
    timerScript: string;
    triggerTime: number;
  }) => void;

  // === 新增: 脚本显示地图坐标、水波效果、并行脚本 ===
  // 脚本显示地图坐标
  isScriptShowMapPos: () => boolean;
  setScriptShowMapPos: (show: boolean) => void;
  // 水波效果
  isWaterEffectEnabled: () => boolean;
  setWaterEffectEnabled: (enabled: boolean) => void;
  // 并行脚本 (通过 ScriptExecutor 获取/设置)
  getParallelScripts: () => Array<{ filePath: string; waitMilliseconds: number }>;
  loadParallelScripts: (scripts: Array<{ filePath: string; waitMilliseconds: number }>) => void;
}

/**
 * 多角色内存存储
 * 用于 PlayerChange 时在内存中保存/加载角色数据
 * 不使用 localStorage，避免跨存档污染
 */
interface CharacterMemoryData {
  player: PlayerSaveData | null;
  magics: {
    items: MagicItemData[];
    xiuLianIndex: number;
    replaceLists?: unknown;
  } | null;
  goods: {
    items: GoodsItemData[];
    equips: (GoodsItemData | null)[];
  } | null;
  memo: {
    items: string[];
  } | null;
}

/**
 * Game Loader - 游戏初始化和存档管理
 */
export class Loader {
  private deps: LoaderDependencies;

  /**
   * 多角色内存存储
   * key: playerIndex (0-4)
   * 当加载存档或开始新游戏时清空
   */
  private characterMemory: Map<number, CharacterMemoryData> = new Map();

  constructor(deps: LoaderDependencies) {
    this.deps = deps;
  }

  /**
   * 清空多角色内存存储
   * 在加载存档或开始新游戏时调用
   */
  private clearCharacterMemory(): void {
    this.characterMemory.clear();
    logger.debug(`[Loader] Character memory cleared`);
  }

  /**
   * 从存档数据恢复其他角色到内存
   * 用于 PlayerChange 切换角色时使用
   */
  private loadOtherCharactersToMemory(otherCharacters: Record<number, CharacterSaveSlot>): void {
    for (const [indexStr, slot] of Object.entries(otherCharacters)) {
      const index = parseInt(indexStr, 10);
      if (Number.isNaN(index)) continue;

      const memoryData: CharacterMemoryData = {
        player: slot.player,
        magics: slot.magics
          ? {
              items: slot.magics,
              xiuLianIndex: slot.xiuLianIndex,
              replaceLists: slot.replaceMagicLists,
            }
          : null,
        goods: slot.goods
          ? {
              items: slot.goods,
              equips: slot.equips ?? [],
            }
          : null,
        memo: slot.memo ? { items: slot.memo } : null,
      };

      this.characterMemory.set(index, memoryData);
    }

    logger.debug(
      `[Loader] Restored ${Object.keys(otherCharacters).length} other characters to memory`
    );
  }

  /**
   * 报告加载进度（如果有进度回调）
   */
  private reportProgress(progress: number, text: string): void {
    this.deps.onProgress?.(progress, text);
  }

  /**
   * 设置进度回调（用于运行时更新）
   */
  setProgressCallback(callback: LoadProgressCallback | undefined): void {
    this.deps.onProgress = callback;
  }

  /**
   * 设置加载完成回调（用于通知核心加载完成）
   */
  setLoadCompleteCallback(callback: (() => void) | undefined): void {
    this.deps.onLoadComplete = callback;
  }

  /**
   * 开始新游戏
   *
   * 运行 NewGame.txt 脚本，该脚本会：
   * 1. StopMusic() - 停止当前音乐
   * 2. LoadGame(0) - 加载初始存档
   * 3. PlayMovie("open.avi") - 播放开场动画
   * 4. RunScript("Begin.txt") - 运行开始脚本
   */
  async newGame(): Promise<void> {
    logger.log("[Loader] Starting new game...");

    const { screenEffects, getScriptExecutor, clearVariables, resetEventId, resetGameTime } =
      this.deps;

    // 重置基本状态
    clearVariables();
    resetEventId();
    resetGameTime();

    // 清空多角色内存存储（新游戏从资源文件加载初始数据）
    this.clearCharacterMemory();

    // 清空分组存储（新游戏无历史 SaveNpc/SaveObj 数据）
    this.deps.npcManager.clearNpcGroups();
    this.deps.objManager.clearObjGroups();

    // 以黑屏开始（用于淡入淡出特效）
    screenEffects.setFadeTransparency(1);

    // 运行 NewGame 脚本（从 /api/config 获取内联脚本内容）
    const scriptExecutor = getScriptExecutor();
    const config = getGameConfig();
    const newGameScriptContent = config?.newGameScript;
    if (newGameScriptContent) {
      logger.info(`[Loader] Running newGame script from API config`);
      await scriptExecutor.runScriptContent(newGameScriptContent, "NewGame.txt");
    } else {
      logger.error(`[Loader] No newGameScript found in API config`);
    }

    logger.log("[Loader] New game started");
  }

  /**
   * 加载初始存档（由 NewGame.txt 脚本调用 LoadGame(0)）
   *
   * 加载流程：
   * 1. 从 /api/config 获取初始地图和 BGM
   * 2. 加载地图和物体
   * 3. 从 /api/data 加载武功、物品、玩家数据
   */
  async loadGame(index: number): Promise<void> {
    // index 0 = 初始存档（由 NewGame.txt 脚本调用 LoadGame(0)）
    // 用户存档通过 loadGameFromJSON（云存档）加载，不再走此路径

    const {
      player,
      npcManager,
      objManager,
      audioManager,
      memoListManager,
      loadMap,
    } = this.deps;

    // 从 Player 获取 GoodsListManager 和 MagicListManager
    const goodsListManager = player.getGoodsListManager();
    const magicListManager = player.getMagicListManager();

    logger.log(`[Loader] Loading initial game save (index=${index})`);

    // 进度报告：地图加载前 0-5%
    this.reportProgress(0, "准备加载...");

    try {
      // Step 1: 从 /api/config 获取初始地图和 BGM
      this.reportProgress(5, "读取配置...");
      const config = getGameConfig();
      const initialMap = config?.initialMap || "map002";
      const initialNpc = config?.initialNpc || "";
      const initialObj = config?.initialObj || "";
      const initialBgm = config?.initialBgm || "";
      logger.debug(`[Loader] Initial save: map=${initialMap}, npc=${initialNpc}, obj=${initialObj}, bgm=${initialBgm}`);

      // 玩家角色索引 - 默认 0
      let chrIndex = 0;

      // 加载地图
      if (initialMap) {
        this.reportProgress(10, "加载地图...");
        logger.debug(`[Loader] Loading map: ${initialMap}`);
        await loadMap(initialMap);
      }

      // 加载 NPC
      if (initialNpc) {
        this.reportProgress(92, "加载 NPC...");
        logger.debug(`[Loader] Loading NPC file: ${initialNpc}`);
        await npcManager.loadNpcFile(initialNpc);
      }

      // 加载物体
      if (initialObj) {
        this.reportProgress(94, "加载物体...");
        logger.debug(`[Loader] Loading Obj file: ${initialObj}`);
        await objManager.load(initialObj);
      }

      // 加载背景音乐
      if (initialBgm) {
        audioManager.playMusic(initialBgm);
      }

      // Step 2: 预读玩家 npcIni 以设置 NpcIniIndex
      // 必须在加载武功列表之前设置，否则 SpecialAttackTexture 预加载会使用错误的索引

      // 优先使用 /api/config 的 playerKey
      let playerKey = `Player${chrIndex}.ini`;
      const configPlayerKey = getGameConfig()?.playerKey;
      if (configPlayerKey) {
        playerKey = configPlayerKey;
        // 从 playerKey 提取 chrIndex（如 "Player1.ini" → 1）
        const match = configPlayerKey.match(/Player(\d+)\.ini/i);
        if (match) {
          chrIndex = parseInt(match[1], 10);
          player.setPlayerIndex(chrIndex);
          logger.debug(`[Loader] Using config playerKey: ${configPlayerKey}, chrIndex=${chrIndex}`);
        }
      }

      // 从 API 数据加载玩家
      const apiPlayerData = this.findApiPlayer(playerKey);

      if (apiPlayerData?.npcIni) {
        await player.setNpcIni(apiPlayerData.npcIni);
        logger.debug(`[Loader] Pre-set NpcIni from API: ${apiPlayerData.npcIni} (index=${player.npcIniIndex})`);
      }

      // Step 3: 加载 Magic、Goods (72-78%)
      this.reportProgress(72, "加载武功...");
      magicListManager.stopReplace();
      magicListManager.clearReplaceList();

      // 初始化武功经验配置（从 /api/config 读取）
      magicListManager.initializeMagicExp();

      // 从 API 数据加载武功
      if (apiPlayerData?.initialMagics && apiPlayerData.initialMagics.length > 0) {
        const magicItems: MagicItemData[] = apiPlayerData.initialMagics.map((m, i) => ({
          fileName: m.iniFile,
          level: m.level,
          exp: m.exp,
          index: i + 1,
        }));
        await this.loadMagicsFromJSON(magicItems, 0, magicListManager);
        logger.debug(`[Loader] Loaded ${magicItems.length} magics from API data`);
      }

      this.reportProgress(74, "加载物品...");
      // 从 API 数据加载物品
      if (apiPlayerData?.initialGoods && apiPlayerData.initialGoods.length > 0) {
        const goodsItems: GoodsItemData[] = apiPlayerData.initialGoods.map(g => ({
          fileName: g.iniFile,
          count: g.number,
        }));
        this.loadGoodsFromJSON(goodsItems, [], goodsListManager);
        logger.debug(`[Loader] Loaded ${goodsItems.length} goods from API data`);
      }

      // 初始存档的备忘为空
      this.reportProgress(76, "加载备忘...");
      memoListManager.renewList();

      // Step 4: 加载玩家 (78-88%)
      this.reportProgress(78, "加载玩家...");
      if (apiPlayerData) {
        logger.debug(`[Loader] Loading player from API data: ${apiPlayerData.key}`);
        await player.loadFromApiData(apiPlayerData);
      }

      // 加载玩家精灵 (80-88%)
      this.reportProgress(80, "加载玩家精灵...");
      const playerNpcIni = player.npcIni;
      logger.debug(`[Loader] Loading player sprites: ${playerNpcIni}`);
      await this.deps.loadPlayerSprites(playerNpcIni);

      this.reportProgress(88, "应用装备特效...");
      // 应用装备特效
      goodsListManager.applyEquipSpecialEffectFromList();

      // 应用武功效果（FlyIni 替换等）
      player.loadMagicEffect();

      // 摄像机居中到玩家 (96-98%)
      this.reportProgress(96, "初始化摄像机...");
      this.deps.centerCameraOnPlayer();

      this.reportProgress(98, "完成加载...");
      this.deps.onLoadComplete?.();
      logger.debug(`[Loader] Game save loaded successfully`);

      // Debug: 打印障碍物体
      objManager.debugPrintObstacleObjs();
    } catch (error) {
      logger.error(`[Loader] Error loading game save:`, error);
    }
  }

  /**
   * 从 API 数据中查找指定 key 的玩家数据
   */
  private findApiPlayer(playerKey: string): import("../resource/resource-loader").ApiPlayerData | null {
    const players = getPlayersData();
    if (!players) return null;
    return players.find(p => p.key === playerKey) ?? null;
  }

  /**
   * 从 API 数据中按 index 查找玩家数据
   * 用于 changePlayer 时从 API 加载目标角色配置
   */
  private findApiPlayerByIndex(index: number): import("../resource/resource-loader").ApiPlayerData | null {
    const players = getPlayersData();
    if (!players) return null;
    return players.find(p => p.index === index) ?? null;
  }

  // ============= JSON 存档系统 =============

  // ============= 多主角切换 =============

  /**
   * 保存当前玩家数据到内存
   * -> 保存到 Player{index}.ini
   *
   * Web 版使用内存存储，不使用 localStorage
   * 避免跨存档污染
   */
  private savePlayerToMemory(): void {
    const { player } = this.deps;
    const index = player.playerIndex;

    const playerData = this.collectPlayerData(player);

    // 获取或创建内存存储
    let memoryData = this.characterMemory.get(index);
    if (!memoryData) {
      memoryData = { player: null, magics: null, goods: null, memo: null };
      this.characterMemory.set(index, memoryData);
    }
    memoryData.player = playerData;

    logger.log(`[Loader] SavePlayer: saved to memory (index=${index})`);
  }

  /**
   * 保存当前武功/物品/备忘录到内存
   * Reference: Saver.SaveMagicGoodMemoList()
   */
  private saveMagicGoodMemoListToMemory(): void {
    const { player, memoListManager } = this.deps;
    const goodsListManager = player.getGoodsListManager();
    const magicListManager = player.getMagicListManager();
    const index = player.playerIndex;

    // 获取或创建内存存储
    let memoryData = this.characterMemory.get(index);
    if (!memoryData) {
      memoryData = { player: null, magics: null, goods: null, memo: null };
      this.characterMemory.set(index, memoryData);
    }

    // 保存武功列表
    memoryData.magics = {
      items: this.collectMagicsData(magicListManager),
      xiuLianIndex: magicListManager.getXiuLianIndex(),
      replaceLists: magicListManager.serializeReplaceLists(),
    };

    // 保存物品列表
    memoryData.goods = {
      items: this.collectGoodsData(goodsListManager),
      equips: this.collectEquipsData(goodsListManager),
    };

    // 保存备忘录
    memoryData.memo = { items: memoListManager.getItems() };

    logger.log(`[Loader] SaveMagicGoodMemoList: saved to memory (index=${index})`);
  }

  /**
   * 加载武功和物品列表
   * Reference: Loader.LoadMagicGoodList()
   *
   * 优先从内存加载，如果内存为空则从资源文件加载初始数据
   * = save/game/Magic{index}.ini
   * = save/game/Goods{index}.ini
   */
  private async loadMagicGoodListFromMemory(): Promise<void> {
    const { player } = this.deps;
    const goodsListManager = player.getGoodsListManager();
    const magicListManager = player.getMagicListManager();
    const index = player.playerIndex;

    // Reference: MagicListManager.StopReplace() + ClearReplaceList()
    magicListManager.stopReplace();
    magicListManager.clearReplaceList();

    // 必须先清空旧列表，确保即使新角色没有数据，旧角色物品/武功也不会残留
    goodsListManager.renewList();
    magicListManager.renewList();

    // 获取内存存储
    const memoryData = this.characterMemory.get(index);

    // 加载武功列表
    let magicLoaded = false;

    if (memoryData?.magics) {
      try {
        const magicData = memoryData.magics;
        // 使用现有的 loadMagicsFromJSON 方法
        if (magicData.items) {
          await this.loadMagicsFromJSON(
            magicData.items,
            magicData.xiuLianIndex ?? 0,
            magicListManager
          );
          magicLoaded = true;
        }
        // 恢复替换列表
        if (magicData.replaceLists) {
          magicListManager.deserializeReplaceLists(magicData.replaceLists);
        }
      } catch (e) {
        logger.warn(`[Loader] Failed to load magic list from memory:`, e);
      }
    }

    if (!magicLoaded) {
      // 尝试从 API 数据加载初始武功
      const apiPlayer = this.findApiPlayerByIndex(index);
      if (apiPlayer?.initialMagics && apiPlayer.initialMagics.length > 0) {
        try {
          const magicItems: MagicItemData[] = apiPlayer.initialMagics.map((m, i) => ({
            fileName: m.iniFile,
            level: m.level,
            exp: m.exp,
            index: i + 1, // 从 1 开始分配位置
          }));
          await this.loadMagicsFromJSON(magicItems, 0, magicListManager);
          magicLoaded = true;
          logger.log(
            `[Loader] LoadMagicList: loaded ${magicItems.length} magics from API data (index=${index})`
          );
        } catch (e) {
          logger.warn(`[Loader] Failed to load magic list from API data:`, e);
        }
      }
    }

    // 加载物品列表
    let goodsLoaded = false;

    if (memoryData?.goods) {
      try {
        const goodsData = memoryData.goods;
        // 使用现有的 loadGoodsFromJSON 方法
        if (goodsData.items) {
          this.loadGoodsFromJSON(goodsData.items, goodsData.equips ?? [], goodsListManager);
          goodsLoaded = true;
        }
      } catch (e) {
        logger.warn(`[Loader] Failed to load goods list from memory:`, e);
      }
    }

    if (!goodsLoaded) {
      // 尝试从 API 数据加载初始物品
      const apiPlayer = this.findApiPlayerByIndex(index);
      if (apiPlayer?.initialGoods && apiPlayer.initialGoods.length > 0) {
        try {
          const goodsItems: GoodsItemData[] = apiPlayer.initialGoods.map(g => ({
            fileName: g.iniFile,
            count: g.number,
          }));
          this.loadGoodsFromJSON(goodsItems, [], goodsListManager);
          goodsLoaded = true;
          logger.log(
            `[Loader] LoadGoodsList: loaded ${goodsItems.length} goods from API data (index=${index})`
          );
        } catch (e) {
          logger.warn(`[Loader] Failed to load goods list from API data:`, e);
        }
      }
    }

    logger.log(
      `[Loader] LoadMagicGoodList: done (index=${index}, magic=${magicLoaded}, goods=${goodsLoaded})`
    );
  }

  /**
   * 加载玩家数据
   * Reference: Loader.LoadPlayer()
   *
   * 优先从内存加载，如果内存为空则从 API 数据加载
   */
  private async loadPlayerFromMemory(): Promise<void> {
    const { player } = this.deps;
    const goodsListManager = player.getGoodsListManager();
    const index = player.playerIndex;

    // 获取内存存储
    const memoryData = this.characterMemory.get(index);

    let loaded = false;

    if (memoryData?.player) {
      // 从内存加载
      try {
        await this.loadPlayerFromJSON(memoryData.player, player);
        // 重新加载角色精灵（ASF）
        // 在切换时会重新设置精灵
        if (memoryData.player.npcIni) {
          await player.loadSpritesFromNpcIni(memoryData.player.npcIni);
        }
        loaded = true;
        logger.log(`[Loader] LoadPlayer: loaded from memory (index=${index})`);
      } catch (e) {
        logger.error(`[Loader] Failed to load player from memory:`, e);
      }
    }

    if (!loaded) {
      // 尝试从 API 数据加载
      const apiPlayer = this.findApiPlayerByIndex(index);
      if (apiPlayer) {
        try {
          await player.loadFromApiData(apiPlayer);
          await player.loadSpritesFromNpcIni(apiPlayer.npcIni);
          loaded = true;
          logger.log(`[Loader] LoadPlayer: loaded from API data (index=${index}, key=${apiPlayer.key})`);
        } catch (e) {
          logger.error(`[Loader] Failed to load player from API data:`, e);
        }
      }
    }

    if (loaded) {
      // Reference: GoodsListManager.ApplyEquipSpecialEffectFromList(Globals.ThePlayer)
      goodsListManager.applyEquipSpecialEffectFromList();

      // Reference: Globals.ThePlayer.LoadMagicEffect()
      player.loadMagicEffect();
    }

    // GuiManager.StateInterface.Index = GuiManager.EquipInterface.Index = Globals.PlayerIndex;
    // Web 版 UI 响应式更新，playerIndex 变更会自动反映到 UI
    // 不需要显式通知
  }

  /**
   * 保存当前玩家数据到内存
   * 在切换角色前调用
   */
  saveCurrentPlayerToMemory(): void {
    logger.log(
      `[Loader] Saving current player (index ${this.deps.player.playerIndex}) to memory...`
    );
    // 保存当前玩家数据到内存
    this.savePlayerToMemory();
    // 保存武功/物品/备忘录到内存
    this.saveMagicGoodMemoListToMemory();
  }

  /**
   * 从内存加载玩家数据
   * 在切换角色后调用
   */
  async loadPlayerDataFromMemory(): Promise<void> {
    const { player } = this.deps;
    const index = player.playerIndex;
    logger.log(`[Loader] Loading player (index ${index}) data from memory...`);

    // 预设 NpcIniIndex（从内存或 API 数据中提取 npcIni）
    // 必须在加载武功列表之前设置，否则 SpecialAttackTexture 预加载会使用错误的索引
    const memoryData = this.characterMemory.get(index);
    const npcIni = memoryData?.player?.npcIni;
    if (npcIni) {
      await player.setNpcIni(npcIni);
      logger.debug(`[Loader] Pre-set NpcIni from memory: ${npcIni} (index=${player.npcIniIndex})`);
    } else {
      // 没有内存数据时，尝试从 API 数据获取 npcIni
      const apiPlayer = this.findApiPlayerByIndex(index);
      if (apiPlayer?.npcIni) {
        await player.setNpcIni(apiPlayer.npcIni);
        logger.debug(`[Loader] Pre-set NpcIni from API: ${apiPlayer.npcIni} (index=${player.npcIniIndex})`);
      }
    }

    // 加载新角色的武功/物品
    await this.loadMagicGoodListFromMemory();
    // 加载新角色
    await this.loadPlayerFromMemory();
  }

  /**
   * 从 JSON 数据加载存档
   *
   * @param data 存档数据
   */
  async loadGameFromJSON(data: SaveData): Promise<void> {
    logger.log(`[Loader] Loading game from JSON...`);

    const {
      player,
      npcManager,
      objManager,
      audioManager,
      screenEffects,
      memoListManager,
      guiManager,
      loadMap,
      clearScriptCache,
      setVariables,
      getScriptExecutor,
    } = this.deps;

    // 从 Player 获取 GoodsListManager 和 MagicListManager
    const goodsListManager = player.getGoodsListManager();
    const magicListManager = player.getMagicListManager();

    try {
      // Step 0: 立即设置屏幕全黑，防止在加载过程中看到摄像机移动
      // Reference: 存档加载时画面保持黑色直到 FadeIn
      screenEffects.setFadeTransparency(1);
      // 重置绘制颜色为白色（避免前一次游戏的颜色残留）
      // 后面 Step 13 会从存档恢复正确的颜色
      screenEffects.resetColors();

      // Step 1: 停止所有正在运行的脚本 (0-5%)
      // Reference: ScriptManager.Clear()
      this.reportProgress(0, "停止脚本...");
      logger.debug(`[Loader] Stopping all scripts...`);
      const scriptExecutor = getScriptExecutor();
      scriptExecutor.stopAllScripts();

      // Step 2: 重置 UI 状态（关闭对话框、选择框等）(5-10%)
      // Reference: GuiManager.EndDialog(), GuiManager.CloseTimeLimit()
      this.reportProgress(5, "重置界面...");
      logger.debug(`[Loader] Resetting UI state...`);
      guiManager.resetAllUI();

      // Step 3: 清理 (10-15%)
      this.reportProgress(10, "清理数据...");
      logger.debug(`[Loader] Clearing all managers...`);
      clearScriptCache();
      this.deps.clearVariables();
      // 清理精灵/ASF/武功等资源缓存，释放 JS 堆和 GPU 纹理
      this.deps.clearResourceCaches();
      npcManager.clearAllNpc();
      objManager.clearAll();
      audioManager.stopMusic();

      // 清空多角色内存存储（避免跨存档污染）
      this.clearCharacterMemory();

      // 清空内存文件存储（避免跨存档污染，后面会从存档恢复）
      npcManager.clearNpcGroups();
      objManager.clearObjGroups();



      // Step 4: 加载游戏状态
      const state = data.state;

      // 加载地图 (15-70% - 地图加载是最耗时的部分)
      if (state.map) {
        this.reportProgress(15, "加载地图...");
        logger.debug(`[Loader] Loading map: ${state.map}`);
        await loadMap(state.map);
      }

      // 注意：不从 .npc 文件加载，而是从 JSON 存档数据恢复
      // 在存档时会把 NPC 状态写到 save/game/xxx.npc 文件
      // Web 版直接从 JSON 恢复，所以跳过 npcManager.loadNpcFile()
      // 只设置 fileName 用于后续可能的引用
      if (state.npc) {
        npcManager.setFileName(state.npc);
      }

      // 注意：不从 .obj 文件加载，而是从 JSON 存档数据恢复
      // 在存档时会把 Obj 状态写到 save/game/xxx.obj 文件
      // Web 版直接从 JSON 恢复，所以跳过 objManager.load()
      // 只设置 fileName 用于后续可能的引用
      if (state.obj) {
        objManager.setFileName(state.obj);
      }

      // 播放背景音乐
      if (state.bgm) {
        audioManager.playMusic(state.bgm);
      }

      // 玩家角色索引（支持多主角）
      // Globals.PlayerIndex = int.Parse(state["Chr"]);
      // 必须在加载武功/物品/玩家数据之前设置，因为它们依赖 playerIndex
      const chrIndex = state.chr ?? 0;
      player.setPlayerIndex(chrIndex);
      logger.debug(`[Loader] Set playerIndex: ${chrIndex}`);

      // Step 5: 恢复变量 (70-72%)
      this.reportProgress(70, "恢复变量...");
      if (data.variables && setVariables) {
        logger.debug(`[Loader] Restoring variables: ${Object.keys(data.variables).length} keys`);
        setVariables(data.variables);
      }

      // Step 5.5: 预设 NpcIniIndex（从存档数据中提取 npcIni）
      // 必须在加载武功列表之前设置，否则 SpecialAttackTexture 预加载会使用错误的索引
      if (data.player?.npcIni) {
        await player.setNpcIni(data.player.npcIni);
        logger.debug(`[Loader] Pre-set NpcIni from save: ${data.player.npcIni} (index=${player.npcIniIndex})`);
      }

      // Step 6: 加载武功列表 (72-75%)
      this.reportProgress(72, "加载武功...");
      // 先停止替换并清理替换列表
      magicListManager.stopReplace();
      magicListManager.clearReplaceList();
      logger.debug(`[Loader] Loading magics...`);
      await this.loadMagicsFromJSON(data.magics, data.xiuLianIndex, magicListManager);

      // 加载替换武功列表（如果有）
      // 会在角色变身时创建替换列表，保存时通过 SaveReplaceList 持久化
      if (data.replaceMagicLists) {
        logger.debug(`[Loader] Loading replace magic lists...`);
        await magicListManager.deserializeReplaceLists(data.replaceMagicLists);
      }

      // Step 7: 加载物品列表 (75-78%)
      this.reportProgress(75, "加载物品...");
      logger.debug(`[Loader] Loading goods...`);
      this.loadGoodsFromJSON(data.goods, data.equips, goodsListManager);

      // Step 8: 加载备忘录 (78-80%)
      this.reportProgress(78, "加载备忘...");
      if (data.memo) {
        logger.debug(`[Loader] Loading memo...`);
        memoListManager.renewList();
        memoListManager.bulkLoadItems(data.memo.items);
      }

      // Step 9: 加载玩家 (80-85%)
      this.reportProgress(80, "加载玩家...");
      logger.debug(`[Loader] Loading player...`);
      await this.loadPlayerFromJSON(data.player, player);

      // 设置加载中状态（-1），确保后面设置真正 state 时会触发纹理更新
      player.setLoadingState();

      // 加载玩家精灵 (85-88%)
      this.reportProgress(85, "加载玩家精灵...");
      // Reference: Loader.LoadPlayer() -> new Player(path) -> Load() -> Initlize()
      const playerNpcIni = player.npcIni;
      logger.debug(`[Loader] Loading player sprites: ${playerNpcIni}`);
      await this.deps.loadPlayerSprites(playerNpcIni);

      // 精灵加载后恢复 state（因为 _state=-1，值不同会触发纹理更新）
      player.state = data.player.state ?? 0;

      // 应用装备特效
      // Reference: Loader.LoadPlayer() -> GoodsListManager.ApplyEquipSpecialEffectFromList
      goodsListManager.applyEquipSpecialEffectFromList();

      // 应用武功效果（FlyIni 替换等）
      // Reference: Loader.LoadPlayer() -> Globals.ThePlayer.LoadMagicEffect()
      player.loadMagicEffect();

      // Step 10: 加载陷阱 (88-90%)
      // 陷阱基础配置已从 MMF 地图数据内嵌加载（在 handleMapChange 中初始化）
      // 这里只恢复存档中的运行时陷阱修改（脚本动态设置的陷阱）
      this.reportProgress(88, "加载陷阱...");
      if (data.groups?.trap) {
        logger.debug(`[Loader] Loading traps from save data...`);
        this.loadTrapsFromSave(data.snapshot.trap, data.groups.trap);
      } else if (data.snapshot?.trap) {
        // 没有 trap groups，只恢复已触发列表
        this.loadTrapsFromSave(data.snapshot.trap, undefined);
      }

      // Step 11: 从快照恢复 NPC (90-93%)
      this.reportProgress(90, "加载 NPC...");
      logger.debug(`[Loader] Loading NPCs...`);
      npcManager.clearAllNpc();
      // clearAllNpc 会清空 fileName（与 C# 行为一致），需要重新设置
      // 否则脚本调用 SaveNpc() 时找不到文件名
      if (state.npc) {
        npcManager.setFileName(state.npc);
      }
      if (data.snapshot.npc?.length > 0) {
        await this.loadNpcsFromJSON(data.snapshot.npc, npcManager);
      }

      // Step 11.5: 从快照恢复伙伴 (93-95%)
      this.reportProgress(93, "加载伙伴...");
      logger.debug(`[Loader] Loading partners...`);
      if (data.snapshot.partner?.length > 0) {
        await this.loadNpcsFromJSON(data.snapshot.partner, npcManager);
        logger.debug(`[Loader] Loaded ${data.snapshot.partner.length} partners`);
      }

      // Step 12: 从快照恢复 Obj (95-98%)
      this.reportProgress(95, "加载物体...");
      logger.debug(`[Loader] Loading Objs...`);
      objManager.clearAll();
      // clearAll 会清空 fileName，需要重新设置
      // 否则脚本调用 SaveObj() 时找不到文件名
      if (state.obj) {
        objManager.setFileName(state.obj);
      }
      if (data.snapshot.obj?.length > 0) {
        await this.loadObjsFromJSON(data.snapshot.obj, objManager);
      }

      // Step 12.5: 恢复分组存储
      if (data.groups?.npc) {
        npcManager.setNpcGroups(data.groups.npc);
        logger.debug(`[Loader] Restored NPC groups (${Object.keys(data.groups.npc).length} files)`);
      }
      if (data.groups?.obj) {
        objManager.setObjGroups(data.groups.obj);
        logger.debug(`[Loader] Restored Obj groups (${Object.keys(data.groups.obj).length} files)`);
      }

      // Step 13: 加载选项设置
      // 参考Loader.cs LoadGame() 中的 option 恢复
      if (data.option) {
        logger.debug(`[Loader] Restoring game options...`);
        // mapTime
        if (this.deps.setMapTime && data.option.mapTime !== undefined) {
          this.deps.setMapTime(data.option.mapTime);
        }
        // save/drop flags
        if (this.deps.setSaveEnabled) {
          this.deps.setSaveEnabled(!data.option.saveDisabled);
        }
        if (this.deps.setDropEnabled) {
          this.deps.setDropEnabled(!data.option.isDropGoodWhenDefeatEnemyDisabled);
        }
        // weather
        if (this.deps.setWeatherState) {
          this.deps.setWeatherState({
            snowShow: data.option.snowShow,
            rainFile: data.option.rainFile,
          });
        }
        // draw colors (mpcStyle = map, asfStyle = sprite)
        // 格式: RRGGBB 十六进制字符串
        // 参考 C#: 总是显式设置颜色（有值则解析，无值则重置为白色）
        const hexToRgb = (hex: string) => {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          return {
            r: Number.isNaN(r) ? 255 : r,
            g: Number.isNaN(g) ? 255 : g,
            b: Number.isNaN(b) ? 255 : b,
          };
        };
        if (data.option.mpcStyle && data.option.mpcStyle !== "FFFFFF") {
          const c = hexToRgb(data.option.mpcStyle);
          screenEffects.setMapColor(c.r, c.g, c.b);
          logger.debug(`[Loader] Restored map color: #${data.option.mpcStyle}`);
        } else {
          screenEffects.setMapColor(255, 255, 255);
          logger.debug(`[Loader] Reset map color to white (default)`);
        }
        if (data.option.asfStyle && data.option.asfStyle !== "FFFFFF") {
          const c = hexToRgb(data.option.asfStyle);
          screenEffects.setSpriteColor(c.r, c.g, c.b);
          logger.debug(`[Loader] Restored sprite color: #${data.option.asfStyle}`);
        } else {
          screenEffects.setSpriteColor(255, 255, 255);
          logger.debug(`[Loader] Reset sprite color to white (default)`);
        }
      }

      // Step 14: 加载计时器状态
      // 参考Loader.cs LoadGame() 中的 timer 恢复
      if (data.timer?.isOn && this.deps.setTimerState) {
        logger.debug(`[Loader] Restoring timer state...`);
        this.deps.setTimerState({
          isOn: data.timer.isOn,
          totalSecond: data.timer.totalSecond,
          isHidden: !data.timer.isTimerWindowShow,
          isScriptSet: data.timer.isScriptSet,
          timerScript: data.timer.timerScript,
          triggerTime: data.timer.triggerTime,
        });
      }

      // Step 14.1: 恢复脚本显示地图坐标开关
      if (data.state?.scriptShowMapPos !== undefined && this.deps.setScriptShowMapPos) {
        this.deps.setScriptShowMapPos(data.state.scriptShowMapPos);
        logger.debug(`[Loader] Restored scriptShowMapPos: ${data.state.scriptShowMapPos}`);
      }

      // Step 14.2: 恢复水波效果开关
      if (data.option?.water !== undefined && this.deps.setWaterEffectEnabled) {
        this.deps.setWaterEffectEnabled(data.option.water);
        logger.debug(`[Loader] Restored water effect: ${data.option.water}`);
      }

      // Step 14.3: 加载并行脚本
      if (
        data.parallelScripts &&
        data.parallelScripts.length > 0 &&
        this.deps.loadParallelScripts
      ) {
        logger.debug(`[Loader] Restoring ${data.parallelScripts.length} parallel scripts...`);
        this.deps.loadParallelScripts(data.parallelScripts);
      }

      // Step 15: 立即居中摄像机到玩家位置 (98%)
      // 必须在 fadeIn 之前完成，否则会看到摄像机移动
      this.reportProgress(98, "完成加载...");
      logger.debug(`[Loader] Centering camera on player...`);
      this.deps.centerCameraOnPlayer();
      this.deps.onLoadComplete?.();

      // Step 16: 恢复其他角色数据到内存
      // 用于 PlayerChange 切换角色时使用
      if (data.otherCharacters) {
        this.loadOtherCharactersToMemory(data.otherCharacters);
      }

      // Step 17: 执行淡入效果 (98-100%)
      // 加载存档后屏幕应该从黑屏淡入到正常
      logger.debug(`[Loader] Starting fade in effect...`);
      screenEffects.fadeIn();

      this.reportProgress(100, "加载完成");
      logger.log(`[Loader] Game loaded from JSON successfully`);
    } catch (error) {
      logger.error(`[Loader] Error loading game from JSON:`, error);
      throw error;
    }
  }

  /**
   * 收集当前游戏状态用于保存
   */
  collectSaveData(): SaveData {
    const {
      player,
      npcManager,
      objManager,
      audioManager,
      screenEffects,
      memoListManager,
      getVariables,
      getCurrentMapName,
      getMapTime,
      isSaveEnabled,
      isDropEnabled,
      getWeatherState,
      getTimerState,
    } = this.deps;

    // 从 Player 获取 GoodsListManager 和 MagicListManager
    const goodsListManager = player.getGoodsListManager();
    const magicListManager = player.getMagicListManager();

    const mapName = getCurrentMapName();
    const variables = getVariables();
    const weatherState = getWeatherState();
    const timerState = getTimerState();

    // 获取绘制颜色 (mpcStyle = map draw color, asfStyle = sprite draw color)
    const mapColor = screenEffects.getMapTintColor();
    const spriteColor = screenEffects.getSpriteTintColor();
    // 转换为十六进制字符串（格式：RRGGBB）
    const colorToHex = (c: { r: number; g: number; b: number }) => {
      const r = c.r.toString(16).padStart(2, "0");
      const g = c.g.toString(16).padStart(2, "0");
      const b = c.b.toString(16).padStart(2, "0");
      return `${r}${g}${b}`.toUpperCase();
    };

    const saveData: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),

      // 游戏状态
      state: {
        map: mapName,
        npc: npcManager.getFileName() || "",
        obj: objManager.getFileName() || "",
        bgm: audioManager.getCurrentMusicFile() || "",
        chr: player.playerIndex, // Player 维护的 playerIndex
        time: formatSaveTime(),
        scriptShowMapPos: this.deps.isScriptShowMapPos(),
      },

      // 选项 - 参考Saver.cs [Option] section
      option: {
        mapTime: getMapTime(),
        snowShow: weatherState.isSnowing,
        rainFile: weatherState.isRaining ? "rain" : "", // 保存雨声文件名
        water: this.deps.isWaterEffectEnabled(),
        mpcStyle: colorToHex(mapColor),
        asfStyle: colorToHex(spriteColor),
        saveDisabled: !isSaveEnabled(),
        isDropGoodWhenDefeatEnemyDisabled: !isDropEnabled(),
      },

      // 计时器 - 参考Saver.cs [Timer] section
      timer: {
        isOn: timerState.isOn,
        totalSecond: timerState.totalSecond,
        isTimerWindowShow: !timerState.isHidden, // 保存的是 "是否显示"，TypeScript 内部存的是 "是否隐藏"
        isScriptSet: timerState.isScriptSet,
        timerScript: timerState.timerScript,
        triggerTime: timerState.triggerTime,
      },

      // 脚本变量
      variables: { ...variables },

      // 并行脚本
      parallelScripts: this.deps.getParallelScripts(),

      // 玩家数据
      player: this.collectPlayerData(player),

      // 物品
      goods: this.collectGoodsData(goodsListManager),
      equips: this.collectEquipsData(goodsListManager),

      // 武功
      magics: this.collectMagicsData(magicListManager),
      xiuLianIndex: magicListManager.getXiuLianIndex(),
      // 替换武功列表 (角色变身时的临时武功)
      // > MagicListManager.SaveReplaceList
      replaceMagicLists: magicListManager.serializeReplaceLists(),

      // 备忘录
      memo: {
        items: memoListManager.getItems(),
      },

      // 快照 - 存档瞬间各实体的当前状态
      snapshot: {
        npc: npcManager.collectSnapshot(false),
        partner: npcManager.collectSnapshot(true),
        obj: objManager.collectSnapshot(),
        trap: this.collectTrapSnapshot(),
      },

      // 分组 - 脚本按 key 缓存的中间数据
      groups: {
        npc: this.serializeGroups(npcManager.getNpcGroups()),
        obj: this.serializeGroups(objManager.getObjGroups()),
        trap: this.collectTrapGroups(),
      },

      // 多角色数据 (PlayerChange 切换过的角色)
      otherCharacters: this.collectOtherCharactersData(),
    };

    return saveData;
  }

  /**
   * 收集其他角色的存档数据
   * 保存内存中通过 PlayerChange 切换过的角色数据
   */
  private collectOtherCharactersData(): Record<number, CharacterSaveSlot> | undefined {
    if (this.characterMemory.size === 0) {
      return undefined;
    }

    const result: Record<number, CharacterSaveSlot> = {};

    for (const [index, memoryData] of this.characterMemory) {
      result[index] = {
        player: memoryData.player,
        magics: memoryData.magics?.items ?? null,
        xiuLianIndex: memoryData.magics?.xiuLianIndex ?? 0,
        replaceMagicLists: memoryData.magics?.replaceLists,
        goods: memoryData.goods?.items ?? null,
        equips: memoryData.goods?.equips ?? null,
        memo: memoryData.memo?.items ?? null,
      };
    }

    logger.debug(`[Loader] Collected ${Object.keys(result).length} other characters for save`);
    return result;
  }

  /**
   * 将 Map<string, T[]> 转换为 Record<string, T[]> 用于存档序列化
   */
  private serializeGroups<T>(store: Map<string, T[]>): Record<string, T[]> | undefined {
    if (store.size === 0) return undefined;
    const result: Record<string, T[]> = {};
    for (const [key, value] of store) {
      result[key] = value;
    }
    return result;
  }

  // ============= 数据收集方法 =============

  /**
   * 收集玩家数据
   * + Player.Save()
   */
  private collectPlayerData(player: Player): PlayerSaveData {
    return {
      // === 基本信息 ===
      name: player.name,
      npcIni: player.npcIni,
      kind: player.kind,
      relation: player.relation,
      pathFinder: player.pathFinder,
      state: player.state,

      // === 位置 ===
      mapX: player.mapX,
      mapY: player.mapY,
      dir: player.currentDirection,

      // === 范围 ===
      visionRadius: player.visionRadius,
      dialogRadius: player.dialogRadius,
      attackRadius: player.attackRadius,

      // === 属性 ===
      level: player.level,
      exp: player.exp,
      levelUpExp: player.levelUpExp,
      life: player.life,
      lifeMax: player.lifeMax,
      thew: player.thew,
      thewMax: player.thewMax,
      mana: player.mana,
      manaMax: player.manaMax,
      attack: player.attack,
      attack2: player.attack2,
      attack3: player.attack3,
      attackLevel: player.attackLevel,
      defend: player.defend,
      defend2: player.defend2,
      defend3: player.defend3,
      evade: player.evade,
      lum: player.lum,
      action: player.action,
      walkSpeed: player.walkSpeed,
      addMoveSpeedPercent: player.addMoveSpeedPercent,
      expBonus: player.expBonus,
      canLevelUp: player.canLevelUp,

      // === 位置相关 ===
      fixedPos: player.fixedPos,
      currentFixedPosIndex: player.currentFixedPosIndex,
      destinationMapPosX: player.destinationMoveTilePosition.x,
      destinationMapPosY: player.destinationMoveTilePosition.y,

      // === AI/行为 ===
      idle: player.idle,
      group: player.group,
      noAutoAttackPlayer: player.noAutoAttackPlayer,
      invincible: player.invincible,

      // === 状态效果 ===
      poisonSeconds: player.poisonSeconds,
      poisonByCharacterName: player.poisonByCharacterName,
      petrifiedSeconds: player.petrifiedSeconds,
      frozenSeconds: player.frozenSeconds,
      isPoisonVisualEffect: player.isPoisonVisualEffect,
      isPetrifiedVisualEffect: player.isPetrifiedVisualEffect,
      isFrozenVisualEffect: player.isFrozenVisualEffect,

      // === 死亡/复活 ===
      isDeath: player.isDeath,
      isDeathInvoked: player.isDeathInvoked,
      reviveMilliseconds: player.reviveMilliseconds,
      leftMillisecondsToRevive: player.leftMillisecondsToRevive,

      // === INI 文件 ===
      bodyIni: player.bodyIni || undefined,
      flyIni: player.flyIni || undefined,
      flyIni2: player.flyIni2 || undefined,
      flyInis: player.flyInis || undefined,
      isBodyIniAdded: player.isBodyIniAdded,

      // === 脚本相关 ===
      scriptFile: player.scriptFile || undefined,
      scriptFileRight: player.scriptFileRight || undefined,
      deathScript: player.deathScript || undefined,
      timerScriptFile: player.timerScript || undefined,
      timerScriptInterval: player.timerInterval,

      // === 技能相关 ===
      magicToUseWhenLifeLow: player.magicToUseWhenLifeLow || undefined,
      lifeLowPercent: player.lifeLowPercent,
      keepRadiusWhenLifeLow: player.keepRadiusWhenLifeLow,
      keepRadiusWhenFriendDeath: player.keepRadiusWhenFriendDeath,
      magicToUseWhenBeAttacked: player.magicToUseWhenBeAttacked || undefined,
      magicDirectionWhenBeAttacked: player.magicDirectionWhenBeAttacked,
      magicToUseWhenDeath: player.magicToUseWhenDeath || undefined,
      magicDirectionWhenDeath: player.magicDirectionWhenDeath,

      // === 商店/可见性 ===
      buyIniFile: player.buyIniFile || undefined,
      buyIniString: player.buyIniString || undefined,
      visibleVariableName: player.visibleVariableName || undefined,
      visibleVariableValue: player.visibleVariableValue,

      // === 掉落 ===
      dropIni: player.dropIni || undefined,

      // === 装备 ===
      canEquip: player.canEquip,
      headEquip: player.headEquip || undefined,
      neckEquip: player.neckEquip || undefined,
      bodyEquip: player.bodyEquip || undefined,
      backEquip: player.backEquip || undefined,
      handEquip: player.handEquip || undefined,
      wristEquip: player.wristEquip || undefined,
      footEquip: player.footEquip || undefined,
      backgroundTextureEquip: player.backgroundTextureEquip || undefined,

      // === 保持攻击位置 ===
      keepAttackX: player.keepAttackX,
      keepAttackY: player.keepAttackY,

      // === 伤害玩家 ===
      hurtPlayerInterval: player.hurtPlayerInterval,
      hurtPlayerLife: player.hurtPlayerLife,
      hurtPlayerRadius: player.hurtPlayerRadius,

      // === Player 特有 ===
      money: player.money,
      currentUseMagicIndex: player.currentUseMagicIndex,
      manaLimit: player.manaLimit,
      isRunDisabled: player.isRunDisabled,
      isJumpDisabled: player.isJumpDisabled,
      isFightDisabled: player.isFightDisabled,
      walkIsRun: player.walkIsRun,
      addLifeRestorePercent: player.getAddLifeRestorePercent(),
      addManaRestorePercent: player.getAddManaRestorePercent(),
      addThewRestorePercent: player.getAddThewRestorePercent(),

      // === 等级配置文件 ===
      levelIniFile: player.levelIniFile || undefined,
    };
  }

  /**
   * 收集物品数据
   */
  private collectGoodsData(goodsListManager: GoodsListManager): GoodsItemData[] {
    const items: GoodsItemData[] = [];

    // 遍历背包物品 (1-198)
    for (let i = 1; i <= 198; i++) {
      const info = goodsListManager.getItemInfo(i);
      if (info?.good) {
        items.push({
          fileName: info.good.fileName,
          count: info.count,
        });
      }
    }

    // 遍历快捷栏物品 (221-223)
    for (let i = 221; i <= 223; i++) {
      const info = goodsListManager.getItemInfo(i);
      if (info?.good) {
        items.push({
          fileName: info.good.fileName,
          count: info.count,
          index: i, // 快捷栏物品需要记录索引
        });
      }
    }

    return items;
  }

  /**
   * 收集装备数据
   */
  private collectEquipsData(goodsListManager: GoodsListManager): (GoodsItemData | null)[] {
    const equips: (GoodsItemData | null)[] = [];

    // 装备槽位 (201-207)
    for (let i = 201; i <= 207; i++) {
      const info = goodsListManager.getItemInfo(i);
      if (info?.good) {
        equips.push({
          fileName: info.good.fileName,
          count: 1,
        });
      } else {
        equips.push(null);
      }
    }

    return equips;
  }

  /**
   * 收集武功数据
   * 参考MagicListManager.SaveList
   */
  private collectMagicsData(magicListManager: MagicListManager): MagicItemData[] {
    const items: MagicItemData[] = [];

    // 遍历完整武功列表 (1 到 maxMagic，包括存储区 1-36、快捷栏 40-44、修炼 49)
    const maxMagic = 49;
    for (let i = 1; i <= maxMagic; i++) {
      const info = magicListManager.getItemInfo(i);
      if (info?.magic) {
        const item: MagicItemData = {
          fileName: info.magic.fileName,
          level: info.level,
          exp: info.exp,
          index: i,
        };
        // 只在 hideCount !== 1（默认值）时保存以节省空间
        if (info.hideCount !== 1) {
          item.hideCount = info.hideCount;
        }
        items.push(item);
      }
    }

    // 遍历隐藏武功列表（装备关联武功，脱装备后被隐藏）
    // 参考 C# MagicListManager.SaveList: HideStartIndex(1000+) 区域
    for (let i = 1; i <= maxMagic; i++) {
      const info = magicListManager.getHiddenItemInfo(i);
      if (info?.magic) {
        items.push({
          fileName: info.magic.fileName,
          level: info.level,
          exp: info.exp,
          index: i,
          hideCount: info.hideCount,
          lastIndexWhenHide: info.lastIndexWhenHide,
          isHidden: true,
        });
      }
    }

    return items;
  }

  /** 收集陷阱快照（已触发的陷阱索引列表） */
  private collectTrapSnapshot(): number[] {
    return this.deps.map.collectTrapDataForSave().ignoreList;
  }

  /** 收集陷阱分组（按地图名存储的陷阱配置） */
  private collectTrapGroups(): Record<string, TrapGroupValue> {
    return this.deps.map.collectTrapDataForSave().mapTraps;
  }

  // ============= 数据加载方法 =============

  /**
   * 从 JSON 加载玩家数据
   * 委托给 Player.loadFromSaveData()
   *
   * 会加载 LevelIni 配置
   * 这里需要异步加载等级配置文件（难度设置）
   */
  private async loadPlayerFromJSON(data: PlayerSaveData, player: Player): Promise<void> {
    player.loadFromSaveData(data);

    // 加载等级配置文件（如果存档中有保存）
    // case "LevelIni": -> Utils.GetLevelLists(@"ini\level\" + keyData.Value)
    // 等级配置从 API 按需加载，自动转小写请求
    if (data.levelIniFile) {
      await player.levelManager.setLevelFile(data.levelIniFile);
      logger.debug(`[Loader] Loaded player level config: ${data.levelIniFile}`);
    }
  }

  /**
   * 从 JSON 加载武功列表
   * 参考MagicListManager.LoadList
   */
  private async loadMagicsFromJSON(
    magics: MagicItemData[],
    xiuLianIndex: number,
    magicListManager: MagicListManager
  ): Promise<void> {
    // 清空列表
    magicListManager.renewList();

    // 分离可见武功和隐藏武功
    const visibleMagics = magics.filter((m) => !m.isHidden);
    const hiddenMagics = magics.filter((m) => m.isHidden);

    // 批量加载可见武功（同步放置 + 并行预加载 ASF）
    const batchItems = visibleMagics.map((item) => ({
      fileName: item.fileName,
      index: (item.index ?? -1) > 0 ? item.index : undefined,
      level: item.level,
      exp: item.exp,
      hideCount: item.hideCount,
    }));
    const results = await magicListManager.addMagicBatch(batchItems);

    // 旧存档兼容：检查未指定 index 但成功分配的情况（addMagicBatch 已处理）
    // 恢复 hideCount 在 addMagicBatch 中已通过 item.hideCount 参数处理
    for (let i = 0; i < results.length; i++) {
      const [success, index] = results[i];
      if (!success && index === -1) {
        logger.warn(`[Loader] Failed to load magic ${visibleMagics[i].fileName}`);
      }
    }

    // 批量加载隐藏武功（同步放置 + 并行预加载 ASF）
    if (hiddenMagics.length > 0) {
      await magicListManager.addHiddenMagicBatch(
        hiddenMagics.map((item) => ({
          fileName: item.fileName,
          index: item.index,
          level: item.level,
          exp: item.exp,
          hideCount: item.hideCount ?? 0,
          lastIndexWhenHide: item.lastIndexWhenHide ?? 0,
        }))
      );
    }

    // 设置修炼武功
    magicListManager.setXiuLianIndex(xiuLianIndex);
  }

  /**
   * 从 JSON 加载物品列表
   */
  private loadGoodsFromJSON(
    goods: GoodsItemData[],
    equips: (GoodsItemData | null)[],
    goodsListManager: GoodsListManager
  ): void {
    // 清空列表
    goodsListManager.renewList();

    // 加载背包物品和快捷栏物品
    for (const item of goods) {
      if (item.index !== undefined && item.index >= 221 && item.index <= 223) {
        // 快捷栏物品：使用指定索引
        goodsListManager.setItemAtIndex(item.index, item.fileName, item.count);
      } else {
        // 背包物品：自动分配位置
        goodsListManager.addGoodToListWithCount(item.fileName, item.count);
      }
    }

    // 加载装备
    for (let i = 0; i < equips.length; i++) {
      const equipItem = equips[i];
      if (equipItem) {
        const slotIndex = 201 + i;
        goodsListManager.setItemAtIndex(slotIndex, equipItem.fileName, 1);
      }
    }
  }

  /**
   * 从存档数据恢复陷阱快照和分组
   * 陷阱基础配置已从 MMF 地图数据内嵌加载
   * 这里恢复运行时修改（脚本动态设置的陷阱）和已触发列表
   */
  private loadTrapsFromSave(
    snapshot: number[],
    groups: Record<string, TrapGroupValue> | undefined
  ): void {
    this.deps.map.loadTrapsFromSave(groups, snapshot);
  }

  /**
   * 从 JSON 存档数据创建所有 NPC
   *
   * 工作流程（参考NpcManager.Load）：
   * 1. 调用前已清空 npcManager
   * 2. 遍历存档数据，为每个 NPC 创建实例
   * 3. 加载对应的资源（npcres -> asf）
   *
   * 注意：版本存档时会把完整 NPC 数据写到 save/game/xxx.npc 文件
   * Web 版本则直接从 JSON 恢复
   */
  private async loadNpcsFromJSON(npcs: NpcSaveItem[], npcManager: NpcManager): Promise<void> {
    let loadedCount = 0;

    for (const npcData of npcs) {
      // 跳过已死亡的 NPC（如果 isDeathInvoked 为 true）
      if (npcData.isDeath && npcData.isDeathInvoked) {
        logger.log(`[Loader] Skipping dead NPC: ${npcData.name}`);
        continue;
      }

      try {
        // 使用 NpcManager 的统一方法从存档数据创建 NPC
        await npcManager.createNpcFromData(npcData as unknown as Record<string, unknown>);
        loadedCount++;
      } catch (error) {
        logger.error(`[Loader] Failed to create NPC ${npcData.name}:`, error);
      }
    }

    logger.debug(`[Loader] Created ${loadedCount} NPCs from JSON save data`);
  }

  /**
   * 从 JSON 存档数据创建所有 Obj
   *
   * 工作流程（参考ObjManager.Load）：
   * 1. 调用前已清空 objManager
   * 2. 遍历存档数据，为每个 Obj 创建实例
   * 3. 加载对应的资源（objres -> asf）
   *
   * 注意：版本存档时会把完整 Obj 数据写到 save/game/xxx.obj 文件
   * Web 版本则直接从 JSON 恢复
   */
  private async loadObjsFromJSON(objs: ObjSaveItem[], objManager: ObjManager): Promise<void> {
    let loadedCount = 0;

    for (const objData of objs) {
      // 跳过已移除的物体
      if (objData.isRemoved) {
        logger.log(`[Loader] Skipping removed Obj: ${objData.objName}`);
        continue;
      }

      try {
        // 使用 ObjManager 的方法从 objres 文件创建 Obj
        await objManager.createObjFromSaveData(objData);
        loadedCount++;
      } catch (error) {
        logger.error(`[Loader] Failed to create Obj ${objData.objName}:`, error);
      }
    }

    logger.debug(`[Loader] Created ${loadedCount} Objs from JSON save data`);
  }
}
