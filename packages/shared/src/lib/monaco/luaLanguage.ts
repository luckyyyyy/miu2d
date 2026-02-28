/**
 * Lua Language Definition for Monaco Editor
 * 支持 Lua 5.4 语法高亮、游戏 API 自动补全和悬停提示
 */
import type { IRange, languages, Position } from "monaco-editor";

// biome-ignore lint/suspicious/noExplicitAny: Monaco editor type is dynamically loaded
type MonacoType = any;

/**
 * 语言ID
 */
export const LUA_LANGUAGE_ID = "miu2d-lua";

/**
 * 游戏 API 函数定义（PascalCase，与 lua-api-bindings.ts 对应）
 */
const GAME_API_FUNCTIONS: Array<{
  name: string;
  signature: string;
  description: string;
  category: string;
  blocking?: boolean;
}> = [
  // ===== Player =====
  { name: "SetPlayerPos", signature: "(x, y, name?)", description: "设置玩家位置", category: "Player" },
  { name: "SetPlayerDir", signature: "(direction)", description: "设置玩家方向", category: "Player" },
  { name: "SetPlayerState", signature: "(state)", description: "设置玩家状态", category: "Player" },
  { name: "PlayerWalkTo", signature: "(x, y)", description: "玩家走到指定位置", category: "Player", blocking: true },
  { name: "PlayerWalkToDir", signature: "(direction, steps)", description: "玩家朝方向走指定步数", category: "Player", blocking: true },
  { name: "PlayerRunTo", signature: "(x, y)", description: "玩家跑到指定位置", category: "Player", blocking: true },
  { name: "PlayerJumpTo", signature: "(x, y)", description: "玩家跳到指定位置", category: "Player", blocking: true },
  { name: "PlayerWalkToNonBlocking", signature: "(x, y)", description: "玩家走到指定位置（非阻塞）", category: "Player" },
  { name: "PlayerRunToNonBlocking", signature: "(x, y)", description: "玩家跑到指定位置（非阻塞）", category: "Player" },
  { name: "CenterCamera", signature: "()", description: "摄像机居中到玩家", category: "Player" },
  { name: "SetWalkIsRun", signature: "(value)", description: "设置走路为跑步", category: "Player" },
  { name: "ToNonFightingState", signature: "()", description: "退出战斗状态", category: "Player" },
  { name: "PlayerChange", signature: "(index)", description: "切换角色", category: "Player", blocking: true },
  { name: "GetMoney", signature: "() -> number", description: "获取金钱", category: "Player" },
  { name: "SetMoney", signature: "(amount)", description: "设置金钱", category: "Player" },
  { name: "AddMoney", signature: "(amount)", description: "增加金钱", category: "Player" },
  { name: "GetExp", signature: "() -> number", description: "获取经验", category: "Player" },
  { name: "AddExp", signature: "(amount)", description: "增加经验", category: "Player" },
  { name: "GetPlayerStat", signature: "(name) -> number", description: "获取玩家属性", category: "Player" },
  { name: "FullLife", signature: "()", description: "满血", category: "Player" },
  { name: "FullMana", signature: "()", description: "满蓝", category: "Player" },
  { name: "FullThew", signature: "()", description: "满体力", category: "Player" },
  { name: "AddLife", signature: "(amount)", description: "增加生命", category: "Player" },
  { name: "AddMana", signature: "(amount)", description: "增加法力", category: "Player" },
  { name: "AddThew", signature: "(amount)", description: "增加体力", category: "Player" },
  { name: "AddLifeMax", signature: "(value)", description: "增加生命上限", category: "Player" },
  { name: "AddManaMax", signature: "(value)", description: "增加法力上限", category: "Player" },
  { name: "AddThewMax", signature: "(value)", description: "增加体力上限", category: "Player" },
  { name: "AddAttack", signature: "(value, type?)", description: "增加攻击力", category: "Player" },
  { name: "AddDefend", signature: "(value, type?)", description: "增加防御力", category: "Player" },
  { name: "AddEvade", signature: "(value)", description: "增加闪避", category: "Player" },
  { name: "LimitMana", signature: "(limit)", description: "限制法力", category: "Player" },
  { name: "AddMoveSpeedPercent", signature: "(percent)", description: "增加移速百分比", category: "Player" },
  { name: "IsEquipWeapon", signature: "() -> boolean", description: "是否装备武器", category: "Player" },
  { name: "GetPlayerLevel", signature: "() -> number", description: "获取玩家等级", category: "Player" },
  { name: "SetPlayerLevel", signature: "(level)", description: "设置玩家等级", category: "Player" },
  { name: "SetFightEnabled", signature: "(enabled)", description: "设置是否可战斗", category: "Player" },
  { name: "SetJumpEnabled", signature: "(enabled)", description: "设置是否可跳跃", category: "Player" },
  { name: "SetRunEnabled", signature: "(enabled)", description: "设置是否可跑步", category: "Player" },
  { name: "SetPlayerMagicWhenAttacked", signature: "(magicFile, direction)", description: "设置受击武功", category: "Player" },
  { name: "SavePlayerSnapshot", signature: "(key)", description: "保存玩家快照", category: "Player" },
  { name: "LoadPlayerSnapshot", signature: "(key)", description: "加载玩家快照", category: "Player" },

  // ===== NPC =====
  { name: "AddNpc", signature: "(npcFile, x, y, dir?)", description: "添加 NPC", category: "NPC", blocking: true },
  { name: "DeleteNpc", signature: "(name)", description: "删除 NPC", category: "NPC" },
  { name: "GetNpcPos", signature: "(name) -> {x, y} | nil", description: "获取 NPC 位置", category: "NPC" },
  { name: "SetNpcPos", signature: "(name, x, y)", description: "设置 NPC 位置", category: "NPC" },
  { name: "NpcWalkTo", signature: "(name, x, y)", description: "NPC 走到指定位置", category: "NPC", blocking: true },
  { name: "NpcWalkToDir", signature: "(name, dir, steps)", description: "NPC 朝方向走", category: "NPC", blocking: true },
  { name: "SetNpcActionFile", signature: "(name, stateType, asfFile)", description: "设置 NPC 动作文件", category: "NPC", blocking: true },
  { name: "NpcSpecialAction", signature: "(name, asfFile)", description: "NPC 特殊动作", category: "NPC", blocking: true },
  { name: "NpcSpecialActionNonBlocking", signature: "(name, asfFile)", description: "NPC 特殊动作（非阻塞）", category: "NPC" },
  { name: "NpcWalkToNonBlocking", signature: "(name, x, y)", description: "NPC 走到指定位置（非阻塞）", category: "NPC" },
  { name: "SetNpcLevel", signature: "(name, level)", description: "设置 NPC 等级", category: "NPC" },
  { name: "SetNpcDir", signature: "(name, direction)", description: "设置 NPC 方向", category: "NPC" },
  { name: "SetNpcState", signature: "(name, state)", description: "设置 NPC 状态", category: "NPC" },
  { name: "SetNpcRelation", signature: "(name, relation)", description: "设置 NPC 关系", category: "NPC" },
  { name: "SetNpcDeathScript", signature: "(name, scriptFile)", description: "设置 NPC 死亡脚本", category: "NPC" },
  { name: "SetNpcScript", signature: "(name, scriptFile)", description: "设置 NPC 脚本", category: "NPC" },
  { name: "ShowNpc", signature: "(name, visible)", description: "显示/隐藏 NPC", category: "NPC" },
  { name: "MergeNpc", signature: "(npcFile)", description: "合并 NPC 文件", category: "NPC", blocking: true },
  { name: "SaveNpc", signature: "(fileName?)", description: "保存 NPC", category: "NPC", blocking: true },
  { name: "NpcWatch", signature: "(char1, char2, watchType)", description: "NPC 注视", category: "NPC" },
  { name: "SetNpcAIEnabled", signature: "(enabled)", description: "设置 NPC AI 开关", category: "NPC" },
  { name: "SetNpcKind", signature: "(name, kind)", description: "设置 NPC 类型", category: "NPC" },
  { name: "SetNpcMagicFile", signature: "(name, magicFile)", description: "设置 NPC 武功文件", category: "NPC" },
  { name: "SetNpcResource", signature: "(name, resFile)", description: "设置 NPC 资源", category: "NPC" },
  { name: "SetNpcAction", signature: "(name, action, x?, y?)", description: "设置 NPC 动作", category: "NPC" },
  { name: "SetNpcActionType", signature: "(name, actionType)", description: "设置 NPC 动作类型", category: "NPC" },
  { name: "SetAllNpcScript", signature: "(name, scriptFile)", description: "设置所有 NPC 脚本", category: "NPC" },
  { name: "SetAllNpcDeathScript", signature: "(name, scriptFile)", description: "设置所有 NPC 死亡脚本", category: "NPC" },
  { name: "NpcAttack", signature: "(name, x, y)", description: "NPC 攻击", category: "NPC" },
  { name: "NpcFollow", signature: "(follower, target)", description: "NPC 跟随", category: "NPC" },
  { name: "SetNpcMagicWhenAttacked", signature: "(name, magicFile, dir)", description: "设置 NPC 受击武功", category: "NPC" },
  { name: "AddNpcProperty", signature: "(name, property, value)", description: "增加 NPC 属性", category: "NPC" },
  { name: "AddNpcMagic", signature: "(name, magicFile)", description: "添加 NPC 武功", category: "NPC", blocking: true },
  { name: "SetNpcMagicLevel", signature: "(name, magicFile, level)", description: "设置 NPC 武功等级", category: "NPC" },
  { name: "SetNpcClickScript", signature: "(name, scriptFile)", description: "设置 NPC 点击脚本", category: "NPC" },
  { name: "ChangeNpcLife", signature: "(name, amount)", description: "改变 NPC 生命", category: "NPC" },
  { name: "ChangeNpcMana", signature: "(name, amount)", description: "改变 NPC 法力", category: "NPC" },
  { name: "ChangeNpcThew", signature: "(name, amount)", description: "改变 NPC 体力", category: "NPC" },
  { name: "ChangeNpcFlyIni", signature: "(name, magicFile)", description: "修改 NPC 飞行配置", category: "NPC" },
  { name: "ChangeNpcFlyIni2", signature: "(name, magicFile)", description: "修改 NPC 飞行配置2", category: "NPC" },
  { name: "AddNpcFlyInis", signature: "(name, magicFile, distance)", description: "添加 NPC 飞行配置", category: "NPC" },
  { name: "SetNpcDestination", signature: "(name, x, y)", description: "设置 NPC 目标位置", category: "NPC" },
  { name: "GetNpcCount", signature: "(kind1, kind2) -> number", description: "获取 NPC 数量", category: "NPC" },
  { name: "SetNpcKeepAttack", signature: "(name, x, y)", description: "设置 NPC 持续攻击", category: "NPC" },

  // ===== Goods =====
  { name: "AddGoods", signature: "(goodsName, count)", description: "添加物品", category: "Goods" },
  { name: "RemoveGoods", signature: "(goodsName, count)", description: "移除物品", category: "Goods" },
  { name: "EquipGoods", signature: "(goodListIndex)", description: "装备物品", category: "Goods" },
  { name: "GetGoodsCountByFile", signature: "(goodsFile) -> number", description: "按文件获取物品数量", category: "Goods" },
  { name: "GetGoodsCountByName", signature: "(goodsName) -> number", description: "按名称获取物品数量", category: "Goods" },
  { name: "ClearGoods", signature: "()", description: "清空物品", category: "Goods" },
  { name: "DeleteGoodsByName", signature: "(name, count?)", description: "按名称删除物品", category: "Goods" },
  { name: "HasGoodsFreeSpace", signature: "() -> boolean", description: "是否有空闲物品栏", category: "Goods" },
  { name: "AddRandomGoods", signature: "(buyFileName)", description: "随机添加物品", category: "Goods", blocking: true },
  { name: "BuyGoods", signature: "(buyFile, canSellSelfGoods)", description: "购买物品", category: "Goods", blocking: true },
  { name: "SetDropIni", signature: "(name, dropFile)", description: "设置掉落配置", category: "Goods" },
  { name: "SetDropEnabled", signature: "(enabled)", description: "设置掉落开关", category: "Goods" },
  { name: "SaveGoodsSnapshot", signature: "(key)", description: "保存物品快照", category: "Goods" },
  { name: "LoadGoodsSnapshot", signature: "(key)", description: "加载物品快照", category: "Goods" },

  // ===== Magic =====
  { name: "AddMagic", signature: "(magicFile)", description: "添加武功", category: "Magic", blocking: true },
  { name: "DeleteMagic", signature: "(magicFile)", description: "删除武功", category: "Magic" },
  { name: "SetMagicLevel", signature: "(magicFile, level)", description: "设置武功等级", category: "Magic" },
  { name: "GetMagicLevel", signature: "(magicFile) -> number", description: "获取武功等级", category: "Magic" },
  { name: "ClearMagic", signature: "()", description: "清空武功", category: "Magic" },
  { name: "HasMagicFreeSpace", signature: "() -> boolean", description: "是否有空闲武功栏", category: "Magic" },
  { name: "UseMagic", signature: "(magicFile, x?, y?)", description: "使用武功", category: "Magic" },

  // ===== Memo =====
  { name: "AddMemo", signature: "(text)", description: "添加备忘录", category: "Memo" },
  { name: "DeleteMemo", signature: "(text)", description: "删除备忘录", category: "Memo" },
  { name: "AddMemoById", signature: "(id)", description: "按 ID 添加备忘录", category: "Memo", blocking: true },
  { name: "DeleteMemoById", signature: "(id)", description: "按 ID 删除备忘录", category: "Memo", blocking: true },

  // ===== Map =====
  { name: "LoadMap", signature: "(mapName)", description: "加载地图", category: "Map", blocking: true },
  { name: "LoadMapNpc", signature: "(fileName)", description: "加载地图 NPC 文件", category: "Map", blocking: true },
  { name: "FreeMap", signature: "()", description: "释放地图", category: "Map" },
  { name: "GetCurrentMapPath", signature: "() -> string", description: "获取当前地图路径", category: "Map" },
  { name: "SetMapTime", signature: "(time)", description: "设置地图时间", category: "Map" },
  { name: "SetTrap", signature: "(trapIndex, trapFileName, mapName?)", description: "设置陷阱", category: "Map" },
  { name: "SaveTrap", signature: "()", description: "保存陷阱", category: "Map" },

  // ===== Obj =====
  { name: "LoadObj", signature: "(fileName)", description: "加载物体文件", category: "Obj", blocking: true },
  { name: "AddObj", signature: "(fileName, x, y, direction)", description: "添加物体", category: "Obj", blocking: true },
  { name: "DeleteCurrentObj", signature: "()", description: "删除当前物体", category: "Obj" },
  { name: "DeleteObj", signature: "(nameOrId)", description: "删除物体", category: "Obj" },
  { name: "OpenBox", signature: "(nameOrId?)", description: "打开箱子", category: "Obj" },
  { name: "CloseBox", signature: "(nameOrId?)", description: "关闭箱子", category: "Obj" },
  { name: "SetObjScript", signature: "(nameOrId, scriptFile)", description: "设置物体脚本", category: "Obj" },
  { name: "SaveObj", signature: "(fileName?)", description: "保存物体", category: "Obj", blocking: true },
  { name: "ClearBody", signature: "()", description: "清除尸体", category: "Obj" },
  { name: "GetObjPos", signature: "(nameOrId) -> {x, y} | nil", description: "获取物体位置", category: "Obj" },
  { name: "SetObjOffset", signature: "(objName, x, y)", description: "设置物体偏移", category: "Obj" },
  { name: "SetObjKind", signature: "(objName, kind)", description: "设置物体类型", category: "Obj" },

  // ===== Camera =====
  { name: "CameraMove", signature: "(direction, distance, speed)", description: "摄像机移动", category: "Camera", blocking: true },
  { name: "CameraMoveTo", signature: "(x, y, speed)", description: "摄像机移到指定位置", category: "Camera", blocking: true },
  { name: "SetCameraPos", signature: "(x, y)", description: "设置摄像机位置", category: "Camera" },
  { name: "OpenWaterEffect", signature: "()", description: "开启水面效果", category: "Camera" },
  { name: "CloseWaterEffect", signature: "()", description: "关闭水面效果", category: "Camera" },

  // ===== Audio =====
  { name: "PlayMusic", signature: "(file)", description: "播放音乐", category: "Audio" },
  { name: "StopMusic", signature: "()", description: "停止音乐", category: "Audio" },
  { name: "PlaySound", signature: "(file)", description: "播放音效", category: "Audio" },
  { name: "StopSound", signature: "()", description: "停止音效", category: "Audio" },
  { name: "PlayMovie", signature: "(file)", description: "播放视频", category: "Audio", blocking: true },

  // ===== Effects =====
  { name: "FadeIn", signature: "()", description: "淡入", category: "Effect", blocking: true },
  { name: "FadeOut", signature: "()", description: "淡出", category: "Effect", blocking: true },
  { name: "ChangeMapColor", signature: "(r, g, b)", description: "改变地图颜色", category: "Effect" },
  { name: "ChangeSpriteColor", signature: "(r, g, b)", description: "改变精灵颜色", category: "Effect" },
  { name: "BeginRain", signature: "(fileName)", description: "开始下雨", category: "Effect" },
  { name: "EndRain", signature: "()", description: "停止下雨", category: "Effect" },
  { name: "ShowSnow", signature: "(show)", description: "显示/隐藏雪", category: "Effect" },
  { name: "ShowRandomSnow", signature: "()", description: "显示随机雪", category: "Effect" },
  { name: "SetMainLum", signature: "(level)", description: "设置主亮度", category: "Effect" },
  { name: "SetPlayerLum", signature: "(level)", description: "设置玩家亮度", category: "Effect" },
  { name: "SetFadeLum", signature: "(level)", description: "设置淡入淡出亮度", category: "Effect" },
  { name: "Petrify", signature: "(ms)", description: "石化效果", category: "Effect" },
  { name: "Poison", signature: "(ms)", description: "中毒效果", category: "Effect" },
  { name: "Frozen", signature: "(ms)", description: "冰冻效果", category: "Effect" },
  { name: "ClearEffect", signature: "()", description: "清除效果", category: "Effect" },
  { name: "MoveMagic", signature: "(magicFile, direction)", description: "移动武功特效", category: "Effect" },
  { name: "SetLevelFile", signature: "(file)", description: "设置等级文件", category: "Effect", blocking: true },

  // ===== Dialog =====
  { name: "Say",  signature: "(text, portrait?)", description: "显示对话，文字在前（退出战斗态）", category: "Dialog", blocking: true },
  { name: "Talk", signature: "(portrait, text)", description: "显示对话，portrait 在前", category: "Dialog", blocking: true },
  { name: "ShowTalk", signature: "(startId, endId)", description: "显示对话段（退出战斗态）", category: "Dialog", blocking: true },
  { name: "ShowMessage", signature: "(text)", description: "显示消息", category: "Dialog" },
  { name: "Choose", signature: "(message, selectA, selectB) -> number", description: "二选一", category: "Dialog", blocking: true },
  { name: "ShowSystemMessage", signature: "(msg, stayTime?)", description: "显示系统消息", category: "Dialog" },

  // ===== Timer =====
  { name: "OpenTimer", signature: "(seconds)", description: "打开计时器", category: "Timer" },
  { name: "CloseTimer", signature: "()", description: "关闭计时器", category: "Timer" },
  { name: "HideTimer", signature: "()", description: "隐藏计时器", category: "Timer" },
  { name: "SetTimerScript", signature: "(triggerSeconds, scriptFile)", description: "设置计时器脚本", category: "Timer" },

  // ===== Variables =====
  { name: "GetVar", signature: "(name) -> number", description: "获取脚本变量", category: "Variable" },
  { name: "SetVar", signature: "(name, value)", description: "设置脚本变量", category: "Variable" },
  { name: "ClearAllVars", signature: "()", description: "清空所有变量", category: "Variable" },
  { name: "GetPartnerIndex", signature: "() -> number", description: "获取伙伴索引", category: "Variable" },

  // ===== Input =====
  { name: "SetInputEnabled", signature: "(enabled)", description: "设置输入开关", category: "Input" },

  // ===== Save =====
  { name: "SetSaveEnabled", signature: "(enabled)", description: "设置存档开关", category: "Save" },
  { name: "ClearAllSaves", signature: "()", description: "清空所有存档", category: "Save" },

  // ===== Script Runner =====
  { name: "RunScript", signature: "(scriptFile)", description: "运行脚本", category: "Script", blocking: true },
  { name: "RunParallelScript", signature: "(scriptFile, delay?)", description: "运行并行脚本", category: "Script" },
  { name: "ReturnToTitle", signature: "()", description: "返回标题", category: "Script" },
  { name: "Sleep", signature: "(ms)", description: "等待指定毫秒", category: "Script", blocking: true },
  { name: "LoadGame", signature: "(index)", description: "加载存档", category: "Script", blocking: true },
  { name: "SetInterfaceVisible", signature: "(visible)", description: "设置界面可见性", category: "Script" },
  { name: "SaveGame", signature: "()", description: "保存游戏", category: "Script" },
  { name: "UpdateState", signature: "()", description: "更新状态", category: "Script" },
  { name: "ShowGamble", signature: "(cost, npcType) -> boolean", description: "显示赌博", category: "Script", blocking: true },
];

