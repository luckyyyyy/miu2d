/**
 * Magic Types - based on JxqyHD Engine/Magic.cs
 * 武功系统类型定义
 */

import type { Vector2 } from "../core/types";

// ========== 全局常量 ==========

/**
 * 武功基础速度
 * Globals.MagicBasespeed = 100
 */
export const MAGIC_BASE_SPEED = 100;

/**
 * 武功移动类型
 * 决定武功的运动轨迹
 *
 * MagicManager.cs 中的 switch (magic.MoveKind) 参考
 */
export enum MagicMoveKind {
  NoMove = 0, // 不移动
  FixedPosition = 1, // 固定位置 (AddFixedPositionMagicSprite)
  SingleMove = 2, // 单个移动 - 向鼠标方向飞，**自由方向** (GetMoveMagicSprite)
  LineMove = 3, // 直线移动 - 多个，按等级增加数量 (AddLineMoveMagicSprite)
  CircleMove = 4, // 圆形移动 (AddCircleMoveMagicSprite)
  HeartMove = 5, // 心形移动 (AddHeartMoveMagicSprite)
  SpiralMove = 6, // 螺旋移动 (AddSpiralMoveMagicSprite)
  SectorMove = 7, // 扇形移动 (AddSectorMoveMagicSprite)
  RandomSector = 8, // 随机扇形 (AddRandomSectorMoveMagicSprite)
  FixedWall = 9, // 固定墙 (AddFixedWallMagicSprite)
  WallMove = 10, // 墙移动 (AddWallMoveMagicSprite)
  RegionBased = 11, // 区域类型 - 根据 Region 决定具体类型
  // 12 unused
  FollowCharacter = 13, // 跟随角色 (AddFollowCharacterMagicSprite)
  // 14 unused
  SuperMode = 15, // 超级模式 (AddSuperModeMagic)
  FollowEnemy = 16, // 跟随敌人 (AddFollowEnemyMagicSprite)
  Throw = 17, // 投掷 (AddThrowMagicSprite)
  // 18 empty
  Kind19 = 19, // 特殊类型19 - 持续留痕武功
  Transport = 20, // 传送
  PlayerControl = 21, // 玩家控制角色
  Summon = 22, // 召唤 NPC
  TimeStop = 23, // 时间停止 (same as FollowCharacter)
  VMove = 24, // V字移动 (AddVMoveMagicSprite)
}

/**
 * 武功特殊效果类型
 *
 * 注意：这些值在 MoveKind=13 (FollowCharacter) 时有特殊含义
 * switch (magic.SpecialKind)
 *
 * 在 MoveKind=13 (自身增益类武功) 时:
 * - 1: 加生命 (清心咒)
 * - 2: 加体力
 * - 3,6: 持续效果 (金钟罩等BUFF)
 * - 4: 隐身 (攻击时消失)
 * - 5: 隐身 (攻击时可见)
 * - 7: 变身
 * - 8: 解除异常状态
 * - 9: 改变飞行ini
 */
export enum MagicSpecialKind {
  None = 0,
  // MoveKind=13 时: 加生命; 其他: 冰冻
  AddLifeOrFrozen = 1,
  // MoveKind=13 时: 加体力; 其他: 中毒
  AddThewOrPoison = 2,
  // MoveKind=13 时: 持续效果; 其他: 石化
  BuffOrPetrify = 3,
  // MoveKind=13 时: 隐身(攻击时消失)
  InvisibleHide = 4,
  // MoveKind=13 时: 隐身(攻击时可见)
  InvisibleShow = 5,
  // MoveKind=13 时: 持续效果
  Buff = 6,
  // 变身
  ChangeCharacter = 7,
  // 解除异常状态
  RemoveAbnormal = 8,
  // 改变飞行ini
  ChangeFlyIni = 9,
}

/**
 * 附加效果
 */
export enum MagicAddonEffect {
  None = 0,
  Frozen = 1,
  Poison = 2,
  Petrified = 3,
}

/**
 * 副作用伤害类型
 */
export enum SideEffectDamageType {
  Life = 0,
  Mana = 1,
  Thew = 2,
}

/**
 * 恢复属性类型
 */
export enum RestorePropertyType {
  Life = 0,
  Mana = 1,
  Thew = 2,
}

/**
 * 武功数据类的核心属性
 */
export interface MagicData {
  // 基础信息
  fileName: string; // 文件名
  name: string; // 武功名称
  intro: string; // 武功介绍
  type?: string; // 类型

