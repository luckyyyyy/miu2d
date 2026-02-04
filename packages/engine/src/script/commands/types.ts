/**
 * Command Handler Types
 * Shared types for script command handlers
 */
import type { ScriptState, SelectionOption, Vector2 } from "../../core/types";
import type { TalkTextListManager } from "../../listManager/talkTextList";

export interface ScriptContext {
  // System access
  talkTextList: TalkTextListManager;

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
  setPlayerPosition: (x: number, y: number, characterName?: string) => void;
  setPlayerDirection: (direction: number) => void;
  setPlayerState: (state: number) => void;
  playerGoto: (x: number, y: number) => void;
  isPlayerGotoEnd: (destination: Vector2) => boolean;
  playerGotoDir: (direction: number, steps: number) => void;
  isPlayerGotoDirEnd: () => boolean;
  playerRunTo: (x: number, y: number) => void;
  isPlayerRunToEnd: (destination: Vector2) => boolean;

  // NPC functions
  addNpc: (npcFile: string, x: number, y: number, direction?: number) => void;
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
  setNpcRelation: (name: string, relation: number) => void;
  setNpcDeathScript: (name: string, scriptFile: string) => void;
  setNpcScript: (name: string, scriptFile: string) => void; // set NPC interaction script
  showNpc: (name: string, show: boolean) => void; // show/hide NPC
  mergeNpc: (npcFile: string) => Promise<void>; // merge NPC file without clearing
  saveNpc: (fileName?: string) => Promise<void>; // save NPC state
  watch: (char1: string, char2: string, watchType: number) => void; // make characters face each other
  enableNpcAI: () => void;
  disableNpcAI: () => void;

  // Camera functions
  moveScreen: (direction: number, distance: number, speed: number) => void;
  isMoveScreenEnd: () => boolean;

  // Player functions
  addGoods: (goodsName: string, count: number) => void;
  removeGoods: (goodsName: string, count: number) => void;
  equipGoods: (equipType: number, goodsId: number) => void;
  addMoney: (amount: number) => void;
  addExp: (amount: number) => void;

  // Player stats
  fullLife: () => void;
  fullMana: () => void;
  fullThew: () => void;
  addLife: (amount: number) => void;
  addMana: (amount: number) => void;
  addThew: (amount: number) => void;

  // Magic functions
  addMagic: (magicFile: string) => Promise<void>;
  setMagicLevel: (magicFile: string, level: number) => void;

  // Memo functions (任务系统)
  addMemo: (text: string) => void;
  delMemo: (text: string) => void;
  addToMemo: (memoId: number) => Promise<void>;
  delMemoById: (memoId: number) => Promise<void>;

  // Obj (interactive objects) functions
  loadObj: (fileName: string) => Promise<void>;
  addObj: (fileName: string, x: number, y: number, direction: number) => Promise<void>;
  delCurObj: () => void; // removes the object that triggered the script
  delObj: (objName: string) => void; // removes object by name
  openBox: (objName?: string) => void; // plays box opening animation
  closeBox: (objName?: string) => void; // plays box closing animation
  addRandGoods: (buyFileName: string) => Promise<void>; // adds random item from buy file
  setObjScript: (objNameOrId: string, scriptFile: string) => void; // set object script file
  saveObj: (fileName?: string) => Promise<void>; // save object state
  clearBody: () => void; // clear dead NPC bodies
  getObjPosition: (objNameOrId: string) => Vector2 | null; // Get OBJ tile position

  // Trap functions
  setMapTrap: (trapIndex: number, trapFileName: string, mapName?: string) => void;

  // Game flow
  sleep: (ms: number) => void;
  playMusic: (file: string) => void;
  stopMusic: () => void;
  playSound: (file: string, emitterPosition?: Vector2) => void;
  playMovie: (file: string) => void; // play video file
  isMovieEnd: () => boolean; // Check if movie playback finished
  fadeIn: () => void;
  fadeOut: () => void;
  isFadeInEnd: () => boolean;
  isFadeOutEnd: () => boolean;
  changeMapColor: (r: number, g: number, b: number) => void;
  changeAsfColor: (r: number, g: number, b: number) => void;
  beginRain: (fileName: string) => void; // start rain effect with config file
  endRain: () => void; // stop rain effect
  showSnow: (show: boolean) => void; // show/hide snow effect
  freeMap: () => void; // release map resources
  setLevelFile: (file: string) => Promise<void>;

  // Timer commands
  openTimeLimit: (seconds: number) => void; // start countdown
  closeTimeLimit: () => void; // stop countdown
  hideTimerWnd: () => void; // hide timer but keep running
  setTimeScript: (triggerSeconds: number, scriptFileName: string) => void; // run script at specified time

  // Input/ability control
  disableInput: () => void;
  enableInput: () => void;
  disableFight: () => void;
  enableFight: () => void;
  disableJump: () => void;
  enableJump: () => void;
  disableRun: () => void;
  enableRun: () => void;