const GAME_API_NAMES = GAME_API_FUNCTIONS.map((f) => f.name);

/** Lua 关键字 */
const LUA_KEYWORDS = [
  "and", "break", "do", "else", "elseif", "end", "false", "for",
  "function", "goto", "if", "in", "local", "nil", "not", "or",
  "repeat", "return", "then", "true", "until", "while",
];

/** Lua 标准库函数 */
const LUA_BUILTINS = [
  "assert", "collectgarbage", "dofile", "error", "getmetatable", "ipairs",
  "load", "loadfile", "next", "pairs", "pcall", "print", "rawequal",
  "rawget", "rawlen", "rawset", "require", "select", "setmetatable",
  "tonumber", "tostring", "type", "warn", "xpcall",
  // string
  "string.byte", "string.char", "string.dump", "string.find", "string.format",
  "string.gmatch", "string.gsub", "string.len", "string.lower", "string.match",
  "string.pack", "string.packsize", "string.rep", "string.reverse",
  "string.sub", "string.unpack", "string.upper",
  // table
  "table.concat", "table.insert", "table.move", "table.pack", "table.remove",
  "table.sort", "table.unpack",
  // math
  "math.abs", "math.acos", "math.asin", "math.atan", "math.ceil", "math.cos",
  "math.deg", "math.exp", "math.floor", "math.fmod", "math.huge",
  "math.log", "math.max", "math.maxinteger", "math.min", "math.mininteger",
  "math.modf", "math.pi", "math.rad", "math.random", "math.randomseed",
  "math.sin", "math.sqrt", "math.tan", "math.tointeger", "math.type",
];

