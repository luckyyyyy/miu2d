/**
 * System Commands - Dialog, variables, save, input, effects
 * Extracted from scriptContextFactory.ts
 */

import type { ScriptContext } from "../../script/executor";
import type { ScriptCommandContext } from "./types";
import { StorageManager } from "../storage";
import { logger } from "../../core/logger";
import { resolveScriptPath } from "../../config/resourcePaths";

export function createSystemCommands(ctx: ScriptCommandContext): Partial<ScriptContext> {
  const {
    player,
    npcManager,
    guiManager,
    partnerList,
    getScriptBasePath,
    getVariables,
    setVariable,
    runScript: runScriptFn,
    enableSave,
    disableSave,
    enableDrop,
    disableDrop,
  } = ctx;

  return {

    // Variables
    getVariable: (name) => getVariables()[name] || 0,
    setVariable: (name, value) => {
      setVariable(name, value);
    },

    // Dialog
    showDialog: (text, portraitIndex) => {
      ctx.clearMouseInput?.(); // 清除鼠标按住状态，打断用户输入
      guiManager.showDialog(text, portraitIndex);
    },
    showMessage: (text) => {
      guiManager.showMessage(text);
    },
    showDialogSelection: (message, selectA, selectB) => {
      ctx.clearMouseInput?.(); // 清除鼠标按住状态，打断用户输入
      guiManager.showDialogSelection(message, selectA, selectB);
    },
    showSelection: (options, message) => {
      ctx.clearMouseInput?.(); // 清除鼠标按住状态，打断用户输入
      guiManager.showSelection(
        options.map((o) => ({ ...o, enabled: true })),
        message || ""
      );
    },

    // Input/ability control
    // Note: IsInputDisabled is a global state that prevents player input during cutscenes
    // In TS, we handle this via script execution state - when script is running, input is already disabled
    disableInput: () => {
      // Globals.IsInputDisabled = true
      // In TypeScript, script execution already blocks input
      // This is mainly for explicit cutscene control
      logger.log("[ScriptContext] DisableInput");
    },
    enableInput: () => {
      // Globals.IsInputDisabled = false
      logger.log("[ScriptContext] EnableInput");
    },

    // Wait for input
    waitForDialogClose: () => {
      // Handled by script executor
    },
    waitForSelection: () => {
      // Handled by script executor
    },
    getSelectionResult: () => {
      return guiManager.getState().selection.selectedIndex;
    },

    // Script management
    runScript: async (scriptFile) => {
      const basePath = getScriptBasePath();
      await runScriptFn(resolveScriptPath(basePath, scriptFile));
    },
    getCurrentMapPath: () => "", // Will be overridden by caller
    returnToTitle: () => {
      // 返回标题界面 - 通过依赖项的回调来实现
      logger.log("[ScriptContext] ReturnToTitle");
      ctx.returnToTitle();
    },

    // Map time
    setMapTime: (time) => {
      // MapBase.MapTime = time
      ctx.setMapTime(time);
    },
    enableDrop: () => {
      enableDrop();
      logger.log("[ScriptContext] EnableDrop");
    },
    disableDrop: () => {
      disableDrop();
      logger.log("[ScriptContext] DisableDrop");
    },

    // ============= Save Commands =============
    saveMapTrap: () => {
      ctx.saveMapTrap();
      logger.log("[ScriptContext] SaveMapTrap");
    },
    clearAllSave: () => {
      StorageManager.deleteAllSaves();
      logger.log("[ScriptContext] ClearAllSave: all user saves deleted");
    },
    enableSave: () => {
      enableSave();
      logger.log("[ScriptContext] EnableSave");
    },
    disableSave: () => {
      disableSave();
      logger.log("[ScriptContext] DisableSave");
    },

    // ============= Variable Commands =============
    clearAllVar: (keepsVars) => {
      const variables = getVariables();
      const keeps: Record<string, number> = {};
      for (const key of keepsVars || []) {
        const normalizedKey = key.startsWith("$") ? key : `$${key}`;
        if (normalizedKey in variables) {
          keeps[normalizedKey] = variables[normalizedKey];
        }
      }
      // Clear all
      for (const key of Object.keys(variables)) {
        delete variables[key];
      }
      // Restore keeps
      for (const [key, value] of Object.entries(keeps)) {
        variables[key] = value;
      }
      logger.log(`[ScriptContext] ClearAllVar, kept: ${Object.keys(keeps).join(", ")}`);
    },
    getPartnerIdx: () => {
      // 获取第一个队友的索引
      const partners = npcManager.getAllPartner();
      if (partners.length > 0) {
        const partnerName = partners[0].name;
        const idx = partnerList.getIndex(partnerName);
        logger.log(`[ScriptContext] GetPartnerIdx: ${partnerName} -> ${idx}`);
        return idx;
      }
      // 如果没有队友，返回 count + 1
      const count = partnerList.getCount();
      logger.log(`[ScriptContext] GetPartnerIdx: no partner, returning ${count + 1}`);
      return count + 1;
    },

    // ============= Effect Commands =============
    petrifyMillisecond: (ms) => {
      if (player) {
        // seconds = Globals.ThePlayer.PetrifiedSeconds < seconds ? seconds : Globals.ThePlayer.PetrifiedSeconds;
        let seconds = ms / 1000;
        seconds = player.petrifiedSeconds < seconds ? seconds : player.petrifiedSeconds;
        player.setPetrifySeconds(seconds, true);
        logger.log(`[ScriptContext] PetrifyMillisecond: ${ms}ms (actual: ${seconds}s)`);
      }
    },
    poisonMillisecond: (ms) => {
      if (player) {
        // seconds = Globals.ThePlayer.PoisonSeconds < seconds ? seconds : Globals.ThePlayer.PoisonSeconds;
        let seconds = ms / 1000;
        seconds = player.poisonSeconds < seconds ? seconds : player.poisonSeconds;
        player.setPoisonSeconds(seconds, true);
        logger.log(`[ScriptContext] PoisonMillisecond: ${ms}ms (actual: ${seconds}s)`);
      }
    },
    frozenMillisecond: (ms) => {
      if (player) {
        // seconds = Globals.ThePlayer.FrozenSeconds < seconds ? seconds : Globals.ThePlayer.FrozenSeconds;
        let seconds = ms / 1000;
        seconds = player.frozenSeconds < seconds ? seconds : player.frozenSeconds;
        player.setFrozenSeconds(seconds, true);
        logger.log(`[ScriptContext] FrozenMillisecond: ${ms}ms (actual: ${seconds}s)`);
      }
    },

    // ============= Misc Extended Commands =============
    runParallelScript: (scriptFile, delay) => {
      if (ctx.runParallelScript) {
        ctx.runParallelScript(scriptFile, delay || 0);
      } else {
        logger.warn(`[ScriptContext] RunParallelScript not available: ${scriptFile}`);
      }
    },
    setShowMapPos: (show) => {
      ctx.setScriptShowMapPos(show);
      logger.log(`[ScriptContext] SetShowMapPos: ${show}`);
    },
    showSystemMsg: (msg, stayTime) => {
      // stayTime in milliseconds
      guiManager.showMessage(msg, stayTime || 3000);
      logger.log(`[ScriptContext] ShowSystemMsg: "${msg}", stayTime=${stayTime || 3000}`);
    },
    randRun: (_probability, _script1, _script2) => {
      // Handled by command handler
    },

    // ============= Extended Dialog Commands =============
    chooseEx: (message, options, _resultVar) => {
      // Create selection options from the array
      const selectionOptions = options.map((opt, idx) => ({
        text: opt.text,
        label: String(idx),
        enabled: true,
      }));
      guiManager.showSelection(selectionOptions, message);
      logger.log(`[ScriptContext] ChooseEx: "${message}" with ${options.length} options`);
    },
    chooseMultiple: (columns, rows, varPrefix, message, options) => {
      // GuiManager.ChooseMultiple(column, selectionCount, varName, message, selections, isShows)
      // rows 参数对应selectionCount（需要选择的数量）
      const selectionOptions = options.map((opt, idx) => ({
        text: opt.text,
        label: String(idx),
        enabled: opt.condition !== "false", // 简单条件判断
      }));
      guiManager.showMultiSelection(columns, rows, message, selectionOptions);
      // 保存变量前缀用于后续获取结果
      (guiManager as unknown as { multiSelectionVarPrefix?: string }).multiSelectionVarPrefix =
        varPrefix;
      logger.log(
        `[ScriptContext] ChooseMultiple: ${columns}x${rows}, prefix=${varPrefix}, msg="${message}", ${options.length} options`
      );
    },
    isChooseExEnd: () => {
      return !guiManager.getState().selection.isVisible;
    },
    isChooseMultipleEnd: () => {
      return guiManager.isMultiSelectionEnd();
    },
    getMultiSelectionResult: () => {
      return guiManager.getState().selection.selectedIndex;
    },
    getChooseMultipleResult: () => {
      return guiManager.getMultiSelectionResult();
    },
  };
}
