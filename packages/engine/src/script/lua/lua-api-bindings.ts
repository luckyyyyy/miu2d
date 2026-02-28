/**
 * Lua API Bindings - Maps GameAPI to PascalCase Lua global functions
 *
 * All functions use PascalCase naming convention for Lua scripts.
 * Blocking operations (movement, dialogs, fades) are async JS functions
 * that wasmoon automatically bridges via coroutine yield/resume.
 */

import type { GameAPI } from "../api/game-api";

/**
 * Lua API function definition for documentation and autocomplete
 */
export interface LuaAPIFunction {
  /** PascalCase function name in Lua */
  name: string;
  /** Function signature for documentation */
  signature: string;
  /** Description */
  description: string;
  /** Category for grouping */
  category: string;
  /** Whether this function is blocking (async) */
  blocking?: boolean;
}

/**
 * All Lua API function definitions for Monaco autocomplete
 */
export const LUA_API_FUNCTIONS: LuaAPIFunction[] = [
  // ===== Player =====
  { name: "SetPlayerPos", signature: "(x: number, y: number, name?: string)", description: "设置玩家位置", category: "Player" },
  { name: "SetPlayerDir", signature: "(direction: number)", description: "设置玩家方向", category: "Player" },
  { name: "SetPlayerState", signature: "(state: number)", description: "设置玩家状态", category: "Player" },
  { name: "PlayerWalkTo", signature: "(x: number, y: number)", description: "玩家走到指定位置（阻塞）", category: "Player", blocking: true },
  { name: "PlayerWalkToDir", signature: "(direction: number, steps: number)", description: "玩家朝方向走指定步数（阻塞）", category: "Player", blocking: true },
  { name: "PlayerRunTo", signature: "(x: number, y: number)", description: "玩家跑到指定位置（阻塞）", category: "Player", blocking: true },
  { name: "PlayerJumpTo", signature: "(x: number, y: number)", description: "玩家跳到指定位置（阻塞）", category: "Player", blocking: true },
  { name: "PlayerWalkToNonBlocking", signature: "(x: number, y: number)", description: "玩家走到指定位置（非阻塞）", category: "Player" },
  { name: "PlayerRunToNonBlocking", signature: "(x: number, y: number)", description: "玩家跑到指定位置（非阻塞）", category: "Player" },
  { name: "CenterCamera", signature: "()", description: "摄像机居中到玩家", category: "Player" },
  { name: "SetWalkIsRun", signature: "(value: number)", description: "设置走路为跑步", category: "Player" },
  { name: "ToNonFightingState", signature: "()", description: "退出战斗状态", category: "Player" },
  { name: "PlayerChange", signature: "(index: number)", description: "切换角色（阻塞）", category: "Player", blocking: true },
  { name: "GetMoney", signature: "(): number", description: "获取金钱", category: "Player" },
  { name: "SetMoney", signature: "(amount: number)", description: "设置金钱", category: "Player" },
  { name: "AddMoney", signature: "(amount: number)", description: "增加金钱", category: "Player" },
  { name: "GetExp", signature: "(): number", description: "获取经验", category: "Player" },
  { name: "AddExp", signature: "(amount: number)", description: "增加经验", category: "Player" },
  { name: "GetPlayerStat", signature: "(name: string): number", description: "获取玩家属性", category: "Player" },
  { name: "FullLife", signature: "()", description: "满血", category: "Player" },
  { name: "FullMana", signature: "()", description: "满蓝", category: "Player" },
  { name: "FullThew", signature: "()", description: "满体力", category: "Player" },
  { name: "AddLife", signature: "(amount: number)", description: "增加生命", category: "Player" },
  { name: "AddMana", signature: "(amount: number)", description: "增加法力", category: "Player" },
  { name: "AddThew", signature: "(amount: number)", description: "增加体力", category: "Player" },
  { name: "AddLifeMax", signature: "(value: number)", description: "增加生命上限", category: "Player" },
  { name: "AddManaMax", signature: "(value: number)", description: "增加法力上限", category: "Player" },
  { name: "AddThewMax", signature: "(value: number)", description: "增加体力上限", category: "Player" },
  { name: "AddAttack", signature: "(value: number, type?: number)", description: "增加攻击力", category: "Player" },
  { name: "AddDefend", signature: "(value: number, type?: number)", description: "增加防御力", category: "Player" },
  { name: "AddEvade", signature: "(value: number)", description: "增加闪避", category: "Player" },
  { name: "LimitMana", signature: "(limit: boolean)", description: "限制法力", category: "Player" },
  { name: "AddMoveSpeedPercent", signature: "(percent: number)", description: "增加移速百分比", category: "Player" },
  { name: "IsEquipWeapon", signature: "(): boolean", description: "是否装备武器", category: "Player" },
  { name: "GetPlayerLevel", signature: "(): number", description: "获取玩家等级", category: "Player" },
  { name: "SetPlayerLevel", signature: "(level: number)", description: "设置玩家等级", category: "Player" },
  { name: "SetFightEnabled", signature: "(enabled: boolean)", description: "设置是否可战斗", category: "Player" },
  { name: "SetJumpEnabled", signature: "(enabled: boolean)", description: "设置是否可跳跃", category: "Player" },
  { name: "SetRunEnabled", signature: "(enabled: boolean)", description: "设置是否可跑步", category: "Player" },
  { name: "SetPlayerMagicWhenAttacked", signature: "(magicFile: string, direction: number)", description: "设置受击武功", category: "Player" },
  { name: "SavePlayerSnapshot", signature: "(key: string)", description: "保存玩家快照", category: "Player" },
  { name: "LoadPlayerSnapshot", signature: "(key: string)", description: "加载玩家快照", category: "Player" },

  // ===== NPC =====
  { name: "AddNpc", signature: "(npcFile: string, x: number, y: number, dir?: number)", description: "添加 NPC（阻塞）", category: "NPC", blocking: true },
  { name: "DeleteNpc", signature: "(name: string)", description: "删除 NPC", category: "NPC" },
  { name: "GetNpcPos", signature: "(name: string): {x, y} | nil", description: "获取 NPC 位置", category: "NPC" },
  { name: "SetNpcPos", signature: "(name: string, x: number, y: number)", description: "设置 NPC 位置", category: "NPC" },
  { name: "NpcWalkTo", signature: "(name: string, x: number, y: number)", description: "NPC 走到指定位置（阻塞）", category: "NPC", blocking: true },
  { name: "NpcWalkToDir", signature: "(name: string, dir: number, steps: number)", description: "NPC 朝方向走（阻塞）", category: "NPC", blocking: true },
  { name: "SetNpcActionFile", signature: "(name: string, stateType: number, asfFile: string)", description: "设置 NPC 动作文件（阻塞）", category: "NPC", blocking: true },
  { name: "NpcSpecialAction", signature: "(name: string, asfFile: string)", description: "NPC 特殊动作（阻塞）", category: "NPC", blocking: true },
  { name: "NpcSpecialActionNonBlocking", signature: "(name: string, asfFile: string)", description: "NPC 特殊动作（非阻塞）", category: "NPC" },
  { name: "NpcWalkToNonBlocking", signature: "(name: string, x: number, y: number)", description: "NPC 走到指定位置（非阻塞）", category: "NPC" },
  { name: "SetNpcLevel", signature: "(name: string, level: number)", description: "设置 NPC 等级", category: "NPC" },
  { name: "SetNpcDir", signature: "(name: string, direction: number)", description: "设置 NPC 方向", category: "NPC" },
  { name: "SetNpcState", signature: "(name: string, state: number)", description: "设置 NPC 状态", category: "NPC" },
  { name: "SetNpcRelation", signature: "(name: string, relation: number)", description: "设置 NPC 关系", category: "NPC" },
  { name: "SetNpcDeathScript", signature: "(name: string, scriptFile: string)", description: "设置 NPC 死亡脚本", category: "NPC" },
  { name: "SetNpcScript", signature: "(name: string, scriptFile: string)", description: "设置 NPC 脚本", category: "NPC" },
  { name: "ShowNpc", signature: "(name: string, visible: boolean)", description: "显示/隐藏 NPC", category: "NPC" },
  { name: "MergeNpc", signature: "(npcFile: string)", description: "合并 NPC 文件（阻塞）", category: "NPC", blocking: true },
  { name: "SaveNpc", signature: "(fileName?: string)", description: "保存 NPC（阻塞）", category: "NPC", blocking: true },
  { name: "NpcWatch", signature: "(char1: string, char2: string, watchType: number)", description: "NPC 注视", category: "NPC" },
  { name: "SetNpcAIEnabled", signature: "(enabled: boolean)", description: "设置 NPC AI 开关", category: "NPC" },
  { name: "SetNpcKind", signature: "(name: string, kind: number)", description: "设置 NPC 类型", category: "NPC" },
  { name: "SetNpcMagicFile", signature: "(name: string, magicFile: string)", description: "设置 NPC 武功文件", category: "NPC" },
  { name: "SetNpcResource", signature: "(name: string, resFile: string)", description: "设置 NPC 资源", category: "NPC" },
  { name: "SetNpcAction", signature: "(name: string, action: number, x?: number, y?: number)", description: "设置 NPC 动作", category: "NPC" },
  { name: "SetNpcActionType", signature: "(name: string, actionType: number)", description: "设置 NPC 动作类型", category: "NPC" },
  { name: "SetAllNpcScript", signature: "(name: string, scriptFile: string)", description: "设置所有 NPC 脚本", category: "NPC" },
  { name: "SetAllNpcDeathScript", signature: "(name: string, scriptFile: string)", description: "设置所有 NPC 死亡脚本", category: "NPC" },
  { name: "NpcAttack", signature: "(name: string, x: number, y: number)", description: "NPC 攻击", category: "NPC" },
  { name: "NpcFollow", signature: "(follower: string, target: string)", description: "NPC 跟随", category: "NPC" },
  { name: "SetNpcMagicWhenAttacked", signature: "(name: string, magicFile: string, dir: number)", description: "设置 NPC 受击武功", category: "NPC" },
  { name: "AddNpcProperty", signature: "(name: string, property: string, value: number)", description: "增加 NPC 属性", category: "NPC" },
  { name: "AddNpcMagic", signature: "(name: string, magicFile: string)", description: "添加 NPC 武功（阻塞）", category: "NPC", blocking: true },
  { name: "SetNpcMagicLevel", signature: "(name: string, magicFile: string, level: number)", description: "设置 NPC 武功等级", category: "NPC" },
  { name: "SetNpcClickScript", signature: "(name: string, scriptFile: string)", description: "设置 NPC 点击脚本", category: "NPC" },
  { name: "ChangeNpcLife", signature: "(name: string, amount: number)", description: "改变 NPC 生命", category: "NPC" },
  { name: "ChangeNpcMana", signature: "(name: string, amount: number)", description: "改变 NPC 法力", category: "NPC" },
  { name: "ChangeNpcThew", signature: "(name: string, amount: number)", description: "改变 NPC 体力", category: "NPC" },
  { name: "ChangeNpcFlyIni", signature: "(name: string, magicFile: string)", description: "修改 NPC 飞行配置", category: "NPC" },
  { name: "ChangeNpcFlyIni2", signature: "(name: string, magicFile: string)", description: "修改 NPC 飞行配置2", category: "NPC" },
  { name: "AddNpcFlyInis", signature: "(name: string, magicFile: string, distance: number)", description: "添加 NPC 飞行配置", category: "NPC" },
  { name: "SetNpcDestination", signature: "(name: string, x: number, y: number)", description: "设置 NPC 目标位置", category: "NPC" },
  { name: "GetNpcCount", signature: "(kind1: number, kind2: number): number", description: "获取 NPC 数量", category: "NPC" },
  { name: "SetNpcKeepAttack", signature: "(name: string, x: number, y: number)", description: "设置 NPC 持续攻击", category: "NPC" },

  // ===== Goods =====
  { name: "AddGoods", signature: "(goodsName: string, count: number)", description: "添加物品", category: "Goods" },
  { name: "RemoveGoods", signature: "(goodsName: string, count: number)", description: "移除物品", category: "Goods" },
  { name: "EquipGoods", signature: "(goodListIndex: number)", description: "装备物品", category: "Goods" },
  { name: "GetGoodsCountByFile", signature: "(goodsFile: string): number", description: "按文件获取物品数量", category: "Goods" },
  { name: "GetGoodsCountByName", signature: "(goodsName: string): number", description: "按名称获取物品数量", category: "Goods" },
  { name: "ClearGoods", signature: "()", description: "清空物品", category: "Goods" },
  { name: "DeleteGoodsByName", signature: "(name: string, count?: number)", description: "按名称删除物品", category: "Goods" },
  { name: "HasGoodsFreeSpace", signature: "(): boolean", description: "是否有空闲物品栏", category: "Goods" },
  { name: "AddRandomGoods", signature: "(buyFileName: string)", description: "随机添加物品（阻塞）", category: "Goods", blocking: true },
  { name: "BuyGoods", signature: "(buyFile: string, canSellSelfGoods: boolean)", description: "购买物品（阻塞）", category: "Goods", blocking: true },
  { name: "SetDropIni", signature: "(name: string, dropFile: string)", description: "设置掉落配置", category: "Goods" },
  { name: "SetDropEnabled", signature: "(enabled: boolean)", description: "设置掉落开关", category: "Goods" },
  { name: "SaveGoodsSnapshot", signature: "(key: string)", description: "保存物品快照", category: "Goods" },
  { name: "LoadGoodsSnapshot", signature: "(key: string)", description: "加载物品快照", category: "Goods" },

  // ===== Magic =====
  { name: "AddMagic", signature: "(magicFile: string)", description: "添加武功（阻塞）", category: "Magic", blocking: true },
  { name: "DeleteMagic", signature: "(magicFile: string)", description: "删除武功", category: "Magic" },
  { name: "SetMagicLevel", signature: "(magicFile: string, level: number)", description: "设置武功等级", category: "Magic" },
  { name: "GetMagicLevel", signature: "(magicFile: string): number", description: "获取武功等级", category: "Magic" },
  { name: "ClearMagic", signature: "()", description: "清空武功", category: "Magic" },
  { name: "HasMagicFreeSpace", signature: "(): boolean", description: "是否有空闲武功栏", category: "Magic" },
  { name: "UseMagic", signature: "(magicFile: string, x?: number, y?: number)", description: "使用武功", category: "Magic" },

  // ===== Memo =====
  { name: "AddMemo", signature: "(text: string)", description: "添加备忘录", category: "Memo" },
  { name: "DeleteMemo", signature: "(text: string)", description: "删除备忘录", category: "Memo" },
  { name: "AddMemoById", signature: "(id: number)", description: "按 ID 添加备忘录（阻塞）", category: "Memo", blocking: true },
  { name: "DeleteMemoById", signature: "(id: number)", description: "按 ID 删除备忘录（阻塞）", category: "Memo", blocking: true },

  // ===== Map =====
  { name: "LoadMap", signature: "(mapName: string)", description: "加载地图（阻塞）", category: "Map", blocking: true },
  { name: "LoadMapNpc", signature: "(fileName: string)", description: "加载地图 NPC 文件（阻塞）", category: "Map", blocking: true },
  { name: "FreeMap", signature: "()", description: "释放地图", category: "Map" },
  { name: "GetCurrentMapPath", signature: "(): string", description: "获取当前地图路径", category: "Map" },
  { name: "SetMapTime", signature: "(time: number)", description: "设置地图时间", category: "Map" },
  { name: "SetTrap", signature: "(trapIndex: number, trapFileName: string, mapName?: string)", description: "设置陷阱", category: "Map" },
  { name: "SaveTrap", signature: "()", description: "保存陷阱", category: "Map" },

  // ===== Obj =====
  { name: "LoadObj", signature: "(fileName: string)", description: "加载物体文件（阻塞）", category: "Obj", blocking: true },
  { name: "AddObj", signature: "(fileName: string, x: number, y: number, direction: number)", description: "添加物体（阻塞）", category: "Obj", blocking: true },
  { name: "DeleteCurrentObj", signature: "()", description: "删除当前物体", category: "Obj" },
  { name: "DeleteObj", signature: "(nameOrId: string)", description: "删除物体", category: "Obj" },
  { name: "OpenBox", signature: "(nameOrId?: string)", description: "打开箱子", category: "Obj" },
  { name: "CloseBox", signature: "(nameOrId?: string)", description: "关闭箱子", category: "Obj" },
  { name: "SetObjScript", signature: "(nameOrId: string, scriptFile: string)", description: "设置物体脚本", category: "Obj" },
  { name: "SaveObj", signature: "(fileName?: string)", description: "保存物体（阻塞）", category: "Obj", blocking: true },
  { name: "ClearBody", signature: "()", description: "清除尸体", category: "Obj" },
  { name: "GetObjPos", signature: "(nameOrId: string): {x, y} | nil", description: "获取物体位置", category: "Obj" },
  { name: "SetObjOffset", signature: "(objName: string, x: number, y: number)", description: "设置物体偏移", category: "Obj" },
  { name: "SetObjKind", signature: "(objName: string, kind: number)", description: "设置物体类型", category: "Obj" },

  // ===== Camera =====
  { name: "CameraMove", signature: "(direction: number, distance: number, speed: number)", description: "摄像机移动（阻塞）", category: "Camera", blocking: true },
  { name: "CameraMoveTo", signature: "(x: number, y: number, speed: number)", description: "摄像机移到指定位置（阻塞）", category: "Camera", blocking: true },
  { name: "SetCameraPos", signature: "(x: number, y: number)", description: "设置摄像机位置", category: "Camera" },
  { name: "OpenWaterEffect", signature: "()", description: "开启水面效果", category: "Camera" },
  { name: "CloseWaterEffect", signature: "()", description: "关闭水面效果", category: "Camera" },

  // ===== Audio =====
  { name: "PlayMusic", signature: "(file: string)", description: "播放音乐", category: "Audio" },
  { name: "StopMusic", signature: "()", description: "停止音乐", category: "Audio" },
  { name: "PlaySound", signature: "(file: string)", description: "播放音效", category: "Audio" },
  { name: "StopSound", signature: "()", description: "停止音效", category: "Audio" },
  { name: "PlayMovie", signature: "(file: string)", description: "播放视频（阻塞）", category: "Audio", blocking: true },

  // ===== Effects =====
  { name: "FadeIn", signature: "()", description: "淡入（阻塞）", category: "Effect", blocking: true },
  { name: "FadeOut", signature: "()", description: "淡出（阻塞）", category: "Effect", blocking: true },
  { name: "ChangeMapColor", signature: "(r: number, g: number, b: number)", description: "改变地图颜色", category: "Effect" },
  { name: "ChangeSpriteColor", signature: "(r: number, g: number, b: number)", description: "改变精灵颜色", category: "Effect" },
  { name: "BeginRain", signature: "(fileName: string)", description: "开始下雨", category: "Effect" },
  { name: "EndRain", signature: "()", description: "停止下雨", category: "Effect" },
  { name: "ShowSnow", signature: "(show: boolean)", description: "显示/隐藏雪", category: "Effect" },
  { name: "ShowRandomSnow", signature: "()", description: "显示随机雪", category: "Effect" },
  { name: "SetMainLum", signature: "(level: number)", description: "设置主亮度", category: "Effect" },
  { name: "SetPlayerLum", signature: "(level: number)", description: "设置玩家亮度", category: "Effect" },
  { name: "SetFadeLum", signature: "(level: number)", description: "设置淡入淡出亮度", category: "Effect" },
  { name: "Petrify", signature: "(ms: number)", description: "石化效果", category: "Effect" },
  { name: "Poison", signature: "(ms: number)", description: "中毒效果", category: "Effect" },
  { name: "Frozen", signature: "(ms: number)", description: "冰冻效果", category: "Effect" },
  { name: "ClearEffect", signature: "()", description: "清除效果", category: "Effect" },
  { name: "MoveMagic", signature: "(magicFile: string, direction: number)", description: "移动武功特效", category: "Effect" },
  { name: "SetLevelFile", signature: "(file: string)", description: "设置等级文件（阻塞）", category: "Effect", blocking: true },

  // ===== Dialog =====
  { name: "Say",  signature: "(text: string, portrait?: number)", description: "显示对话（阻塞，退出战斗状态）", category: "Dialog", blocking: true },
  { name: "Talk", signature: "(text: string, portrait?: number)", description: "显示对话（阻塞，与 Say 相同，text 在前）", category: "Dialog", blocking: true },
  { name: "ShowTalk", signature: "(startId: number, endId: number)", description: "显示对话段（阻塞，退出战斗状态）", category: "Dialog", blocking: true },
  { name: "ShowMessage", signature: "(text: string)", description: "显示消息", category: "Dialog" },
  { name: "Choose", signature: "(message: string, selectA: string, selectB: string): number", description: "二选一（阻塞）", category: "Dialog", blocking: true },
  { name: "ShowSystemMessage", signature: "(msg: string, stayTime?: number)", description: "显示系统消息", category: "Dialog" },

  // ===== Timer =====
  { name: "OpenTimer", signature: "(seconds: number)", description: "打开计时器", category: "Timer" },
  { name: "CloseTimer", signature: "()", description: "关闭计时器", category: "Timer" },
  { name: "HideTimer", signature: "()", description: "隐藏计时器", category: "Timer" },
  { name: "SetTimerScript", signature: "(triggerSeconds: number, scriptFile: string)", description: "设置计时器脚本", category: "Timer" },

  // ===== Variables =====
  { name: "GetVar", signature: "(name: string): number", description: "获取脚本变量", category: "Variable" },
  { name: "SetVar", signature: "(name: string, value: number)", description: "设置脚本变量", category: "Variable" },
  { name: "ClearAllVars", signature: "()", description: "清空所有变量", category: "Variable" },
  { name: "GetPartnerIndex", signature: "(): number", description: "获取伙伴索引", category: "Variable" },

  // ===== Input =====
  { name: "SetInputEnabled", signature: "(enabled: boolean)", description: "设置输入开关", category: "Input" },

  // ===== Save =====
  { name: "SetSaveEnabled", signature: "(enabled: boolean)", description: "设置存档开关", category: "Save" },
  { name: "ClearAllSaves", signature: "()", description: "清空所有存档", category: "Save" },

  // ===== Script Runner =====
  { name: "RunScript", signature: "(scriptFile: string)", description: "运行脚本（阻塞）", category: "Script", blocking: true },
  { name: "RunParallelScript", signature: "(scriptFile: string, delay?: number)", description: "运行并行脚本", category: "Script" },
  { name: "ReturnToTitle", signature: "()", description: "返回标题", category: "Script" },
  { name: "Sleep", signature: "(ms: number)", description: "等待指定毫秒（阻塞）", category: "Script", blocking: true },
  { name: "LoadGame", signature: "(index: number)", description: "加载存档（阻塞）", category: "Script", blocking: true },
  { name: "SetInterfaceVisible", signature: "(visible: boolean)", description: "设置界面可见性", category: "Script" },
  { name: "SaveGame", signature: "()", description: "保存游戏", category: "Script" },
  { name: "UpdateState", signature: "()", description: "更新状态", category: "Script" },
  { name: "ShowGamble", signature: "(cost: number, npcType: number): boolean", description: "显示赌博（阻塞）", category: "Script", blocking: true },
];

