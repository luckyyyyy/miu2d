/**
 * Magic Config Loader - 从统一数据加载器获取武功配置
 *
 * 在 dataLoader 加载完成后自动构建武功缓存。
 *
 * 路径处理规则：
 * - 绝对路径（以 `/` 开头）：转换为 `/game/{gameSlug}/resources/xxx`
 * - 相对路径：保持不变（由 magicLoader 处理）
 */

import {
  getMagicsData,
  isGameDataLoaded,
  registerCacheBuilder,
  type ApiMagicData,
} from "../resource/resourceLoader";
import { getResourceRoot, normalizeCacheKey } from "../config/resourcePaths";
import { logger } from "../core/logger";
import { createDefaultMagicData, type MagicData, MagicMoveKind, MagicSpecialKind } from "./types";

// ========== API 响应类型（从 dataLoader 复用） ==========

type ApiMagicLevel = ApiMagicData extends { levels: (infer L)[] | null } ? NonNullable<L> : never;
type ApiAttackFile = ApiMagicData extends { attackFile: infer A } ? NonNullable<A> : never;

// ========== 缓存 ==========

const MAGIC_KEY_PREFIXES = ["ini/magic/"] as const;

/** 已解析的武功配置缓存 (key -> MagicData) */
const magicConfigCache = new Map<string, MagicData>();

// ========== MoveKind 字符串到枚举映射 ==========

const MOVE_KIND_MAP: Record<string, MagicMoveKind> = {
  NoMove: MagicMoveKind.NoMove,
  FixedPosition: MagicMoveKind.FixedPosition,
  SingleMove: MagicMoveKind.SingleMove,
  LineMove: MagicMoveKind.LineMove,
  CircleMove: MagicMoveKind.CircleMove,
  HeartMove: MagicMoveKind.HeartMove,
  SpiralMove: MagicMoveKind.SpiralMove,
  SectorMove: MagicMoveKind.SectorMove,
  RandomSector: MagicMoveKind.RandomSector,
  FixedWall: MagicMoveKind.FixedWall,
  WallMove: MagicMoveKind.WallMove,
  RegionBased: MagicMoveKind.RegionBased,
  FollowCharacter: MagicMoveKind.FollowCharacter,
  SuperMode: MagicMoveKind.SuperMode,
  FollowEnemy: MagicMoveKind.FollowEnemy,
  Throw: MagicMoveKind.Throw,
  Kind19: MagicMoveKind.Kind19,
  Transport: MagicMoveKind.Transport,
  PlayerControl: MagicMoveKind.PlayerControl,
  Summon: MagicMoveKind.Summon,
  TimeStop: MagicMoveKind.TimeStop,
  VMove: MagicMoveKind.VMove,
};

const SPECIAL_KIND_MAP: Record<string, MagicSpecialKind> = {
  None: MagicSpecialKind.None,
  AddLifeOrFrozen: MagicSpecialKind.AddLifeOrFrozen,
  AddThewOrPoison: MagicSpecialKind.AddThewOrPoison,
  BuffOrPetrify: MagicSpecialKind.BuffOrPetrify,
  InvisibleHide: MagicSpecialKind.InvisibleHide,
  InvisibleShow: MagicSpecialKind.InvisibleShow,
  Buff: MagicSpecialKind.Buff,
  ChangeCharacter: MagicSpecialKind.ChangeCharacter,
  RemoveAbnormal: MagicSpecialKind.RemoveAbnormal,
  ChangeFlyIni: MagicSpecialKind.ChangeFlyIni,
};

// ========== 路径处理 ==========

/**
 * 规范化资源路径
 * - 绝对路径（以 `/` 开头）：转换为资源根目录下的路径
 * - 相对路径：保持不变
 *
 * @param path 原始路径
 * @param resourceType 资源类型（用于构建相对路径前缀）
 */
function normalizeResourcePath(
  path: string | null | undefined,
  resourceType: "effect" | "magic" | "sound" | "character"
): string | undefined {
  if (!path) return undefined;

  // 绝对路径：转换为资源根目录下的路径
  if (path.startsWith("/")) {
    const root = getResourceRoot();
    // 移除开头的 /，拼接到资源根目录
    return `${root}${path}`;
  }

  // 相对路径：添加资源类型前缀
  const prefixMap: Record<string, string> = {
    effect: "asf/effect/",
    magic: "asf/magic/",
    sound: "Content/sound/",
    character: "asf/character/",
  };

  const prefix = prefixMap[resourceType] || "";
  return `${prefix}${path}`;
}

/**
 * 规范化声音路径
 */
function normalizeSoundPath(path: string | null | undefined): string | undefined {
  if (!path) return undefined;

  // 绝对路径处理
  if (path.startsWith("/")) {
    const root = getResourceRoot();
    return `${root}${path}`;
  }

  // 声音文件不需要前缀（由 audioManager 处理）
  return path;
}

