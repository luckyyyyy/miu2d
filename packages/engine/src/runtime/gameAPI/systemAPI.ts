/**
 * System APIs - Dialog, Variable, Input, Save, ScriptRunner implementations
 */

import type { DialogAPI, VariableAPI, InputAPI, SaveAPI, ScriptRunnerAPI } from "../../core/gameAPI";
import type { ScriptCommandContext } from "../scriptContext/types";
import { deleteAllSaves } from "../storage";
import { logger } from "../../core/logger";
import { resolveScriptPath } from "../../config/resourcePaths";

export function createDialogAPI(ctx: ScriptCommandContext): DialogAPI {
  const { guiManager, talkTextList } = ctx;

  return {
    show: (text, portraitIndex) => {
      ctx.clearMouseInput?.();
      guiManager.showDialog(text, portraitIndex);
    },
    showMessage: (text) => { guiManager.showMessage(text); },
    showSelection: (message, selectA, selectB) => {
      ctx.clearMouseInput?.();
      guiManager.showDialogSelection(message, selectA, selectB);
    },
    showSelectionList: (options, message?) => {
      ctx.clearMouseInput?.();
      guiManager.showSelection(
        options.map(o => ({ ...o, enabled: true })),
        message || "",
      );
    },
    chooseEx: (message, options, _resultVar) => {
      const selectionOptions = options.map((opt, idx) => ({
        text: opt.text,
        label: String(idx),
        enabled: true,
      }));
      guiManager.showSelection(selectionOptions, message);
    },
    chooseMultiple: (columns, rows, varPrefix, message, options) => {
      const selectionOptions = options.map((opt, idx) => ({
        text: opt.text,
        label: String(idx),
        enabled: opt.condition !== "false",
      }));
      guiManager.showMultiSelection(columns, rows, message, selectionOptions);
      (guiManager as unknown as { multiSelectionVarPrefix?: string }).multiSelectionVarPrefix = varPrefix;
    },
    isChooseExEnd: () => !guiManager.getState().selection.isVisible,
    isChooseMultipleEnd: () => guiManager.isMultiSelectionEnd(),
    getSelectionResult: () => guiManager.getState().selection.selectedIndex,
    getMultiSelectionResult: () => guiManager.getState().selection.selectedIndex,
    getChooseMultipleResult: () => guiManager.getMultiSelectionResult(),
    showSystemMessage: (msg, stayTime?) => { guiManager.showMessage(msg, stayTime || 3000); },
    waitForClose: () => { /* Handled by script executor */ },
    waitForSelection: () => { /* Handled by script executor */ },
    talkTextList,
  };
}

export function createVariableAPI(ctx: ScriptCommandContext): VariableAPI {
  const { npcManager, partnerList, getVariables, setVariable } = ctx;

  return {
    get: (name) => getVariables()[name] || 0,
    set: (name, value) => { setVariable(name, value); },
    clearAll: (keepsVars?) => {
      const variables = getVariables();
      const keeps: Record<string, number> = {};
      for (const key of keepsVars || []) {
        const normalizedKey = key.startsWith("$") ? key : `$${key}`;
        if (normalizedKey in variables) { keeps[normalizedKey] = variables[normalizedKey]; }
      }
      for (const key of Object.keys(variables)) { delete variables[key]; }
      for (const [key, value] of Object.entries(keeps)) { variables[key] = value; }
    },
    getPartnerIndex: () => {
      const partners = npcManager.getAllPartner();
      if (partners.length > 0) {
        const partnerName = partners[0].name;
        return partnerList.getIndex(partnerName);
      }
      return partnerList.getCount() + 1;
    },
  };
}

export function createInputAPI(ctx: ScriptCommandContext): InputAPI {
  return {
    setEnabled: (_enabled) => {
      // In TypeScript, script execution already blocks input
      // This is mainly for explicit cutscene control
    },
  };
}

export function createSaveAPI(ctx: ScriptCommandContext): SaveAPI {
  return {
    setEnabled: (enabled) => {
      if (enabled) ctx.enableSave(); else ctx.disableSave();
    },
    clearAll: () => { deleteAllSaves(); },
  };
}

export function createScriptRunnerAPI(ctx: ScriptCommandContext): ScriptRunnerAPI {
  return {
    run: async (scriptFile) => {
      const basePath = ctx.getScriptBasePath();
      await ctx.runScript(resolveScriptPath(basePath, scriptFile));
    },
    runParallel: (scriptFile, delay?) => {
      if (ctx.runParallelScript) { ctx.runParallelScript(scriptFile, delay || 0); }
      else { logger.warn(`[GameAPI.script] runParallel not available: ${scriptFile}`); }
    },
    returnToTitle: () => { ctx.returnToTitle(); },
    randRun: (_probability, _script1, _script2) => {
      // Handled by command handler directly
    },
    setShowMapPos: (show) => { ctx.setScriptShowMapPos(show); },
    sleep: (_ms) => { /* Handled by executor */ },
    loadGame: async (index) => { await ctx.loadGameSave(index); },
  };
}