/**
 * Register all GameAPI methods as PascalCase Lua global functions
 */
export function registerLuaAPIBindings(
  setGlobal: (name: string, value: unknown) => void,
  api: GameAPI,
): void {
  // ===== Player =====
  setGlobal("SetPlayerPos", (x: number, y: number, name?: string) => api.player.setPosition(x, y, name));
  setGlobal("SetPlayerDir", (dir: number) => api.player.setDirection(dir));
  setGlobal("SetPlayerState", (state: number) => api.player.setState(state));
  setGlobal("PlayerWalkTo", (x: number, y: number) => api.player.walkTo(x, y));
  setGlobal("PlayerWalkToDir", (dir: number, steps: number) => api.player.walkToDir(dir, steps));
  setGlobal("PlayerRunTo", (x: number, y: number) => api.player.runTo(x, y));
  setGlobal("PlayerJumpTo", (x: number, y: number) => api.player.jumpTo(x, y));
  setGlobal("PlayerWalkToNonBlocking", (x: number, y: number) => api.player.walkToNonBlocking(x, y));
  setGlobal("PlayerRunToNonBlocking", (x: number, y: number) => api.player.runToNonBlocking(x, y));
  setGlobal("CenterCamera", () => api.player.centerCamera());
  setGlobal("SetWalkIsRun", (value: number) => api.player.setWalkIsRun(value));
  setGlobal("ToNonFightingState", () => api.player.toNonFightingState());
  setGlobal("PlayerChange", (index: number) => api.player.change(index));
  setGlobal("GetMoney", () => api.player.getMoney());
  setGlobal("SetMoney", (amount: number) => api.player.setMoney(amount));
  setGlobal("AddMoney", (amount: number) => api.player.addMoney(amount));
  setGlobal("GetExp", () => api.player.getExp());
  setGlobal("AddExp", (amount: number) => api.player.addExp(amount));
  setGlobal("GetPlayerStat", (name: string) => api.player.getStat(name));
  setGlobal("FullLife", () => api.player.fullLife());
  setGlobal("FullMana", () => api.player.fullMana());
  setGlobal("FullThew", () => api.player.fullThew());
  setGlobal("AddLife", (amount: number) => api.player.addLife(amount));
  setGlobal("AddMana", (amount: number) => api.player.addMana(amount));
  setGlobal("AddThew", (amount: number) => api.player.addThew(amount));
  setGlobal("AddLifeMax", (value: number) => api.player.addLifeMax(value));
  setGlobal("AddManaMax", (value: number) => api.player.addManaMax(value));
  setGlobal("AddThewMax", (value: number) => api.player.addThewMax(value));
  setGlobal("AddAttack", (value: number, type?: number) => api.player.addAttack(value, type));
  setGlobal("AddDefend", (value: number, type?: number) => api.player.addDefend(value, type));
  setGlobal("AddEvade", (value: number) => api.player.addEvade(value));
  setGlobal("LimitMana", (limit: boolean) => api.player.limitMana(limit));
  setGlobal("AddMoveSpeedPercent", (percent: number) => api.player.addMoveSpeedPercent(percent));
  setGlobal("IsEquipWeapon", () => api.player.isEquipWeapon());
  setGlobal("GetPlayerLevel", () => api.player.getLevel());
  setGlobal("SetPlayerLevel", (level: number) => api.player.setLevel(level));
  setGlobal("SetFightEnabled", (enabled: boolean) => api.player.setFightEnabled(enabled));
  setGlobal("SetJumpEnabled", (enabled: boolean) => api.player.setJumpEnabled(enabled));
  setGlobal("SetRunEnabled", (enabled: boolean) => api.player.setRunEnabled(enabled));
  setGlobal("SetPlayerMagicWhenAttacked", (magicFile: string, dir: number) => api.player.setMagicWhenAttacked(magicFile, dir));
  setGlobal("SavePlayerSnapshot", (key: string) => api.player.saveSnapshot(key));
  setGlobal("LoadPlayerSnapshot", (key: string) => api.player.loadSnapshot(key));

  // ===== NPC =====
  setGlobal("AddNpc", (npcFile: string, x: number, y: number, dir?: number) => api.npc.add(npcFile, x, y, dir));
  setGlobal("DeleteNpc", (name: string) => api.npc.delete(name));
  setGlobal("GetNpcPos", (name: string) => api.npc.getPosition(name));
  setGlobal("SetNpcPos", (name: string, x: number, y: number) => api.npc.setPosition(name, x, y));
  setGlobal("NpcWalkTo", (name: string, x: number, y: number) => api.npc.walkTo(name, x, y));
  setGlobal("NpcWalkToDir", (name: string, dir: number, steps: number) => api.npc.walkToDir(name, dir, steps));
  setGlobal("SetNpcActionFile", (name: string, stateType: number, asfFile: string) => api.npc.setActionFile(name, stateType, asfFile));
  setGlobal("NpcSpecialAction", (name: string, asfFile: string) => api.npc.specialAction(name, asfFile));
  setGlobal("NpcSpecialActionNonBlocking", (name: string, asfFile: string) => api.npc.specialActionNonBlocking(name, asfFile));
  setGlobal("NpcWalkToNonBlocking", (name: string, x: number, y: number) => api.npc.walkToNonBlocking(name, x, y));
  setGlobal("SetNpcLevel", (name: string, level: number) => api.npc.setLevel(name, level));
  setGlobal("SetNpcDir", (name: string, dir: number) => api.npc.setDirection(name, dir));
  setGlobal("SetNpcState", (name: string, state: number) => api.npc.setState(name, state));
  setGlobal("SetNpcRelation", (name: string, relation: number) => api.npc.setRelation(name, relation));
  setGlobal("SetNpcDeathScript", (name: string, scriptFile: string) => api.npc.setDeathScript(name, scriptFile));
  setGlobal("SetNpcScript", (name: string, scriptFile: string) => api.npc.setScript(name, scriptFile));
  setGlobal("ShowNpc", (name: string, visible: boolean) => api.npc.show(name, visible));
  setGlobal("MergeNpc", (npcFile: string) => api.npc.merge(npcFile));
  setGlobal("SaveNpc", (fileName?: string) => api.npc.save(fileName));
  setGlobal("NpcWatch", (char1: string, char2: string, watchType: number) => api.npc.watch(char1, char2, watchType));
  setGlobal("SetNpcAIEnabled", (enabled: boolean) => api.npc.setAIEnabled(enabled));
  setGlobal("SetNpcKind", (name: string, kind: number) => api.npc.setKind(name, kind));
  setGlobal("SetNpcMagicFile", (name: string, magicFile: string) => api.npc.setMagicFile(name, magicFile));
  setGlobal("SetNpcResource", (name: string, resFile: string) => api.npc.setResource(name, resFile));
  setGlobal("SetNpcAction", (name: string, action: number, x?: number, y?: number) => api.npc.setAction(name, action, x, y));
  setGlobal("SetNpcActionType", (name: string, actionType: number) => api.npc.setActionType(name, actionType));
  setGlobal("SetAllNpcScript", (name: string, scriptFile: string) => api.npc.setAllScript(name, scriptFile));
  setGlobal("SetAllNpcDeathScript", (name: string, scriptFile: string) => api.npc.setAllDeathScript(name, scriptFile));
  setGlobal("NpcAttack", (name: string, x: number, y: number) => api.npc.attack(name, x, y));
  setGlobal("NpcFollow", (follower: string, target: string) => api.npc.follow(follower, target));
  setGlobal("SetNpcMagicWhenAttacked", (name: string, magicFile: string, dir: number) => api.npc.setMagicWhenAttacked(name, magicFile, dir));
  setGlobal("AddNpcProperty", (name: string, property: string, value: number) => api.npc.addProperty(name, property, value));
  setGlobal("AddNpcMagic", (name: string, magicFile: string) => api.npc.addMagic(name, magicFile));
  setGlobal("SetNpcMagicLevel", (name: string, magicFile: string, level: number) => api.npc.setMagicLevel(name, magicFile, level));
  setGlobal("SetNpcClickScript", (name: string, scriptFile: string) => api.npc.setClickScript(name, scriptFile));
  setGlobal("ChangeNpcLife", (name: string, amount: number) => api.npc.changeLife(name, amount));
  setGlobal("ChangeNpcMana", (name: string, amount: number) => api.npc.changeMana(name, amount));
  setGlobal("ChangeNpcThew", (name: string, amount: number) => api.npc.changeThew(name, amount));
  setGlobal("ChangeNpcFlyIni", (name: string, magicFile: string) => api.npc.changeFlyIni(name, magicFile));
  setGlobal("ChangeNpcFlyIni2", (name: string, magicFile: string) => api.npc.changeFlyIni2(name, magicFile));
  setGlobal("AddNpcFlyInis", (name: string, magicFile: string, distance: number) => api.npc.addFlyInis(name, magicFile, distance));
  setGlobal("SetNpcDestination", (name: string, x: number, y: number) => api.npc.setDestination(name, x, y));
  setGlobal("GetNpcCount", (kind1: number, kind2: number) => api.npc.getCount(kind1, kind2));
  setGlobal("SetNpcKeepAttack", (name: string, x: number, y: number) => api.npc.setKeepAttack(name, x, y));

  // ===== Goods =====
  setGlobal("AddGoods", (goodsName: string, count: number) => api.goods.add(goodsName, count));
  setGlobal("RemoveGoods", (goodsName: string, count: number) => api.goods.remove(goodsName, count));
  setGlobal("EquipGoods", (goodListIndex: number) => api.goods.equip(goodListIndex));
  setGlobal("GetGoodsCountByFile", (goodsFile: string) => api.goods.getCountByFile(goodsFile));
  setGlobal("GetGoodsCountByName", (goodsName: string) => api.goods.getCountByName(goodsName));
  setGlobal("ClearGoods", () => api.goods.clear());
  setGlobal("DeleteGoodsByName", (name: string, count?: number) => api.goods.deleteByName(name, count));
  setGlobal("HasGoodsFreeSpace", () => api.goods.hasFreeSpace());
  setGlobal("AddRandomGoods", (buyFileName: string) => api.goods.addRandom(buyFileName));
  setGlobal("BuyGoods", (buyFile: string, canSellSelfGoods: boolean) => api.goods.buy(buyFile, canSellSelfGoods));
  setGlobal("SetDropIni", (name: string, dropFile: string) => api.goods.setDropIni(name, dropFile));
  setGlobal("SetDropEnabled", (enabled: boolean) => api.goods.setDropEnabled(enabled));
  setGlobal("SaveGoodsSnapshot", (key: string) => api.goods.saveSnapshot(key));
  setGlobal("LoadGoodsSnapshot", (key: string) => api.goods.loadSnapshot(key));

  // ===== Magic =====
  setGlobal("AddMagic", (magicFile: string) => api.magic.add(magicFile));
  setGlobal("DeleteMagic", (magicFile: string) => api.magic.delete(magicFile));
  setGlobal("SetMagicLevel", (magicFile: string, level: number) => api.magic.setLevel(magicFile, level));
  setGlobal("GetMagicLevel", (magicFile: string) => api.magic.getLevel(magicFile));
  setGlobal("ClearMagic", () => api.magic.clear());
  setGlobal("HasMagicFreeSpace", () => api.magic.hasFreeSpace());
  setGlobal("UseMagic", (magicFile: string, x?: number, y?: number) => api.magic.use(magicFile, x, y));

  // ===== Memo =====
  setGlobal("AddMemo", (text: string) => api.memo.add(text));
  setGlobal("DeleteMemo", (text: string) => api.memo.delete(text));
  setGlobal("AddMemoById", (id: number) => api.memo.addById(id));
  setGlobal("DeleteMemoById", (id: number) => api.memo.deleteById(id));

  // ===== Map =====
  setGlobal("LoadMap", (mapName: string) => api.map.load(mapName));
  setGlobal("LoadMapNpc", (fileName: string) => api.map.loadNpc(fileName));
  setGlobal("FreeMap", () => api.map.free());
  setGlobal("GetCurrentMapPath", () => api.map.getCurrentPath());
  setGlobal("SetMapTime", (time: number) => api.map.setTime(time));
  setGlobal("SetTrap", (trapIndex: number, trapFileName: string, mapName?: string) => api.map.setTrap(trapIndex, trapFileName, mapName));
  setGlobal("SaveTrap", () => api.map.saveTrap());

  // ===== Obj =====
  setGlobal("LoadObj", (fileName: string) => api.obj.load(fileName));
  setGlobal("AddObj", (fileName: string, x: number, y: number, dir: number) => api.obj.add(fileName, x, y, dir));
  setGlobal("DeleteCurrentObj", () => api.obj.deleteCurrent());
  setGlobal("DeleteObj", (nameOrId: string) => api.obj.delete(nameOrId));
  setGlobal("OpenBox", (nameOrId?: string) => api.obj.openBox(nameOrId));
  setGlobal("CloseBox", (nameOrId?: string) => api.obj.closeBox(nameOrId));
  setGlobal("SetObjScript", (nameOrId: string, scriptFile: string) => api.obj.setScript(nameOrId, scriptFile));
  setGlobal("SaveObj", (fileName?: string) => api.obj.save(fileName));
  setGlobal("ClearBody", () => api.obj.clearBody());
  setGlobal("GetObjPos", (nameOrId: string) => api.obj.getPosition(nameOrId));
  setGlobal("SetObjOffset", (objName: string, x: number, y: number) => api.obj.setOffset(objName, x, y));
  setGlobal("SetObjKind", (objName: string, kind: number) => api.obj.setKind(objName, kind));

  // ===== Camera =====
  setGlobal("CameraMove", (dir: number, distance: number, speed: number) => api.camera.move(dir, distance, speed));
  setGlobal("CameraMoveTo", (x: number, y: number, speed: number) => api.camera.moveTo(x, y, speed));
  setGlobal("SetCameraPos", (x: number, y: number) => api.camera.setPosition(x, y));
  setGlobal("OpenWaterEffect", () => api.camera.openWaterEffect());
  setGlobal("CloseWaterEffect", () => api.camera.closeWaterEffect());

  // ===== Audio =====
  setGlobal("PlayMusic", (file: string) => api.audio.playMusic(file));
  setGlobal("StopMusic", () => api.audio.stopMusic());
  setGlobal("PlaySound", (file: string) => api.audio.playSound(file));
  setGlobal("StopSound", () => api.audio.stopSound());
  setGlobal("PlayMovie", (file: string) => api.audio.playMovie(file));

  // ===== Effects =====
  setGlobal("FadeIn", () => api.effects.fadeIn());
  setGlobal("FadeOut", () => api.effects.fadeOut());
  setGlobal("ChangeMapColor", (r: number, g: number, b: number) => api.effects.changeMapColor(r, g, b));
  setGlobal("ChangeSpriteColor", (r: number, g: number, b: number) => api.effects.changeSpriteColor(r, g, b));
  setGlobal("BeginRain", (fileName: string) => api.effects.beginRain(fileName));
  setGlobal("EndRain", () => api.effects.endRain());
  setGlobal("ShowSnow", (show: boolean) => api.effects.showSnow(show));
  setGlobal("ShowRandomSnow", () => api.effects.showRandomSnow());
  setGlobal("SetMainLum", (level: number) => api.effects.setMainLum(level));
  setGlobal("SetPlayerLum", (level: number) => api.effects.setPlayerLum(level));
  setGlobal("SetFadeLum", (level: number) => api.effects.setFadeLum(level));
  setGlobal("Petrify", (ms: number) => api.effects.petrify(ms));
  setGlobal("Poison", (ms: number) => api.effects.poison(ms));
  setGlobal("Frozen", (ms: number) => api.effects.frozen(ms));
  setGlobal("ClearEffect", () => api.effects.clearEffect());
  setGlobal("MoveMagic", (magicFile: string, dir: number) => api.effects.moveMagic(magicFile, dir));
  setGlobal("SetLevelFile", (file: string) => api.effects.setLevelFile(file));

  // ===== Dialog =====
  // Say(text, portrait?) — text first, portrait optional (same order as DSL sayCommand)
  // Talk(text, portrait?) — same as Say for Lua convenience; consistent text-first convention
  setGlobal("Say", async (text: string, portraitIndex?: number) => {
    api.player.toNonFightingState();
    return api.dialog.show(text, portraitIndex ?? 0);
  });
  setGlobal("Talk", async (text: string, portraitIndex?: number) => {
    api.player.toNonFightingState();
    return api.dialog.show(text, portraitIndex ?? 0);
  });
  setGlobal("ShowTalk", (startId: number, endId: number) => {
    api.player.toNonFightingState();
    return api.dialog.showTalk(startId, endId);
  });
  setGlobal("ShowMessage", (text: string) => api.dialog.showMessage(text));
  setGlobal("Choose", (message: string, selectA: string, selectB: string) => api.dialog.showSelection(message, selectA, selectB));
  setGlobal("ShowSystemMessage", (msg: string, stayTime?: number) => api.dialog.showSystemMessage(msg, stayTime));

  // ===== Timer =====
  setGlobal("OpenTimer", (seconds: number) => api.timer.open(seconds));
  setGlobal("CloseTimer", () => api.timer.close());
  setGlobal("HideTimer", () => api.timer.hide());
  setGlobal("SetTimerScript", (triggerSeconds: number, scriptFile: string) => api.timer.setScript(triggerSeconds, scriptFile));

  // ===== Variables =====
  setGlobal("GetVar", (name: string) => api.variables.get(name));
  setGlobal("SetVar", (name: string, value: number) => api.variables.set(name, value));
  setGlobal("ClearAllVars", () => api.variables.clearAll());
  setGlobal("GetPartnerIndex", () => api.variables.getPartnerIndex());

  // ===== Input =====
  setGlobal("SetInputEnabled", (enabled: boolean) => api.input.setEnabled(enabled));

  // ===== Save =====
  setGlobal("SetSaveEnabled", (enabled: boolean) => api.save.setEnabled(enabled));
  setGlobal("ClearAllSaves", () => api.save.clearAll());

  // ===== Script Runner =====
  setGlobal("RunScript", (scriptFile: string) => api.script.run(scriptFile));
  setGlobal("RunParallelScript", (scriptFile: string, delay?: number) => api.script.runParallel(scriptFile, delay));
  setGlobal("ReturnToTitle", () => api.script.returnToTitle());
  setGlobal("Sleep", (ms: number) => api.script.sleep(ms));
  setGlobal("LoadGame", (index: number) => api.script.loadGame(index));
  setGlobal("SetInterfaceVisible", (visible: boolean) => api.script.setInterfaceVisible(visible));
  setGlobal("SaveGame", () => api.script.saveGame());
  setGlobal("UpdateState", () => api.script.updateState());
  setGlobal("ShowGamble", (cost: number, npcType: number) => api.script.showGamble(cost, npcType));
}
