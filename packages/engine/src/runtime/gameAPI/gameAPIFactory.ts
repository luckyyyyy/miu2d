/**
 * GameAPI Factory - Creates a complete GameAPI from ScriptContextDependencies
 */

import type { GameAPI } from "../../core/gameAPI";
import type { ScriptContextDependencies } from "../scriptContextFactory";
import { ResourcePath } from "../../config/resourcePaths";
import type { Npc } from "../../npc";
import type { Player } from "../../player/player";
import type { ScriptCommandContext } from "../scriptContext/types";

import { createPlayerAPI } from "./playerAPI";
import { createNpcAPI } from "./npcAPI";
import { createGoodsAPI, createMagicAPI, createMemoAPI } from "./itemAPI";
import { createMapAPI, createObjAPI, createCameraAPI, createAudioAPI, createEffectsAPI, createTimerAPI } from "./worldAPI";
import { createDialogAPI, createVariableAPI, createInputAPI, createSaveAPI, createScriptRunnerAPI } from "./systemAPI";

/**
 * Build the shared ScriptCommandContext from dependencies.
 */
function buildCommandContext(deps: ScriptContextDependencies): ScriptCommandContext {
  const {
    player, npcManager, guiManager, objManager, audioManager,
    screenEffects, talkTextList, memoListManager, weatherManager,
    timerManager, buyManager, partnerList,
    getVariables, setVariable, getCurrentMapName,
    loadMap, loadNpcFile, loadGameSave,
    setMapTrap, checkTrap,
    cameraMoveTo, cameraMoveToPosition, isCameraMoving, isCameraMoveToPositionEnd,
    setCameraPosition, centerCameraOnPlayer, runScript,
    enableSave, disableSave, enableDrop, disableDrop, isMapObstacleForCharacter,
  } = deps;

  const levelManager = player.levelManager;
  const goodsListManager = player.getGoodsListManager();

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

  return {
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
}

/**
 * Create a complete GameAPI instance from dependencies.
 */
export function createGameAPIImpl(deps: ScriptContextDependencies): {
  api: GameAPI;
  ctx: ScriptCommandContext;
} {
  const ctx = buildCommandContext(deps);

  const api: GameAPI = {
    player: createPlayerAPI(ctx),
    npc: createNpcAPI(ctx),
    goods: createGoodsAPI(ctx),
    magic: createMagicAPI(ctx),
    memo: createMemoAPI(ctx),
    map: createMapAPI(ctx),
    obj: createObjAPI(ctx),
    camera: createCameraAPI(ctx),
    audio: createAudioAPI(ctx),
    effects: createEffectsAPI(ctx),
    dialog: createDialogAPI(ctx),
    timer: createTimerAPI(ctx),
    variables: createVariableAPI(ctx),
    input: createInputAPI(ctx),
    save: createSaveAPI(ctx),
    script: createScriptRunnerAPI(ctx),
  };

  return { api, ctx };
}
