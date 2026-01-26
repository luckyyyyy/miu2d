/**
 * Game Manager - Central game controller
 * Ties together all game systems based on JxqyHD architecture
 */
import type {
  GameVariables,
  Vector2,
  NpcData,
  PlayerData,
  SelectionOption,
  InputState,
} from "../core/types";
import type { JxqyMapData } from "../types";
import { CharacterState, Direction, CharacterKind, RelationType, DEFAULT_PLAYER_STATS } from "../core/types";
import { pixelToTile, tileToPixel } from "../core/utils";
import { PlayerController } from "../character/playerController";
import { NpcManager } from "../character/npcManager";
import { ScriptExecutor, type ScriptContext } from "../script/executor";
import { GuiManager } from "../gui/guiManager";
import { BarrierType } from "../types";
import { AudioManager, getAudioManager } from "../audio";
import { ScreenEffects, getScreenEffects } from "../effects";
import { ObjManager, getObjManager } from "../obj";
import { getTalkTextList, getMemoListManager } from "../listManager";
import { getLevelManager, type LevelManager } from "../level";
import { getCheatManager, type CheatManager } from "../cheat";
import { GoodsListManager, type Good } from "../goods";

export interface GameManagerConfig {
  onMapChange?: (mapPath: string) => Promise<JxqyMapData | null>;
  onLoadComplete?: () => void;
}

export class GameManager {
  // Core systems
  private playerController: PlayerController;
  private npcManager: NpcManager;
  private objManager: ObjManager;
  private scriptExecutor: ScriptExecutor;
  private guiManager: GuiManager;
  private audioManager: AudioManager;
  private screenEffects: ScreenEffects;
  private levelManager: LevelManager;
  private cheatManager: CheatManager;
  private goodsListManager: GoodsListManager;
  private characterRenderer: any = null;

  // Game state
  private variables: GameVariables = {};
  private currentMapPath: string = "";
  private currentMapName: string = "";
  private mapData: JxqyMapData | null = null;

  // Configuration
  private config: GameManagerConfig;

  // Timing
  private gameTime: number = 0;
  private isPaused: boolean = false;

  // Goods UI version (increment to trigger re-render)
  private goodsVersion: number = 0;

  // Event tracking
  private eventId: number = 0;

  // Pending actions
  private pendingSleep: number = 0;

  // Level/experience file
  private levelFile: string = "";

  // Trap management (like C#'s _ingnoredTrapsIndex and _traps)
  private ignoredTrapIndices: Set<number> = new Set();
  private mapTraps: Map<string, Map<number, string>> = new Map(); // mapName -> (trapIndex -> scriptFile)
  private isInRunMapTrap: boolean = false; // C#'s _isInRunMapTrap - prevents trap re-triggering

  // Camera movement (C#: Camera.IsInMove, MoveTo)
  private isCameraMoving: boolean = false;
  private cameraMoveTarget: Vector2 | null = null;
  private cameraMoveSpeed: number = 0;
  private cameraMoveDirection: number = 0;
  private cameraMoveDistance: number = 0;
  private cameraMoveStartPos: Vector2 | null = null;

  constructor(config: GameManagerConfig = {}) {
    this.config = config;

    // Create walkability checker (matches C# IsObstacleForCharacter - checks barrier+Trans+NPC+Obj)
    const isWalkable = (tile: Vector2) => this.isTileWalkable(tile);
    // Create map-only obstacle checker (matches C# IsObstacle - only checks barrier 0x80)
    // Used for diagonal blocking in pathfinding
    const isMapObstacle = (tile: Vector2) => this.isMapOnlyObstacle(tile);

    // Initialize systems
    this.playerController = new PlayerController(isWalkable, isMapObstacle);
    this.npcManager = new NpcManager(isWalkable, isMapObstacle);
    this.objManager = getObjManager();
    this.guiManager = new GuiManager();
    this.audioManager = getAudioManager();
    this.screenEffects = getScreenEffects();
    this.levelManager = getLevelManager();
    this.cheatManager = getCheatManager();

    // Initialize goods list manager
    this.goodsListManager = new GoodsListManager();

    // Set up goods manager callbacks for equip/unequip and UI updates
    this.goodsListManager.setCallbacks({
      onEquiping: (good: Good | null, currentEquip: Good | null) => {
        if (good) this.playerController.equiping(good, currentEquip);
      },
      onUnEquiping: (good: Good | null) => {
        if (good) this.playerController.unEquiping(good);
      },
      onUpdateView: () => {
        // Increment version to trigger UI re-render
        this.goodsVersion++;
      },
    });

    // Set up system references for notifications
    this.playerController.setGuiManager(this.guiManager);
    this.cheatManager.setSystems(this.playerController, this.npcManager, this.guiManager);

    // Create script context
    const scriptContext = this.createScriptContext();
    this.scriptExecutor = new ScriptExecutor(scriptContext, this.variables);

    // Set up GUI event handler
    this.guiManager.setEventHandler((event, data) => this.handleGuiEvent(event, data));
  }

  /**
   * Set character renderer for NPC and player custom action files
   * This should be called after GameManager is created
   */
  setCharacterRenderer(renderer: any): void {
    this.characterRenderer = renderer;
    this.npcManager.setCharacterRenderer(renderer);
  }

  /**
   * Get character by name (player or NPC)
   * Based on C#'s GetPlayerOrNpc - first checks if name matches player, then checks NPCs
   */
  private getCharacterByName(name: string): NpcData | PlayerData | null {
    // First check if it's the player
    const player = this.playerController.getPlayer();
    if (player && player.config && player.config.name === name) {
      return player;
    }
    // Then check NPCs
    return this.npcManager.getNpc(name);
  }

