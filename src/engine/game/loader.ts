/**
 * Loader - 游戏加载器
 *
 * ================== 职责边界 ==================
 *
 * Loader 负责「游戏初始化和存档」：
 * 1. newGame() - 开始新游戏，运行 NewGame.txt 脚本
 * 2. loadGame(index) - 读取存档，加载地图/NPC/物品/武功/玩家等
 * 3. saveGame(index) - 保存存档（TODO）
 *
 * Loader 不负责：
 * - 游戏逻辑更新（由 GameManager 处理）
 * - 渲染和游戏循环（由 GameEngine 处理）
 *
 * ================================================
 */
import type { Player } from "../character/player";
import type { NpcManager } from "../character/npcManager";
import type { ObjManager } from "../obj";
import type { AudioManager } from "../audio";
import type { ScreenEffects } from "../effects";
import type { GoodsListManager } from "../goods";
import type { MagicListManager } from "../magic";
import type { MemoListManager } from "../listManager";
import type { ScriptExecutor } from "../script/executor";
import type { MapTrapManager } from "./mapTrapManager";

/**
 * Dependencies for Loader
 */
export interface LoaderDependencies {
  player: Player;
  npcManager: NpcManager;
  objManager: ObjManager;
  audioManager: AudioManager;
  screenEffects: ScreenEffects;
  goodsListManager: GoodsListManager;
  magicListManager: MagicListManager;
  memoListManager: MemoListManager;
  trapManager: MapTrapManager;
  getScriptExecutor: () => ScriptExecutor;
  loadMap: (mapPath: string) => Promise<void>;
  parseIni: (content: string) => Record<string, Record<string, string>>;
  clearScriptCache: () => void;
  clearVariables: () => void;
  resetEventId: () => void;
  resetGameTime: () => void;
  loadPlayerSprites?: (npcIni: string) => Promise<void>;
}

/**
 * Game Loader - 游戏初始化和存档管理
 */
export class Loader {
  private deps: LoaderDependencies;

  constructor(deps: LoaderDependencies) {
    this.deps = deps;
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
    console.log("[Loader] Starting new game...");

    const {
      screenEffects,
      getScriptExecutor,
      clearVariables,
      resetEventId,
      resetGameTime,
    } = this.deps;

    // 重置基本状态
    clearVariables();
    resetEventId();
    resetGameTime();

    // 以黑屏开始（用于淡入淡出特效）
    screenEffects.setFadeTransparency(1);

    // 运行 NewGame 脚本
    const scriptExecutor = getScriptExecutor();
    await scriptExecutor.runScript("/resources/script/common/NewGame.txt");

    console.log("[Loader] New game started");
  }

