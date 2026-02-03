/**
 * 角色编辑器类型定义
 * 复用 @miu2d/engine 中的核心类型，扩展编辑器专用的 UI 元数据
 */

// 从 engine 复用核心类型
export {
  CharacterKind,
  RelationType,
  CharacterState,
  type CharacterConfig as EngineCharacterConfig,
  type CharacterStats,
  DEFAULT_CHARACTER_CONFIG,
  DEFAULT_PLAYER_STATS,
} from "@miu2d/engine/core/types";

import {
  CharacterKind,
  RelationType,
  DEFAULT_PLAYER_STATS,
} from "@miu2d/engine/core/types";

/** AI 类型 (engine 中没有单独定义) */
export enum AIType {
  /** 默认 AI */
  Default = 0,
  /** 随机移动随机攻击 */
  RandMoveRandAttack = 1,
  /** 随机移动随机攻击，不反击 */
  RandMoveRandAttackNoFightBack = 2,
}

/** 死亡时使用魔法的方向 */
export enum DeathUseMagicDirection {
  /** 最后攻击者方向 */
  LastAttacker = 0,
  /** 最后魔法反方向 */
  LastMagicSpriteOppDirection = 1,
  /** 当前 NPC 方向 */
  CurrentNpcDirection = 2,
}

/**
 * NPC 资源状态信息（npcres 目录下的配置）
 */
export interface NpcResStateInfo {
  /** 动画文件路径 */
  image: string;
  /** 音效文件路径 */
  sound: string;
}

/**
 * NPC 资源配置（npcres 目录下的 .ini 文件）
 */
export interface NpcResConfig {
  Stand?: NpcResStateInfo;
  Stand1?: NpcResStateInfo;
  Walk?: NpcResStateInfo;
  Run?: NpcResStateInfo;
  Jump?: NpcResStateInfo;
  Attack?: NpcResStateInfo;
  Attack1?: NpcResStateInfo;
  Attack2?: NpcResStateInfo;
  Magic?: NpcResStateInfo;
  Hurt?: NpcResStateInfo;
  Death?: NpcResStateInfo;
  FightStand?: NpcResStateInfo;
  FightStand1?: NpcResStateInfo;
  FightWalk?: NpcResStateInfo;
  FightRun?: NpcResStateInfo;
  FightJump?: NpcResStateInfo;
  Sit?: NpcResStateInfo;
}

/**
 * 编辑器用的扁平化角色配置
 * 将 engine 的 CharacterConfig.stats 展平为顶级字段，便于 UI 编辑
 */
export interface EditorCharacterConfig {
  // ===== 基础信息 =====
  name: string;
  kind: CharacterKind;
  relation: RelationType;
  group: number;
  noAutoAttackPlayer: number;

  // ===== 资源引用 =====
  npcIni: string;
  bodyIni: string;
  flyIni: string;
  flyIni2: string;
  flyInis: string;
  dropIni: string;

  // ===== 属性值 (来自 CharacterStats) =====
  life: number;
  lifeMax: number;
  thew: number;
  thewMax: number;
  mana: number;
  manaMax: number;
  attack: number;
  attack2: number;
  attack3: number;
  attackLevel: number;
  defend: number;
  defend2: number;
  defend3: number;
  evade: number;
  exp: number;
  expBonus: number;
  levelUpExp: number;
  level: number;
  canLevelUp: number;

  // ===== 移动与行为 =====
  dir: number;
  walkSpeed: number;
  addMoveSpeedPercent: number;
  pathFinder: number;
  visionRadius: number;
  dialogRadius: number;
  attackRadius: number;
  lum: number;
  action: number;
  idle: number;
  fixedPos: string;

  // ===== AI 相关 =====
  aiType: AIType;
  magicToUseWhenLifeLow: string;
  keepRadiusWhenLifeLow: number;
  lifeLowPercent: number;
  stopFindingTarget: number;
  keepRadiusWhenFriendDeath: number;
  magicToUseWhenBeAttacked: string;
  magicDirectionWhenBeAttacked: number;
  magicToUseWhenDeath: string;
  magicDirectionWhenDeath: DeathUseMagicDirection;

  // ===== 脚本 =====
  scriptFile: string;
  scriptFileRight: string;
  canInteractDirectly: number;
  timerScriptFile: string;
  timerScriptInterval: number;
  deathScript: string;

  // ===== 商店 =====
  buyIniFile: string;

  // ===== 特殊属性 =====
  invincible: number;
  noDropWhenDie: number;
  reviveMilliseconds: number;
  visibleVariableName: string;
  visibleVariableValue: number;

