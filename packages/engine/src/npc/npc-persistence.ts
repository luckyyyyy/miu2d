/**
 * NPC 持久化工具函数
 * 从 NpcManager 提取的纯数据转换逻辑，无副作用
 */

import type { CharacterConfig, Vector2 } from "../core/types";
import type { CharacterKind, RelationType } from "../core/types";
import type { NpcSaveItem } from "../runtime/storage";
import type { Npc } from "./npc";

/** NPC 的额外状态（不属于 CharacterConfig 的部分） */
export interface NpcExtraState {
  // 基本状态
  state?: number;
  action: number;
  /** script-controlled hiding (IsVisible is computed from magic time) */
  isHide: boolean;
  isAIDisabled: boolean;

  // 死亡/复活
  isDeath: boolean;
  isDeathInvoked: boolean;
  invincible: number;
  reviveMilliseconds: number;
  leftMillisecondsToRevive: number;

  // 脚本
  scriptFileRight?: string;
  timerScriptFile?: string;
  timerScriptInterval?: number;

  // 配置
  dropIni?: string;
  buyIniFile?: string;
  buyIniString?: string;
  actionPathTilePositions?: Array<{ x: number; y: number }>;

  // 属性 (存档专用)
  attack3: number;
  defend3: number;
  canLevelUp: number;

  // 位置相关
  currentFixedPosIndex: number;
  destinationMapPosX: number;
  destinationMapPosY: number;

  // INI 文件
  isBodyIniAdded: number;

  // 状态效果
  poisonSeconds: number;
  poisonByCharacterName?: string;
  petrifiedSeconds: number;
  frozenSeconds: number;
  isPoisonVisualEffect: boolean;
  isPetrifiedVisualEffect: boolean;
  isFrozenVisualEffect: boolean;

  // 装备
  canEquip: number;
  headEquip?: string;
  neckEquip?: string;
  bodyEquip?: string;
  backEquip?: string;
  handEquip?: string;
  wristEquip?: string;
  footEquip?: string;
  backgroundTextureEquip?: string;

  // 保持攻击位置
  keepAttackX: number;
  keepAttackY: number;

  // 等级配置
  levelIniFile?: string;
}

/** parseNpcData 的返回类型 */
export interface ParsedNpcData {
  config: CharacterConfig;
  extraState: NpcExtraState;
  mapX: number;
  mapY: number;
  dir: number;
}

/**
 * 解析 NPC 数据为配置和额外状态
 * 纯函数，同时支持 INI 解析数据（Record<string, string>）和 JSON 存档数据
 *
 * 这个接口同时支持：
 * 1. .npc 文件加载（INI 格式，解析后变成 Record<string, string>）
 * 2. JSON 存档加载（完整类型的对象）
 */