  // 运动属性
  speed: number; // 速度
  moveKind: MagicMoveKind; // 移动类型
  region: number; // 区域

  // 特效属性
  specialKind: MagicSpecialKind; // 特殊效果
  specialKindValue: number; // 特殊效果值
  specialKindMilliSeconds: number; // 特殊效果持续时间
  noSpecialKindEffect: number; // 禁用特效动画
  alphaBlend: number; // 透明混合
  flyingLum: number; // 飞行亮度
  vanishLum: number; // 消失亮度

  // 图像资源
  image?: string; // 武功图像
  icon?: string; // 图标
  flyingImage?: string; // 飞行图像
  vanishImage?: string; // 消失图像
  superModeImage?: string; // 超级模式图像
  leapImage?: string; // 跳跃图像
  useActionFile?: string; // 使用动作文件
  hitCountFlyingImage?: string; // 连击飞行图像
  hitCountVanishImage?: string; // 连击消失图像

  // 声音资源
  flyingSound?: string; // 飞行声音
  vanishSound?: string; // 消失声音

  // 帧相关
  waitFrame: number; // 等待帧数
  lifeFrame: number; // 生命帧数

  // 从属关系
  belong: number; // 从属
  actionFile?: string; // 动作文件
  attackFile?: string; // 攻击文件

  // 关联武功
  explodeMagicFile?: string; // 爆炸武功
  randMagicFile?: string; // 随机武功
  randMagicProbability: number; // 随机武功概率
  flyMagic?: string; // 飞行武功
  flyInterval: number; // 飞行间隔
  secondMagicFile?: string; // 第二武功
  secondMagicDelay: number; // 第二武功延迟
  magicToUseWhenKillEnemy?: string; // 杀敌时使用的武功
  magicDirectionWhenKillEnemy: number; // 杀敌武功方向
  bounceFlyEndMagic?: string; // 弹飞结束武功
  magicDirectionWhenBounceFlyEnd: number; // 弹飞结束武功方向
  changeMagic?: string; // 变化武功
  parasiticMagic?: string; // 寄生武功
  jumpEndMagic?: string; // 跳跃结束武功
  regionFile?: string; // 区域文件
  magicToUseWhenBeAttacked?: string; // 被攻击时使用的武功
  magicDirectionWhenBeAttacked: number; // 被攻击武功方向
  magicWhenNewPos?: string; // 新位置武功
  replaceMagic?: string; // 替换武功

  // 效果值
  effect: number; // 主效果 - 伤害/治疗量
  effect2: number; // 效果2
  effect3: number; // 效果3
  effectExt: number; // 效果扩展
  effectMana: number; // 内力效果

  // 消耗
  manaCost: number; // 内力消耗
  thewCost: number; // 体力消耗
  lifeCost: number; // 生命消耗

  // 升级
  levelupExp: number; // 升级所需经验
  currentLevel: number; // 当前等级
  effectLevel: number; // 效果等级
  maxLevel: number; // 最大等级

  // 冷却
  coldMilliSeconds: number; // 冷却时间
  keepMilliseconds: number; // 保持时间
  changeToFriendMilliseconds: number; // 转友时间

  // 计数
  count: number; // 数量
  maxCount: number; // 最大数量

  // 杂项标志
  passThrough: number; // 穿透
  passThroughWithDestroyEffect: number; // 穿透带销毁特效
  passThroughWall: number; // 穿墙
  attackAll: number; // 攻击全部
  noInterruption: number; // 不打断
  vibratingScreen: number; // 震屏
  bodyRadius: number; // 身体半径
  solid: number; // 实体
  noExplodeWhenLifeFrameEnd: number; // 生命结束不爆炸
  explodeWhenLifeFrameEnd: number; // 生命结束爆炸
  discardOppositeMagic: number; // 抵消对方武功
  exchangeUser: number; // 交换使用者

  // 起始位置
  beginAtMouse: number; // 从鼠标位置开始
  beginAtUser: number; // 从使用者位置开始
  beginAtUserAddDirectionOffset: number; // 从使用者位置加方向偏移开始
  beginAtUserAddUserDirectionOffset: number; // 从使用者位置加使用者方向偏移开始

  // 移动相关
  randomMoveDegree: number; // 随机移动角度
  followMouse: number; // 跟随鼠标
  meteorMove: number; // 流星移动
  meteorMoveDir: number; // 流星移动方向
  moveBack: number; // 后退移动
  moveImitateUser: number; // 模仿使用者移动