  /**
   * 读取存档
   *
   * 加载流程：
   * 1. 清理 managers（index != 0 时）
   * 2. 加载 Game.ini（地图、NPC、物体、BGM）
   * 3. 加载 Magic.ini、Goods.ini、memo.ini
   * 4. 加载 Player.ini
   * 5. 加载 Traps.ini
   *
   * @param index 存档索引 (0 = 初始存档, 1-7 = 用户存档)
   */
  async loadGame(index: number): Promise<void> {
    // index 0 时不清理 managers（由 NewGame.txt 调用）
    // index 1-7 时先清理 managers
    const isInitializeGame = index !== 0;

    const {
      player,
      npcManager,
      objManager,
      audioManager,
      goodsListManager,
      magicListManager,
      memoListManager,
      trapManager,
      loadMap,
      parseIni,
      clearScriptCache,
      clearVariables,
    } = this.deps;

    console.log(`[Loader] Loading game save index: ${index}, isInitializeGame: ${isInitializeGame}`);

    try {
      // Step 1: 清理 managers
      if (isInitializeGame) {
        console.log(`[Loader] Clearing all managers...`);
        clearScriptCache();
        clearVariables();
        npcManager.clearAllNpcs();
        objManager.clearAll();
        audioManager.stopMusic();
      }

      // 确定存档路径
      // index 0 = resources/save/game/Game.ini (初始存档)
      // index 1-7 = resources/save/rpgN/Game.ini (用户存档)
      const basePath = index === 0 ? "/resources/save/game" : `/resources/save/rpg${index}`;

      // Step 2: 加载 Game.ini
      const gameIniPath = `${basePath}/Game.ini`;
      const response = await fetch(gameIniPath);
      if (!response.ok) {
        console.error(`[Loader] Failed to load Game.ini: ${gameIniPath}`);
        return;
      }

      const content = await response.text();
      const sections = parseIni(content);
      const stateSection = sections["State"];

      // 玩家角色索引 - 默认 0
      let chrIndex = 0;

      if (stateSection) {
        // 加载地图
        const mapName = stateSection["Map"];
        if (mapName) {
          console.log(`[Loader] Loading map: ${mapName}`);
          await loadMap(mapName);
        }

        // 加载 NPC
        const npcFile = stateSection["Npc"];
        if (npcFile) {
          console.log(`[Loader] Loading NPC file: ${npcFile}`);
          await npcManager.loadNpcFile(npcFile);
        }

        // 加载物体
        const objFile = stateSection["Obj"];
        if (objFile) {
          console.log(`[Loader] Loading Obj file: ${objFile}`);
          await objManager.load(objFile);
        }

        // 加载背景音乐
        const bgm = stateSection["Bgm"];
        if (bgm) {
          audioManager.playMusic(bgm);
        }

        // 玩家角色索引（支持多主角）
        chrIndex = parseInt(stateSection["Chr"] || "0", 10);
      }

      // Step 3: 加载 Magic、Goods、Memo
      const magicPath = `${basePath}/Magic${chrIndex}.ini`;
      console.log(`[Loader] Loading magic from: ${magicPath}`);
      await magicListManager.loadPlayerList(magicPath);

      const goodsPath = `${basePath}/Goods${chrIndex}.ini`;
      console.log(`[Loader] Loading goods from: ${goodsPath}`);
      await goodsListManager.loadList(goodsPath);

      const memoPath = `${basePath}/memo.ini`;
      console.log(`[Loader] Loading memo from: ${memoPath}`);
      await this.loadMemoList(memoPath, memoListManager, parseIni);

      // Step 4: 加载玩家
      const playerPath = `${basePath}/Player${chrIndex}.ini`;
      console.log(`[Loader] Loading player from: ${playerPath}`);
      await player.loadFromFile(playerPath);

      // 加载玩家精灵
      if (this.deps.loadPlayerSprites) {
        const playerNpcIni = player.npcIni;
        console.log(`[Loader] Loading player sprites: ${playerNpcIni}`);
        await this.deps.loadPlayerSprites(playerNpcIni);
      }

      // 应用装备特效
      goodsListManager.applyEquipSpecialEffectFromList();

      // Step 5: 加载陷阱
      await trapManager.loadTraps(basePath, parseIni);

      console.log(`[Loader] Game save loaded successfully`);

      // Debug: 打印障碍物体
      objManager.debugPrintObstacleObjs();
    } catch (error) {
      console.error(`[Loader] Error loading game save:`, error);
    }
  }

  /**
   * 加载备忘录列表
   */
  private async loadMemoList(
    path: string,
    memoListManager: MemoListManager,
    parseIni: (content: string) => Record<string, Record<string, string>>
  ): Promise<void> {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        console.warn(`[Loader] No memo file found: ${path}`);
        memoListManager.renewList();
        return;
      }

      const content = await response.text();
      const sections = parseIni(content);
      const memoSection = sections["Memo"];

      if (memoSection) {
        memoListManager.loadList(memoSection);
      } else {
        memoListManager.renewList();
      }
    } catch (error) {
      console.warn(`[Loader] Error loading memo list:`, error);
      memoListManager.renewList();
    }
  }

  /**
   * 保存存档
   *
   * TODO: 实现保存功能
   *
   * @param index 存档索引 (1-7)
   */
  async saveGame(index: number): Promise<boolean> {
    console.log(`[Loader] Saving game to slot ${index} - not yet implemented`);
    // TODO: Implement save game
    return false;
  }
}
