/**
 * Script Context Factory - Creates ScriptContext for script execution
 * Extracted from GameManager to reduce complexity
 *
 *  context bindings
 */

import type { AudioManager } from "../audio";
import { ResourcePath } from "../config/resourcePaths";
import type { Vector2 } from "../core/types";
import type { ScreenEffects } from "../effects";
import type { BuyManager } from "../gui/buyManager";
import type { GuiManager } from "../gui/guiManager";
import type { MemoListManager, TalkTextListManager } from "../listManager";
import type { PartnerListManager } from "../listManager/partnerList";
import type { Npc, NpcManager } from "../npc";
import type { ObjManager } from "../obj";
import type { Player } from "../player/player";
import type { ScriptContext } from "../script/executor";
import type { TimerManager } from "../timer";
import type { WeatherManager } from "../weather";

/**
 * Dependencies needed to create a script context
 */
export interface ScriptContextDependencies {
  // Controllers
  player: Player;
  npcManager: NpcManager;
  guiManager: GuiManager;
  objManager: ObjManager;
  audioManager: AudioManager;
  screenEffects: ScreenEffects;
  talkTextList: TalkTextListManager;
  memoListManager: MemoListManager;
  weatherManager: WeatherManager;
  timerManager: TimerManager;
  buyManager: BuyManager;
  partnerList: PartnerListManager;

  // State accessors
  getVariables: () => Record<string, number>;
  setVariable: (name: string, value: number) => void;
  getCurrentMapName: () => string;

  // Actions
  loadMap: (mapPath: string) => Promise<void>;
  loadNpcFile: (fileName: string) => Promise<void>;
  loadGameSave: (index: number) => Promise<void>;
  setMapTrap: (trapIndex: number, trapFileName: string, mapName?: string) => void;
  checkTrap: (tile: Vector2) => void;
  cameraMoveTo: (direction: number, distance: number, speed: number) => void;
  cameraMoveToPosition: (destX: number, destY: number, speed: number) => void;
  isCameraMoving: () => boolean;
  isCameraMoveToPositionEnd: () => boolean;
  setCameraPosition: (pixelX: number, pixelY: number) => void;
  centerCameraOnPlayer: () => void;
  runScript: (scriptFile: string) => Promise<void>;

  // Save/Drop flags
  enableSave: () => void;
  disableSave: () => void;
  enableDrop: () => void;
  disableDrop: () => void;

  // Show map pos flag
  setScriptShowMapPos: (show: boolean) => void;

  // Map time
  setMapTime: (time: number) => void;

  // Trap save
  saveMapTrap: () => void;

  // Player change (多主角切换)
  changePlayer: (index: number) => Promise<void>;

  // Debug hooks (optional)
  onScriptStart?: (filePath: string, totalLines: number, allCodes: string[]) => void;
  onLineExecuted?: (filePath: string, lineNumber: number) => void;

  // Input control (optional)
  clearMouseInput?: () => void;

  // Map obstacle check (injected to avoid global MapBase.Instance)
  isMapObstacleForCharacter: (x: number, y: number) => boolean;

  // Return to title
  returnToTitle: () => void;

  // Parallel script (optional - set after ScriptExecutor is created)
  runParallelScript?: (scriptFile: string, delayMs: number) => void;
}

/**
 * Create ScriptContext for script execution
 * This is the bridge between script commands and game systems
 */
import {
  createPlayerCommands,
  createNpcCommands,
  createItemCommands,
  createWorldCommands,
  createSystemCommands,
} from "./scriptContext";

export function createScriptContext(deps: ScriptContextDependencies): ScriptContext {
  const {
    player,
    npcManager,
    guiManager,
    objManager,
    audioManager,
    screenEffects,
    talkTextList,
    memoListManager,
    weatherManager,
    timerManager,
    buyManager,
    partnerList,
    getVariables,
    setVariable,
    getCurrentMapName,
    loadMap,
    loadNpcFile,
    loadGameSave,
    setMapTrap,
    checkTrap,
    cameraMoveTo,
    cameraMoveToPosition,
    isCameraMoving,
    isCameraMoveToPositionEnd,
    setCameraPosition,
    centerCameraOnPlayer,
    runScript,
    enableSave,
    disableSave,
    enableDrop,
    disableDrop,
    isMapObstacleForCharacter,
  } = deps;

  // Derived from player
  const levelManager = player.levelManager;
  const goodsListManager = player.getGoodsListManager();

  // Character lookup utilities
  const getCharacterByName = (name: string): Npc | Player | null => {
    if (player && player.name === name) return player;
    return npcManager.getNpc(name);
  };

  const getCharactersByName = (name: string): (Npc | Player)[] => {
    const result: (Npc | Player)[] = [];
    if (player && player.name === name) result.push(player);
    result.push(...npcManager.getAllNpcsByName(name));
    return result;
  };

  const getScriptBasePath = (): string => {
    const mapName = getCurrentMapName();
    return mapName
      ? ResourcePath.scriptMap(mapName)
      : ResourcePath.scriptCommon("").replace(/\/$/, "");
  };

  // Build shared context for sub-command files
  const ctx = {
    player, npcManager, guiManager, objManager, audioManager,
    screenEffects, talkTextList, memoListManager, weatherManager,
    timerManager, buyManager, partnerList,
    levelManager, goodsListManager,
    getCharacterByName, getCharactersByName, getScriptBasePath,
    getVariables, setVariable, getCurrentMapName,
    loadMap, loadNpcFile, loadGameSave,
    setMapTrap, checkTrap,
    cameraMoveTo, cameraMoveToPosition, isCameraMoving, isCameraMoveToPositionEnd,
    setCameraPosition, centerCameraOnPlayer,
    runScript, enableSave, disableSave, enableDrop, disableDrop,
    isMapObstacleForCharacter,
    setScriptShowMapPos: deps.setScriptShowMapPos,
    setMapTime: deps.setMapTime,
    saveMapTrap: deps.saveMapTrap,
    changePlayer: deps.changePlayer,
    clearMouseInput: deps.clearMouseInput,
    returnToTitle: deps.returnToTitle,
    runParallelScript: deps.runParallelScript,
  };

  return {
    // System access
    talkTextList,
    scriptBasePath: getScriptBasePath(),
    ...createPlayerCommands(ctx),
    ...createNpcCommands(ctx),
    ...createItemCommands(ctx),
    ...createWorldCommands(ctx),
    ...createSystemCommands(ctx),
    // Debug hooks
    onScriptStart: deps.onScriptStart,
    onLineExecuted: deps.onLineExecuted,
  } as ScriptContext;
}