  // 圆周运动
  circleMoveClockwise: number; // 顺时针圆周移动
  circleMoveAnticlockwise: number; // 逆时针圆周移动
  roundMoveClockwise: number; // 顺时针圆形移动
  roundMoveAnticlockwise: number; // 逆时针圆形移动
  roundMoveCount: number; // 圆形移动数量
  roundMoveDegreeSpeed: number; // 圆形移动角速度
  roundRadius: number; // 圆形半径

  // 携带使用者
  carryUser: number; // 携带使用者
  carryUserSpriteIndex: number; // 携带使用者精灵索引
  hideUserWhenCarry: number; // 携带时隐藏使用者

  // 弹跳相关
  bounce: number; // 弹跳
  bounceHurt: number; // 弹跳伤害
  ball: number; // 球
  bounceFly: number; // 弹飞
  bounceFlySpeed: number; // 弹飞速度
  bounceFlyEndHurt: number; // 弹飞结束伤害
  bounceFlyTouchHurt: number; // 弹飞触碰伤害
  sticky: number; // 粘附

  // 跟踪属性
  traceEnemy: number; // 追踪敌人
  traceSpeed: number; // 追踪速度
  traceEnemyDelayMilliseconds: number; // 追踪延迟

  // 禁用属性
  disableUse: number; // 禁用使用
  lifeFullToUse: number; // 满生命使用
  disableMoveMilliseconds: number; // 禁用移动时间
  disableSkillMilliseconds: number; // 禁用技能时间

  // 附加效果
  additionalEffect: MagicAddonEffect; // 附加效果

  // 副作用
  sideEffectProbability: number; // 副作用概率
  sideEffectPercent: number; // 副作用百分比
  sideEffectType: SideEffectDamageType; // 副作用类型

  // 恢复
  restoreProbability: number; // 恢复概率
  restorePercent: number; // 恢复百分比
  restoreType: RestorePropertyType; // 恢复类型
  dieAfterUse: number; // 使用后死亡

  // 寄生
  parasitic: number; // 寄生
  parasiticInterval: number; // 寄生间隔
  parasiticMaxEffect: number; // 寄生最大效果

  // 范围效果
  rangeEffect: number; // 范围效果
  rangeAddLife: number; // 范围加生命
  rangeAddMana: number; // 范围加内力
  rangeAddThew: number; // 范围加体力
  rangeSpeedUp: number; // 范围加速
  rangeFreeze: number; // 范围冰冻
  rangePoison: number; // 范围中毒
  rangePetrify: number; // 范围石化
  rangeDamage: number; // 范围伤害
  rangeRadius: number; // 范围半径
  rangeTimeInterval: number; // 范围时间间隔

  // 属性加成
  attackAddPercent: number; // 攻击加成百分比
  defendAddPercent: number; // 防御加成百分比
  evadeAddPercent: number; // 闪避加成百分比
  speedAddPercent: number; // 速度加成百分比

  // 变身
  morphMilliseconds: number; // 变身时间

  // 虚弱
  weakMilliseconds: number; // 虚弱时间
  weakAttackPercent: number; // 虚弱攻击百分比
  weakDefendPercent: number; // 虚弱防御百分比

  // 致盲
  blindMilliseconds: number; // 致盲时间

  // SpecialKind=9 飞行ini替换
  specialKind9ReplaceFlyIni?: string; //
  specialKind9ReplaceFlyIni2?: string; //

  // 跳跃
  leapTimes: number; // 跳跃次数
  leapFrame: number; // 跳跃帧
  effectReducePercentage: number; // 效果减少百分比

  // 复活尸体
  reviveBodyRadius: number; // 复活尸体半径
  reviveBodyMaxCount: number; // 复活尸体最大数量
  reviveBodyLifeMilliSeconds: number; // 复活尸体存活时间

  // NPC 相关
  npcFile?: string; // NPC 文件
  npcIni?: string; // NPC 配置

  // 跳跃到目标
  jumpToTarget: number; // 跳跃到目标
  jumpMoveSpeed: number; // 跳跃移动速度

  // 恢复加成
  addThewRestorePercent: number; // 体力恢复加成百分比
  addManaRestorePercent: number; // 内力恢复加成百分比
  addLifeRestorePercent: number; // 生命恢复加成百分比

  // 连击变化
  hitCountToChangeMagic: number; // 连击变化所需次数
  hitCountFlyRadius: number; // 连击飞行半径
  hitCountFlyAngleSpeed: number; // 连击飞行角速度