export function parseNpcData(data: Record<string, unknown>): ParsedNpcData {
  // 辅助函数：解析数字，兼容 string 和 number
  const parseNum = (val: unknown, def: number): number => {
    if (val === undefined || val === null || val === "") return def;
    return typeof val === "number" ? val : parseInt(String(val), 10);
  };
  const parseStr = (val: unknown, def: string = ""): string => {
    return val !== undefined && val !== null ? String(val) : def;
  };
  const parseBool = (val: unknown, def: boolean = false): boolean => {
    if (val === undefined || val === null) return def;
    if (typeof val === "boolean") return val;
    return val === "1" || val === "true" || val === 1;
  };

  // 基础信息
  const name = parseStr(data.Name ?? data.name);
  const npcIni = parseStr(data.NpcIni ?? data.npcIni);
  const mapX = parseNum(data.MapX ?? data.mapX, 0);
  const mapY = parseNum(data.MapY ?? data.mapY, 0);
  const dir = parseNum(data.Dir ?? data.dir, 4);
  const kind = parseNum(data.Kind ?? data.kind, 0);
  const relation = parseNum(data.Relation ?? data.relation, 0);
  const group = parseNum(data.Group ?? data.group, 0);
  const pathFinder = parseNum(data.PathFinder ?? data.pathFinder, 0);
  const action = parseNum(data.Action ?? data.action, 0);
  const noAutoAttackPlayer = parseNum(data.NoAutoAttackPlayer ?? data.noAutoAttackPlayer, 0);
  const idle = parseNum(data.Idle ?? data.idle, 0);

  // 属性
  const walkSpeed = parseNum(data.WalkSpeed ?? data.walkSpeed, 1);
  const addMoveSpeedPercent = parseNum(data.AddMoveSpeedPercent ?? data.addMoveSpeedPercent, 0);
  const dialogRadius = parseNum(data.DialogRadius ?? data.dialogRadius, 1);
  const visionRadius = parseNum(data.VisionRadius ?? data.visionRadius, 10);
  const attackRadius = parseNum(data.AttackRadius ?? data.attackRadius, 1);

  // 战斗属性
  const life = parseNum(data.Life ?? data.life, 100);
  const lifeMax = parseNum(data.LifeMax ?? data.lifeMax, 100);
  const mana = parseNum(data.Mana ?? data.mana, 100);
  const manaMax = parseNum(data.ManaMax ?? data.manaMax, 100);
  const thew = parseNum(data.Thew ?? data.thew, 100);
  const thewMax = parseNum(data.ThewMax ?? data.thewMax, 100);
  const attack = parseNum(data.Attack ?? data.attack, 10);
  const attack2 = parseNum(data.Attack2 ?? data.attack2, 0);
  const attackLevel = parseNum(data.AttackLevel ?? data.attackLevel, 0);
  // Defence is alias for Defend
  const defend = parseNum(data.Defend ?? data.defend ?? data.Defence ?? data.defence, 10);
  const defend2 = parseNum(data.Defend2 ?? data.defend2, 0);
  const evade = parseNum(data.Evade ?? data.evade, 0);
  const level = parseNum(data.Level ?? data.level, 1);
  const exp = parseNum(data.Exp ?? data.exp, 0);
  const levelUpExp = parseNum(data.LevelUpExp ?? data.levelUpExp, 100);
  const expBonus = parseNum(data.ExpBonus ?? data.expBonus, 0); // Boss判断
  const lum = parseNum(data.Lum ?? data.lum, 0);

  // 脚本和资源
  const scriptFile = parseStr(data.ScriptFile ?? data.scriptFile);
  const scriptFileRight = parseStr(data.ScriptFileRight ?? data.scriptFileRight);
  const deathScript = parseStr(data.DeathScript ?? data.deathScript);
  const bodyIni = parseStr(data.BodyIni ?? data.bodyIni);
  const flyIni = parseStr(data.FlyIni ?? data.flyIni);
  const flyIni2 = parseStr(data.FlyIni2 ?? data.flyIni2);
  const flyInis = parseStr(data.FlyInis ?? data.flyInis);

  // 状态（只有 JSON 存档才有）
  const state = data.state !== undefined ? parseNum(data.state, 0) : undefined;
  // IsHide is script-controlled hiding, IsVisible is magic invisibility (computed)
  // Web 存档兼容：同时支持 isHide 和旧的 isVisible 字段
  // 注意：只有当字段明确存在时才使用，否则默认 isHide = false
  const isHide =
    data.isHide !== undefined
      ? parseBool(data.isHide, false)
      : data.isVisible !== undefined
        ? !parseBool(data.isVisible, true)
        : false;
  const isAIDisabled = parseBool(data.isAIDisabled, false);
  const isDeath = parseBool(data.isDeath, false);
  const isDeathInvoked = parseBool(data.isDeathInvoked, false);
  const invincible = parseNum(data.invincible ?? data.Invincible, 0);
  const reviveMilliseconds = parseNum(data.reviveMilliseconds ?? data.ReviveMilliseconds, 0);
  const leftMillisecondsToRevive = parseNum(
    data.leftMillisecondsToRevive ?? data.LeftMillisecondsToRevive,
    0
  );

  // 额外属性（只有 JSON 存档才有）
  const timerScriptFile = parseStr(data.timerScriptFile ?? data.TimerScriptFile);
  const timerScriptInterval = parseNum(data.timerScriptInterval ?? data.TimerScriptInterval, 0);
  const dropIni = parseStr(data.dropIni ?? data.DropIni);
  const buyIniFile = parseStr(data.buyIniFile ?? data.BuyIniFile);
  const actionPathTilePositions = (data.actionPathTilePositions ?? undefined) as
    | Vector2[]
    | undefined;

  // === AI 相关字段 ===
  const aiType = parseNum(data.AIType ?? data.aiType, 0);
  const keepRadiusWhenLifeLow = parseNum(
    data.KeepRadiusWhenLifeLow ?? data.keepRadiusWhenLifeLow,
    0
  );
  const lifeLowPercent = parseNum(data.LifeLowPercent ?? data.lifeLowPercent, 20);
  const stopFindingTarget = parseNum(data.StopFindingTarget ?? data.stopFindingTarget, 0);
  const keepRadiusWhenFriendDeath = parseNum(
    data.KeepRadiusWhenFriendDeath ?? data.keepRadiusWhenFriendDeath,
    0
  );

  // === Hurt Player (接触伤害) ===
  const hurtPlayerInterval = parseNum(data.HurtPlayerInterval ?? data.hurtPlayerInterval, 0);
  const hurtPlayerLife = parseNum(data.HurtPlayerLife ?? data.hurtPlayerLife, 0);
  const hurtPlayerRadius = parseNum(data.HurtPlayerRadius ?? data.hurtPlayerRadius, 0);

  // === Magic Direction ===
  const magicDirectionWhenBeAttacked = parseNum(
    data.MagicDirectionWhenBeAttacked ?? data.magicDirectionWhenBeAttacked,
    0
  );
  const magicDirectionWhenDeath = parseNum(
    data.MagicDirectionWhenDeath ?? data.magicDirectionWhenDeath,
    0
  );

  // === Visibility Control ===
  const fixedPos = parseStr(data.FixedPos ?? data.fixedPos);
  const visibleVariableName = parseStr(data.VisibleVariableName ?? data.visibleVariableName);
  const visibleVariableValue = parseNum(
    data.VisibleVariableValue ?? data.visibleVariableValue,
    0
  );

  // === Auto Magic ===
  const magicToUseWhenLifeLow = parseStr(
    data.MagicToUseWhenLifeLow ?? data.magicToUseWhenLifeLow
  );
  const magicToUseWhenBeAttacked = parseStr(
    data.MagicToUseWhenBeAttacked ?? data.magicToUseWhenBeAttacked
  );
  const magicToUseWhenDeath = parseStr(data.MagicToUseWhenDeath ?? data.magicToUseWhenDeath);

  // === Drop Control ===
  const noDropWhenDie = parseNum(data.NoDropWhenDie ?? data.noDropWhenDie, 0);

  const config: CharacterConfig = {
    name,
    npcIni,
    kind: kind as CharacterKind,
    relation: relation as RelationType,
    group,
    noAutoAttackPlayer,
    scriptFile: scriptFile || undefined,
    scriptFileRight: scriptFileRight || undefined,
    deathScript: deathScript || undefined,
    bodyIni: bodyIni || undefined,
    flyIni: flyIni || undefined,
    flyIni2: flyIni2 || undefined,
    flyInis: flyInis || undefined,
    idle,
    expBonus, // Boss判断（>0为Boss）
    // === AI/Combat Fields ===
    dropIni: dropIni || undefined,
    buyIniFile: buyIniFile || undefined,
    keepRadiusWhenLifeLow,
    lifeLowPercent,
    stopFindingTarget,
    keepRadiusWhenFriendDeath,
    aiType,
    invincible,
    reviveMilliseconds,
    // === Hurt Player ===
    hurtPlayerInterval,
    hurtPlayerLife,
    hurtPlayerRadius,
    // === Magic Direction ===
    magicDirectionWhenBeAttacked,
    magicDirectionWhenDeath,
    // === Visibility Control ===
    fixedPos: fixedPos || undefined,
    visibleVariableName: visibleVariableName || undefined,
    visibleVariableValue,
    // === Auto Magic ===
    magicToUseWhenLifeLow: magicToUseWhenLifeLow || undefined,
    magicToUseWhenBeAttacked: magicToUseWhenBeAttacked || undefined,
    magicToUseWhenDeath: magicToUseWhenDeath || undefined,
    // === Drop Control ===
    noDropWhenDie,
    stats: {
      life,
      lifeMax,
      mana,
      manaMax,
      thew,
      thewMax,
      attack,
      attack2,
      attack3: 0,
      attackLevel,
      defend,
      defend2,
      defend3: 0,
      evade,
      exp,
      levelUpExp,
      level,
      canLevelUp: 0,
      walkSpeed,
      addMoveSpeedPercent,
      visionRadius,
      attackRadius,
      dialogRadius,
      lum,
      action,
    },
    pathFinder,
  };

  // 解析更多存档专用字段
  const attack3 = parseNum(data.Attack3 ?? data.attack3, 0);
  const defend3 = parseNum(data.Defend3 ?? data.defend3, 0);
  const canLevelUp = parseNum(data.CanLevelUp ?? data.canLevelUp, 0);
  const currentFixedPosIndex = parseNum(
    data.CurrentFixedPosIndex ?? data.currentFixedPosIndex,
    0
  );
  const destinationMapPosX = parseNum(data.DestinationMapPosX ?? data.destinationMapPosX, 0);
  const destinationMapPosY = parseNum(data.DestinationMapPosY ?? data.destinationMapPosY, 0);
  const isBodyIniAdded = parseNum(data.IsBodyIniAdded ?? data.isBodyIniAdded, 0);
  const poisonSeconds = parseNum(data.PoisonSeconds ?? data.poisonSeconds, 0);
  const poisonByCharacterName = parseStr(
    data.PoisonByCharacterName ?? data.poisonByCharacterName
  );
  const petrifiedSeconds = parseNum(data.PetrifiedSeconds ?? data.petrifiedSeconds, 0);
  const frozenSeconds = parseNum(data.FrozenSeconds ?? data.frozenSeconds, 0);
  const isPoisonVisualEffect = parseBool(
    data.IsPoisonVisualEffect ?? data.isPoisonVisualEffect,
    false
  );
  const isPetrifiedVisualEffect = parseBool(
    data.IsPetrifiedVisualEffect ?? data.isPetrifiedVisualEffect,
    false
  );
  const isFrozenVisualEffect = parseBool(
    data.IsFrozenVisualEffect ?? data.isFrozenVisualEffect,
    false
  );
  const buyIniString = parseStr(data.BuyIniString ?? data.buyIniString);
  const canEquip = parseNum(data.CanEquip ?? data.canEquip, 0);
  const headEquip = parseStr(data.HeadEquip ?? data.headEquip);
  const neckEquip = parseStr(data.NeckEquip ?? data.neckEquip);
  const bodyEquip = parseStr(data.BodyEquip ?? data.bodyEquip);
  const backEquip = parseStr(data.BackEquip ?? data.backEquip);
  const handEquip = parseStr(data.HandEquip ?? data.handEquip);
  const wristEquip = parseStr(data.WristEquip ?? data.wristEquip);
  const footEquip = parseStr(data.FootEquip ?? data.footEquip);
  const backgroundTextureEquip = parseStr(
    data.BackgroundTextureEquip ?? data.backgroundTextureEquip
  );
  const keepAttackX = parseNum(data.KeepAttackX ?? data.keepAttackX, 0);
  const keepAttackY = parseNum(data.KeepAttackY ?? data.keepAttackY, 0);
  const levelIniFile = parseStr(data.LevelIni ?? data.LevelIniFile ?? data.levelIniFile);

  return {
    config,
    extraState: {
      // 基本状态
      state,
      action,
      isHide,
      isAIDisabled,

      // 死亡/复活
      isDeath,
      isDeathInvoked,
      invincible,
      reviveMilliseconds,
      leftMillisecondsToRevive,

      // 脚本
      scriptFileRight: scriptFileRight || undefined,
      timerScriptFile: timerScriptFile || undefined,
      timerScriptInterval,

      // 配置
      dropIni: dropIni || undefined,
      buyIniFile: buyIniFile || undefined,
      buyIniString: buyIniString || undefined,
      actionPathTilePositions,

      // 属性 (存档专用)
      attack3,
      defend3,
      canLevelUp,

      // 位置相关
      currentFixedPosIndex,
      destinationMapPosX,
      destinationMapPosY,

      // INI 文件
      isBodyIniAdded,

      // 状态效果
      poisonSeconds,
      poisonByCharacterName: poisonByCharacterName || undefined,
      petrifiedSeconds,
      frozenSeconds,
      isPoisonVisualEffect,
      isPetrifiedVisualEffect,
      isFrozenVisualEffect,

      // 装备
      canEquip,
      headEquip: headEquip || undefined,
      neckEquip: neckEquip || undefined,
      bodyEquip: bodyEquip || undefined,
      backEquip: backEquip || undefined,
      handEquip: handEquip || undefined,
      wristEquip: wristEquip || undefined,
      footEquip: footEquip || undefined,
      backgroundTextureEquip: backgroundTextureEquip || undefined,

      // 保持攻击位置
      keepAttackX,
      keepAttackY,

      // 等级配置
      levelIniFile: levelIniFile || undefined,
    },
    mapX,
    mapY,
    dir,
  };
}