/**
 * 将 signature 字符串转换为 Monaco snippet insertText。
 * 例如 "(clientId, message)" → "Talk(${1:clientId}, ${2:message})"
 * 无参数 "()" → "Talk($1)"
 */
function buildSnippetInsertText(name: string, signature: string): string {
  // 取出第一对括号内的内容（忽略 "-> ..." 返回类型）
  const match = signature.match(/^\(([^)]*)\)/);
  if (!match) return `${name}($1)`;
  const paramStr = match[1].trim();
  if (!paramStr) return `${name}($1)`;

  const params = paramStr
    .split(",")
    .map((p) => p.trim().replace(/[?]$/, "").trim()) // 去掉可选标记 ?
    .filter(Boolean);

  if (params.length === 0) return `${name}($1)`;

  const snippetParams = params.map((p, i) => `\${${i + 1}:${p}}`).join(", ");
  return `${name}(${snippetParams})`;
}

/** Category 对应的颜色 */
const CATEGORY_COLORS: Record<string, string> = {
  Player: "#4FC1FF",
  NPC: "#C586C0",
  Dialog: "#CE9178",
  Goods: "#4EC9B0",
  Magic: "#DCDCAA",
  Memo: "#9CDCFE",
  Map: "#569CD6",
  Obj: "#D7BA7D",
  Camera: "#B5CEA8",
  Audio: "#6A9955",
  Effect: "#C586C0",
  Timer: "#D4D4D4",
  Variable: "#9CDCFE",
  Input: "#4FC1FF",
  Save: "#CE9178",
  Script: "#DCDCAA",
};