  // 基础属性加成
  lifeMax: number; // 生命上限加成
  thewMax: number; // 体力上限加成
  manaMax: number; // 内力上限加成
  attack: number; // 攻击加成
  defend: number; // 防御加成
  evade: number; // 闪避加成
  attack2: number; // 攻击2加成
  defend2: number; // 防御2加成
  attack3: number; // 攻击3加成
  defend3: number; // 防御3加成

  // 飞行配置
  flyIni?: string; // 飞行ini
  flyIni2?: string; // 飞行ini2

  // 物品
  goodsName?: string; // 物品名称

  // 等级数据 (用于不同等级的武功)
  levels?: Map<number, Partial<MagicData>>;
}

/**
 * 武功列表项信息
 */
export interface MagicItemInfo {
  magic: MagicData | null; // 武功数据
  level: number; // 等级
  exp: number; // 经验值
  remainColdMilliseconds: number; // 剩余冷却时间
  hideCount: number; // 隐藏计数
  lastIndexWhenHide: number; // 隐藏时的索引
}

/**
 * 武功使用参数
 */
export interface UseMagicParams {
  userId: string; // 使用者ID
  magic: MagicData; // 武功数据
  origin: Vector2; // 起点
  destination: Vector2; // 终点
  targetId?: string; // 目标ID
}

/**
 * 默认武功数据
 */
export function createDefaultMagicData(): MagicData {
  return {
    fileName: "",
    name: "",
    intro: "",
    speed: 8,
    moveKind: MagicMoveKind.NoMove,
    region: 0,
    specialKind: MagicSpecialKind.None,
    specialKindValue: 0,
    specialKindMilliSeconds: 0,
    noSpecialKindEffect: 0,
    alphaBlend: 0,
    flyingLum: 0,
    vanishLum: 0,
    waitFrame: 0,
    lifeFrame: 4,
    belong: 0,

    // 关联武功默认值
    randMagicProbability: 0,
    flyInterval: 0,
    secondMagicDelay: 0,
    magicDirectionWhenKillEnemy: 0,
    magicDirectionWhenBounceFlyEnd: 0,
    magicDirectionWhenBeAttacked: 0,

    // 效果值
    effect: 0,
    effect2: 0,
    effect3: 0,
    effectExt: 0,
    effectMana: 0,

    // 消耗
    manaCost: 0,
    thewCost: 0,
    lifeCost: 0,

    // 升级
    levelupExp: 0,
    currentLevel: 1,
    effectLevel: 0,
    maxLevel: 10,

    // 冷却和时间
    coldMilliSeconds: 0,
    keepMilliseconds: 0,
    changeToFriendMilliseconds: 0,

    // 计数
    count: 1,
    maxCount: 0,

    // 标志
    passThrough: 0,
    passThroughWithDestroyEffect: 0,
    passThroughWall: 0,
    attackAll: 0,
    noInterruption: 0,
    vibratingScreen: 0,
    bodyRadius: 0,
    solid: 0,
    noExplodeWhenLifeFrameEnd: 0,
    explodeWhenLifeFrameEnd: 0,
    discardOppositeMagic: 0,
    exchangeUser: 0,

    // 起始位置
    beginAtMouse: 0,
    beginAtUser: 0,
    beginAtUserAddDirectionOffset: 0,
    beginAtUserAddUserDirectionOffset: 0,

    // 移动
    randomMoveDegree: 0,
    followMouse: 0,
    meteorMove: 0,
    meteorMoveDir: 5,
    moveBack: 0,
    moveImitateUser: 0,

    // 圆周运动
    circleMoveClockwise: 0,
    circleMoveAnticlockwise: 0,
    roundMoveClockwise: 0,
    roundMoveAnticlockwise: 0,
    roundMoveCount: 1,
    roundMoveDegreeSpeed: 1,
    roundRadius: 1,

    // 携带
    carryUser: 0,
    carryUserSpriteIndex: 0,
    hideUserWhenCarry: 0,

    // 弹跳
    bounce: 0,
    bounceHurt: 0,
    ball: 0,
    bounceFly: 0,
    bounceFlySpeed: 32,
    bounceFlyEndHurt: 0,
    bounceFlyTouchHurt: 0,
    sticky: 0,

    // 追踪
    traceEnemy: 0,
    traceSpeed: 0,
    traceEnemyDelayMilliseconds: 0,

    // 禁用
    disableUse: 0,
    lifeFullToUse: 0,
    disableMoveMilliseconds: 0,
    disableSkillMilliseconds: 0,

    // 附加效果
    additionalEffect: MagicAddonEffect.None,

    // 副作用
    sideEffectProbability: 0,
    sideEffectPercent: 0,
    sideEffectType: SideEffectDamageType.Life,

    // 恢复
    restoreProbability: 0,
    restorePercent: 0,
    restoreType: RestorePropertyType.Life,
    dieAfterUse: 0,

    // 寄生
    parasitic: 0,
    parasiticInterval: 1000,
    parasiticMaxEffect: 0,

    // 范围效果
    rangeEffect: 0,
    rangeAddLife: 0,
    rangeAddMana: 0,
    rangeAddThew: 0,
    rangeSpeedUp: 0,
    rangeFreeze: 0,
    rangePoison: 0,
    rangePetrify: 0,
    rangeDamage: 0,
    rangeRadius: 0,
    rangeTimeInterval: 0,

    // 属性加成
    attackAddPercent: 0,
    defendAddPercent: 0,
    evadeAddPercent: 0,
    speedAddPercent: 0,

    // 变身
    morphMilliseconds: 0,

    // 虚弱
    weakMilliseconds: 0,
    weakAttackPercent: 0,
    weakDefendPercent: 0,

    // 致盲
    blindMilliseconds: 0,

    // 跳跃
    leapTimes: 0,
    leapFrame: 0,
    effectReducePercentage: 0,

    // 复活尸体
    reviveBodyRadius: 0,
    reviveBodyMaxCount: 0,
    reviveBodyLifeMilliSeconds: 0,

    // 跳跃到目标
    jumpToTarget: 0,
    jumpMoveSpeed: 32,

    // 恢复加成
    addThewRestorePercent: 0,
    addManaRestorePercent: 0,
    addLifeRestorePercent: 0,

    // 连击变化
    hitCountToChangeMagic: 0,
    hitCountFlyRadius: 0,
    hitCountFlyAngleSpeed: 0,

    // 基础属性加成
    lifeMax: 0,
    thewMax: 0,
    manaMax: 0,
    attack: 0,
    defend: 0,
    evade: 0,
    attack2: 0,
    defend2: 0,
    attack3: 0,
    defend3: 0,
  };
}

