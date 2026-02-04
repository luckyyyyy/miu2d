/**
 * Magic Config Loader - 从 API 加载武功配置
 *
 * 游戏启动时从 `/game/{gameSlug}/api/magic` 获取所有武功配置，
 * 缓存到内存中，后续 loadMagic 直接从缓存读取。
 *
 * 路径处理规则：
 * - 绝对路径（以 `/` 开头）：转换为 `/game/{gameSlug}/resources/xxx`
 * - 相对路径：保持不变（由 magicLoader 处理）
 */

import { getResourceRoot } from "../config/resourcePaths";
import { logger } from "../core/logger";
import { createDefaultMagicData, type MagicData, MagicMoveKind, MagicSpecialKind } from "./types";

// ========== API 响应类型 ==========

/**
 * API 返回的武功等级数据
 */
interface ApiMagicLevel {
  level: number;
  effect: number;
  manaCost: number;
  levelupExp: number | null;
  speed?: number;
  moveKind?: string;
  lifeFrame?: number;
}

/**
 * API 返回的攻击文件数据（嵌套武功）
 */
interface ApiAttackFile {
  name: string;
  intro?: string;
  speed: number;
  bounce: boolean;
  region: number;
  moveKind: string;
  attackAll: boolean;
  flyingLum: number;
  lifeFrame: number;
  vanishLum: number;
  waitFrame: number;
  alphaBlend: boolean;
  bounceHurt: number;
  traceEnemy: boolean;
  traceSpeed: number;
  flyingImage: string | null;
  flyingSound: string | null;
  passThrough: boolean;
  rangeRadius: number;
  specialKind?: string;
  vanishImage: string | null;
  vanishSound: string | null;
  passThroughWall: boolean;
  vibratingScreen: boolean;
  specialKindValue: number;
  specialKindMilliSeconds: number;
}

/**
 * API 返回的单个武功数据
 */
interface ApiMagicData {
  id: string;
  gameId: string;
  key: string; // e.g., "player-magic-银钩铁划.ini"
  userType: "player" | "npc";
  name: string;
  intro?: string;
  icon: string | null;
  image: string | null;
  speed: number;
  belong?: string;
  bounce: boolean;
  levels: ApiMagicLevel[] | null;
  region: number;
  npcFile: string | null;
  flyMagic: string | null;
  moveKind?: string;
  attackAll: boolean;
  flyingLum: number;
  lifeFrame: number;
  parasitic: boolean;
  vanishLum: number;
  waitFrame: number;
  actionFile: string | null;
  alphaBlend: boolean;
  attackFile: ApiAttackFile | null;
  bounceHurt: number;
  traceEnemy: boolean;
  traceSpeed: number;
  beginAtUser: boolean;
  flyInterval: number;
  flyingImage: string | null;
  flyingSound: string | null;
  passThrough: boolean;
  rangeRadius: number;
  specialKind?: string;
  vanishImage: string | null;
  vanishSound: string | null;
  beginAtMouse: boolean;
  parasiticMagic: string | null;
  superModeImage: string | null;
  passThroughWall: boolean;
  vibratingScreen: boolean;
  coldMilliSeconds: number;
  explodeMagicFile: string | null;
  specialKindValue: number;
  parasiticInterval: number;
  specialKindMilliSeconds: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * API 响应格式
 */
interface ApiMagicResponse {
  player: ApiMagicData[];
  npc: ApiMagicData[];
}

// ========== 缓存和状态 ==========

/** 已解析的武功配置缓存 (key -> MagicData) */
const magicConfigCache = new Map<string, MagicData>();

/** API 是否已加载 */
let isApiLoaded = false;

/** 当前 gameSlug */
let currentGameSlug = "";

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
    magicConfigCache.set(normalizeKeyForCache(attackFileName), attackMagic);
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

// ========== 缓存键规范化 ==========

/**
 * 规范化缓存键（与 magicLoader 中的 normalizeMagicPath 对应）
 * 支持多种输入格式：
 * - "player-magic-银钩铁划.ini"
 * - "ini/magic/player-magic-银钩铁划.ini"
 * - "/resources/ini/magic/player-magic-银钩铁划.ini"
 */
function normalizeKeyForCache(fileName: string): string {
  let normalized = fileName.replace(/\\/g, "/");

  // 移除资源根目录前缀（如 /game/xxx/resources/）
  const resourceRoot = getResourceRoot();
  if (normalized.startsWith(resourceRoot)) {
    normalized = normalized.slice(resourceRoot.length);
  }

  // 移除开头的 /
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  // 移除 ini/magic/ 前缀
  if (normalized.startsWith("ini/magic/")) {
    normalized = normalized.slice("ini/magic/".length);
  }

  return normalized.toLowerCase();
}

// ========== 公共 API ==========

/**
 * 从 API 加载所有武功配置
 *
 * @param gameSlug 游戏标识（如 "william-chan"）
 * @param force 是否强制重新加载（跳过缓存检查）
 */
export async function loadMagicConfigFromApi(gameSlug: string, force = false): Promise<void> {
  if (!force && isApiLoaded && currentGameSlug === gameSlug) {
    logger.debug("[MagicConfigLoader] Already loaded for this game");
    return;
  }

  // 添加时间戳参数防止浏览器缓存
  const apiUrl = `/game/${gameSlug}/api/magic?_t=${Date.now()}`;
  logger.info(`[MagicConfigLoader] Loading magic config from ${apiUrl}`);

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ApiMagicResponse = await response.json();

    // 清空旧缓存
    magicConfigCache.clear();

    // 处理玩家武功
    for (const api of data.player) {
      const magic = convertApiMagicToMagicData(api);
      const cacheKey = normalizeKeyForCache(api.key);
      magicConfigCache.set(cacheKey, magic);
      // logger.debug(`[MagicConfigLoader] Cached player magic: ${api.name} -> ${cacheKey}`);
    }

    // 处理 NPC 武功
    for (const api of data.npc) {
      const magic = convertApiMagicToMagicData(api);
      const cacheKey = normalizeKeyForCache(api.key);
      magicConfigCache.set(cacheKey, magic);
      // logger.debug(`[MagicConfigLoader] Cached npc magic: ${api.name} -> ${cacheKey}`);
    }

    isApiLoaded = true;
    currentGameSlug = gameSlug;

    logger.info(
      `[MagicConfigLoader] Loaded ${data.player.length} player magics and ${data.npc.length} npc magics`
    );
  } catch (error) {
    logger.error(`[MagicConfigLoader] Failed to load magic config:`, error);
    throw error;
  }
}

