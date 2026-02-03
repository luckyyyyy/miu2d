/**
 * 角色配置 INI 解析器
 * 解析 npc 目录和 npcres 目录下的 .ini 文件
 */

import {
  defaultEditorCharacterConfig,
  type EditorCharacterConfig,
  type NpcResConfig,
  type NpcResStateInfo,
} from "../types/character";

/**
 * 解析 INI 文件内容
 * @param content INI 文件内容
 * @returns 解析后的键值对映射，按 section 分组
 */
export function parseIniContent(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = "INIT"; // 默认 section

  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#")) {
      continue;
    }

    // 检查 section
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    // 解析键值对
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex > 0) {
      const key = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim();
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      result[currentSection][key] = value;
    }
  }

  return result;
}

/**
 * 将 INI 键名映射到 EditorCharacterConfig 键名
 * C# 中使用的是 Pascal 命名，我们使用 camelCase
 */
const keyMapping: Record<string, keyof EditorCharacterConfig> = {
  Name: "name",
  Kind: "kind",
  Relation: "relation",
  Group: "group",
  NoAutoAttackPlayer: "noAutoAttackPlayer",
  NpcIni: "npcIni",
  BodyIni: "bodyIni",
  FlyIni: "flyIni",
  FlyIni2: "flyIni2",
  FlyInis: "flyInis",
  DropIni: "dropIni",
  Life: "life",
  LifeMax: "lifeMax",
  Thew: "thew",
  ThewMax: "thewMax",
  Mana: "mana",
  ManaMax: "manaMax",
  Attack: "attack",
  Attack2: "attack2",
  Attack3: "attack3",
  AttackLevel: "attackLevel",
  Defend: "defend",
  Defence: "defend", // C# 有拼写变体
  Defend2: "defend2",
  Defend3: "defend3",
  Evade: "evade",
  Exp: "exp",
  ExpBonus: "expBonus",
  LevelUpExp: "levelUpExp",
  Level: "level",
  CanLevelUp: "canLevelUp",
  Dir: "dir",
  WalkSpeed: "walkSpeed",
  AddMoveSpeedPercent: "addMoveSpeedPercent",
  PathFinder: "pathFinder",
  VisionRadius: "visionRadius",
  DialogRadius: "dialogRadius",
  AttackRadius: "attackRadius",
  Lum: "lum",
  Action: "action",
  Idle: "idle",
  FixedPos: "fixedPos",
  AIType: "aiType",
  MagicToUseWhenLifeLow: "magicToUseWhenLifeLow",
  KeepRadiusWhenLifeLow: "keepRadiusWhenLifeLow",
  LifeLowPercent: "lifeLowPercent",
  StopFindingTarget: "stopFindingTarget",
  KeepRadiusWhenFriendDeath: "keepRadiusWhenFriendDeath",
  MagicToUseWhenBeAttacked: "magicToUseWhenBeAttacked",
  MagicDirectionWhenBeAttacked: "magicDirectionWhenBeAttacked",
  MagicToUseWhenDeath: "magicToUseWhenDeath",
  MagicDirectionWhenDeath: "magicDirectionWhenDeath",
  ScriptFile: "scriptFile",
  ScriptFileRight: "scriptFileRight",
  CanInteractDirectly: "canInteractDirectly",
  TimerScriptFile: "timerScriptFile",
  TimerScriptInterval: "timerScriptInterval",
  DeathScript: "deathScript",
  BuyIniFile: "buyIniFile",
  Invincible: "invincible",
  NoDropWhenDie: "noDropWhenDie",
  ReviveMilliseconds: "reviveMilliseconds",
  VisibleVariableName: "visibleVariableName",
  VisibleVariableValue: "visibleVariableValue",
  HurtPlayerInterval: "hurtPlayerInterval",
  HurtPlayerLife: "hurtPlayerLife",
  HurtPlayerRadius: "hurtPlayerRadius",
  MapX: "mapX",
  MapY: "mapY",
};

