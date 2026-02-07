/**
 * World Commands - Map, obj, audio, weather, camera, effects, timer
 * Extracted from scriptContextFactory.ts
 */

import type { ScriptContext } from "../../script/executor";
import type { ScriptCommandContext } from "./types";
import { logger } from "../../core/logger";
import { tileToPixel } from "../../utils";

export function createWorldCommands(ctx: ScriptCommandContext): Partial<ScriptContext> {
  const {
    objManager,
    audioManager,
    guiManager,
    screenEffects,
    weatherManager,
    timerManager,
    levelManager,
    loadMap: loadMapFn,
    loadNpcFile,
    loadGameSave,
    setMapTrap: setMapTrapFn,
    cameraMoveTo,
    cameraMoveToPosition,
    isCameraMoving,
    isCameraMoveToPositionEnd,
    setCameraPosition,
  } = ctx;

  return {

    // Map
    loadMap: async (mapName) => {
      await loadMapFn(mapName);
    },
    loadNpc: async (fileName) => {
      await loadNpcFile(fileName);
    },
    loadGame: async (index) => {
      await loadGameSave(index);
    },

    // Obj
    loadObj: async (fileName) => {
      logger.log(`[ScriptContext] LoadObj command: ${fileName}`);
      const result = await objManager.load(fileName);
      logger.log(`[ScriptContext] LoadObj result: ${result}`);
    },
    addObj: async (fileName, x, y, direction) => {
      logger.log(`[ScriptContext] AddObj command: ${fileName} at (${x}, ${y}) dir=${direction}`);
      await objManager.addObjByFile(fileName, x, y, direction);
    },
    delCurObj: () => {
      // removes the object that triggered the script
      // The belongObject is stored in ScriptState, accessed via command handler
      // This is a no-op as the actual deletion is handled by delObj with __id__ prefix
      logger.log(`[ScriptContext] DelCurObj command (no-op, handled by delObj)`);
    },
    delObj: (objNameOrId) => {
      // Support both name-based and id-based deletion
      // ID-based: "__id__:xxx" format (used by DelCurObj)
      if (objNameOrId.startsWith("__id__:")) {
        const id = objNameOrId.substring(7);
        logger.log(`[ScriptContext] DelObj by id: ${id}`);
        objManager.deleteObjById(id);
      } else {
        logger.log(`[ScriptContext] DelObj by name: ${objNameOrId}`);
        objManager.deleteObj(objNameOrId);
      }
    },
    openBox: (objNameOrId) => {
      // plays box opening animation
      // If no name provided, uses belongObject (handled by command)
      if (objNameOrId) {
        logger.log(`[ScriptContext] OpenBox: ${objNameOrId}`);
        objManager.openBox(objNameOrId);
      }
    },
    closeBox: (objNameOrId) => {
      // plays box closing animation
      if (objNameOrId) {
        logger.log(`[ScriptContext] CloseBox: ${objNameOrId}`);
        objManager.closeBox(objNameOrId);
      }
    },
    setObjScript: (objNameOrId, scriptFile) => {
      // sets object's script file
      // When scriptFile is empty, the object becomes non-interactive
      logger.log(`[ScriptContext] SetObjScript: ${objNameOrId} -> "${scriptFile}"`);
      objManager.setObjScript(objNameOrId, scriptFile);
    },
    saveObj: async (fileName) => {
      await objManager.saveObj(fileName);
    },
    clearBody: () => {
      // removes all objects with IsBody=true
      objManager.clearBodies();
      logger.log(`[ScriptContext] ClearBody`);
    },
    getObjPosition: (objNameOrId) => {
      // Get OBJ position by name or id
      const obj = objManager.getObj(objNameOrId);
      if (obj) {
        return obj.tilePosition;
      }
      return null;
    },

    // Trap management
    setMapTrap: (trapIndex, trapFileName, mapName) => {
      setMapTrapFn(trapIndex, trapFileName, mapName);
    },

    // Game flow
    sleep: (_ms) => {
      // Note: This is handled by the caller, not stored here
    },
    playMusic: (file) => {
      audioManager.playMusic(file);
    },
    stopMusic: () => {
      audioManager.stopMusic();
    },
    playSound: (file, emitterPosition?) => {
      // PlaySound uses belongObject position for 3D spatial audio
      if (emitterPosition) {
        audioManager.play3DSoundOnce(file, emitterPosition);
      } else {
        audioManager.playSound(file);
      }
    },
    playMovie: (file) => {
      // PlayMovie uses XNA VideoPlayer
      // Web implementation: Use HTML5 Video element
      logger.log(`[ScriptContext] PlayMovie: ${file}`);
      guiManager.playMovie(file);
    },
    isMovieEnd: () => {
      return guiManager.isMovieEnd();
    },
    fadeIn: () => {
      screenEffects.fadeIn();
    },
    fadeOut: () => {
      screenEffects.fadeOut();
    },
    isFadeInEnd: () => {
      return screenEffects.isFadeInEnd();
    },
    isFadeOutEnd: () => {
      return screenEffects.isFadeOutEnd();
    },
    moveScreen: (direction, distance, speed) => {
      cameraMoveTo(direction, distance, speed);
    },
    isMoveScreenEnd: () => {
      return !isCameraMoving();
    },
    changeMapColor: (r, g, b) => {
      screenEffects.setMapColor(r, g, b);
    },
    changeAsfColor: (r, g, b) => {
      screenEffects.setSpriteColor(r, g, b);
    },
    beginRain: (fileName) => {
      // start rain effect
      // fileName 是雨效果配置文件，如 "Rain2.ini"
      weatherManager.beginRain(fileName);
      logger.log(`[ScriptContext] BeginRain: ${fileName}`);
    },
    endRain: () => {
      // stop rain effect
      weatherManager.stopRain();
      // 恢复正常颜色
      screenEffects.setMapColor(255, 255, 255);
      screenEffects.setSpriteColor(255, 255, 255);
      logger.log(`[ScriptContext] EndRain`);
    },
    showSnow: (show) => {
      // show/hide snow effect
      weatherManager.showSnow(show);
      logger.log(`[ScriptContext] ShowSnow: ${show}`);
    },
    freeMap: () => {
      // release map resources
      // In JS, we rely on garbage collection
      // This is mainly a signal that map should be unloaded
      logger.log(`[ScriptContext] FreeMap (JS uses garbage collection)`);
    },
    setLevelFile: async (file) => {
      // 从 API 按需加载，自动转小写请求
      await levelManager.setLevelFile(file);
    },

    // Timer commands
    openTimeLimit: (seconds) => {
      timerManager.openTimeLimit(seconds);
      logger.log(`[ScriptContext] OpenTimeLimit: ${seconds} seconds`);
    },
    closeTimeLimit: () => {
      timerManager.closeTimeLimit();
      logger.log(`[ScriptContext] CloseTimeLimit`);
    },
    hideTimerWnd: () => {
      timerManager.hideTimerWnd();
      logger.log(`[ScriptContext] HideTimerWnd`);
    },
    setTimeScript: (triggerSeconds, scriptFileName) => {
      // 只存储文件名，触发时根据当前地图构建路径
      timerManager.setTimeScript(triggerSeconds, scriptFileName);
      logger.log(`[ScriptContext] SetTimeScript: ${triggerSeconds}s -> ${scriptFileName}`);
    },

    // ============= Extended Camera Commands =============
    moveScreenEx: (x, y, speed) => {
      // 将摄像机移动到指定瓦片位置（使该瓦片居中）
      // _moveToBeginDestination = MapBase.ToPixelPosition(centerTilePosition) - GetHalfViewSize()
      // 这里我们将瓦片转为像素，视口偏移由 GameEngine 处理
      const pixelPos = tileToPixel(x, y);
      cameraMoveToPosition(pixelPos.x, pixelPos.y, speed);
      logger.log(
        `[ScriptContext] MoveScreenEx: tile(${x}, ${y}) -> pixel(${pixelPos.x}, ${pixelPos.y}), speed=${speed}`
      );
    },
    isMoveScreenExEnd: () => {
      return isCameraMoveToPositionEnd();
    },
    setMapPos: (x, y) => {
      // 将瓦片坐标转换为像素坐标，设置摄像机位置
      // Globals.TheCarmera.CarmeraBeginPositionInWorld = MapBase.ToPixelPosition(x, y)
      const pixelPos = tileToPixel(x, y);
      setCameraPosition(pixelPos.x, pixelPos.y);
      logger.log(
        `[ScriptContext] SetMapPos: tile(${x}, ${y}) -> pixel(${pixelPos.x}, ${pixelPos.y})`
      );
    },
    openWaterEffect: () => {
      screenEffects.openWaterEffect();
      logger.log("[ScriptContext] OpenWaterEffect");
    },
    closeWaterEffect: () => {
      screenEffects.closeWaterEffect();
      logger.log("[ScriptContext] CloseWaterEffect");
    },
    setObjOfs: (objName, x, y) => {
      const obj = objManager.getObj(objName) || objManager.getObjById(objName);
      if (obj) {
        obj.setOffset({ x, y });
      }
      logger.log(`[ScriptContext] SetObjOfs: ${objName} -> (${x}, ${y})`);
    },
    stopSound: () => {
      audioManager.stopAllSounds();
      logger.log("[ScriptContext] StopSound");
    },
  };
}
