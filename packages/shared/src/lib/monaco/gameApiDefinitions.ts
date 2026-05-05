/**
 * Lua API function definitions — single source of truth for Monaco autocomplete.
 *
 * Imported by:
 *   - @miu2d/shared  luaLanguage.ts  (Lua editor completions)
 *   - @miu2d/engine  lua-api-bindings.ts  (runtime setGlobal ordering / docs)
 */

/** Shape of a single Lua API entry */
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
 * All Lua API function definitions for Monaco autocomplete.
 * Includes both canonical PascalCase names and DSL-compatible aliases.
 */
export const LUA_API_FUNCTIONS: LuaAPIFunction[] = [
  // ===== Player =====
  {
    name: "SetPlayerPos",
    signature: "(x: number, y: number, name?: string)",
    description: "设置玩家位置",
    category: "Player",
  },
  {
    name: "SetPlayerDir",
    signature: "(direction: number)",
    description: "设置玩家方向",
    category: "Player",
  },
  {
    name: "SetPlayerState",
    signature: "(state: number)",
    description: "设置玩家状态",
    category: "Player",
  },
  {
    name: "PlayerWalkTo",
    signature: "(x: number, y: number)",
    description: "玩家走到指定位置（阻塞）",
    category: "Player",
    blocking: true,
  },
  {
    name: "PlayerWalkToDir",
    signature: "(direction: number, steps: number)",
    description: "玩家朝方向走指定步数（阻塞）",
    category: "Player",
    blocking: true,
  },
  {
    name: "PlayerRunTo",
    signature: "(x: number, y: number)",
    description: "玩家跑到指定位置（阻塞）",
    category: "Player",
    blocking: true,
  },
  {
    name: "PlayerJumpTo",
    signature: "(x: number, y: number)",
    description: "玩家跳到指定位置（阻塞）",
    category: "Player",
    blocking: true,
  },
  {
    name: "PlayerWalkToNonBlocking",
    signature: "(x: number, y: number)",
    description: "玩家走到指定位置（非阻塞）",
    category: "Player",
  },
  {
    name: "PlayerRunToNonBlocking",
    signature: "(x: number, y: number)",
    description: "玩家跑到指定位置（非阻塞）",
    category: "Player",
  },
  { name: "CenterCamera", signature: "()", description: "摄像机居中到玩家", category: "Player" },
  {
    name: "SetWalkIsRun",
    signature: "(value: number)",
    description: "设置走路为跑步",
    category: "Player",
  },
  { name: "ToNonFightingState", signature: "()", description: "退出战斗状态", category: "Player" },
  {
    name: "PlayerChange",
    signature: "(index: number)",
    description: "切换角色（阻塞）",
    category: "Player",
    blocking: true,
  },
  { name: "GetMoney", signature: "(): number", description: "获取金钱", category: "Player" },
  { name: "SetMoney", signature: "(amount: number)", description: "设置金钱", category: "Player" },
  { name: "AddMoney", signature: "(amount: number)", description: "增加金钱", category: "Player" },
  { name: "GetExp", signature: "(): number", description: "获取经验", category: "Player" },
  { name: "AddExp", signature: "(amount: number)", description: "增加经验", category: "Player" },
  {
    name: "GetPlayerStat",
    signature: "(name: string): number",
    description: "获取玩家属性",
    category: "Player",
  },
  { name: "FullLife", signature: "()", description: "满血", category: "Player" },
  { name: "FullMana", signature: "()", description: "满蓝", category: "Player" },
  { name: "FullThew", signature: "()", description: "满体力", category: "Player" },
  { name: "AddLife", signature: "(amount: number)", description: "增加生命", category: "Player" },
  { name: "AddMana", signature: "(amount: number)", description: "增加法力", category: "Player" },
  { name: "AddThew", signature: "(amount: number)", description: "增加体力", category: "Player" },
  {
    name: "AddLifeMax",
    signature: "(value: number)",
    description: "增加生命上限",
    category: "Player",
  },
  {
    name: "AddManaMax",
    signature: "(value: number)",
    description: "增加法力上限",
    category: "Player",
  },
  {
    name: "AddThewMax",
    signature: "(value: number)",
    description: "增加体力上限",
    category: "Player",
  },
  {
    name: "AddAttack",
    signature: "(value: number, type?: number)",
    description: "增加攻击力",
    category: "Player",
  },
  {
    name: "AddDefend",
    signature: "(value: number, type?: number)",
    description: "增加防御力",
    category: "Player",
  },
  { name: "AddEvade", signature: "(value: number)", description: "增加闪避", category: "Player" },
  { name: "LimitMana", signature: "(limit: boolean)", description: "限制法力", category: "Player" },
  {
    name: "AddMoveSpeedPercent",
    signature: "(percent: number)",
    description: "增加移速百分比",
    category: "Player",
  },
  {
    name: "IsEquipWeapon",
    signature: "(): boolean",
    description: "是否装备武器",
    category: "Player",
  },
  {
    name: "GetPlayerLevel",
    signature: "(): number",
    description: "获取玩家等级",
    category: "Player",
  },
  {
    name: "SetPlayerLevel",
    signature: "(level: number)",
    description: "设置玩家等级",
    category: "Player",
  },
  {
    name: "SetFightEnabled",
    signature: "(enabled: boolean)",
    description: "设置是否可战斗",
    category: "Player",
  },
  {
    name: "SetJumpEnabled",
    signature: "(enabled: boolean)",
    description: "设置是否可跳跃",
    category: "Player",
  },
  {
    name: "SetRunEnabled",
    signature: "(enabled: boolean)",
    description: "设置是否可跑步",
    category: "Player",
  },
  {
    name: "SetPlayerMagicWhenAttacked",
    signature: "(magicFile: string, direction: number)",
    description: "设置受击武功",
    category: "Player",
  },
  {
    name: "SavePlayerSnapshot",
    signature: "(key: string)",
    description: "保存玩家快照",
    category: "Player",
  },
  {
    name: "LoadPlayerSnapshot",
    signature: "(key: string)",
    description: "加载玩家快照",
    category: "Player",
  },

  // ===== NPC =====
  {
    name: "AddNpc",
    signature: "(npcFile: string, x: number, y: number, dir?: number)",
    description: "添加 NPC（阻塞）",
    category: "NPC",
    blocking: true,
  },
  { name: "DeleteNpc", signature: "(name: string)", description: "删除 NPC", category: "NPC" },
  {
    name: "GetNpcPos",
    signature: "(name: string): {x, y} | nil",
    description: "获取 NPC 位置",
    category: "NPC",
  },
  {
    name: "SetNpcPos",
    signature: "(name: string, x: number, y: number)",
    description: "设置 NPC 位置",
    category: "NPC",
  },
  {
    name: "NpcWalkTo",
    signature: "(name: string, x: number, y: number)",
    description: "NPC 走到指定位置（阻塞）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "NpcWalkToDir",
    signature: "(name: string, dir: number, steps: number)",
    description: "NPC 朝方向走（阻塞）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "SetNpcActionFile",
    signature: "(name: string, stateType: number, asfFile: string)",
    description: "设置 NPC 动作文件（阻塞）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "NpcSpecialAction",
    signature: "(name: string, asfFile: string)",
    description: "NPC 特殊动作（阻塞）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "NpcSpecialActionNonBlocking",
    signature: "(name: string, asfFile: string)",
    description: "NPC 特殊动作（非阻塞）",
    category: "NPC",
  },
  {
    name: "NpcWalkToNonBlocking",
    signature: "(name: string, x: number, y: number)",
    description: "NPC 走到指定位置（非阻塞）",
    category: "NPC",
  },
  {
    name: "SetNpcLevel",
    signature: "(name: string, level: number)",
    description: "设置 NPC 等级",
    category: "NPC",
  },
  {
    name: "SetNpcDir",
    signature: "(name: string, direction: number)",
    description: "设置 NPC 方向",
    category: "NPC",
  },
  {
    name: "SetNpcState",
    signature: "(name: string, state: number)",
    description: "设置 NPC 状态",
    category: "NPC",
  },
  {
    name: "SetNpcRelation",
    signature: "(name: string, relation: number)",
    description: "设置 NPC 关系",
    category: "NPC",
  },
  {
    name: "SetNpcDeathScript",
    signature: "(name: string, scriptFile: string)",
    description: "设置 NPC 死亡脚本",
    category: "NPC",
  },
  {
    name: "SetNpcScript",
    signature: "(name: string, scriptFile: string)",
    description: "设置 NPC 脚本",
    category: "NPC",
  },
  {
    name: "ShowNpc",
    signature: "(name: string, visible: boolean)",
    description: "显示/隐藏 NPC",
    category: "NPC",
  },
  {
    name: "MergeNpc",
    signature: "(npcFile: string)",
    description: "合并 NPC 文件（阻塞）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "LoadNpc",
    signature: "(fileName: string)",
    description: "加载 NPC 文件（阻塞）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "SaveNpc",
    signature: "(fileName?: string)",
    description: "保存 NPC（阻塞）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "NpcWatch",
    signature: "(char1: string, char2: string, watchType: number)",
    description: "NPC 注视",
    category: "NPC",
  },
  {
    name: "SetNpcAIEnabled",
    signature: "(enabled: boolean)",
    description: "设置 NPC AI 开关",
    category: "NPC",
  },
  {
    name: "SetNpcKind",
    signature: "(name: string, kind: number)",
    description: "设置 NPC 类型",
    category: "NPC",
  },
  {
    name: "SetNpcMagicFile",
    signature: "(name: string, magicFile: string)",
    description: "设置 NPC 武功文件（阻塞）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "SetNpcResource",
    signature: "(name: string, resFile: string)",
    description: "设置 NPC 资源",
    category: "NPC",
  },
  {
    name: "SetNpcAction",
    signature: "(name: string, action: number, x?: number, y?: number)",
    description: "设置 NPC 动作",
    category: "NPC",
  },
  {
    name: "SetNpcActionType",
    signature: "(name: string, actionType: number)",
    description: "设置 NPC 动作类型",
    category: "NPC",
  },
  {
    name: "SetAllNpcScript",
    signature: "(name: string, scriptFile: string)",
    description: "设置所有 NPC 脚本",
    category: "NPC",
  },
  {
    name: "SetAllNpcDeathScript",
    signature: "(name: string, scriptFile: string)",
    description: "设置所有 NPC 死亡脚本",
    category: "NPC",
  },
  {
    name: "NpcAttack",
    signature: "(name: string, x: number, y: number)",
    description: "NPC 攻击",
    category: "NPC",
  },
  {
    name: "NpcFollow",
    signature: "(follower: string, target: string)",
    description: "NPC 跟随",
    category: "NPC",
  },
  {
    name: "SetNpcMagicWhenAttacked",
    signature: "(name: string, magicFile: string, dir: number)",
    description: "设置 NPC 受击武功",
    category: "NPC",
  },
  {
    name: "AddNpcProperty",
    signature: "(name: string, property: string, value: number)",
    description: "增加 NPC 属性",
    category: "NPC",
  },
  {
    name: "AddNpcMagic",
    signature: "(name: string, magicFile: string)",
    description: "添加 NPC 武功（阻塞）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "SetNpcMagicLevel",
    signature: "(name: string, magicFile: string, level: number)",
    description: "设置 NPC 武功等级",
    category: "NPC",
  },
  {
    name: "SetNpcClickScript",
    signature: "(name: string, scriptFile: string)",
    description: "设置 NPC 点击脚本",
    category: "NPC",
  },
  {
    name: "ChangeNpcLife",
    signature: "(name: string, amount: number)",
    description: "改变 NPC 生命",
    category: "NPC",
  },
  {
    name: "ChangeNpcMana",
    signature: "(name: string, amount: number)",
    description: "改变 NPC 法力",
    category: "NPC",
  },
  {
    name: "ChangeNpcThew",
    signature: "(name: string, amount: number)",
    description: "改变 NPC 体力",
    category: "NPC",
  },
  {
    name: "ChangeNpcFlyIni",
    signature: "(name: string, magicFile: string)",
    description: "修改 NPC 飞行配置",
    category: "NPC",
  },
  {
    name: "ChangeNpcFlyIni2",
    signature: "(name: string, magicFile: string)",
    description: "修改 NPC 飞行配置2",
    category: "NPC",
  },
  {
    name: "AddNpcFlyInis",
    signature: "(name: string, magicFile: string, distance: number)",
    description: "添加 NPC 飞行配置",
    category: "NPC",
  },
  {
    name: "SetNpcDestination",
    signature: "(name: string, x: number, y: number)",
    description: "设置 NPC 目标位置",
    category: "NPC",
  },
  {
    name: "GetNpcCount",
    signature: "(kind: number, relation: number): number",
    description: "获取 NPC 数量",
    category: "NPC",
  },
  {
    name: "SetNpcKeepAttack",
    signature: "(name: string, x: number, y: number)",
    description: "设置 NPC 持续攻击",
    category: "NPC",
  },
  {
    name: "NpcFollowPlayer",
    signature: "(name: string)",
    description: "NPC 跟随玩家",
    category: "NPC",
  },

  // ===== Goods =====
  {
    name: "AddGoods",
    signature: "(goodsName: string, count: number)",
    description: "添加物品",
    category: "Goods",
  },
  {
    name: "RemoveGoods",
    signature: "(goodsName: string, count: number)",
    description: "移除物品",
    category: "Goods",
  },
  {
    name: "EquipGoods",
    signature: "(goodListIndex: number)",
    description: "装备物品",
    category: "Goods",
  },
  {
    name: "GetGoodsCountByFile",
    signature: "(goodsFile: string): number",
    description: "按文件获取物品数量",
    category: "Goods",
  },
  {
    name: "GetGoodsCountByName",
    signature: "(goodsName: string): number",
    description: "按名称获取物品数量",
    category: "Goods",
  },
  { name: "ClearGoods", signature: "()", description: "清空物品", category: "Goods" },
  {
    name: "DeleteGoodsByName",
    signature: "(name: string, count?: number)",
    description: "按名称删除物品",
    category: "Goods",
  },
  {
    name: "HasGoodsFreeSpace",
    signature: "(): boolean",
    description: "是否有空闲物品栏",
    category: "Goods",
  },
  {
    name: "AddRandomGoods",
    signature: "(buyFileName: string)",
    description: "随机添加物品（阻塞）",
    category: "Goods",
    blocking: true,
  },
  {
    name: "BuyGoods",
    signature: "(buyFile: string, canSellSelfGoods: boolean)",
    description: "购买物品（阻塞）",
    category: "Goods",
    blocking: true,
  },
  {
    name: "SetDropIni",
    signature: "(name: string, dropFile: string)",
    description: "设置掉落配置",
    category: "Goods",
  },
  {
    name: "SetDropEnabled",
    signature: "(enabled: boolean)",
    description: "设置掉落开关",
    category: "Goods",
  },
  {
    name: "SaveGoodsSnapshot",
    signature: "(key: string)",
    description: "保存物品快照",
    category: "Goods",
  },
  {
    name: "LoadGoodsSnapshot",
    signature: "(key: string)",
    description: "加载物品快照",
    category: "Goods",
  },

  // ===== Magic =====
  {
    name: "AddMagic",
    signature: "(magicFile: string)",
    description: "添加武功（阻塞）",
    category: "Magic",
    blocking: true,
  },
  {
    name: "DeleteMagic",
    signature: "(magicFile: string)",
    description: "删除武功",
    category: "Magic",
  },
  {
    name: "SetMagicLevel",
    signature: "(magicFile: string, level: number)",
    description: "设置武功等级",
    category: "Magic",
  },
  {
    name: "AddMagicExp",
    signature: "(magicFile: string, amount: number)",
    description: "增加武功经验",
    category: "Magic",
  },
  {
    name: "GetMagicLevel",
    signature: "(magicFile: string): number",
    description: "获取武功等级",
    category: "Magic",
  },
  { name: "ClearMagic", signature: "()", description: "清空武功", category: "Magic" },
  {
    name: "HasMagicFreeSpace",
    signature: "(): boolean",
    description: "是否有空闲武功栏",
    category: "Magic",
  },
  {
    name: "UseMagic",
    signature: "(magicFile: string, x?: number, y?: number)",
    description: "使用武功",
    category: "Magic",
  },

  // ===== Memo =====
  { name: "AddMemo", signature: "(text: string)", description: "添加备忘录", category: "Memo" },
  { name: "DeleteMemo", signature: "(text: string)", description: "删除备忘录", category: "Memo" },
  {
    name: "AddMemoById",
    signature: "(id: number)",
    description: "按 ID 添加备忘录（阻塞）",
    category: "Memo",
    blocking: true,
  },
  {
    name: "DeleteMemoById",
    signature: "(id: number)",
    description: "按 ID 删除备忘录（阻塞）",
    category: "Memo",
    blocking: true,
  },

  // ===== Map =====
  {
    name: "LoadMap",
    signature: "(mapName: string)",
    description: "加载地图（阻塞）",
    category: "Map",
    blocking: true,
  },
  {
    name: "LoadMapNpc",
    signature: "(fileName: string)",
    description: "加载地图 NPC 文件（阻塞）",
    category: "Map",
    blocking: true,
  },
  { name: "FreeMap", signature: "()", description: "释放地图", category: "Map" },
  {
    name: "GetCurrentMapPath",
    signature: "(): string",
    description: "获取当前地图路径",
    category: "Map",
  },
  { name: "SetMapTime", signature: "(time: number)", description: "设置地图时间", category: "Map" },
  {
    name: "SetTrap",
    signature: "(trapIndex: number, trapFileName: string, mapName?: string)",
    description: "设置陷阱",
    category: "Map",
  },
  { name: "SaveTrap", signature: "()", description: "保存陷阱", category: "Map" },

  // ===== Obj =====
  {
    name: "LoadObj",
    signature: "(fileName: string)",
    description: "加载物体文件（阻塞）",
    category: "Obj",
    blocking: true,
  },
  {
    name: "AddObj",
    signature: "(fileName: string, x: number, y: number, direction: number)",
    description: "添加物体（阻塞）",
    category: "Obj",
    blocking: true,
  },
  { name: "DeleteCurrentObj", signature: "()", description: "删除当前物体", category: "Obj" },
  { name: "DeleteObj", signature: "(nameOrId: string)", description: "删除物体", category: "Obj" },
  { name: "OpenBox", signature: "(nameOrId?: string)", description: "打开箱子", category: "Obj" },
  { name: "CloseBox", signature: "(nameOrId?: string)", description: "关闭箱子", category: "Obj" },
  {
    name: "SetObjScript",
    signature: "(nameOrId: string, scriptFile: string)",
    description: "设置物体脚本",
    category: "Obj",
  },
  {
    name: "SaveObj",
    signature: "(fileName?: string)",
    description: "保存物体（阻塞）",
    category: "Obj",
    blocking: true,
  },
  { name: "ClearBody", signature: "()", description: "清除尸体", category: "Obj" },
  {
    name: "GetObjPos",
    signature: "(nameOrId: string): {x, y} | nil",
    description: "获取物体位置",
    category: "Obj",
  },
  {
    name: "SetObjOffset",
    signature: "(objName: string, x: number, y: number)",
    description: "设置物体偏移",
    category: "Obj",
  },
  {
    name: "SetObjPos",
    signature: "(name: string, x: number, y: number)",
    description: "设置物体格子位置",
    category: "Obj",
  },
  {
    name: "SetObjKind",
    signature: "(objName: string, kind: number)",
    description: "设置物体类型",
    category: "Obj",
  },

  // ===== Camera =====
  {
    name: "CameraMove",
    signature: "(direction: number, distance: number, speed: number)",
    description: "摄像机移动（阻塞）",
    category: "Camera",
    blocking: true,
  },
  {
    name: "CameraMoveTo",
    signature: "(x: number, y: number, speed: number)",
    description: "摄像机移到指定位置（阻塞）",
    category: "Camera",
    blocking: true,
  },
  {
    name: "SetCameraPos",
    signature: "(x: number, y: number)",
    description: "设置摄像机位置",
    category: "Camera",
  },
  { name: "OpenWaterEffect", signature: "()", description: "开启水面效果", category: "Camera" },
  { name: "CloseWaterEffect", signature: "()", description: "关闭水面效果", category: "Camera" },

  // ===== Audio =====
  { name: "PlayMusic", signature: "(file: string)", description: "播放音乐", category: "Audio" },
  { name: "StopMusic", signature: "()", description: "停止音乐", category: "Audio" },
  { name: "PlaySound", signature: "(file: string)", description: "播放音效", category: "Audio" },
  { name: "StopSound", signature: "()", description: "停止音效", category: "Audio" },
  {
    name: "PlayMovie",
    signature: "(file: string)",
    description: "播放视频（阻塞）",
    category: "Audio",
    blocking: true,
  },

  // ===== Effects =====
  {
    name: "FadeIn",
    signature: "()",
    description: "淡入（阻塞）",
    category: "Effect",
    blocking: true,
  },
  {
    name: "FadeOut",
    signature: "()",
    description: "淡出（阻塞）",
    category: "Effect",
    blocking: true,
  },
  {
    name: "ChangeMapColor",
    signature: "(r: number, g: number, b: number)",
    description: "改变地图颜色",
    category: "Effect",
  },
  {
    name: "ChangeSpriteColor",
    signature: "(r: number, g: number, b: number)",
    description: "改变精灵颜色",
    category: "Effect",
  },
  {
    name: "BeginRain",
    signature: "(fileName: string)",
    description: "开始下雨",
    category: "Effect",
  },
  { name: "EndRain", signature: "()", description: "停止下雨", category: "Effect" },
  {
    name: "ShowSnow",
    signature: "(show: boolean)",
    description: "显示/隐藏雪",
    category: "Effect",
  },
  { name: "ShowRandomSnow", signature: "()", description: "显示随机雪", category: "Effect" },
  {
    name: "SetMainLum",
    signature: "(level: number)",
    description: "设置主亮度",
    category: "Effect",
  },
  {
    name: "SetPlayerLum",
    signature: "(level: number)",
    description: "设置玩家亮度",
    category: "Effect",
  },
  {
    name: "SetFadeLum",
    signature: "(level: number)",
    description: "设置淡入淡出亮度",
    category: "Effect",
  },
  { name: "Petrify", signature: "(ms: number)", description: "石化效果", category: "Effect" },
  { name: "Poison", signature: "(ms: number)", description: "中毒效果", category: "Effect" },
  { name: "Frozen", signature: "(ms: number)", description: "冰冻效果", category: "Effect" },
  { name: "ClearEffect", signature: "()", description: "清除效果", category: "Effect" },
  {
    name: "MoveMagic",
    signature: "(magicFile: string, slotIndex: number)",
    description: "将武功移动到快捷栏槽位（1-5）",
    category: "Magic",
  },
  {
    name: "SetLevelFile",
    signature: "(file: string)",
    description: "设置等级文件（阻塞）",
    category: "Effect",
    blocking: true,
  },

  // ===== Dialog =====
  {
    name: "Say",
    signature: "(text: string, portrait?: number)",
    description: "显示对话（阻塞，退出战斗状态）",
    category: "Dialog",
    blocking: true,
  },
  {
    name: "Talk",
    signature: "(text: string, portrait?: number)",
    description: "显示对话（阻塞，与 Say 相同，text 在前）",
    category: "Dialog",
    blocking: true,
  },
  {
    name: "ShowTalk",
    signature: "(startId: number, endId: number)",
    description: "显示对话段（阻塞，退出战斗状态）",
    category: "Dialog",
    blocking: true,
  },
  { name: "ShowMessage", signature: "(text: string)", description: "显示消息", category: "Dialog" },
  {
    name: "Choose",
    signature: "(message: string, selectA: string, selectB: string): number",
    description: "二选一（阻塞）",
    category: "Dialog",
    blocking: true,
  },
  {
    name: "ShowSystemMessage",
    signature: "(msg: string, stayTime?: number)",
    description: "显示系统消息",
    category: "Dialog",
  },

  // ===== Timer =====
  {
    name: "OpenTimer",
    signature: "(seconds: number)",
    description: "打开计时器",
    category: "Timer",
  },
  { name: "CloseTimer", signature: "()", description: "关闭计时器", category: "Timer" },
  { name: "HideTimer", signature: "()", description: "隐藏计时器", category: "Timer" },
  {
    name: "SetTimerScript",
    signature: "(triggerSeconds: number, scriptFile: string)",
    description: "设置计时器脚本",
    category: "Timer",
  },

  // ===== Variables =====
  {
    name: "GetVar",
    signature: "(name: string): number",
    description: "获取脚本变量",
    category: "Variable",
  },
  {
    name: "SetVar",
    signature: "(name: string, value: number)",
    description: "设置脚本变量",
    category: "Variable",
  },
  { name: "ClearAllVars", signature: "()", description: "清空所有变量", category: "Variable" },
  {
    name: "GetPartnerIndex",
    signature: "(): number",
    description: "获取伙伴索引",
    category: "Variable",
  },

  // ===== Input =====
  {
    name: "SetInputEnabled",
    signature: "(enabled: boolean)",
    description: "设置输入开关",
    category: "Input",
  },

  // ===== Save =====
  {
    name: "SetSaveEnabled",
    signature: "(enabled: boolean)",
    description: "设置存档开关",
    category: "Save",
  },
  { name: "ClearAllSaves", signature: "()", description: "清空所有存档", category: "Save" },

  // ===== Script Runner =====
  {
    name: "RunScript",
    signature: "(scriptFile: string)",
    description: "运行脚本（阻塞）",
    category: "Script",
    blocking: true,
  },
  {
    name: "RunParallelScript",
    signature: "(scriptFile: string, delay?: number)",
    description: "运行并行脚本",
    category: "Script",
  },
  { name: "ReturnToTitle", signature: "()", description: "返回标题", category: "Script" },
  {
    name: "Sleep",
    signature: "(ms: number)",
    description: "等待指定毫秒（阻塞）",
    category: "Script",
    blocking: true,
  },
  {
    name: "LoadGame",
    signature: "(index: number)",
    description: "加载存档（阻塞）",
    category: "Script",
    blocking: true,
  },
  {
    name: "SetInterfaceVisible",
    signature: "(visible: boolean)",
    description: "设置界面可见性",
    category: "Script",
  },
  { name: "SaveGame", signature: "()", description: "保存游戏", category: "Script" },
  { name: "UpdateState", signature: "()", description: "更新状态", category: "Script" },
  {
    name: "ShowGamble",
    signature: "(cost: number, npcType: number): boolean",
    description: "显示赌博（阻塞）",
    category: "Script",
    blocking: true,
  },
  {
    name: "SetShowMapPos",
    signature: "(show: boolean)",
    description: "显示/隐藏地图坐标",
    category: "Script",
  },
  { name: "ShowMouseCursor", signature: "()", description: "显示鼠标光标", category: "Script" },
  { name: "HideMouseCursor", signature: "()", description: "隐藏鼠标光标", category: "Script" },
  {
    name: "CheckYear",
    signature: "(varName: string): void",
    description: "检查当前是否元旦或春节，结果写入变量（1=是, 0=否）",
    category: "Script",
  },

  // ===== Dialog Extended =====
  {
    name: "ChooseEx",
    signature: "(message: string, ...options: string[]): number",
    description: "扩展选择（支持条件）",
    category: "Dialog",
    blocking: true,
  },
  {
    name: "ChooseMultiple",
    signature:
      "(columns: number, rows: number, varPrefix: string, message: string, ...options: string[]): table",
    description: "多选网格",
    category: "Dialog",
    blocking: true,
  },
  {
    name: "Select",
    signature: "(messageId: number, optionAId: number, optionBId: number): number",
    description: "TalkTextList 选择",
    category: "Dialog",
    blocking: true,
  },

  // ===== DSL-compatible aliases =====
  // These match original DSL command names so scripts can use either convention.
  {
    name: "GetPlayerState",
    signature: "(name: string): number",
    description: "获取玩家属性（DSL别名 → GetPlayerStat）",
    category: "Player",
  },
  {
    name: "GetMoneyNum",
    signature: "(): number",
    description: "获取金钱（DSL别名 → GetMoney）",
    category: "Player",
  },
  {
    name: "SetMoneyNum",
    signature: "(amount: number)",
    description: "设置金钱（DSL别名 → SetMoney）",
    category: "Player",
  },
  {
    name: "PlayerGoto",
    signature: "(x: number, y: number)",
    description: "玩家走到（DSL别名 → PlayerWalkTo）",
    category: "Player",
    blocking: true,
  },
  {
    name: "PlayerGotoEx",
    signature: "(x: number, y: number)",
    description: "玩家走到非阻塞（DSL别名 → PlayerWalkToNonBlocking）",
    category: "Player",
  },
  {
    name: "AddRandMoney",
    signature: "(min: number, max: number)",
    description: "随机增加金钱",
    category: "Player",
  },
  { name: "EnableFight", signature: "()", description: "允许战斗", category: "Player" },
  { name: "DisableFight", signature: "()", description: "禁止战斗", category: "Player" },
  { name: "EnableJump", signature: "()", description: "允许跳跃", category: "Player" },
  { name: "DisableJump", signature: "()", description: "禁止跳跃", category: "Player" },
  { name: "EnableRun", signature: "()", description: "允许跑步", category: "Player" },
  { name: "DisableRun", signature: "()", description: "禁止跑步", category: "Player" },
  {
    name: "NpcGoto",
    signature: "(name: string, x: number, y: number)",
    description: "NPC走到（DSL别名 → NpcWalkTo）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "NpcGotoEx",
    signature: "(name: string, x: number, y: number)",
    description: "NPC走到非阻塞（DSL别名 → NpcWalkToNonBlocking）",
    category: "NPC",
  },
  {
    name: "DelNpc",
    signature: "(name: string)",
    description: "删除NPC（DSL别名 → DeleteNpc）",
    category: "NPC",
  },
  {
    name: "LoadOneNpc",
    signature: "(file: string, x: number, y: number)",
    description: "在指定位置加载单个NPC",
    category: "NPC",
    blocking: true,
  },
  {
    name: "Watch",
    signature: "(char1: string, char2: string, watchType: number)",
    description: "NPC注视（DSL别名 → NpcWatch）",
    category: "NPC",
  },
  {
    name: "ChangeLife",
    signature: "(name: string, amount: number)",
    description: "改变NPC生命（DSL别名 → ChangeNpcLife）",
    category: "NPC",
  },
  {
    name: "ChangeMana",
    signature: "(name: string, amount: number)",
    description: "改变NPC法力（DSL别名 → ChangeNpcMana）",
    category: "NPC",
  },
  {
    name: "ChangeThew",
    signature: "(name: string, amount: number)",
    description: "改变NPC体力（DSL别名 → ChangeNpcThew）",
    category: "NPC",
  },
  { name: "EnableNpcAI", signature: "()", description: "启用NPC AI", category: "NPC" },
  { name: "DisableNpcAI", signature: "()", description: "禁用NPC AI", category: "NPC" },
  {
    name: "DelGoods",
    signature: "(goodsName: string, count?: number)",
    description: "删除物品（DSL别名 → RemoveGoods）",
    category: "Goods",
  },
  {
    name: "DelMagic",
    signature: "(magicFile: string)",
    description: "删除武功（DSL别名 → DeleteMagic）",
    category: "Magic",
  },
  {
    name: "GetGoodsNum",
    signature: "(goodsFile: string): number",
    description: "按文件获取物品数量（DSL别名 → GetGoodsCountByFile）",
    category: "Goods",
  },
  {
    name: "SellGoods",
    signature: "(buyFile: string)",
    description: "出售物品界面（可出售自身物品）",
    category: "Goods",
    blocking: true,
  },
  {
    name: "BuyGoodsOnly",
    signature: "(buyFile: string)",
    description: "购买物品界面（不可出售自身物品）",
    category: "Goods",
    blocking: true,
  },
  { name: "EnableDrop", signature: "()", description: "允许掉落", category: "Goods" },
  { name: "DisableDrop", signature: "()", description: "禁止掉落", category: "Goods" },
  {
    name: "DelObj",
    signature: "(nameOrId: string)",
    description: "删除物体（DSL别名 → DeleteObj）",
    category: "Obj",
  },
  {
    name: "MoveScreen",
    signature: "(direction: number, distance: number, speed: number)",
    description: "摄像机移动（DSL别名 → CameraMove）",
    category: "Camera",
    blocking: true,
  },
  {
    name: "MoveScreenEx",
    signature: "(x: number, y: number, speed: number)",
    description: "摄像机移到（DSL别名 → CameraMoveTo）",
    category: "Camera",
    blocking: true,
  },
  {
    name: "SetMapPos",
    signature: "(x: number, y: number)",
    description: "设置摄像机位置（DSL别名 → SetCameraPos）",
    category: "Camera",
  },
  {
    name: "OpenTimeLimit",
    signature: "(seconds: number)",
    description: "打开计时器（DSL别名 → OpenTimer）",
    category: "Timer",
  },
  {
    name: "CloseTimeLimit",
    signature: "()",
    description: "关闭计时器（DSL别名 → CloseTimer）",
    category: "Timer",
  },
  {
    name: "ShowSystemMsg",
    signature: "(msg: string, stayTime?: number)",
    description: "显示系统消息（DSL别名 → ShowSystemMessage）",
    category: "Dialog",
  },
  {
    name: "Memo",
    signature: "(text: string)",
    description: "添加备忘录（DSL别名 → AddMemo）",
    category: "Memo",
  },
  { name: "EnableInput", signature: "()", description: "启用输入", category: "Input" },
  { name: "DisableInput", signature: "()", description: "禁用输入", category: "Input" },
  { name: "EnableSave", signature: "()", description: "允许存档", category: "Save" },
  { name: "DisableSave", signature: "()", description: "禁止存档", category: "Save" },
  { name: "HideInterface", signature: "()", description: "隐藏界面", category: "Script" },
  { name: "ShowInterface", signature: "()", description: "显示界面", category: "Script" },
  {
    name: "HideBottomWnd",
    signature: "()",
    description: "隐藏底部窗口（DSL别名 → HideInterface）",
    category: "Script",
  },
  {
    name: "ShowBottomWnd",
    signature: "()",
    description: "显示底部窗口（DSL别名 → ShowInterface）",
    category: "Script",
  },
  {
    name: "RandRun",
    signature: "(probability: number, script1: string, script2: string)",
    description: "按概率(0-99)随机执行两个脚本之一",
    category: "Script",
  },

  // ===== Additional DSL aliases (registered in engine commands but missing from above) =====

  // Player
  {
    name: "PlayerGotoDir",
    signature: "(dir: number, steps: number)",
    description: "玩家朝方向走（DSL别名 → PlayerWalkToDir）",
    category: "Player",
    blocking: true,
  },
  {
    name: "PlayerRunToEx",
    signature: "(x: number, y: number)",
    description: "玩家跑到位置非阻塞（DSL别名 → PlayerRunToNonBlocking）",
    category: "Player",
  },
  {
    name: "SetPlayerScn",
    signature: "()",
    description: "摄像机居中到玩家（DSL别名 → CenterCamera）",
    category: "Player",
  },
  {
    name: "SavePlayer",
    signature: "(key: string)",
    description: "保存玩家快照（DSL别名 → SavePlayerSnapshot）",
    category: "Player",
  },
  {
    name: "LoadPlayer",
    signature: "(index: number)",
    description: "加载玩家从存档（DSL别名 → LoadPlayerSnapshot）",
    category: "Player",
  },
  {
    name: "GetPlayerExp",
    signature: "(): number",
    description: "获取玩家经验（DSL别名 → GetExp）",
    category: "Player",
  },
  {
    name: "GetPlayerMagicLevel",
    signature: "(magicFile: string): number",
    description: "获取玩家武功等级",
    category: "Player",
  },
  {
    name: "PlayerAddEmotion",
    signature: "(amount: number)",
    description: "增加玩家情感值（存根）",
    category: "Player",
  },
  {
    name: "PlayerAddJustice",
    signature: "(amount: number)",
    description: "增加玩家正义值（存根）",
    category: "Player",
  },

  // NPC
  {
    name: "NpcGotoDir",
    signature: "(name: string, dir: number, steps: number)",
    description: "NPC 朝方向走（DSL别名 → NpcWalkToDir）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "NpcSpecialActionEx",
    signature: "(name: string, asfFile: string)",
    description: "NPC 特殊动作阻塞（DSL别名 → NpcSpecialAction）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "AddOneMagic",
    signature: "(name: string, magicFile: string)",
    description: "给 NPC 添加武功（DSL别名 → AddNpcMagic）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "SetNpcRes",
    signature: "(name: string, resFile: string)",
    description: "设置 NPC 资源（DSL别名 → SetNpcResource）",
    category: "NPC",
  },
  {
    name: "ChangeFlyIni",
    signature: "(name: string, magicFile: string)",
    description: "修改 NPC 飞行配置（DSL别名 → ChangeNpcFlyIni）",
    category: "NPC",
  },
  {
    name: "ChangeFlyIni2",
    signature: "(name: string, magicFile: string)",
    description: "修改 NPC 飞行配置2（DSL别名 → ChangeNpcFlyIni2）",
    category: "NPC",
  },
  {
    name: "AddFlyInis",
    signature: "(name: string, magicFile: string, distance: number)",
    description: "添加 NPC 飞行配置（DSL别名 → AddNpcFlyInis）",
    category: "NPC",
  },
  {
    name: "FollowNpc",
    signature: "(follower: string, target: string)",
    description: "NPC 跟随另一角色（DSL别名 → NpcFollow）",
    category: "NPC",
  },
  {
    name: "FollowPlayer",
    signature: "(name: string)",
    description: "NPC 跟随玩家（DSL别名 → NpcFollowPlayer）",
    category: "NPC",
  },
  {
    name: "SetKeepAttack",
    signature: "(name: string, x: number, y: number)",
    description: "设置 NPC 持续攻击位置（DSL别名 → SetNpcKeepAttack）",
    category: "NPC",
  },
  {
    name: "SetPartnerLevel",
    signature: "(name: string, level: number)",
    description: "设置伙伴等级（DSL别名 → SetNpcLevel）",
    category: "NPC",
  },

  // Goods
  {
    name: "AddRandGoods",
    signature: "(buyFileName: string)",
    description: "随机添加物品（DSL别名 → AddRandomGoods）",
    category: "Goods",
    blocking: true,
  },
  {
    name: "GetGoodsNumByName",
    signature: "(goodsName: string): number",
    description: "按名称获取物品数量（DSL别名 → GetGoodsCountByName）",
    category: "Goods",
  },
  {
    name: "CheckFreeGoodsSpace",
    signature: "(): 0 | 1",
    description: "检查物品栏是否有空位（DSL别名 → HasGoodsFreeSpace）",
    category: "Goods",
  },
  {
    name: "DelGoodByName",
    signature: "(name: string, count?: number)",
    description: "按名称删除物品（DSL别名 → DeleteGoodsByName）",
    category: "Goods",
  },
  {
    name: "SaveGoods",
    signature: "(key: string)",
    description: "保存物品快照（DSL别名 → SaveGoodsSnapshot）",
    category: "Goods",
  },
  {
    name: "LoadGoods",
    signature: "(key: string)",
    description: "加载物品快照（DSL别名 → LoadGoodsSnapshot）",
    category: "Goods",
  },

  // Magic
  {
    name: "CheckFreeMagicSpace",
    signature: "(): 0 | 1",
    description: "检查武功栏是否有空位（DSL别名 → HasMagicFreeSpace）",
    category: "Magic",
  },

  // Memo
  {
    name: "AddToMemo",
    signature: "(idOrText: number | string)",
    description: "按 ID 或文本添加备忘录（DSL别名 → AddMemoById）",
    category: "Memo",
    blocking: true,
  },
  {
    name: "DelMemo",
    signature: "(text: string)",
    description: "删除备忘录（DSL别名 → DeleteMemo）",
    category: "Memo",
  },
  { name: "ClearMemo", signature: "()", description: "清空所有备忘录", category: "Memo" },

  // Obj
  {
    name: "DelCurObj",
    signature: "()",
    description: "删除当前触发物体（DSL别名 → DeleteCurrentObj）",
    category: "Obj",
  },
  {
    name: "SetObjOfs",
    signature: "(name: string, x: number, y: number)",
    description: "设置物体偏移（DSL别名 → SetObjOffset）",
    category: "Obj",
  },
  {
    name: "OpenObj",
    signature: "(nameOrId?: string)",
    description: "打开物体/箱子（DSL别名 → OpenBox）",
    category: "Obj",
  },

  // Map
  {
    name: "SetMapTrap",
    signature: "(trapIndex: number, trapFileName: string)",
    description: "设置陷阱（当前地图，DSL别名 → SetTrap）",
    category: "Map",
  },
  {
    name: "SaveMapTrap",
    signature: "()",
    description: "保存地图陷阱（DSL别名 → SaveTrap）",
    category: "Map",
  },

  // Effect
  {
    name: "ChangeAsfColor",
    signature: "(r: number, g: number, b: number)",
    description: "改变精灵颜色（DSL别名 → ChangeSpriteColor）",
    category: "Effect",
  },
  {
    name: "ShowRain",
    signature: "(level: number)",
    description: "按等级控制雨效果（0=停止）",
    category: "Effect",
  },
  {
    name: "PetrifyMillisecond",
    signature: "(ms: number)",
    description: "石化效果（毫秒，DSL别名 → Petrify）",
    category: "Effect",
  },
  {
    name: "PoisonMillisecond",
    signature: "(ms: number)",
    description: "中毒效果（毫秒，DSL别名 → Poison）",
    category: "Effect",
  },
  {
    name: "FrozenMillisecond",
    signature: "(ms: number)",
    description: "冰冻效果（毫秒，DSL别名 → Frozen）",
    category: "Effect",
  },

  // Audio
  { name: "StopMovie", signature: "()", description: "停止播放视频", category: "Audio" },

  // Dialog
  {
    name: "Message",
    signature: "(text: string)",
    description: "显示消息（DSL别名 → ShowMessage）",
    category: "Dialog",
  },
  {
    name: "DisplayMessage",
    signature: "(text: string)",
    description: "显示消息（DSL别名 → ShowMessage）",
    category: "Dialog",
  },
  {
    name: "MessageBox",
    signature: "(text: string)",
    description: "显示消息框（DSL别名 → ShowMessage）",
    category: "Dialog",
  },

  // Timer
  {
    name: "HideTimerWnd",
    signature: "()",
    description: "隐藏计时器窗口（DSL别名 → HideTimer）",
    category: "Timer",
  },
  {
    name: "SetTimeScript",
    signature: "(triggerSeconds: number, scriptFile: string)",
    description: "设置计时器触发脚本（DSL别名 → SetTimerScript）",
    category: "Timer",
  },

  // Variable
  {
    name: "GetPartnerIdx",
    signature: "(): number",
    description: "获取伙伴索引（DSL别名 → GetPartnerIndex）",
    category: "Variable",
  },
  {
    name: "ClearAllVar",
    signature: "(...keepVars: string[])",
    description: "清空所有变量（DSL别名 → ClearAllVars）",
    category: "Variable",
  },

  // Save
  {
    name: "ClearAllSave",
    signature: "()",
    description: "清空所有存档（DSL别名 → ClearAllSaves）",
    category: "Save",
  },

  // Script
  {
    name: "Gamble",
    signature: "(cost: number, type: number)",
    description: "骰子赌博（DSL别名 → ShowGamble）",
    category: "Script",
    blocking: true,
  },

  // Legacy typo aliases (from original game source)
  {
    name: "SetNpcMagicToUseWhenBeAtacked",
    signature: "(name: string, magicFile: string, dir: number)",
    description: "设置 NPC 受击武功（DSL拼写别名 → SetNpcMagicWhenAttacked）",
    category: "NPC",
  },
  {
    name: "SetPlayerMagicToUseWhenBeAtacked",
    signature: "(magicFile: string, direction: number)",
    description: "设置玩家受击武功（DSL拼写别名 → SetPlayerMagicWhenAttacked）",
    category: "Player",
  },
];

/**
 * DSL (.txt script) control-flow entries that have no Lua equivalent
 * (Lua uses native syntax for if/goto/return/assignment/arithmetic).
 * Combined with LUA_API_FUNCTIONS → SCRIPT_COMMANDS in jxqyScriptLanguage.ts.
 */
export const DSL_ONLY_COMMANDS: LuaAPIFunction[] = [
  { name: "If", signature: "($var op value) @label", description: "条件跳转", category: "Control" },
  { name: "Goto", signature: "@label", description: "无条件跳转", category: "Control" },
  { name: "Return", signature: "", description: "返回/结束脚本", category: "Control" },
  { name: "Assign", signature: "($var, value)", description: "设置变量", category: "Control" },
  {
    name: "Assing",
    signature: "($var, value)",
    description: "设置变量（Assign 的拼写错误别名）",
    category: "Control",
  },
  { name: "Add", signature: "($var, value)", description: "变量加法", category: "Control" },
  { name: "Sub", signature: "($var, value)", description: "变量减法", category: "Control" },
  {
    name: "GetRandNum",
    signature: "($var, min, max)",
    description: "生成随机数到变量",
    category: "Control",
  },
];