/**
 * 注册 Lua 语言到 Monaco Editor
 */
export function registerLuaLanguage(monaco: MonacoType): void {
  // 检查是否已注册
  const languagesList = monaco.languages.getLanguages();
  if (languagesList.some((lang: { id: string }) => lang.id === LUA_LANGUAGE_ID)) {
    return;
  }

  // 注册语言
  monaco.languages.register({
    id: LUA_LANGUAGE_ID,
    extensions: [".lua"],
    aliases: ["Lua", "lua"],
  });

  // 语言配置
  monaco.languages.setLanguageConfiguration(LUA_LANGUAGE_ID, {
    comments: {
      lineComment: "--",
      blockComment: ["--[[", "]]"],
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: "[[", close: "]]" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    folding: {
      markers: {
        start: /^\s*--\s*#?region\b/,
        end: /^\s*--\s*#?endregion\b/,
      },
    },
    indentationRules: {
      increaseIndentPattern: /^\s*(else|elseif|for|function|if|repeat|while|do)\b.*$/,
      decreaseIndentPattern: /^\s*(end|else|elseif|until)\b.*$/,
    },
  } as languages.LanguageConfiguration);

  // Monarch 词法分析器
  monaco.languages.setMonarchTokensProvider(LUA_LANGUAGE_ID, {
    keywords: LUA_KEYWORDS,
    builtins: LUA_BUILTINS.filter((b) => !b.includes(".")),
    gameApiFunctions: GAME_API_NAMES,

    tokenizer: {
      root: [
        // 多行注释
        [/--\[\[/, "comment", "@blockComment"],
        // 单行注释
        [/--.*$/, "comment"],

        // 多行字符串
        [/\[\[/, "string", "@multiLineString"],

        // 字符串
        [/"/, "string", "@doubleQuoteString"],
        [/'/, "string", "@singleQuoteString"],

        // 数字
        [/0[xX][0-9a-fA-F]+/, "number.hex"],
        [/\d+(\.\d+)?([eE][+-]?\d+)?/, "number"],

        // 游戏 API 函数（PascalCase 全局函数）
        [
          /[A-Z][a-zA-Z0-9]*/,
          {
            cases: {
              "@gameApiFunctions": "function.gameapi",
              "@default": "identifier",
            },
          },
        ],

        // 标识符/关键字
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@keywords": "keyword",
              "@builtins": "function.builtin",
              "@default": "identifier",
            },
          },
        ],

        // 运算符
        [/[+\-*/%^#~]/, "operator"],
        [/[<>=]=?/, "operator"],
        [/\.\.\.?/, "operator"],
        [/[;,.]/, "delimiter"],
        [/[{}()[\]]/, "@brackets"],
      ],

      blockComment: [
        [/\]\]/, "comment", "@pop"],
        [/./, "comment"],
      ],

      multiLineString: [
        [/\]\]/, "string", "@pop"],
        [/./, "string"],
      ],

      doubleQuoteString: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, "string", "@pop"],
      ],

      singleQuoteString: [
        [/[^\\']+/, "string"],
        [/\\./, "string.escape"],
        [/'/, "string", "@pop"],
      ],
    },
  } as languages.IMonarchLanguage);

  // ===== 自动补全 =====
  monaco.languages.registerCompletionItemProvider(LUA_LANGUAGE_ID, {
    triggerCharacters: [".", ":"],
    provideCompletionItems: (
      model: { getWordUntilPosition: (pos: Position) => { word: string; startColumn: number; endColumn: number } },
      position: Position,
    ) => {
      const word = model.getWordUntilPosition(position);
      const range: IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: languages.CompletionItem[] = [];

      // 游戏 API 函数补全
      for (const func of GAME_API_FUNCTIONS) {
        const blockingBadge = func.blocking ? " ⏱" : "";
        const categoryColor = CATEGORY_COLORS[func.category] ?? "#D4D4D4";
        suggestions.push({
          label: {
            label: func.name,
            description: `[${func.category}]${blockingBadge}`,
          },
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: buildSnippetInsertText(func.name, func.signature),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: `${func.name}${func.signature}`,
          documentation: {
            value: `**${func.category}** | ${func.description}${func.blocking ? "\n\n⏱ *阻塞操作*" : ""}`,
          },
          range,
          sortText: `0_${func.category}_${func.name}`,
          tags: [],
          command: { id: "editor.action.triggerParameterHints", title: "Trigger Parameter Hints" },
        } as languages.CompletionItem);
      }

      // Lua 关键字补全
      for (const kw of LUA_KEYWORDS) {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
          sortText: `1_${kw}`,
        } as languages.CompletionItem);
      }

      // Lua 内置函数补全
      for (const builtin of LUA_BUILTINS) {
        const parts = builtin.split(".");
        const label = parts.length > 1 ? parts[1] : builtin;
        suggestions.push({
          label: builtin,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${builtin}(`,
          detail: `Lua 标准库: ${builtin}`,
          range,
          sortText: `2_${label}`,
        } as languages.CompletionItem);
      }

      // Monaco snippet syntax uses ${n:placeholder} — build from parts to avoid lint warnings
      const $ = (n: number, text: string) => `\${${n}:${text}}`;
      const snippets: Array<{ label: string; insertText: string; documentation: string }> = [
        {
          label: "if-then-end",
          insertText: `if ${$(1, "condition")} then\n\t${$(2, "-- body")}\nend`,
          documentation: "If 语句",
        },
        {
          label: "if-then-else-end",
          insertText: `if ${$(1, "condition")} then\n\t${$(2, "-- then")}\nelse\n\t${$(3, "-- else")}\nend`,
          documentation: "If-Else 语句",
        },
        {
          label: "for-do-end",
          insertText: `for ${$(1, "i")} = ${$(2, "1")}, ${$(3, "10")} do\n\t${$(4, "-- body")}\nend`,
          documentation: "For 循环",
        },
        {
          label: "for-in-pairs",
          insertText: `for ${$(1, "k")}, ${$(2, "v")} in pairs(${$(3, "table")}) do\n\t${$(4, "-- body")}\nend`,
          documentation: "For-In-Pairs 循环",
        },
        {
          label: "while-do-end",
          insertText: `while ${$(1, "condition")} do\n\t${$(2, "-- body")}\nend`,
          documentation: "While 循环",
        },
        {
          label: "function",
          insertText: `function ${$(1, "name")}(${$(2, "args")})\n\t${$(3, "-- body")}\nend`,
          documentation: "函数定义",
        },
        {
          label: "local function",
          insertText: `local function ${$(1, "name")}(${$(2, "args")})\n\t${$(3, "-- body")}\nend`,
          documentation: "局部函数定义",
        },
      ];

      for (const snippet of snippets) {
        suggestions.push({
          label: snippet.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: snippet.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: snippet.documentation,
          range,
          sortText: `3_${snippet.label}`,
        } as languages.CompletionItem);
      }

      return { suggestions };
    },
  });

  // ===== 悬停提示 =====
  monaco.languages.registerHoverProvider(LUA_LANGUAGE_ID, {
    provideHover: (
      model: { getWordAtPosition: (pos: Position) => { word: string; startColumn: number; endColumn: number } | null },
      position: Position,
    ) => {
      const wordInfo = model.getWordAtPosition(position);
      if (!wordInfo) return null;

      const func = GAME_API_FUNCTIONS.find((f) => f.name === wordInfo.word);
      if (!func) return null;

      const blockingInfo = func.blocking ? "\n\n⏱ **阻塞操作** — 此函数会等待操作完成才返回" : "";
      const contents = [
        {
          value: `\`\`\`lua\nfunction ${func.name}${func.signature}\n\`\`\``,
        },
        {
          value: `**[${func.category}]** ${func.description}${blockingInfo}`,
        },
      ];

      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: wordInfo.startColumn,
          endColumn: wordInfo.endColumn,
        },
        contents,
      };
    },
  });

  // ===== 签名帮助 =====
  monaco.languages.registerSignatureHelpProvider(LUA_LANGUAGE_ID, {
    signatureHelpTriggerCharacters: ["(", ","],
    provideSignatureHelp: (
      model: { getValueInRange: (range: IRange) => string },
      position: Position,
    ) => {
      // 查找当前函数调用
      const textBefore = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // 从后往前找未匹配的 ( 来找函数名
      let parenDepth = 0;
      let funcEnd = -1;
      let activeParam = 0;

      for (let i = textBefore.length - 1; i >= 0; i--) {
        const ch = textBefore[i];
        if (ch === ")") parenDepth++;
        else if (ch === "(") {
          if (parenDepth === 0) {
            funcEnd = i;
            break;
          }
          parenDepth--;
        } else if (ch === "," && parenDepth === 0) {
          activeParam++;
        }
      }

      if (funcEnd < 0) return null;

      // 提取函数名
      const beforeParen = textBefore.substring(0, funcEnd).trimEnd();
      const funcNameMatch = beforeParen.match(/([A-Za-z_]\w*)$/);
      if (!funcNameMatch) return null;

      const func = GAME_API_FUNCTIONS.find((f) => f.name === funcNameMatch[1]);
      if (!func) return null;

      // 解析参数列表
      const paramStr = func.signature.replace(/^\(/, "").replace(/\).*$/, "");
      const params = paramStr.split(",").map((p) => p.trim()).filter(Boolean);

      const parameters: Array<{ label: string; documentation?: string }> = params.map((p) => ({
        label: p,
      }));

      return {
        value: {
          signatures: [
            {
              label: `${func.name}${func.signature}`,
              documentation: `**[${func.category}]** ${func.description}`,
              parameters,
            },
          ],
          activeSignature: 0,
          activeParameter: activeParam,
        },
        dispose: () => {},
      };
    },
  });
}

/**
 * 定义 Lua 主题（复用 vs-dark 基础，定制 token 颜色）
 */
export function defineLuaTheme(monaco: MonacoType): void {
  monaco.editor.defineTheme("miu2d-lua-theme", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6A9955", fontStyle: "italic" },
      { token: "keyword", foreground: "C586C0" },
      { token: "function.gameapi", foreground: "DCDCAA" },
      { token: "function.builtin", foreground: "4EC9B0" },
      { token: "identifier", foreground: "9CDCFE" },
      { token: "string", foreground: "CE9178" },
      { token: "string.escape", foreground: "D7BA7D" },
      { token: "number", foreground: "B5CEA8" },
      { token: "number.hex", foreground: "B5CEA8" },
      { token: "operator", foreground: "D4D4D4" },
      { token: "delimiter", foreground: "D4D4D4" },
    ],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
    },
  } as Record<string, unknown>);
}