/**
 * 创建默认武功项信息
 */
export function createDefaultMagicItemInfo(
  magic: MagicData | null = null,
  level: number = 1
): MagicItemInfo {
  return {
    magic,
    level,
    exp: 0,
    remainColdMilliseconds: 0,
    hideCount: 1,
    lastIndexWhenHide: 0,
  };
}

/**
 * Kind19 武功信息 - 持续留痕武功
 * 角色移动时在原位置留下武功痕迹，持续一段时间后消失
 */
export interface Kind19MagicInfo {
  /** 剩余持续时间（毫秒） */
  keepMilliseconds: number;
  /** 武功数据 */
  magic: MagicData;
  /** 所属角色 ID */
  belongCharacterId: string;
  /** 上一次的瓦片位置 */
  lastTilePosition: Vector2;
}

/**
 * 判断武功是否需要方向指向器
 *
 * 不需要方向指向器的武功类型（自身施放/全方位释放）：
 * - MoveKind 4: CircleMove - 圆形扩散，以自身为中心
 * - MoveKind 5: HeartMove - 心形移动，自身发出
 * - MoveKind 13: FollowCharacter - 跟随自身（清心咒、金钟罩等BUFF类）
 * - MoveKind 15: SuperMode - 超级模式，作用于自身
 * - MoveKind 19: Kind19 - 持续留痕武功
 * - MoveKind 23: TimeStop - 时间停止，同 FollowCharacter
 *
 * @param magic 武功数据
 * @returns true 如果需要方向指向器，false 如果不需要
 */
export function magicNeedsDirectionPointer(magic: MagicData | null | undefined): boolean {
  if (!magic) return false;

  // 不需要方向指向器的 MoveKind 列表
  const selfTargetMoveKinds = [
    MagicMoveKind.CircleMove, // 4 - 圆形扩散
    MagicMoveKind.HeartMove, // 5 - 心形移动
    MagicMoveKind.FollowCharacter, // 13 - 跟随自身（清心咒等）
    MagicMoveKind.SuperMode, // 15 - 超级模式
    MagicMoveKind.Kind19, // 19 - 持续留痕
    MagicMoveKind.TimeStop, // 23 - 时间停止
  ];

  return !selfTargetMoveKinds.includes(magic.moveKind);
}
