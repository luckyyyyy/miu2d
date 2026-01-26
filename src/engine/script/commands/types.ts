/**
 * Command Handler Types
 * Shared types for script command handlers
 */
import type {
  ScriptState,
  GameVariables,
  SelectionOption,
  Vector2,
} from "../../core/types";

export interface ScriptContext {
  // Game state access
  getVariable: (name: string) => number;
  setVariable: (name: string, value: number) => void;

  // Dialog functions
  showDialog: (text: string, portraitIndex: number) => void;
  showMessage: (text: string) => void;
  showDialogSelection: (message: string, selectA: string, selectB: string) => void;
  showSelection: (options: SelectionOption[], message?: string) => void;

  // Map functions
  loadMap: (mapName: string) => Promise<void>;
  loadNpc: (fileName: string) => Promise<void>;
  loadGame: (index: number) => Promise<void>;
  setPlayerPosition: (x: number, y: number) => void;
  setPlayerDirection: (direction: number) => void;
  setPlayerState: (state: number) => void;
  playerGoto: (x: number, y: number) => void;
  isPlayerGotoEnd: (destination: Vector2) => boolean;
  playerGotoDir: (direction: number, steps: number) => void;
  isPlayerGotoDirEnd: () => boolean;
  playerRunTo: (x: number, y: number) => void;
  isPlayerRunToEnd: (destination: Vector2) => boolean;

  // NPC functions
  addNpc: (npcFile: string, x: number, y: number) => void;
  deleteNpc: (name: string) => void;
  getNpcPosition: (name: string) => Vector2 | null;
  setNpcPosition: (name: string, x: number, y: number) => void;
  npcGoto: (name: string, x: number, y: number) => void;
  isNpcGotoEnd: (name: string, destination: Vector2) => boolean;
  npcGotoDir: (name: string, direction: number, steps: number) => void;
  isNpcGotoDirEnd: (name: string) => boolean;
  setNpcActionFile: (name: string, stateType: number, asfFile: string) => void;
  npcSpecialAction: (name: string, asfFile: string) => void;
  isNpcSpecialActionEnd: (name: string) => boolean;
  setNpcLevel: (name: string, level: number) => void;
  setNpcDirection: (name: string, direction: number) => void;
  setNpcState: (name: string, state: number) => void;

  // Camera functions
  moveScreen: (direction: number, distance: number, speed: number) => void;
  isMoveScreenEnd: () => boolean;

  // Player functions
  addGoods: (goodsName: string, count: number) => void;
  removeGoods: (goodsName: string, count: number) => void;
  equipGoods: (equipType: number, goodsId: number) => void;
  addMoney: (amount: number) => void;
  addExp: (amount: number) => void;

  // Memo functions (任务系统)
  addMemo: (text: string) => void;
  delMemo: (text: string) => void;
  addToMemo: (memoId: number) => Promise<void>;
  delMemoById: (memoId: number) => Promise<void>;

  // Obj (interactive objects) functions
  loadObj: (fileName: string) => Promise<void>;
  addObj: (fileName: string, x: number, y: number, direction: number) => Promise<void>;

  // Trap functions
  setMapTrap: (trapIndex: number, trapFileName: string, mapName?: string) => void;

  // Game flow
  sleep: (ms: number) => void;
  playMusic: (file: string) => void;
  stopMusic: () => void;
  playSound: (file: string) => void;
  fadeIn: () => void;
  fadeOut: () => void;
  isFadeInEnd: () => boolean;
  isFadeOutEnd: () => boolean;
  changeMapColor: (r: number, g: number, b: number) => void;
  changeAsfColor: (r: number, g: number, b: number) => void;
  setLevelFile: (file: string) => void | Promise<void>;

  // Wait for user input
  waitForDialogClose: () => void;
  waitForSelection: () => void;
  getSelectionResult: () => number;

  // Script management
  runScript: (scriptFile: string) => Promise<void>;
  getCurrentMapPath: () => string;
}

/**
 * Command handler function signature
 * Returns true to continue execution, false to pause
 */
export type CommandHandler = (
  params: string[],
  result: string,
  helpers: CommandHelpers
) => Promise<boolean> | boolean;

/**
 * Helper functions available to command handlers
 */
export interface CommandHelpers {
  context: ScriptContext;
  state: ScriptState;
  variables: GameVariables;
  resolveString: (value: string) => string;
  resolveNumber: (value: string) => number;
  gotoLabel: (label: string) => void;
  endScript: () => void;
}

/**
 * Command registry type
 */
export type CommandRegistry = Map<string, CommandHandler>;