/** 数字类型字段 */
const numberFields: Set<keyof EditorCharacterConfig> = new Set([
  "kind",
  "relation",
  "group",
  "noAutoAttackPlayer",
  "life",
  "lifeMax",
  "thew",
  "thewMax",
  "mana",
  "manaMax",
  "attack",
  "attack2",
  "attack3",
  "attackLevel",
  "defend",
  "defend2",
  "defend3",
  "evade",
  "exp",
  "expBonus",
  "levelUpExp",
  "level",
  "canLevelUp",
  "dir",
  "walkSpeed",
  "addMoveSpeedPercent",
  "pathFinder",
  "visionRadius",
  "dialogRadius",
  "attackRadius",
  "lum",
  "action",
  "idle",
  "aiType",
  "keepRadiusWhenLifeLow",
  "lifeLowPercent",
  "stopFindingTarget",
  "keepRadiusWhenFriendDeath",
  "magicDirectionWhenBeAttacked",
  "magicDirectionWhenDeath",
  "canInteractDirectly",
  "timerScriptInterval",
  "invincible",
  "noDropWhenDie",
  "reviveMilliseconds",
  "visibleVariableValue",
  "hurtPlayerInterval",
  "hurtPlayerLife",
  "hurtPlayerRadius",
  "mapX",
  "mapY",
]);

/**
 * 解析角色配置 INI 内容
 * @param content INI 文件内容
 * @returns 角色配置对象
 */
export function parseCharacterIni(content: string): EditorCharacterConfig {
  const sections = parseIniContent(content);
  const initSection = sections.INIT || sections.Init || sections.init || {};

  const config: EditorCharacterConfig = { ...defaultEditorCharacterConfig };

  for (const [iniKey, value] of Object.entries(initSection)) {
    const configKey = keyMapping[iniKey];
    if (!configKey) {
      // 未知字段，跳过
      continue;
    }

    if (numberFields.has(configKey)) {
      // 数字字段
      const numVal = Number.parseInt(value, 10);
      if (!Number.isNaN(numVal)) {
        (config as unknown as Record<string, unknown>)[configKey] = numVal;
      }
    } else {
      // 字符串字段
      (config as unknown as Record<string, unknown>)[configKey] = value;
    }
  }

  return config;
}

/**
 * 解析 NPC 资源配置（npcres 目录下的 .ini 文件）
 * @param content INI 文件内容
 * @returns NPC 资源配置
 */
export function parseNpcResIni(content: string): NpcResConfig {
  const sections = parseIniContent(content);
  const config: NpcResConfig = {};

  const stateNames: (keyof NpcResConfig)[] = [
    "Stand",
    "Stand1",
    "Walk",
    "Run",
    "Jump",
    "Attack",
    "Attack1",
    "Attack2",
    "Magic",
    "Hurt",
    "Death",
    "FightStand",
    "FightStand1",
    "FightWalk",
    "FightRun",
    "FightJump",
    "Sit",
  ];

  for (const stateName of stateNames) {
    const section = sections[stateName];
    if (section) {
      const stateInfo: NpcResStateInfo = {
        image: section.Image || section.image || "",
        sound: section.Sound || section.sound || "",
      };
      config[stateName] = stateInfo;
    }
  }

  return config;
}

/**
 * 将 EditorCharacterConfig 转换为 JSON 格式
 * @param config 角色配置
 * @returns JSON 字符串
 */
export function characterConfigToJson(config: EditorCharacterConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * 将 EditorCharacterConfig 转换为 INI 格式
 * @param config 角色配置
 * @returns INI 字符串
 */
export function characterConfigToIni(config: EditorCharacterConfig): string {
  const lines: string[] = ["[INIT]"];

  // 逆向映射：configKey -> iniKey
  const reverseMapping: Record<string, string> = {};
  for (const [iniKey, configKey] of Object.entries(keyMapping)) {
    // 优先使用首个映射
    if (!reverseMapping[configKey]) {
      reverseMapping[configKey] = iniKey;
    }
  }

  // 按照字段分组输出，过滤掉默认值
  for (const [key, value] of Object.entries(config)) {
    const iniKey = reverseMapping[key];
    if (!iniKey) continue;

    const defaultValue = defaultEditorCharacterConfig[key as keyof EditorCharacterConfig];

    // 跳过默认值（节省空间）
    if (value === defaultValue) continue;

    // 跳过空字符串
    if (typeof value === "string" && value === "") continue;

    lines.push(`${iniKey}=${value}`);
  }

  return lines.join("\n");
}

/**
 * 从 JSON 解析 EditorCharacterConfig
 * @param json JSON 字符串
 * @returns 角色配置对象
 */
export function parseCharacterJson(json: string): EditorCharacterConfig {
  const parsed = JSON.parse(json) as Partial<EditorCharacterConfig>;
  return { ...defaultEditorCharacterConfig, ...parsed };
}