// ========== 解析函数 ==========

/**
 * 解析 MoveKind 字符串为枚举
 */
function parseMoveKind(moveKind: string | undefined): MagicMoveKind {
  if (!moveKind) return MagicMoveKind.NoMove;
  return MOVE_KIND_MAP[moveKind] ?? MagicMoveKind.NoMove;
}

/**
 * 解析 SpecialKind 字符串为枚举
 */
function parseSpecialKind(specialKind: string | undefined): MagicSpecialKind {
  if (!specialKind) return MagicSpecialKind.None;
  return SPECIAL_KIND_MAP[specialKind] ?? MagicSpecialKind.None;
}

/**
 * 从 key 提取文件名（统一转小写）
 * e.g., "player-magic-银钩铁划.ini" -> "player-magic-银钩铁划.ini"
 */
function extractFileName(key: string): string {
  return key.toLowerCase();
}

/**
 * 将 API 武功数据转换为引擎 MagicData
 */
function convertApiMagicToMagicData(api: ApiMagicData): MagicData {
  const magic = createDefaultMagicData();

  // 基础信息
  magic.fileName = extractFileName(api.key);
  magic.name = api.name;
  magic.intro = api.intro || "";

  // 运动属性
  magic.speed = api.speed || 8;
  magic.moveKind = parseMoveKind(api.moveKind);
  magic.region = api.region || 0;

  // 特效属性
  magic.specialKind = parseSpecialKind(api.specialKind);
  magic.specialKindValue = api.specialKindValue || 0;
  magic.specialKindMilliSeconds = api.specialKindMilliSeconds || 0;
  magic.alphaBlend = api.alphaBlend ? 1 : 0;
  magic.flyingLum = api.flyingLum || 0;
  magic.vanishLum = api.vanishLum || 0;

  // 图像资源（应用路径转换）
  magic.image = normalizeResourcePath(api.image, "magic");
  magic.icon = normalizeResourcePath(api.icon, "magic");
  magic.flyingImage = normalizeResourcePath(api.flyingImage, "effect");
  magic.vanishImage = normalizeResourcePath(api.vanishImage, "effect");
  magic.superModeImage = normalizeResourcePath(api.superModeImage, "effect");

  // 声音资源
  magic.flyingSound = normalizeSoundPath(api.flyingSound);
  magic.vanishSound = normalizeSoundPath(api.vanishSound);

  // 帧相关
  magic.waitFrame = api.waitFrame ?? 0;
  magic.lifeFrame = api.lifeFrame ?? 4;

  // 从属关系
  // belong 在 API 中是字符串，需要映射（暂时忽略，保持默认0）

  // 动作和攻击文件
  magic.actionFile = api.actionFile || undefined;

  // AttackFile 是嵌套的武功数据
  if (api.attackFile) {
    // 存储为文件名引用，实际使用时会单独加载
    // 为嵌套的 attackFile 创建一个虚拟文件名
    const attackFileName = `${api.key.replace(".ini", "")}-attack.ini`;
    magic.attackFile = attackFileName;

    // 同时将 attackFile 数据转换并缓存
    const attackMagic = convertAttackFileToMagicData(api.attackFile, attackFileName);
    magicConfigCache.set(normalizeCacheKey(attackFileName, MAGIC_KEY_PREFIXES), attackMagic);
  }

  // 关联武功
  magic.flyMagic = api.flyMagic || undefined;
  magic.flyInterval = api.flyInterval || 0;
  magic.parasiticMagic = api.parasiticMagic || undefined;
  magic.explodeMagicFile = api.explodeMagicFile || undefined;

  // 杂项标志
  magic.passThrough = api.passThrough ? 1 : 0;
  magic.passThroughWall = api.passThroughWall ? 1 : 0;
  magic.attackAll = api.attackAll ? 1 : 0;
  magic.vibratingScreen = api.vibratingScreen ? 1 : 0;
  magic.bounce = api.bounce ? 1 : 0;
  magic.bounceHurt = api.bounceHurt || 0;
  magic.traceEnemy = api.traceEnemy ? 1 : 0;
  magic.traceSpeed = api.traceSpeed || 0;
  magic.beginAtUser = api.beginAtUser ? 1 : 0;
  magic.beginAtMouse = api.beginAtMouse ? 1 : 0;
  magic.rangeRadius = api.rangeRadius || 0;

  // 寄生
  magic.parasitic = api.parasitic ? 1 : 0;
  magic.parasiticInterval = api.parasiticInterval || 1000;

  // 冷却
  magic.coldMilliSeconds = api.coldMilliSeconds || 0;

  // 等级数据
  if (api.levels && api.levels.length > 0) {
    const levels = new Map<number, Partial<MagicData>>();
    for (const lvl of api.levels) {
      const levelData: Partial<MagicData> = {
        effect: lvl.effect || 0,
        manaCost: lvl.manaCost || 0,
        levelupExp: lvl.levelupExp ?? 0,
      };
      if (lvl.speed !== undefined) {
        levelData.speed = lvl.speed;
      }
      if (lvl.moveKind !== undefined) {
        levelData.moveKind = parseMoveKind(lvl.moveKind);
      }
      if (lvl.lifeFrame !== undefined) {
        levelData.lifeFrame = lvl.lifeFrame;
      }
      levels.set(lvl.level, levelData);
    }
    magic.levels = levels;

    // 从第一级获取默认值
    const level1 = api.levels.find((l) => l.level === 1);
    if (level1) {
      magic.effect = level1.effect || 0;
      magic.manaCost = level1.manaCost || 0;
      magic.levelupExp = level1.levelupExp ?? 0;
    }
  }

  return magic;
}