  // ===== 伤害玩家 =====
  hurtPlayerInterval: number;
  hurtPlayerLife: number;
  hurtPlayerRadius: number;

  // ===== 位置 =====
  mapX: number;
  mapY: number;
}

/** 编辑器角色配置默认值 */
export const defaultEditorCharacterConfig: EditorCharacterConfig = {
  // 基础信息
  name: "",
  kind: CharacterKind.Normal,
  relation: RelationType.Friend,
  group: 0,
  noAutoAttackPlayer: 0,

  // 资源引用
  npcIni: "",
  bodyIni: "",
  flyIni: "",
  flyIni2: "",
  flyInis: "",
  dropIni: "",

  // 属性值
  life: DEFAULT_PLAYER_STATS.life,
  lifeMax: DEFAULT_PLAYER_STATS.lifeMax,
  thew: DEFAULT_PLAYER_STATS.thew,
  thewMax: DEFAULT_PLAYER_STATS.thewMax,
  mana: DEFAULT_PLAYER_STATS.mana,
  manaMax: DEFAULT_PLAYER_STATS.manaMax,
  attack: DEFAULT_PLAYER_STATS.attack,
  attack2: DEFAULT_PLAYER_STATS.attack2,
  attack3: DEFAULT_PLAYER_STATS.attack3,
  attackLevel: DEFAULT_PLAYER_STATS.attackLevel,
  defend: DEFAULT_PLAYER_STATS.defend,
  defend2: DEFAULT_PLAYER_STATS.defend2,
  defend3: DEFAULT_PLAYER_STATS.defend3,
  evade: DEFAULT_PLAYER_STATS.evade,
  exp: DEFAULT_PLAYER_STATS.exp,
  expBonus: 0,
  levelUpExp: DEFAULT_PLAYER_STATS.levelUpExp,
  level: DEFAULT_PLAYER_STATS.level,
  canLevelUp: DEFAULT_PLAYER_STATS.canLevelUp,

  // 移动与行为
  dir: 0,
  walkSpeed: DEFAULT_PLAYER_STATS.walkSpeed,
  addMoveSpeedPercent: DEFAULT_PLAYER_STATS.addMoveSpeedPercent,
  pathFinder: 0,
  visionRadius: DEFAULT_PLAYER_STATS.visionRadius,
  dialogRadius: DEFAULT_PLAYER_STATS.dialogRadius,
  attackRadius: DEFAULT_PLAYER_STATS.attackRadius,
  lum: DEFAULT_PLAYER_STATS.lum,
  action: DEFAULT_PLAYER_STATS.action,
  idle: 0,
  fixedPos: "",

  // AI 相关
  aiType: AIType.Default,
  magicToUseWhenLifeLow: "",
  keepRadiusWhenLifeLow: 0,
  lifeLowPercent: 20,
  stopFindingTarget: 0,
  keepRadiusWhenFriendDeath: 0,
  magicToUseWhenBeAttacked: "",
  magicDirectionWhenBeAttacked: 0,
  magicToUseWhenDeath: "",
  magicDirectionWhenDeath: DeathUseMagicDirection.LastAttacker,

  // 脚本
  scriptFile: "",
  scriptFileRight: "",
  canInteractDirectly: 0,
  timerScriptFile: "",
  timerScriptInterval: 0,
  deathScript: "",

  // 商店
  buyIniFile: "",

  // 特殊属性
  invincible: 0,
  noDropWhenDie: 0,
  reviveMilliseconds: 0,
  visibleVariableName: "",
  visibleVariableValue: 0,

  // 伤害玩家
  hurtPlayerInterval: 0,
  hurtPlayerLife: 0,
  hurtPlayerRadius: 1,

  // 位置
  mapX: 0,
  mapY: 0,
};

// ===== UI 元数据定义 =====

/** 配置字段分组 */
export interface CharacterFieldGroup {
  name: string;
  icon: string;
  fields: CharacterFieldDef[];
}

/** 字段类型 */
export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "file"
  | "script";

/** 字段定义 */
export interface CharacterFieldDef {
  /** 字段键名 */
  key: keyof EditorCharacterConfig;
  /** 显示名称 */
  label: string;
  /** 字段类型 */
  type: FieldType;
  /** 描述 */
  description?: string;
  /** 枚举选项（type 为 enum 时） */
  options?: { value: number; label: string }[];
  /** 文件扩展名过滤（type 为 file 时） */
  fileExtensions?: string[];
  /** 文件目录提示 */
  fileDirectory?: string;
  /** 最小值（type 为 number 时） */
  min?: number;
  /** 最大值（type 为 number 时） */
  max?: number;
}