/**
 * 收集 NPC 快照为 NpcSaveItem[]
 * 纯查询函数，不修改任何状态
 *
 * @param npcs NPC 集合
 * @param partnersOnly 是否只收集伙伴
 */
export function collectNpcSnapshot(
  npcs: Map<string, Npc>,
  partnersOnly: boolean
): NpcSaveItem[] {
  const items: NpcSaveItem[] = [];

  for (const [, npc] of npcs) {
    // 根据 partnersOnly 参数过滤
    if (partnersOnly !== npc.isPartner) continue;
    // 跳过被魔法召唤的 NPC
    if (npc.summonedByMagicSprite !== null) continue;

    const item: NpcSaveItem = {
      name: npc.name,
      npcIni: npc.npcIni,
      kind: npc.kind,
      relation: npc.relation,
      pathFinder: npc.pathFinder,
      state: npc.state,
      mapX: npc.mapX,
      mapY: npc.mapY,
      dir: npc.currentDirection,
      visionRadius: npc.visionRadius,
      dialogRadius: npc.dialogRadius,
      attackRadius: npc.attackRadius,
      level: npc.level,
      exp: npc.exp,
      levelUpExp: npc.levelUpExp,
      life: npc.life,
      lifeMax: npc.lifeMax,
      thew: npc.thew,
      thewMax: npc.thewMax,
      mana: npc.mana,
      manaMax: npc.manaMax,
      attack: npc.attack,
      attack2: npc.attack2,
      attack3: npc.attack3,
      attackLevel: npc.attackLevel,
      defend: npc.defend,
      defend2: npc.defend2,
      defend3: npc.defend3,
      evade: npc.evade,
      lum: npc.lum,
      action: npc.actionType,
      walkSpeed: npc.walkSpeed,
      addMoveSpeedPercent: npc.addMoveSpeedPercent,
      expBonus: npc.expBonus,
      canLevelUp: npc.canLevelUp,
      fixedPos: npc.fixedPos,
      currentFixedPosIndex: npc.currentFixedPosIndex,
      destinationMapPosX: npc.destinationMoveTilePosition.x,
      destinationMapPosY: npc.destinationMoveTilePosition.y,
      idle: npc.idle,
      group: npc.group,
      noAutoAttackPlayer: npc.noAutoAttackPlayer,
      invincible: npc.invincible,
      poisonSeconds: npc.poisonSeconds,
      poisonByCharacterName: npc.poisonByCharacterName,
      petrifiedSeconds: npc.petrifiedSeconds,
      frozenSeconds: npc.frozenSeconds,
      isPoisonVisualEffect: npc.isPoisonVisualEffect,
      isPetrifiedVisualEffect: npc.isPetrifiedVisualEffect,
      isFrozenVisualEffect: npc.isFrozenVisualEffect,
      isDeath: npc.isDeath,
      isDeathInvoked: npc.isDeathInvoked,
      reviveMilliseconds: npc.reviveMilliseconds,
      leftMillisecondsToRevive: npc.leftMillisecondsToRevive,
      bodyIni: npc.bodyIni || undefined,
      flyIni: npc.flyIni || undefined,
      flyIni2: npc.flyIni2 || undefined,
      flyInis: npc.flyInis || undefined,
      isBodyIniAdded: npc.isBodyIniAdded,
      scriptFile: npc.scriptFile || undefined,
      scriptFileRight: npc.scriptFileRight || undefined,
      deathScript: npc.deathScript || undefined,
      timerScriptFile: npc.timerScript || undefined,
      timerScriptInterval: npc.timerInterval,
      magicToUseWhenLifeLow: npc.magicToUseWhenLifeLow || undefined,
      lifeLowPercent: npc.lifeLowPercent,
      keepRadiusWhenLifeLow: npc.keepRadiusWhenLifeLow,
      keepRadiusWhenFriendDeath: npc.keepRadiusWhenFriendDeath,
      magicToUseWhenBeAttacked: npc.magicToUseWhenBeAttacked || undefined,
      magicDirectionWhenBeAttacked: npc.magicDirectionWhenBeAttacked,
      magicToUseWhenDeath: npc.magicToUseWhenDeath || undefined,
      magicDirectionWhenDeath: npc.magicDirectionWhenDeath,
      buyIniFile: npc.buyIniFile || undefined,
      buyIniString: npc.buyIniString || undefined,
      visibleVariableName: npc.visibleVariableName || undefined,
      visibleVariableValue: npc.visibleVariableValue,
      dropIni: npc.dropIni || undefined,
      canEquip: npc.canEquip,
      headEquip: npc.headEquip || undefined,
      neckEquip: npc.neckEquip || undefined,
      bodyEquip: npc.bodyEquip || undefined,
      backEquip: npc.backEquip || undefined,
      handEquip: npc.handEquip || undefined,
      wristEquip: npc.wristEquip || undefined,
      footEquip: npc.footEquip || undefined,
      backgroundTextureEquip: npc.backgroundTextureEquip || undefined,
      keepAttackX: npc.keepAttackX,
      keepAttackY: npc.keepAttackY,
      hurtPlayerInterval: npc.hurtPlayerInterval,
      hurtPlayerLife: npc.hurtPlayerLife,
      hurtPlayerRadius: npc.hurtPlayerRadius,
      isHide: npc.isHide,
      isAIDisabled: npc.isAIDisabled,
      actionPathTilePositions:
        npc.actionPathTilePositions?.length > 0
          ? npc.actionPathTilePositions.map((p) => ({ x: p.x, y: p.y }))
          : undefined,
      levelIniFile: npc.levelIniFile || undefined,
    };

    items.push(item);
  }

  return items;
}