  /**
   * Create script context for script executor
   */
  private createScriptContext(): ScriptContext {
    return {
      // Variables
      getVariable: (name) => this.variables[name] || 0,
      setVariable: (name, value) => {
        this.variables[name] = value;
      },

      // Dialog
      showDialog: (text, portraitIndex) => {
        this.guiManager.showDialog(text, portraitIndex);
      },
      showMessage: (text) => {
        this.guiManager.showMessage(text);
      },
      showDialogSelection: (message, selectA, selectB) => {
        this.guiManager.showDialogSelection(message, selectA, selectB);
      },
      showSelection: (options, message) => {
        this.guiManager.showSelection(
          options.map((o) => ({ ...o, enabled: true })),
          message || ""
        );
      },

      // Map
      loadMap: async (mapName) => {
        await this.loadMap(mapName);
      },
      loadNpc: async (fileName) => {
        await this.loadNpcFile(fileName);
      },
      loadGame: async (index) => {
        await this.loadGameSave(index);
      },
      setPlayerPosition: (x, y) => {
        this.playerController.setPosition(x, y);
        // After setting position, check and trigger trap at current position
        // This matches C#'s ScriptExecuter.SetPlayerPos which calls CheckMapTrap()
        this.checkTrap({ x, y });
      },
      setPlayerDirection: (direction) => {
        this.playerController.setDirection(direction);
      },
      setPlayerState: (state) => {
        this.playerController.setState(state);
      },
      playerGoto: (x, y) => {
        this.playerController.walkToTile(x, y);
      },
      isPlayerGotoEnd: (destination) => {
        // C#: IsCharacterMoveEndAndStanding
        // Returns true only when player is at destination AND standing,
        // OR when path is null/empty (destination unreachable)
        const player = this.playerController.getPlayer();
        if (!player) return true;

        const atDestination =
          player.tilePosition.x === destination.x &&
          player.tilePosition.y === destination.y;

        const isStanding =
          player.state === CharacterState.Stand ||
          player.state === CharacterState.Stand1;

        if (atDestination && isStanding) {
          return true;
        }

        // C#: Check moveable - if Path is null or empty while standing,
        // destination is unreachable, so return true (end)
        if (!atDestination && isStanding) {
          // Check if there's no valid path (destination unreachable)
          if (!player.path || player.path.length === 0) {
            // Try to walk once, if still no path, return true
            const success = this.playerController.walkToTile(destination.x, destination.y);
            if (!success || !player.path || player.path.length === 0) {
              return true; // Destination unreachable, end the command
            }
          }
        }

        return false;
      },
      playerRunTo: (x, y) => {
        this.playerController.runToTile(x, y);
      },
      isPlayerRunToEnd: (destination) => {
        // C#: IsCharacterMoveEndAndStanding with isRun=true
        // Returns true only when player is at destination AND standing,
        // OR when path is null/empty (destination unreachable)
        const player = this.playerController.getPlayer();
        if (!player) return true;

        const atDestination =
          player.tilePosition.x === destination.x &&
          player.tilePosition.y === destination.y;

        const isStanding =
          player.state === CharacterState.Stand ||
          player.state === CharacterState.Stand1;

        if (atDestination && isStanding) {
          return true;
        }

        // C#: Check moveable - if Path is null or empty while standing,
        // destination is unreachable, so return true (end)
        if (!atDestination && isStanding) {
          // Check if there's no valid path (destination unreachable)
          if (!player.path || player.path.length === 0) {
            // Try to run once, if still no path, return true
            const success = this.playerController.runToTile(destination.x, destination.y);
            if (!success || !player.path || player.path.length === 0) {
              return true; // Destination unreachable, end the command
            }
          }
        }

        return false;
      },
      playerGotoDir: (direction, steps) => {
        // C#: Character.WalkToDirection(direction, steps)
        // Walk in specified direction for given number of steps
        this.playerController.walkToDirection(direction, steps);
      },
      isPlayerGotoDirEnd: () => {
        // C#: IsCharacterGotoDirEnd - check if character is standing
        const player = this.playerController.getPlayer();
        if (!player) return true;
        return (
          player.state === CharacterState.Stand ||
          player.state === CharacterState.Stand1
        );
      },

      // NPC
      addNpc: (npcFile, x, y) => {
        this.npcManager.addNpc(`/resources/ini/npc/${npcFile}`, x, y);
      },
      deleteNpc: (name) => {
        this.npcManager.deleteNpc(name);
      },
      getNpcPosition: (name) => {
        const character = this.getCharacterByName(name);
        return character ? character.tilePosition : null;
      },
      setNpcPosition: (name, x, y) => {
        // First check if it's the player
        const player = this.playerController.getPlayer();
        if (player && player.config && player.config.name === name) {
          this.playerController.setPosition(x, y);
          return;
        }
        this.npcManager.setNpcPosition(name, x, y);
      },
      npcGoto: (name, x, y) => {
        // First check if it's the player
        const player = this.playerController.getPlayer();
        if (player && player.config && player.config.name === name) {
          this.playerController.walkToTile(x, y);
          return;
        }
        this.npcManager.npcGoto(name, x, y);
      },
      isNpcGotoEnd: (name, destination) => {
        // C#: IsCharacterMoveEndAndStanding for NPC
        const player = this.playerController.getPlayer();
        if (player && player.config && player.config.name === name) {
          // It's the player
          const atDestination =
            player.tilePosition.x === destination.x &&
            player.tilePosition.y === destination.y;

          const isStanding =
            player.state === CharacterState.Stand ||
            player.state === CharacterState.Stand1;

          if (atDestination && isStanding) {
            return true;
          }

          if (!atDestination && isStanding) {
            this.playerController.walkToTile(destination.x, destination.y);
          }

          return false;
        }

        // Check NPC
        const npc = this.npcManager.getNpc(name);
        if (!npc) return true;

        const atDestination =
          npc.tilePosition.x === destination.x &&
          npc.tilePosition.y === destination.y;

        const isStanding =
          npc.state === CharacterState.Stand ||
          npc.state === CharacterState.Stand1;

        if (atDestination && isStanding) {
          return true;
        }

        // C#: If character is standing but not at destination, re-issue WalkTo
        if (!atDestination && isStanding) {
          this.npcManager.npcGoto(name, destination.x, destination.y);
        }

        return false;
      },
      npcGotoDir: (name, direction, steps) => {
        // C#: Character.WalkToDirection(direction, steps)
        const player = this.playerController.getPlayer();
        if (player && player.config && player.config.name === name) {
          this.playerController.walkToDirection(direction, steps);
          return;
        }
        this.npcManager.npcGotoDir(name, direction, steps);
      },
      isNpcGotoDirEnd: (name) => {
        // C#: IsCharacterGotoDirEnd - check if character is standing
        const player = this.playerController.getPlayer();
        if (player && player.config && player.config.name === name) {
          return (
            player.state === CharacterState.Stand ||
            player.state === CharacterState.Stand1
          );
        }

        const npc = this.npcManager.getNpc(name);
        if (!npc) return true;
        return (
          npc.state === CharacterState.Stand ||
          npc.state === CharacterState.Stand1
        );
      },
      setNpcActionFile: (name, stateType, asfFile) => {
        console.log(`[GameManager] SetNpcActionFile called: name="${name}", state=${stateType}, file="${asfFile}"`);
        // Set the action file for a specific state
        // Based on C#'s GetPlayerOrNpc - first checks player, then NPCs
        const player = this.playerController.getPlayer();
        if (player && player.config && player.config.name === name) {
          // For player, store in customActionFiles
          if (!player.customActionFiles) {
            player.customActionFiles = new Map();
          }
          player.customActionFiles.set(stateType, asfFile);
          console.log(`[GameManager] SetNpcActionFile for player: state=${stateType}, file=${asfFile}`);

          // Notify character renderer to load the custom ASF
          if (this.characterRenderer && this.characterRenderer.setNpcActionFile) {
            this.characterRenderer.setNpcActionFile('player', stateType, asfFile);

            // Preload the ASF if this is the current state
            if (player.state === stateType && this.characterRenderer.preloadCustomActionFile) {
              this.characterRenderer.preloadCustomActionFile('player', stateType, asfFile)
                .catch((err: any) => console.error(`Failed to preload player custom action file:`, err));
            }
          }
          return;
        }
        console.log(`[GameManager] SetNpcActionFile for NPC: "${name}"`);
        this.npcManager.setNpcActionFile(name, stateType, asfFile);
      },
      npcSpecialAction: (name, asfFile) => {
        // Based on C# Character.SetSpecialAction():
        // 1. Set IsInSpecialAction = true
        // 2. Save current direction (_specialActionLastDirection)
        // 3. Load and play the special action ASF (PlayCurrentDirOnce)
        // 4. When animation ends, restore state and direction (in update loop)

        const player = this.playerController.getPlayer();
        const isPlayer = player.config.name === name;

        if (isPlayer) {
          // Player special action
          console.log(`[GameManager] NpcSpecialAction for player: ${asfFile}`);
          player.isInSpecialAction = true;
          player.specialActionAsf = asfFile;
          player.specialActionLastDirection = player.direction;
          player.specialActionFrame = 0;

          // Start the special action animation in renderer (async but we track via isInSpecialAction)
          if (this.characterRenderer) {
            this.characterRenderer.setSpecialAction('player', asfFile)
              .then((success: boolean) => {
                if (!success) {
                  console.warn(`[GameManager] Failed to start player special action, clearing state`);
                  player.isInSpecialAction = false;
                }
              })
              .catch((err: any) => {
                console.error(`Failed to start player special action:`, err);
                player.isInSpecialAction = false;
              });
          }
        } else {
          // NPC special action
          const npc = this.npcManager.getNpc(name);
          if (npc) {
            console.log(`[GameManager] NpcSpecialAction for NPC "${name}": ${asfFile}`);
            npc.isInSpecialAction = true;
            npc.specialActionAsf = asfFile;
            npc.specialActionLastDirection = npc.direction;
            npc.specialActionFrame = 0;

            // Start the special action animation in renderer
            if (this.characterRenderer) {
              this.characterRenderer.setSpecialAction(npc.id, asfFile)
                .then((success: boolean) => {
                  if (!success) {
                    console.warn(`[GameManager] Failed to start NPC special action, clearing state`);
                    npc.isInSpecialAction = false;
                  }
                })
                .catch((err: any) => {
                  console.error(`Failed to start NPC special action:`, err);
                  npc.isInSpecialAction = false;
                });
            }
          } else {
            console.warn(`[GameManager] NpcSpecialAction: NPC not found: ${name}`);
          }
        }
      },
      isNpcSpecialActionEnd: (name) => {
        // C#: Check if IsInSpecialAction is false
        const player = this.playerController.getPlayer();
        if (player && player.config && player.config.name === name) {
          return !player.isInSpecialAction;
        }

        const npc = this.npcManager.getNpc(name);
        if (!npc) return true;
        return !npc.isInSpecialAction;
      },
      setNpcLevel: (name, level) => {
        // C# checks if name matches player name first
        if (this.playerController.getPlayer().config.name === name) {
          // This is the player - use setLevelTo
          console.log(`[GameManager] SetNpcLevel: setting player level to ${level}`);
          this.playerController.setLevelTo(level);
        } else {
          // This is an NPC
          this.npcManager.setNpcLevel(name, level);
        }
      },
      setNpcDirection: (name, direction) => {
        this.npcManager.setNpcDirection(name, direction);
      },
      setNpcState: (name, state) => {
        this.npcManager.setNpcState(name, state);
      },

      // Player
      addGoods: async (goodsName, count) => {
        console.log(`AddGoods: ${goodsName} x${count}`);
        // Add items one by one since addGoodToList doesn't support count
        for (let i = 0; i < count; i++) {
          await this.goodsListManager.addGoodToList(goodsName);
        }
      },
      removeGoods: (goodsName, count) => {
        console.log(`RemoveGoods: ${goodsName} x${count}`);
        this.goodsListManager.deleteGoodByName(goodsName, count);
      },
      equipGoods: async (goodsIndex, equipSlot) => {
        // equipSlot: 1=Head, 2=Neck, 3=Body, 4=Back, 5=Hand, 6=Wrist, 7=Foot
        // Equip item from inventory index to equipment slot
        const equipIndex = equipSlot + 200; // Convert to equipment index (201-207)
        console.log(`EquipGoods: from index ${goodsIndex} to slot ${equipSlot} (index ${equipIndex})`);
        this.goodsListManager.exchangeListItemAndEquiping(goodsIndex, equipIndex);
      },
      addMoney: (amount) => {
        this.playerController.addMoney(amount);
      },
      addExp: (amount) => {
        this.playerController.addExp(amount);
      },

      // Memo functions (任务系统)
      addMemo: (text) => {
        this.guiManager.addMemo(text);
      },
      delMemo: (text) => {
        this.guiManager.delMemo(text);
      },
      addToMemo: async (memoId) => {
        await this.guiManager.addToMemo(memoId);
      },
      delMemoById: async (memoId) => {
        // Use MemoListManager directly for ID-based deletion
        const memoManager = getMemoListManager();
        await memoManager.delMemoById(memoId);
        this.guiManager.updateMemoView();
      },

      // Obj (interactive objects)
      loadObj: async (fileName) => {
        console.log(`[GameManager] LoadObj command: ${fileName}`);
        const result = await this.objManager.load(fileName);
        console.log(`[GameManager] LoadObj result: ${result}`);
      },
      addObj: async (fileName, x, y, direction) => {
        console.log(`[GameManager] AddObj command: ${fileName} at (${x}, ${y}) dir=${direction}`);
        await this.objManager.addObjByFile(fileName, x, y, direction);
      },

      // Trap management
      setMapTrap: (trapIndex, trapFileName, mapName) => {
        this.setMapTrap(trapIndex, trapFileName, mapName);
      },

      // Game flow
      sleep: (ms) => {
        this.pendingSleep = ms;
      },
      playMusic: (file) => {
        // Play background music using AudioManager
        this.audioManager.playMusic(file);
      },
      stopMusic: () => {
        // Stop background music
        this.audioManager.stopMusic();
      },
      playSound: (file) => {
        // Play sound effect
        this.audioManager.playSound(file);
      },
      fadeIn: () => {
        // Start fade in effect (screen goes from black to normal)
        this.screenEffects.fadeIn();
      },
      fadeOut: () => {
        // Start fade out effect (screen goes to black)
        this.screenEffects.fadeOut();
      },
      isFadeInEnd: () => {
        return this.screenEffects.isFadeInEnd();
      },
      isFadeOutEnd: () => {
        return this.screenEffects.isFadeOutEnd();
      },
      moveScreen: (direction, distance, speed) => {
        // C#: Camera.MoveTo(direction, distance, speed)
        // Move camera in specified direction
        this.cameraMoveTo(direction, distance, speed);
      },
      isMoveScreenEnd: () => {
        // C#: !Camera.IsInMove
        return !this.isCameraMoving;
      },
      changeMapColor: (r, g, b) => {
        // Change map tint color
        this.screenEffects.setMapColor(r, g, b);
      },
      changeAsfColor: (r, g, b) => {
        // Change sprite tint color
        this.screenEffects.setSpriteColor(r, g, b);
      },
      setLevelFile: async (file) => {
        // Set the experience/level configuration file
        this.levelFile = file;
        // Build full path - handle case sensitivity issues
        // Try exact case first, then fallback to lowercase
        const basePath = `/resources/ini/level/`;
        const paths = [
          `${basePath}${file}`,
          `${basePath}${file.toLowerCase()}`,
        ];

        for (const path of paths) {
          try {
            const response = await fetch(path, { method: 'HEAD' });
            if (response.ok) {
              await this.levelManager.setPlayerLevelFile(path);
              console.log(`[GameManager] Level file set to: ${path}`);
              return;
            }
          } catch {
            // Try next path
          }
        }
        console.warn(`[GameManager] Could not load level file: ${file}`);
      },

      // Wait for input
      waitForDialogClose: () => {
        // Handled by script executor
      },
      waitForSelection: () => {
        // Handled by script executor
      },
      getSelectionResult: () => {
        return this.guiManager.getState().selection.selectedIndex;
      },

      // Script management
      runScript: async (scriptFile) => {
        const basePath = this.getScriptBasePath();
        await this.scriptExecutor.runScript(`${basePath}/${scriptFile}`);
      },
      getCurrentMapPath: () => this.currentMapPath,
    };
  }