/**
 * 将嵌套的 AttackFile 转换为 MagicData
 */
function convertAttackFileToMagicData(attack: ApiAttackFile, fileName: string): MagicData {
  const magic = createDefaultMagicData();

  magic.fileName = fileName;
  magic.name = attack.name || "";
  magic.intro = attack.intro || "";

  magic.speed = attack.speed || 8;
  magic.moveKind = parseMoveKind(attack.moveKind);
  magic.region = attack.region || 0;

  magic.specialKind = parseSpecialKind(attack.specialKind);
  magic.specialKindValue = attack.specialKindValue || 0;
  magic.specialKindMilliSeconds = attack.specialKindMilliSeconds || 0;

  magic.alphaBlend = attack.alphaBlend ? 1 : 0;
  magic.flyingLum = attack.flyingLum || 0;
  magic.vanishLum = attack.vanishLum || 0;

  magic.flyingImage = normalizeResourcePath(attack.flyingImage, "effect");
  magic.vanishImage = normalizeResourcePath(attack.vanishImage, "effect");

  magic.flyingSound = normalizeSoundPath(attack.flyingSound);
  magic.vanishSound = normalizeSoundPath(attack.vanishSound);

  magic.waitFrame = attack.waitFrame ?? 0;
  magic.lifeFrame = attack.lifeFrame ?? 4;

  magic.passThrough = attack.passThrough ? 1 : 0;
  magic.passThroughWall = attack.passThroughWall ? 1 : 0;
  magic.attackAll = attack.attackAll ? 1 : 0;
  magic.vibratingScreen = attack.vibratingScreen ? 1 : 0;
  magic.bounce = attack.bounce ? 1 : 0;
  magic.bounceHurt = attack.bounceHurt || 0;
  magic.traceEnemy = attack.traceEnemy ? 1 : 0;
  magic.traceSpeed = attack.traceSpeed || 0;
  magic.rangeRadius = attack.rangeRadius || 0;

  return magic;
}



/**
 * 从统一数据构建武功缓存（自动被 dataLoader 调用）
 */
function buildMagicCache(): void {
  const data = getMagicsData();
  if (!data) {
    return;
  }

  // 清空旧缓存
  magicConfigCache.clear();

  // 处理玩家武功
  for (const api of data.player) {
    const magic = convertApiMagicToMagicData(api);
    const cacheKey = normalizeCacheKey(api.key, MAGIC_KEY_PREFIXES);
    magicConfigCache.set(cacheKey, magic);
  }

  // 处理 NPC 武功
  for (const api of data.npc) {
    const magic = convertApiMagicToMagicData(api);
    const cacheKey = normalizeCacheKey(api.key, MAGIC_KEY_PREFIXES);
    magicConfigCache.set(cacheKey, magic);
  }

  logger.info(
    `[MagicConfigLoader] Built cache: ${data.player.length} player + ${data.npc.length} npc magics`
  );
}

// 注册到 dataLoader，数据加载完成后自动构建缓存
registerCacheBuilder(buildMagicCache);

// ========== 公共 API ==========

/**
 * 从缓存获取武功配置
 *
 * @param fileName 武功文件名（支持多种格式）
 * @returns MagicData 或 null
 */
export function getMagicFromApiCache(fileName: string): MagicData | null {
  const cacheKey = normalizeCacheKey(fileName, MAGIC_KEY_PREFIXES);
  const cached = magicConfigCache.get(cacheKey);

  if (cached) {
    // 返回副本，避免外部修改影响缓存
    return { ...cached };
  }

  return null;
}

/**
 * 检查武功配置是否已加载
 */
export function isMagicApiLoaded(): boolean {
  return isGameDataLoaded() && magicConfigCache.size > 0;
}

/**
 * 获取所有缓存的武功文件名
 */
export function getAllCachedMagicFileNames(): string[] {
  return Array.from(magicConfigCache.keys());
}