  // Player extended commands
  playerJumpTo: (x: number, y: number) => void; // player jumps to tile
  isPlayerJumpToEnd: () => boolean; // check if jump finished
  playerGotoEx: (x: number, y: number) => void; // walk to (non-blocking)
  playerRunToEx: (x: number, y: number) => void; // run to (non-blocking)
  setPlayerScn: () => void; // center camera on player
  getMoneyNum: () => number;
  setMoneyNum: (amount: number) => void;
  getPlayerExp: () => number;
  getPlayerState: (stateName: string) => number; // GetPlayerState(Level/Attack/Defend/etc)
  getPlayerMagicLevel: (magicFile: string) => number;
  limitMana: (limit: boolean) => void;
  addMoveSpeedPercent: (percent: number) => void;
  useMagic: (magicFile: string, x?: number, y?: number) => void;
  isEquipWeapon: () => boolean;
  addAttack: (value: number, type?: number) => void;
  addDefend: (value: number, type?: number) => void;
  addEvade: (value: number) => void;
  addLifeMax: (value: number) => void;
  addManaMax: (value: number) => void;
  addThewMax: (value: number) => void;
  delMagic: (magicFile: string) => void;
  setPlayerMagicToUseWhenBeAttacked: (magicFile: string, direction: number) => void;
  setWalkIsRun: (value: number) => void;

  // NPC extended commands
  setNpcKind: (name: string, kind: number) => void;
  setNpcMagicFile: (name: string, magicFile: string) => void;
  setNpcRes: (name: string, resFile: string) => void;
  setNpcAction: (name: string, action: number, x?: number, y?: number) => void;
  setNpcActionType: (name: string, actionType: number) => void;
  setAllNpcScript: (name: string, scriptFile: string) => void;
  setAllNpcDeathScript: (name: string, scriptFile: string) => void;
  npcAttack: (name: string, x: number, y: number) => void;
  followNpc: (follower: string, target: string) => void;
  setNpcMagicToUseWhenBeAttacked: (name: string, magicFile: string, direction: number) => void;
  addNpcProperty: (name: string, property: string, value: number) => void;
  changeFlyIni: (name: string, magicFile: string) => void;
  changeFlyIni2: (name: string, magicFile: string) => void;
  addFlyInis: (name: string, magicFile: string, distance: number) => void;
  setNpcDestination: (name: string, x: number, y: number) => void;
  getNpcCount: (kind1: number, kind2: number) => number;
  setKeepAttack: (name: string, x: number, y: number) => void;

  // Goods extended commands
  buyGoods: (buyFile: string, canSellSelfGoods: boolean) => void;
  isBuyGoodsEnd: () => boolean;
  getGoodsNum: (goodsFile: string) => number;
  getGoodsNumByName: (goodsName: string) => number;
  clearGoods: () => void;
  clearMagic: () => void;
  delGoodByName: (name: string, count?: number) => void;
  checkFreeGoodsSpace: () => boolean;
  checkFreeMagicSpace: () => boolean;
  setDropIni: (name: string, dropFile: string) => void;
  enableDrop: () => void;
  disableDrop: () => void;

  // Camera extended commands
  moveScreenEx: (x: number, y: number, speed: number) => void;
  isMoveScreenExEnd: () => boolean;
  setMapPos: (x: number, y: number) => void;
  openWaterEffect: () => void;
  closeWaterEffect: () => void;

  // Save commands
  saveMapTrap: () => void;
  clearAllSave: () => void;
  enableSave: () => void;
  disableSave: () => void;

  // Variable commands
  clearAllVar: (keepsVars?: string[]) => void;
  getPartnerIdx: () => number;

  // Effect commands
  petrifyMillisecond: (ms: number) => void;
  poisonMillisecond: (ms: number) => void;
  frozenMillisecond: (ms: number) => void;

  // Misc commands
  runParallelScript: (scriptFile: string, delay?: number) => void;
  setObjOfs: (objName: string, x: number, y: number) => void;
  setShowMapPos: (show: boolean) => void;
  showSystemMsg: (msg: string, stayTime?: number) => void;
  randRun: (probability: number, script1: string, script2: string) => void;
  stopSound: () => void;

  // Dialog extended commands
  chooseEx: (
    message: string,
    options: Array<{ text: string; condition?: string }>,
    resultVar: string
  ) => void;
  chooseMultiple: (
    columns: number,
    rows: number,
    varPrefix: string,
    message: string,
    options: Array<{ text: string; condition?: string }>
  ) => void;
  isChooseExEnd: () => boolean;
  isChooseMultipleEnd: () => boolean;
  getMultiSelectionResult: () => number;
  getChooseMultipleResult: () => number[];

  // Character state commands
  toNonFightingState: () => void; // exit fighting mode

  // Wait for user input
  waitForDialogClose: () => void;
  waitForSelection: () => void;
  getSelectionResult: () => number;

  // Script management
  runScript: (scriptFile: string) => Promise<void>;
  getCurrentMapPath: () => string;
  returnToTitle: () => void;

  // Map time
  setMapTime: (time: number) => void;

  // Player change
  playerChange: (index: number) => Promise<void>;

  // Debug hooks (optional)
  onScriptStart?: (filePath: string, totalLines: number, allCodes: string[]) => void;
  onLineExecuted?: (filePath: string, lineNumber: number) => void;
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
 * 变量通过 context.getVariable/setVariable 访问，不再直接传递 variables 对象
 */
export interface CommandHelpers {
  context: ScriptContext;
  state: ScriptState;
  resolveString: (value: string) => string;
  resolveNumber: (value: string) => number;
  gotoLabel: (label: string) => void;
  endScript: () => void;
}

/**
 * Command registry type
 */
export type CommandRegistry = Map<string, CommandHandler>;