  /**
   * Get base path for scripts
   */
  private getScriptBasePath(): string {
    const basePath = this.currentMapName
      ? `/resources/script/map/${this.currentMapName}`
      : "/resources/script/common";
    console.log(`[GameManager] Script base path: ${basePath}`);
    return basePath;
  }

  /**
   * Handle GUI events
   */
  private handleGuiEvent(event: string, data?: any): void {
    switch (event) {
      case "dialog:closed":
        this.scriptExecutor.onDialogClosed();
        break;
      case "selection:confirmed":
        this.scriptExecutor.onSelectionMade(data?.index || 0);
        break;
    }
  }

  /**
   * Handle selection made (from DialogUI or SelectionUI)
   */
  onSelectionMade(index: number): void {
    this.scriptExecutor.onSelectionMade(index);
  }

  /**
   * Check if a tile is walkable
   * Matches C# JxqyMap.IsObstacleForCharacter logic
   */
  private isTileWalkable(tile: Vector2): boolean {
    if (!this.mapData) return false; // No map data = obstacle

    // Check map bounds using C# IsTileInMapViewRange logic:
    // C#: return (col < MapColumnCounts && row < MapRowCounts - 1 && col >= 0 && row > 0);
    // Note: row must be > 0 (not >= 0), and row must be < MapRowCounts - 1 (not < MapRowCounts)
    // This excludes the first row (row=0) and last row (row=MapRowCounts-1) from walkable area
    if (
      tile.x < 0 ||
      tile.x >= this.mapData.mapColumnCounts ||
      tile.y <= 0 ||  // C#: row > 0 means row must be at least 1
      tile.y >= this.mapData.mapRowCounts - 1  // C#: row < MapRowCounts - 1
    ) {
      return false; // Out of bounds = obstacle
    }

    // Check tile barrier using C# logic:
    // IsObstacleForCharacter checks: (type & (Obstacle + Trans)) == 0
    // If result is 0, it's walkable (return false from IsObstacleForCharacter)
    // If result is non-zero, it's obstacle (return true from IsObstacleForCharacter)
    const tileIndex = tile.x + tile.y * this.mapData.mapColumnCounts;
    const tileInfo = this.mapData.tileInfos[tileIndex];
    if (tileInfo) {
      const barrier = tileInfo.barrierType;
      const Obstacle = 0x80;
      const Trans = 0x40;
      // C#: if ((type & (Obstacle + Trans)) == 0) return false; else return true;
      // So for walkability (opposite of obstacle): if ((type & (Obstacle + Trans)) != 0) return false;
      if ((barrier & (Obstacle + Trans)) !== 0) {
        return false; // Has Obstacle or Trans flag = not walkable
      }
    }

    // Check NPC collision
    if (this.npcManager.isObstacle(tile.x, tile.y)) {
      return false;
    }

    // Check Obj collision
    if (this.objManager.isObstacle(tile.x, tile.y)) {
      return false;
    }

    return true;
  }