/** 角色配置字段分组定义 */
export const characterFieldGroups: CharacterFieldGroup[] = [
  {
    name: "基础信息",
    icon: "📋",
    fields: [
      { key: "name", label: "名称", type: "string", description: "角色显示名称" },
      {
        key: "kind",
        label: "类型",
        type: "enum",
        description: "角色类型",
        options: [
          { value: CharacterKind.Normal, label: "普通 NPC (0)" },
          { value: CharacterKind.Fighter, label: "战斗角色 (1)" },
          { value: CharacterKind.Player, label: "玩家 (2)" },
          { value: CharacterKind.Follower, label: "伙伴 (3)" },
          { value: CharacterKind.GroundAnimal, label: "地面动物 (4)" },
          { value: CharacterKind.Eventer, label: "事件触发 (5)" },
          { value: CharacterKind.AfraidPlayerAnimal, label: "怕人动物 (6)" },
          { value: CharacterKind.Flyer, label: "飞行角色 (7)" },
        ],
      },
      {
        key: "relation",
        label: "关系",
        type: "enum",
        description: "与玩家的关系",
        options: [
          { value: RelationType.Friend, label: "友好 (0)" },
          { value: RelationType.Enemy, label: "敌对 (1)" },
          { value: RelationType.Neutral, label: "中立 (2)" },
        ],
      },
      { key: "group", label: "分组", type: "number", min: 0 },
      { key: "level", label: "等级", type: "number", min: 1 },
      { key: "noAutoAttackPlayer", label: "不自动攻击玩家", type: "number" },
    ],
  },
  {
    name: "资源引用",
    icon: "📦",
    fields: [
      {
        key: "npcIni",
        label: "NPC 资源",
        type: "file",
        description: "npcres 目录下的配置文件",
        fileExtensions: [".ini"],
        fileDirectory: "ini/npcres",
      },
      {
        key: "bodyIni",
        label: "尸体配置",
        type: "file",
        description: "obj 目录下的尸体配置",
        fileExtensions: [".ini"],
        fileDirectory: "ini/obj",
      },
      {
        key: "flyIni",
        label: "攻击魔法",
        type: "file",
        description: "magic 目录下的魔法配置",
        fileExtensions: [".ini"],
        fileDirectory: "ini/magic",
      },
      {
        key: "flyIni2",
        label: "攻击魔法2",
        type: "file",
        fileExtensions: [".ini"],
        fileDirectory: "ini/magic",
      },
      { key: "flyInis", label: "多攻击魔法", type: "string", description: "格式: magic1.ini:距离;magic2.ini:距离;" },
      {
        key: "dropIni",
        label: "掉落配置",
        type: "file",
        fileExtensions: [".ini"],
      },
    ],
  },
  {
    name: "属性值",
    icon: "💪",
    fields: [
      { key: "life", label: "生命", type: "number", min: 0 },
      { key: "lifeMax", label: "生命上限", type: "number", min: 1 },
      { key: "thew", label: "体力", type: "number", min: 0 },
      { key: "thewMax", label: "体力上限", type: "number", min: 1 },
      { key: "mana", label: "内力", type: "number", min: 0 },
      { key: "manaMax", label: "内力上限", type: "number", min: 1 },
      { key: "attack", label: "攻击力", type: "number", min: 0 },
      { key: "attack2", label: "攻击力2", type: "number", min: 0 },
      { key: "attack3", label: "攻击力3", type: "number", min: 0 },
      { key: "attackLevel", label: "攻击等级", type: "number", min: 0 },
      { key: "defend", label: "防御力", type: "number", min: 0 },
      { key: "defend2", label: "防御力2", type: "number", min: 0 },
      { key: "defend3", label: "防御力3", type: "number", min: 0 },
      { key: "evade", label: "闪避", type: "number", min: 0 },
      { key: "exp", label: "经验值", type: "number", min: 0 },
      { key: "expBonus", label: "经验奖励", type: "number", min: 0 },
      { key: "levelUpExp", label: "升级经验", type: "number", min: 0 },
      { key: "canLevelUp", label: "可升级", type: "number" },
    ],
  },
  {
    name: "移动行为",
    icon: "🏃",
    fields: [
      { key: "dir", label: "方向", type: "number", min: 0, max: 7, description: "0-7 八方向" },
      { key: "walkSpeed", label: "移动速度", type: "number", min: 1, max: 10 },
      { key: "addMoveSpeedPercent", label: "额外速度%", type: "number" },
      { key: "pathFinder", label: "寻路类型", type: "number" },
      { key: "visionRadius", label: "视野半径", type: "number", min: 0 },
      { key: "dialogRadius", label: "对话半径", type: "number", min: 0 },
      { key: "attackRadius", label: "攻击半径", type: "number", min: 0 },
      { key: "lum", label: "光照", type: "number" },
      { key: "action", label: "动作", type: "number" },
      { key: "idle", label: "空闲帧", type: "number" },
      { key: "fixedPos", label: "固定路径", type: "string", description: "十六进制编码路径" },
    ],
  },
  {
    name: "AI 设置",
    icon: "🤖",
    fields: [
      {
        key: "aiType",
        label: "AI 类型",
        type: "enum",
        options: [
          { value: AIType.Default, label: "默认 (0)" },
          { value: AIType.RandMoveRandAttack, label: "随机移动攻击 (1)" },
          { value: AIType.RandMoveRandAttackNoFightBack, label: "不反击 (2)" },
        ],
      },
      { key: "magicToUseWhenLifeLow", label: "低血魔法", type: "file", fileExtensions: [".ini"], fileDirectory: "ini/magic" },
      { key: "keepRadiusWhenLifeLow", label: "低血保持距离", type: "number", min: 0 },
      { key: "lifeLowPercent", label: "低血阈值%", type: "number", min: 0, max: 100 },
      { key: "stopFindingTarget", label: "停止寻敌", type: "number" },
      { key: "keepRadiusWhenFriendDeath", label: "友方死亡保持距离", type: "number", min: 0 },
      { key: "magicToUseWhenBeAttacked", label: "被攻击魔法", type: "file", fileExtensions: [".ini"], fileDirectory: "ini/magic" },
      { key: "magicDirectionWhenBeAttacked", label: "被攻击魔法方向", type: "number" },
      { key: "magicToUseWhenDeath", label: "死亡魔法", type: "file", fileExtensions: [".ini"], fileDirectory: "ini/magic" },
      {
        key: "magicDirectionWhenDeath",
        label: "死亡魔法方向",
        type: "enum",
        options: [
          { value: DeathUseMagicDirection.LastAttacker, label: "攻击者方向 (0)" },
          { value: DeathUseMagicDirection.LastMagicSpriteOppDirection, label: "魔法反向 (1)" },
          { value: DeathUseMagicDirection.CurrentNpcDirection, label: "当前方向 (2)" },
        ],
      },
    ],
  },
  {
    name: "脚本",
    icon: "📜",
    fields: [
      { key: "scriptFile", label: "对话脚本", type: "script", description: "左键对话脚本" },
      { key: "scriptFileRight", label: "右键脚本", type: "script", description: "右键对话脚本" },
      { key: "canInteractDirectly", label: "直接交互", type: "number" },
      { key: "timerScriptFile", label: "定时脚本", type: "script" },
      { key: "timerScriptInterval", label: "定时间隔(ms)", type: "number", min: 0 },
      { key: "deathScript", label: "死亡脚本", type: "script" },
    ],
  },
  {
    name: "商店",
    icon: "🏪",
    fields: [
      { key: "buyIniFile", label: "商店配置", type: "file", fileExtensions: [".ini"], fileDirectory: "ini/buy" },
    ],
  },
  {
    name: "特殊属性",
    icon: "⚡",
    fields: [
      { key: "invincible", label: "无敌", type: "number" },
      { key: "noDropWhenDie", label: "不掉落", type: "number" },
      { key: "reviveMilliseconds", label: "复活时间(ms)", type: "number", min: 0 },
      { key: "visibleVariableName", label: "可见变量名", type: "string" },
      { key: "visibleVariableValue", label: "可见变量值", type: "number" },
    ],
  },
  {
    name: "伤害玩家",
    icon: "💥",
    fields: [
      { key: "hurtPlayerInterval", label: "伤害间隔(ms)", type: "number", min: 0 },
      { key: "hurtPlayerLife", label: "伤害值", type: "number", min: 0 },
      { key: "hurtPlayerRadius", label: "伤害半径", type: "number", min: 0 },
    ],
  },
  {
    name: "位置",
    icon: "📍",
    fields: [
      { key: "mapX", label: "地图X", type: "number" },
      { key: "mapY", label: "地图Y", type: "number" },
    ],
  },
];