/**
 * 从缓存获取武功配置
 *
 * @param fileName 武功文件名（支持多种格式）
 * @returns MagicData 或 null
 */
export function getMagicFromApiCache(fileName: string): MagicData | null {
  const cacheKey = normalizeKeyForCache(fileName);
  const cached = magicConfigCache.get(cacheKey);

  if (cached) {
    // 返回副本，避免外部修改影响缓存
    return { ...cached };
  }

  return null;
}

/**
 * 强制重新加载武功配置
 * 会清除所有相关缓存并重新加载：
 * - API 配置缓存（magicConfigCache）
 * - 所有 NPC 的武功缓存（清除并重新加载）
 * - 玩家的武功列表（更新 MagicData）
 *
 * @param gameSlug 游戏标识（如 "william-chan"）
 */
export async function reloadMagicConfigFromApi(gameSlug: string): Promise<void> {
  logger.info("[MagicConfigLoader] Force reloading magic config...");

  // 1. 重新加载 API 配置（会自动清除旧缓存）
  await loadMagicConfigFromApi(gameSlug, true);

  // 2. 刷新游戏内缓存（如果引擎已初始化）
  try {
    const { getEngineContext } = await import("../core/engineContext");
    const ctx = getEngineContext();
    if (ctx) {
      // 重新加载所有 NPC 的武功缓存
      await (ctx.npcManager as { reloadAllMagicCaches?: () => Promise<void> }).reloadAllMagicCaches?.();
      // 重新加载玩家的武功列表
      const magicListManager = (ctx.player as { getMagicListManager?: () => { reloadAllMagics?: () => Promise<void> } }).getMagicListManager?.();
      await magicListManager?.reloadAllMagics?.();
    }
  } catch {
    // 引擎未初始化，忽略
  }

  logger.info("[MagicConfigLoader] Magic config reloaded successfully");
}

/**
 * 检查 API 配置是否已加载
 */
export function isMagicApiLoaded(): boolean {
  return isApiLoaded;
}

/**
 * 获取所有缓存的武功文件名
 */
export function getAllCachedMagicFileNames(): string[] {
  return Array.from(magicConfigCache.keys());
}