  /**
   * Check if a tile is a map-only obstacle (used for diagonal blocking in pathfinding)
   * Matches C# JxqyMap.IsObstacle logic - ONLY checks map barrier (0x80)
   * Does NOT check NPC/Obj - this is intentional per C# PathFinder.GetObstacleIndexList
   */
  private isMapOnlyObstacle(tile: Vector2): boolean {
    if (!this.mapData) return true; // No map data = obstacle

    // Check map bounds
    if (
      tile.x < 0 ||
      tile.x >= this.mapData.mapColumnCounts ||
      tile.y <= 0 ||
      tile.y >= this.mapData.mapRowCounts - 1
    ) {
      return true; // Out of bounds = obstacle
    }

    // Check ONLY the Obstacle flag (0x80), NOT Trans (0x40) and NOT NPC/Obj
    // C# IsObstacle: if ((type & Obstacle) == 0) return false;
    const tileIndex = tile.x + tile.y * this.mapData.mapColumnCounts;
    const tileInfo = this.mapData.tileInfos[tileIndex];
    if (tileInfo) {
      const barrier = tileInfo.barrierType;
      const Obstacle = 0x80;
      if ((barrier & Obstacle) !== 0) {
        return true; // Has Obstacle flag = map obstacle
      }
    }

    return false;
  }

  /**
   * Debug: Print barrier data for map analysis
   */
  private debugPrintBarrierData(): void {
    if (!this.mapData) return;

    const cols = this.mapData.mapColumnCounts;
    const rows = this.mapData.mapRowCounts;
    const Obstacle = 0x80;
    const Trans = 0x40;

    console.log(`\n========== BARRIER DATA DEBUG ==========`);
    console.log(`Map: ${this.currentMapName}`);
    console.log(`Size: ${cols} columns x ${rows} rows`);
    console.log(`Valid range: col [0, ${cols - 1}], row (0, ${rows - 2}]`);
    console.log(`  (C# IsTileInMapViewRange: col >= 0 && col < ${cols} && row > 0 && row < ${rows - 1})`);

    // Print walkability map using actual isTileWalkable (includes boundary check)
    console.log(`\n--- Walkability map (using isTileWalkable, includes boundary) ---`);
    console.log(`Legend: . = walkable, X = obstacle/boundary`);

    // Print first few rows (top edge)
    console.log(`\n--- Top edge (rows 0-5) ---`);
    for (let y = 0; y <= Math.min(5, rows - 1); y++) {
      let rowStr = `Row ${y.toString().padStart(3)}: `;
      for (let x = 0; x < cols; x++) {
        const walkable = this.isTileWalkable({ x, y });
        rowStr += walkable ? '.' : 'X';
      }
      console.log(rowStr);
    }

    // Print last few rows (bottom edge)
    console.log(`\n--- Bottom edge (rows ${rows - 6} to ${rows - 1}) ---`);
    for (let y = Math.max(0, rows - 6); y < rows; y++) {
      let rowStr = `Row ${y.toString().padStart(3)}: `;
      for (let x = 0; x < cols; x++) {
        const walkable = this.isTileWalkable({ x, y });
        rowStr += walkable ? '.' : 'X';
      }
      console.log(rowStr);
    }

    // Print right edge detail (last 3 columns)
    console.log(`\n--- Right edge (last 3 columns, all rows) ---`);
    for (let y = 0; y < rows; y++) {
      let rowStr = `Row ${y.toString().padStart(3)}: `;
      for (let x = Math.max(0, cols - 3); x < cols; x++) {
        const walkable = this.isTileWalkable({ x, y });
        const idx = x + y * cols;
        const barrier = this.mapData.tileInfos[idx].barrierType;
        rowStr += `(${x},${y}):${walkable ? 'W' : 'X'}[${barrier.toString(16).padStart(2, '0')}] `;
      }
      console.log(rowStr);
    }

    // Print raw barrier values for edges
    console.log(`\n--- Raw barrier values (hex) ---`);
    console.log(`Row 0 (first 10 cols):`);
    let raw0 = '';
    for (let x = 0; x < Math.min(10, cols); x++) {
      const idx = x + 0 * cols;
      raw0 += this.mapData.tileInfos[idx].barrierType.toString(16).padStart(2, '0') + ' ';
    }
    console.log(`  ${raw0}`);

    console.log(`Row 1 (first 10 cols):`);
    let raw1 = '';
    for (let x = 0; x < Math.min(10, cols); x++) {
      const idx = x + 1 * cols;
      raw1 += this.mapData.tileInfos[idx].barrierType.toString(16).padStart(2, '0') + ' ';
    }
    console.log(`  ${raw1}`);

    console.log(`Row ${rows - 2} (first 10 cols):`);
    let rawN2 = '';
    for (let x = 0; x < Math.min(10, cols); x++) {
      const idx = x + (rows - 2) * cols;
      rawN2 += this.mapData.tileInfos[idx].barrierType.toString(16).padStart(2, '0') + ' ';
    }
    console.log(`  ${rawN2}`);

    console.log(`Row ${rows - 1} (first 10 cols):`);
    let rawN1 = '';
    for (let x = 0; x < Math.min(10, cols); x++) {
      const idx = x + (rows - 1) * cols;
      rawN1 += this.mapData.tileInfos[idx].barrierType.toString(16).padStart(2, '0') + ' ';
    }
    console.log(`  ${rawN1}`);

    // Count walkable tiles using actual isTileWalkable
    let walkableCount = 0;
    let obstacleCount = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (this.isTileWalkable({ x, y })) {
          walkableCount++;
        } else {
          obstacleCount++;
        }
      }
    }
    console.log(`\nTotal walkable tiles: ${walkableCount}`);
    console.log(`Total obstacle tiles: ${obstacleCount}`);
    console.log(`========================================\n`);
  }

  /**
   * Load a map
   * Based on C#'s ScriptExecuter.LoadMap
   */
  async loadMap(mapPath: string): Promise<void> {
    console.log(`[GameManager] Loading map: ${mapPath}`);
    this.currentMapPath = mapPath;

    // Extract map name from path (without .map extension)
    // Example: "map_002_凌绝峰峰顶.map" -> "map_002_凌绝峰峰顶"
    let mapFileName = mapPath.split("/").pop() || mapPath;
    this.currentMapName = mapFileName.replace(/\.map$/i, "");
    console.log(`[GameManager] Map name: ${this.currentMapName}`);

    // Clear NPCs and Objs (matches C# LoadMap behavior)
    // C#: NpcManager.ClearAllNpcAndKeepPartner(); ObjManager.ClearAllObjAndFileName();
    console.log(`[GameManager] Clearing NPCs and Objs...`);
    this.npcManager.clearAllNpcs();
    this.objManager.clearAll();
    this.scriptExecutor.clearCache();

    // Clear ignored trap indices when loading new map
    // (trap indices are per-instance, not persistent across map loads for different maps)
    this.ignoredTrapIndices.clear();

    // Load map data via callback
    if (this.config.onMapChange) {
      this.mapData = await this.config.onMapChange(mapPath);

      // Debug: Log map info and barrier data
      if (this.mapData) {
        console.log(`[GameManager] Map loaded: ${this.mapData.mapColumnCounts}x${this.mapData.mapRowCounts} tiles`);
        console.log(`[GameManager] Map pixel size: ${this.mapData.mapPixelWidth}x${this.mapData.mapPixelHeight}`);

        // Debug: Print barrier data for analysis
        // this.debugPrintBarrierData();

        // Show trap tiles from map file
        const trapsInMap: { tile: string; trapIndex: number }[] = [];
        for (let i = 0; i < this.mapData.tileInfos.length; i++) {
          const tileInfo = this.mapData.tileInfos[i];
          if (tileInfo.trapIndex > 0) {
            const x = i % this.mapData.mapColumnCounts;
            const y = Math.floor(i / this.mapData.mapColumnCounts);
            trapsInMap.push({ tile: `(${x},${y})`, trapIndex: tileInfo.trapIndex });
          }
        }
        // Show trap scripts configured for this map
        const mapTraps = this.mapTraps.get(this.currentMapName);
        if (mapTraps && mapTraps.size > 0) {
          console.log(`[GameManager] Trap scripts for "${this.currentMapName}":`);
          mapTraps.forEach((scriptFile, trapIndex) => {
            console.log(`[GameManager]   Trap ${trapIndex} -> ${scriptFile}`);
          });
        } else {
          console.log(`[GameManager] No trap scripts configured for "${this.currentMapName}"`);
        }
      }
    }
    console.log(`[GameManager] Map loaded successfully`);
  }

  /**
   * Load NPC file
   * Based on C#'s NpcManager.Load
   */
  async loadNpcFile(fileName: string): Promise<void> {
    console.log(`[GameManager] Loading NPC file: ${fileName}`);
    await this.npcManager.loadNpcFile(fileName);
  }

  /**
   * Load game save from a save slot
   * Based on C#'s Loader.LoadGame
   */
  async loadGameSave(index: number): Promise<void> {
    console.log(`[GameManager] Loading game save index: ${index}`);

    try {
      // Load Game.ini from save directory
      // Index 0 = resources/save/game/Game.ini (initial save)
      // Index 1-7 = resources/save/rpgN/Game.ini
      const basePath = index === 0 ? "/resources/save/game" : `/resources/save/rpg${index}`;
      const gameIniPath = `${basePath}/Game.ini`;

      // Load traps configuration (matches C#'s LoadTraps())
      await this.loadTraps(basePath);

      const response = await fetch(gameIniPath);
      if (!response.ok) {
        console.error(`[GameManager] Failed to load Game.ini: ${gameIniPath}`);
        return;
      }

      // INI files in resources are now UTF-8 encoded
      const content = await response.text();

      // Parse Game.ini
      const sections = this.parseIni(content);
      const stateSection = sections["State"];

      if (stateSection) {
        // Load Map
        const mapName = stateSection["Map"];
        if (mapName) {
          console.log(`[GameManager] Loading map from save: ${mapName}`);
          await this.loadMap(mapName);
        }

        // Load NPCs
        const npcFile = stateSection["Npc"];
        if (npcFile) {
          console.log(`[GameManager] Loading NPC file from save: ${npcFile}`);
          await this.npcManager.loadNpcFile(npcFile);
        }

        // Load Objects
        const objFile = stateSection["Obj"];
        if (objFile) {
          console.log(`[GameManager] Loading Obj file from save: ${objFile}`);
          await this.objManager.load(objFile);
        }

        // Load Background Music
        const bgm = stateSection["Bgm"];
        if (bgm) {
          this.audioManager.playMusic(bgm);
        }

        // Player character index
        const chrIndex = parseInt(stateSection["Chr"] || "0", 10);
        // TODO: Use chrIndex for player character selection
      }

      // Load player from save
      // Uses PlayerN.ini where N = player index (default 0)
      const playerPath = `${basePath}/Player0.ini`;
      console.log(`[GameManager] Loading player from: ${playerPath}`);
      await this.playerController.loadFromFile(playerPath);

      // Load goods from save
      // Index 0 uses game folder (initial clean save state)
      // Index 1-7 uses rpgN folders (player save slots)
      const goodsPath = `${basePath}/Goods0.ini`;
      console.log(`[GameManager] Loading goods from: ${goodsPath}`);
      await this.goodsListManager.loadList(goodsPath);

      console.log(`[GameManager] Game save loaded successfully`);

      // Debug: Print all obstacle objects
      this.objManager.debugPrintObstacleObjs();
    } catch (error) {
      console.error(`[GameManager] Error loading game save:`, error);
    }
  }

  /**
   * Load trap configuration from Traps.ini
   * Based on C#'s MapBase.LoadTrap
   */
  private async loadTraps(basePath: string): Promise<void> {
    try {
      const trapsPath = `${basePath}/Traps.ini`;
      console.log(`[GameManager] Loading traps from: ${trapsPath}`);

      const response = await fetch(trapsPath);
      if (!response.ok) {
        console.warn(`[GameManager] Traps.ini not found at ${trapsPath}, using defaults`);
        return;
      }

      // INI files are now UTF-8
      const content = await response.text();

      // Parse INI
      const sections = this.parseIni(content);

      // Clear existing trap mappings and ignored list (like C# does)
      this.ignoredTrapIndices.clear();
      this.mapTraps.clear();

      // Load trap mappings for each map
      for (const mapName in sections) {
        const trapMapping = new Map<number, string>();
        const section = sections[mapName];

        for (const key in section) {
          const trapIndex = parseInt(key, 10);
          const scriptFile = section[key];
          if (!isNaN(trapIndex)) {
            trapMapping.set(trapIndex, scriptFile);
          }
        }

        if (trapMapping.size > 0) {
          this.mapTraps.set(mapName, trapMapping);
        }
      }

      console.log(`[GameManager] Loaded trap config for ${this.mapTraps.size} maps`);
    } catch (error) {
      console.error(`[GameManager] Error loading traps:`, error);
    }
  }

  /**
   * Simple INI parser
   */
  private parseIni(content: string): Record<string, Record<string, string>> {
    const sections: Record<string, Record<string, string>> = {};
    let currentSection = "";

    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("//")) {
        continue;
      }

      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        sections[currentSection] = {};
        continue;
      }

      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0 && currentSection) {
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        sections[currentSection][key] = value;
      }
    }

    return sections;
  }

  /**
   * Initialize global resources (call once before creating GameManager)
   * This loads TalkIndex.txt and other shared resources
   */
  static async initializeGlobalResources(): Promise<void> {
    console.log("[GameManager] Initializing global resources...");

    // Initialize TalkTextList
    const talkTextList = getTalkTextList();
    await talkTextList.initialize();

    // Initialize Level Manager
    const levelManager = getLevelManager();
    await levelManager.initialize();

    console.log("[GameManager] Global resources initialized");
  }

  /**
   * Initialize new game
   */
  async newGame(): Promise<void> {
    // Reset state
    this.variables = { Event: 0 };
    this.eventId = 0;
    this.gameTime = 0;

    // Start with black screen - FadeIn() in Begin.txt will reveal the scene
    this.screenEffects.setFadeTransparency(1);

    // Reset memo list
    const memoManager = getMemoListManager();
    memoManager.renewList();

    // Reset goods list
    this.goodsListManager.renewList();

    // Initialize player stats from level configuration (level 1)
    await this.playerController.initializeFromLevelConfig(1);

    // Run NewGame script - this will call LoadGame(0) to load initial save
    // which includes goods, player data, etc. Then runs Begin.txt
    await this.scriptExecutor.runScript("/resources/script/common/NewGame.txt");
  }

  /**
   * Load initial game state from game.ini (objects, NPCs, etc.)
   * This is called at game start to set up the initial world state
   */
  async loadInitialGameState(): Promise<void> {
    console.log(`[GameManager] Loading initial game state from game.ini...`);
    try {
      const response = await fetch('/resources/ini/save/game.ini');
      if (!response.ok) {
        console.warn(`[GameManager] No game.ini found, skipping initial state load`);
        return;
      }

      // INI files in resources are now UTF-8 encoded
      const content = await response.text();
      const sections = this.parseIni(content);

      const state = sections['State'];
      if (state) {
        // Load Obj file
        if (state['Obj']) {
          console.log(`[GameManager] Loading initial Obj file: ${state['Obj']}`);
          await this.objManager.load(state['Obj']);
        }

        // Load Npc file (if not already loaded by script)
        if (state['Npc']) {
          console.log(`[GameManager] Loading initial Npc file: ${state['Npc']}`);
          await this.npcManager.loadNpcFile(state['Npc']);
        }
      }

      console.log(`[GameManager] Initial game state loaded`);
    } catch (error) {
      console.warn(`[GameManager] Error loading initial game state:`, error);
    }
  }

  /**
   * Initialize game - run NewGame.txt script (matches C# implementation)
   * This is the main entry point for starting a new game
   *
   * C# equivalent: Loader.NewGame() -> ScriptExecuter.RunScript("NewGame.txt")
   * NewGame.txt contains: LoadGame(0), PlayMovie(), RunScript("Begin.txt")
   */
  async initGame(): Promise<void> {
    console.log("[GameManager] Starting new game...");
    await this.newGame();
    console.log("[GameManager] Game initialization completed");
  }

  /**
   * Set map data
   */
  setMapData(mapData: JxqyMapData): void {
    this.mapData = mapData;
  }

  /**
   * Set current map name (for script path resolution)
   */
  setCurrentMapName(mapName: string): void {
    this.currentMapName = mapName;
  }

  /**
   * Handle keyboard input
   * @param code Key code (e.g., 'KeyA', 'F12')
   * @param shiftKey Whether shift is held
   */
  handleKeyDown(code: string, shiftKey: boolean = false): boolean {
    // Cheat system takes priority
    if (this.cheatManager.handleInput(code, shiftKey)) {
      return true;
    }

    // GUI takes priority
    if (this.guiManager.handleHotkey(code)) {
      return true;
    }

    return false;
  }

  /**
   * Handle mouse click
   */
  handleClick(worldX: number, worldY: number, button: "left" | "right"): void {
    // Check GUI first
    if (this.guiManager.isBlockingInput()) {
      if (button === "left") {
        this.guiManager.handleDialogClick();
      }
      return;
    }

    if (button === "left") {
      // Convert to tile position
      const tile = pixelToTile(worldX, worldY);

      // Check for NPC interaction
      const npc = this.npcManager.getNpcAtTile(tile.x, tile.y);
      if (npc && npc.config.kind === CharacterKind.Eventer) {
        // Walk to NPC and interact
        this.interactWithNpc(npc);
        return;
      }

      // Note: Movement is now handled in update() via handleInput
      // This click handler is for immediate actions like NPC interaction
      // The continuous mouse-held movement is handled by checking input.isMouseDown in update()
    }
  }

  /**
   * Handle continuous mouse input for movement
   * Based on C# Player.cs Update() - mouse held down = continuous movement
   */
  handleContinuousMouseInput(input: InputState): void {
    // C#: if (mouseState.LeftButton == ButtonState.Pressed)
    if (input.isMouseDown && input.clickedTile) {
      const tile = input.clickedTile;

      // Check for NPC at target (interaction takes priority over movement)
      const npc = this.npcManager.getNpcAtTile(tile.x, tile.y);
      if (npc && npc.config.kind === CharacterKind.Eventer) {
        // Don't move, interaction is handled by click
        return;
      }

      // C#: Movement is handled by playerController.handleInput()
      // which checks isShiftDown for run mode
    }
  }

  /**
   * Interact with an NPC
   */
  async interactWithNpc(npc: NpcData): Promise<void> {
    if (!npc.config.scriptFile) {
      this.guiManager.showMessage("...");
      return;
    }

    // Run NPC's script
    const basePath = this.getScriptBasePath();
    await this.scriptExecutor.runScript(`${basePath}/${npc.config.scriptFile}`);
  }

  /**
   * Get trap script file name for a given index
   * Checks custom trap mapping first (from SetTrap/SetMapTrap), then defaults
   */
  private getTrapScriptFileName(trapIndex: number): string | null {

    // Check if trap is in ignored list
    if (this.ignoredTrapIndices.has(trapIndex)) {
      return null;
    }

    // Check if there's a custom trap mapping for current map
    const mapTraps = this.mapTraps.get(this.currentMapName);

    if (mapTraps && mapTraps.has(trapIndex)) {
      const customScript = mapTraps.get(trapIndex)!;
      console.log(`[GameManager] Using custom trap script: ${customScript}`);
      // Empty string means trap is removed
      if (customScript === "") return null;
      return customScript;
    }

    // Default trap file naming
    const defaultScript = `Trap${trapIndex.toString().padStart(2, "0")}.txt`;
    console.log(`[GameManager] Using default trap script: ${defaultScript}`);
    return defaultScript;
  }

  /**
   * Set trap script for a map (called by SetTrap/SetMapTrap script commands)
   * Based on C#'s MapBase.SetMapTrap
   */
  setMapTrap(trapIndex: number, trapFileName: string, mapName?: string): void {
    const targetMap = mapName || this.currentMapName;
    if (!targetMap) return;

    // If setting for current map, remove from ignored list (re-activate)
    if (!mapName || mapName === this.currentMapName) {
      this.ignoredTrapIndices.delete(trapIndex);
    }

    // Get or create trap mapping for this map
    if (!this.mapTraps.has(targetMap)) {
      this.mapTraps.set(targetMap, new Map());
    }
    const traps = this.mapTraps.get(targetMap)!;

    if (!trapFileName) {
      // Remove trap
      traps.delete(trapIndex);
    } else {
      // Set/update trap
      traps.set(trapIndex, trapFileName);
    }
  }

  /**
   * Check and trigger trap at tile
   * Based on C#'s MapBase.RunTileTrapScript
   */
  private checkTrap(tile: Vector2): void {
    if (!this.mapData) {
      return;
    }

    // C#: Don't run trap if already in trap script execution
    // This prevents map transition traps from re-triggering before player position is updated
    if (this.isInRunMapTrap) {
      return;
    }

    // Don't run traps if waiting for input (dialog, selection, etc.)
    if (this.scriptExecutor.isWaitingForInput()) {
      return;
    }

    const tileIndex = tile.x + tile.y * this.mapData.mapColumnCounts;
    const tileInfo = this.mapData.tileInfos[tileIndex];

    if (tileInfo && tileInfo.trapIndex > 0) {
      const trapIndex = tileInfo.trapIndex;

      // Get trap script file name (handles ignored traps and custom mappings)
      const trapScriptName = this.getTrapScriptFileName(trapIndex);
      if (!trapScriptName) {
        return;
      }

      // Add to ignored list so it won't trigger again (until re-activated by SetTrap)
      this.ignoredTrapIndices.add(trapIndex);

      // Set flag to prevent re-triggering during map transitions
      this.isInRunMapTrap = true;

      const basePath = this.getScriptBasePath();
      const scriptPath = `${basePath}/${trapScriptName}`;
      console.log(`[GameManager] Triggering trap script: ${scriptPath}`);
      this.scriptExecutor.runScript(scriptPath);
    }
  }

  /**
   * Update game state
   * Based on C# Player.cs Update() method
   */
  update(deltaTime: number, input: InputState): void {
    if (this.isPaused) return;

    this.gameTime += deltaTime;

    // Update script executor
    this.scriptExecutor.update(deltaTime * 1000);

    // C#: Reset trap flag when trap script finishes
    if (this.isInRunMapTrap && !this.scriptExecutor.isRunning() && !this.scriptExecutor.isWaitingForInput()) {
      this.isInRunMapTrap = false;
    }

    // Update screen effects (fade in/out, etc.)
    this.screenEffects.update(deltaTime);

    // Update GUI
    this.guiManager.update(deltaTime);

    // Check for special action completion (C#: Character.Update() checks IsInSpecialAction)
    this.updateSpecialActions();

    // Don't process game input if GUI is blocking
    if (this.guiManager.isBlockingInput()) {
      return;
    }

    // C#: Handle mouse held for continuous movement
    // This is the key difference from click-based movement
    // When mouse is held down, continuously update target position
    if (input.isMouseDown && input.clickedTile) {
      // Check for NPC interaction first (one-time on click)
      // Movement handling is done in playerController.handleInput()
      this.handleContinuousMouseInput(input);
    }

    // Handle keyboard movement and mouse-held movement
    // C#: PlayerController checks isMouseDown and isShiftDown for run mode
    this.playerController.handleInput(input, 0, 0);

    // Update player
    this.playerController.update(deltaTime);

    // Check for trap at player's position (but not during trap script execution)
    // C#'s update loop doesn't explicitly check this, but trap checking is only
    // done in Player.CheckMapTrap() which is called during movement or SetPlayerPos
    // We check here for continuous trap detection, but skip during map transitions
    if (!this.isInRunMapTrap) {
      const playerTile = this.playerController.getTilePosition();
      this.checkTrap(playerTile);
    }

    // Update NPCs
    this.npcManager.update(deltaTime);

    // Update HUD
    const player = this.playerController.getPlayer();
    this.guiManager.updateHud(
      player.config.stats.life,
      player.config.stats.lifeMax,
      player.config.stats.mana,
      player.config.stats.manaMax,
      player.config.stats.thew,
      player.config.stats.thewMax
    );
  }

  /**
   * Update special action states for player and NPCs
   * Based on C# Character.Update() which checks IsInSpecialAction and IsPlayCurrentDirOnceEnd()
   */
  private updateSpecialActions(): void {
    // Check player special action
    const player = this.playerController.getPlayer();
    if (player.isInSpecialAction && this.characterRenderer) {
      if (this.characterRenderer.isSpecialActionEnd('player')) {
        // Animation finished, restore state and direction
        console.log(`[GameManager] Player special action ended, restoring direction: ${player.specialActionLastDirection}`);
        player.isInSpecialAction = false;
        if (player.specialActionLastDirection !== undefined) {
          player.direction = player.specialActionLastDirection;
        }
        player.specialActionAsf = undefined;
        player.specialActionFrame = undefined;
        this.characterRenderer.endSpecialActionFor('player');
      }
    }

    // Check NPC special actions
    for (const [, npc] of this.npcManager.getAllNpcs()) {
      if (npc.isInSpecialAction && this.characterRenderer) {
        if (this.characterRenderer.isSpecialActionEnd(npc.id)) {
          // Animation finished, restore state and direction
          console.log(`[GameManager] NPC "${npc.config.name}" special action ended, restoring direction: ${npc.specialActionLastDirection}`);
          npc.isInSpecialAction = false;
          if (npc.specialActionLastDirection !== undefined) {
            npc.direction = npc.specialActionLastDirection;
          }
          npc.specialActionAsf = undefined;
          npc.specialActionFrame = undefined;
          this.characterRenderer.endSpecialActionFor(npc.id);
        }
      }
    }
  }

  // ============= Getters =============

  getPlayerController(): PlayerController {
    return this.playerController;
  }

  /**
   * Get current player data
   */
  getPlayer(): PlayerData {
    return this.playerController.getPlayer();
  }

  getNpcManager(): NpcManager {
    return this.npcManager;
  }

  getObjManager(): ObjManager {
    return this.objManager;
  }

  getGuiManager(): GuiManager {
    return this.guiManager;
  }

  getGoodsListManager(): GoodsListManager {
    return this.goodsListManager;
  }

  /**
   * Get goods version (for UI re-render triggering)
   */
  getGoodsVersion(): number {
    return this.goodsVersion;
  }

  /**
   * Increment goods version to trigger UI re-render
   * Call this after money changes or inventory updates
   */
  incrementGoodsVersion(): void {
    this.goodsVersion++;
  }

  /**
   * Get memo list (任务记事)
   * Uses MemoListManager to get all current memos
   */
  getMemoList(): string[] {
    return this.guiManager.getMemoList();
  }

  getScriptExecutor(): ScriptExecutor {
    return this.scriptExecutor;
  }

  getVariables(): GameVariables {
    return this.variables;
  }

  setVariable(name: string, value: number): void {
    this.variables[name] = value;
  }

  getVariable(name: string): number {
    return this.variables[name] || 0;
  }

  getCurrentMapName(): string {
    return this.currentMapName;
  }

  getCurrentMapPath(): string {
    return this.currentMapPath;
  }

  getMapData(): JxqyMapData | null {
    return this.mapData;
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  getGameTime(): number {
    return this.gameTime;
  }

  /**
   * Set event ID (for script conditions)
   */
  setEventId(id: number): void {
    this.eventId = id;
    this.variables.Event = id;
  }

  /**
   * Get event ID
   */
  getEventId(): number {
    return this.eventId;
  }

  /**
   * Add demo NPCs for testing
   */
  async addDemoNpcs(): Promise<void> {
    // Add some NPCs for testing
    const demoNpcs = [
      { name: "章妈", file: "忘忧岛章妈.ini", x: 15, y: 20 },
      { name: "居民1", file: "忘忧岛居民1.ini", x: 18, y: 25 },
      { name: "居民2", file: "忘忧岛居民2.ini", x: 22, y: 22 },
    ];

    for (const npc of demoNpcs) {
      await this.npcManager.addNpc(`/resources/ini/npc/${npc.file}`, npc.x, npc.y);
    }
  }

  // ============= Audio and Effects =============

  getAudioManager(): AudioManager {
    return this.audioManager;
  }

  getScreenEffects(): ScreenEffects {
    return this.screenEffects;
  }

  /**
   * Draw screen effects (call after rendering scene)
   */
  drawScreenEffects(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.screenEffects.drawFade(ctx, width, height);
    this.screenEffects.drawFlash(ctx, width, height);
  }

  /**
   * Check if currently fading (for blocking input during transitions)
   */
  isFading(): boolean {
    return this.screenEffects.isFading();
  }

  /**
   * Get level file
   */
  getLevelFile(): string {
    return this.levelFile;
  }

  /**
   * Get level manager
   */
  getLevelManager(): LevelManager {
    return this.levelManager;
  }

  /**
   * Get cheat manager
   */
  getCheatManager(): CheatManager {
    return this.cheatManager;
  }

  /**
   * Check if cheat mode is enabled
   */
  isCheatEnabled(): boolean {
    return this.cheatManager.isEnabled();
  }

  /**
   * Check if god mode is active
   */
  isGodMode(): boolean {
    return this.cheatManager.isGodMode();
  }

  /**
   * Move camera in a direction for a given distance
   * Based on C# Camera.MoveTo(direction, distance, speed)
   */
  cameraMoveTo(direction: number, distance: number, speed: number): void {
    // Direction is 8-way (0-7), same as character directions
    // 0=North, 1=NorthEast, 2=East, 3=SouthEast, 4=South, 5=SouthWest, 6=West, 7=NorthWest
    this.isCameraMoving = true;
    this.cameraMoveDirection = direction;
    this.cameraMoveDistance = distance;
    this.cameraMoveSpeed = speed;
    this.cameraMoveStartPos = null; // Will be set when camera position is available
  }

  /**
   * Update camera movement (called from game loop)
   */
  updateCameraMovement(
    cameraX: number,
    cameraY: number,
    deltaTime: number
  ): { x: number; y: number } | null {
    if (!this.isCameraMoving) {
      return null;
    }

    // Initialize start position
    if (!this.cameraMoveStartPos) {
      this.cameraMoveStartPos = { x: cameraX, y: cameraY };
    }

    // Direction vectors (8-way)
    const dirVectors = [
      { x: 0, y: -1 },  // 0: North
      { x: 1, y: -1 },  // 1: NorthEast
      { x: 1, y: 0 },   // 2: East
      { x: 1, y: 1 },   // 3: SouthEast
      { x: 0, y: 1 },   // 4: South
      { x: -1, y: 1 },  // 5: SouthWest
      { x: -1, y: 0 },  // 6: West
      { x: -1, y: -1 }, // 7: NorthWest
    ];

    const dir = dirVectors[this.cameraMoveDirection] || { x: 0, y: 0 };

    // Calculate movement per frame
    // C#: speed is pixels per frame at 60fps
    const movePerSecond = this.cameraMoveSpeed * 60;
    const moveAmount = movePerSecond * (deltaTime / 1000);

    // Calculate new position
    const newX = cameraX + dir.x * moveAmount;
    const newY = cameraY + dir.y * moveAmount;

    // Calculate distance moved from start
    const dx = newX - this.cameraMoveStartPos.x;
    const dy = newY - this.cameraMoveStartPos.y;
    const distanceMoved = Math.sqrt(dx * dx + dy * dy);

    // Check if we've moved far enough
    if (distanceMoved >= this.cameraMoveDistance) {
      // Move complete - calculate final position before clearing state
      const startX = this.cameraMoveStartPos.x;
      const startY = this.cameraMoveStartPos.y;

      this.isCameraMoving = false;
      this.cameraMoveStartPos = null;

      // Return final position (exact distance)
      const ratio = this.cameraMoveDistance / distanceMoved;
      return {
        x: startX + dx * ratio,
        y: startY + dy * ratio,
      };
    }

    return { x: newX, y: newY };
  }

  /**
   * Check if camera is being moved by script
   */
  isCameraMovingByScript(): boolean {
    return this.isCameraMoving;
  }

  /**
   * Execute a script file or script content directly (for debug panel)
   * @param input Can be:
   *   - Script content: "Say(\"测试\")" or multi-line script commands
   *   - Full path: "/resources/script/map/map_002/Begin.txt"
   *   - Relative to current map: "Begin.txt"
   *   - Common script: "common/NewGame.txt"
   * @returns Error message if execution failed, null if successful
   */
  async executeScript(input: string): Promise<string | null> {
    try {
      const trimmed = input.trim();
      console.log(`[GameManager] Executing script content directly`);
      await this.scriptExecutor.runScriptContent(trimmed, "DebugPanel");
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[GameManager] Script execution error:`, error);
      return errorMessage;
    }
  }
}
