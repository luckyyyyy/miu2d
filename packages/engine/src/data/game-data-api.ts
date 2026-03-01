/**
 * Game Data API - 游戏数据加载与缓存
 *
 * 从服务端 API 加载游戏配置和数据（NPC/物品/武功/等级/玩家/场景等），
 * 并缓存供引擎各模块使用。
 *
 * 与 ResourceLoader（底层 fetch/缓存）分离，专注于「游戏业务数据」的获取和管理。
 */

import type {
  DropConfig,
  Good,
  LevelConfig,
  LevelDetail,
  Magic,
  MagicExpConfig,
  Npc,
  NpcResource,
  Obj,
  ObjRes,
  Player,
  PlayerConfig,
  Shop,
} from "@miu2d/types";
import { logger } from "../core/logger";
import { getResourceDomain } from "../core/env-config";

// ==================== 数据类型 ====================

/**
 * NPC 数据（继承 Npc 类型 + 服务端注入的 npcIni）
 */
export type NpcData = Npc & {
  /** 资源文件名（npcRes key），由 data endpoint 注入 */
  npcIni?: string | null;
};

/**
 * Obj 数据（继承 Obj 类型 + 服务端注入的 objFile）
 */
export type ObjData = Obj & {
  /** 资源文件名（objRes key），由 data endpoint 注入 */
  objFile?: string | null;
};

export interface MagicResponse {
  player: Magic[];
  npc: Magic[];
}

/** NPC 资源文件数据（npcres） */
export interface NpcResData {
  id: string;
  gameId: string;
  key: string;
  name: string;
  resources: NpcResource;
  createdAt?: string;
  updatedAt?: string;
}

export interface NpcResponse {
  npcs: NpcData[];
  resources: NpcResData[];
}

/** Obj 资源文件数据（objres）— 直接复用 @miu2d/types */
export type ObjResData = ObjRes;

export interface ObjResponse {
  objs: ObjData[];
  resources: ObjResData[];
}

/**
 * API 返回的游戏全局配置
 */
export interface GameConfigResponse {
  gameEnabled: boolean;
  gameName: string;
  gameVersion: string;
  gameDescription: string;
  logoUrl: string;
  playerKey: string;
  initialMap: string;
  initialNpc: string;
  initialObj: string;
  initialBgm: string;
  titleMusic: string;
  newGameScript: string;
  portraitAsf: string;
  uiTheme: unknown;
  player: PlayerConfig;
  drop: DropConfig;
  magicExp?: MagicExpConfig;
}

export interface GameDataResponse {
  magics: MagicResponse;
  goods: Good[];
  shops: Shop[];
  npcs: NpcResponse;
  objs: ObjResponse;
  players: Player[];
  portraits: Array<{ index: number; asfFile: string }>;
  talks: Array<{ id: number; portraitIndex: number; text: string }>;
}

/** 等级配置 */
export interface LevelConfigData {
  id: LevelConfig["id"];
  gameId: LevelConfig["gameId"];
  key: LevelConfig["key"];
  name: LevelConfig["name"];
  userType: LevelConfig["userType"];
  maxLevel?: LevelConfig["maxLevel"];
  levels: LevelDetail[];
  createdAt?: string;
  updatedAt?: string;
}

/** API 返回的等级配置列表 */
export interface LevelResponse {
  player: LevelConfigData[];
  npc: LevelConfigData[];
}

// ========== 公共 fetch 入口 ==========

/**
 * 统一的游戏 API JSON 请求入口
 *
 * @param gameSlug - 游戏 slug
 * @param path    - 相对于 `/game/:slug/api/` 的路径，例如 `config`、`scenes/npc/xxx/yyy`
 */
export async function fetchGameApi<T>(gameSlug: string, path: string): Promise<T> {
  const apiUrl = `${getResourceDomain()}/game/${gameSlug}/api/${path}${path.includes("?") ? "&" : "?"}_t=${Date.now()}`;
  const response = await fetch(apiUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`[GameDataApi] ${apiUrl} → HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/**
 * 统一的游戏 API 二进制请求入口（返回 ArrayBuffer）
 */
export async function fetchGameApiBinary(gameSlug: string, path: string): Promise<ArrayBuffer> {
  const apiUrl = `${getResourceDomain()}/game/${gameSlug}/api/${path}${path.includes("?") ? "&" : "?"}_t=${Date.now()}`;
  const response = await fetch(apiUrl, { credentials: "include" });
  if (!response.ok) {
    throw new Error(`[GameDataApi] ${apiUrl} → HTTP ${response.status}: ${response.statusText}`);
  }
  return response.arrayBuffer();
}

// ==================== 可变状态（集中管理） ====================

interface GameDataState {
  /** 当前加载成功的游戏 slug */
  slug: string;

  // --- gameConfig ---
  config: GameConfigResponse | null;
  isConfigLoaded: boolean;
  /** 按 slug 隔离的并发锁，防止同 slug 重复请求 */
  configPromises: Map<string, Promise<void>>;

  // --- gameData ---
  data: GameDataResponse | null;
  isDataLoaded: boolean;
  /** 按 slug 隔离的并发锁 */
  dataPromises: Map<string, Promise<void>>;

  // --- levelsData ---
  levels: LevelResponse | null;
  isLevelsLoaded: boolean;
  /** 按 slug 隔离的并发锁 */
  levelsPromises: Map<string, Promise<void>>;
}

function createInitialState(): GameDataState {
  return {
    slug: "",
    config: null,
    isConfigLoaded: false,
    configPromises: new Map(),
    data: null,
    isDataLoaded: false,
    dataPromises: new Map(),
    levels: null,
    isLevelsLoaded: false,
    levelsPromises: new Map(),
  };
}

const state: GameDataState = createInitialState();

/**
 * cacheBuilders 使用 Set 防止 HMR / 重复注册时累积。
 * 各模块在模块级调用 registerCacheBuilder，函数引用固定，Set 可正确去重。
 */
const cacheBuilders = new Set<() => void | Promise<void>>();

async function runCacheBuilders(): Promise<void> {
  for (const builder of cacheBuilders) {
    await builder();
  }
}

/**
 * 注册缓存构建回调（数据加载完成后自动调用）。
 * 使用 Set 保存——相同函数引用重复注册只保留一份。
 */
export function registerCacheBuilder(builder: () => void | Promise<void>): void {
  cacheBuilders.add(builder);
}

/**
 * 重置所有游戏数据状态（用于切换游戏 / 单元测试清理）。
 * 注意：cacheBuilders 不清空——各模块的注册在模块初始化时完成，不随游戏切换变化。
 */
export function resetGameData(): void {
  state.slug = "";
  state.config = null;
  state.isConfigLoaded = false;
  state.configPromises.clear();
  state.data = null;
  state.isDataLoaded = false;
  state.dataPromises.clear();
  state.levels = null;
  state.isLevelsLoaded = false;
  state.levelsPromises.clear();
  logger.info("[GameDataApi] State reset");
}

// ========== 游戏配置缓存 ==========

/**
 * 从 API 加载游戏全局配置
 */
export async function loadGameConfig(gameSlug: string, force = false): Promise<void> {
  if (!force && state.isConfigLoaded && state.slug === gameSlug) {
    return;
  }

  const inflight = state.configPromises.get(gameSlug);
  if (inflight) {
    await inflight;
    return;
  }

  const promise = (async () => {
    logger.info(`[GameDataApi] Loading game config for ${gameSlug}`);

    try {
      const config = await fetchGameApi<GameConfigResponse>(gameSlug, "config");

      // 游戏未开放（不存在/未公开/未启用均返回 gameEnabled: false）
      if (!config?.gameEnabled) {
        throw new Error("GAME_NOT_AVAILABLE");
      }

      state.config = config;
      state.isConfigLoaded = true;
      state.slug = gameSlug;

      logger.info(
        `[GameDataApi] Loaded config: playerKey=${state.config.playerKey}, gameName=${state.config.gameName}`
      );
    } catch (error) {
      logger.error(`[GameDataApi] Failed to load game config:`, error);
      throw error;
    } finally {
      state.configPromises.delete(gameSlug);
    }
  })();

  state.configPromises.set(gameSlug, promise);
  await promise;
}

export function isGameConfigLoaded(): boolean {
  return state.isConfigLoaded;
}

export function getGameConfig(): GameConfigResponse | null {
  return state.config;
}

// ========== 游戏数据缓存 ==========

/**
 * 从 API 加载所有游戏数据
 */
export async function loadGameData(gameSlug: string, force = false): Promise<void> {
  if (!force && state.isDataLoaded && state.slug === gameSlug) {
    return;
  }

  const inflight = state.dataPromises.get(gameSlug);
  if (inflight) {
    await inflight;
    return;
  }

  const promise = (async () => {
    logger.info(`[GameDataApi] Loading game data for ${gameSlug}`);

    try {
      state.data = await fetchGameApi<GameDataResponse>(gameSlug, "data");
      state.isDataLoaded = true;
      state.slug = gameSlug;

      try {
        await loadLevelsData(gameSlug, force, false);
      } catch (error) {
        logger.warn(`[GameDataApi] Failed to preload levels data:`, error);
      }

      // 构建所有模块的缓存
      await runCacheBuilders();

      const magicCount =
        (state.data.magics.player.length ?? 0) + (state.data.magics.npc.length ?? 0);
      const goodsCount = state.data.goods.length ?? 0;
      const shopCount = state.data.shops.length ?? 0;
      const npcCount = state.data.npcs.npcs.length ?? 0;
      const npcResCount = state.data.npcs.resources.length ?? 0;
      const objCount = state.data.objs.objs.length ?? 0;
      const objResCount = state.data.objs.resources.length ?? 0;
      const portraitCount = state.data.portraits?.length ?? 0;
      const talkCount = state.data.talks?.length ?? 0;

      logger.info(
        `[GameDataApi] Loaded: ${magicCount} magics, ${goodsCount} goods, ${shopCount} shops, ${npcCount} npcs, ${npcResCount} npcres, ${objCount} objs, ${objResCount} objres, ${portraitCount} portraits, ${talkCount} talks`
      );
    } catch (error) {
      logger.error(`[GameDataApi] Failed to load game data:`, error);
      throw error;
    } finally {
      state.dataPromises.delete(gameSlug);
    }
  })();

  state.dataPromises.set(gameSlug, promise);
  await promise;
}

export async function reloadGameData(gameSlug: string): Promise<void> {
  await loadGameData(gameSlug, true);
}

/**
 * 直接注入游戏数据（跳过 REST fetch），用于 Dashboard 等已有 tRPC 数据的场景
 *
 * 注入后会自动运行 cacheBuilders，使各模块缓存就绪
 */
export async function setGameData(gameSlug: string, data: GameDataResponse): Promise<void> {
  state.data = data;
  state.isDataLoaded = true;
  state.slug = gameSlug;

  await runCacheBuilders();

  const magicCount = (data.magics.player.length ?? 0) + (data.magics.npc.length ?? 0);
  const npcCount = data.npcs.npcs.length ?? 0;
  const objCount = data.objs.objs.length ?? 0;
  logger.info(
    `[GameDataApi] setGameData: ${magicCount} magics, ${npcCount} npcs, ${objCount} objs`
  );
}

export function isGameDataLoaded(): boolean {
  return state.isDataLoaded;
}

/**
 * 获取当前游戏 slug
 */
export function getGameSlug(): string {
  return state.slug;
}

export function getMagicsData(): MagicResponse | null {
  return state.data?.magics ?? null;
}

export function getGoodsData(): Good[] | null {
  return state.data?.goods ?? null;
}

export function getNpcsData(): NpcResponse | null {
  return state.data?.npcs ?? null;
}

export function getObjsData(): ObjResponse | null {
  return state.data?.objs ?? null;
}

export function getShopsData(): Shop[] | null {
  return state.data?.shops ?? null;
}

export function getPlayersData(): Player[] | null {
  return state.data?.players ?? null;
}

export function getPortraitsData(): Array<{ index: number; asfFile: string }> | null {
  return state.data?.portraits ?? null;
}

export function getTalksData(): Array<{ id: number; portraitIndex: number; text: string }> | null {
  return state.data?.talks ?? null;
}

/**
 * 从 API 加载等级配置数据（player + npc）
 */
export async function loadLevelsData(
  gameSlug: string,
  force = false,
  rebuildCaches = true
): Promise<void> {
  if (!force && state.isLevelsLoaded && state.slug === gameSlug) {
    return;
  }

  const inflight = state.levelsPromises.get(gameSlug);
  if (inflight) {
    await inflight;
    return;
  }

  const promise = (async () => {
    logger.info(`[GameDataApi] Loading levels data for ${gameSlug}`);

    try {
      state.levels = await fetchGameApi<LevelResponse>(gameSlug, "level");
      state.isLevelsLoaded = true;
      state.slug = gameSlug;

      const playerCount = state.levels.player.length ?? 0;
      const npcCount = state.levels.npc.length ?? 0;
      logger.info(`[GameDataApi] Loaded levels: ${playerCount} player, ${npcCount} npc`);

      if (rebuildCaches) {
        await runCacheBuilders();
      }
    } catch (error) {
      logger.error(`[GameDataApi] Failed to load levels data:`, error);
      throw error;
    } finally {
      state.levelsPromises.delete(gameSlug);
    }
  })();

  state.levelsPromises.set(gameSlug, promise);
  await promise;
}

export function isLevelsDataLoaded(): boolean {
  return state.isLevelsLoaded;
}

export function getLevelsData(): LevelResponse | null {
  return state.levels;
}

/**
 * 从 Scene API 加载 NPC 条目
 */
export async function loadSceneNpcEntries(
  sceneKey: string,
  fileName: string
): Promise<Record<string, unknown>[] | null> {
  if (!state.slug) {
    logger.warn(`[GameDataApi] loadSceneNpcEntries failed: game slug is empty`);
    return null;
  }

  try {
    return await fetchGameApi<Record<string, unknown>[]>(
      state.slug,
      `scenes/npc/${encodeURIComponent(sceneKey)}/${encodeURIComponent(fileName)}`
    );
  } catch {
    return null;
  }
}

/**
 * 从 Scene API 加载 MMF 地图二进制数据
 */
export async function loadSceneMapMmf(sceneKey: string): Promise<ArrayBuffer | null> {
  if (!state.slug) {
    logger.warn(`[GameDataApi] loadSceneMapMmf failed: game slug is empty`);
    return null;
  }

  try {
    const buffer = await fetchGameApiBinary(
      state.slug,
      `scenes/${encodeURIComponent(sceneKey)}/mmf`
    );
    return buffer.byteLength > 0 ? buffer : null;
  } catch {
    return null;
  }
}

/**
 * 从 Scene API 加载 OBJ 条目列表
 */
export async function loadSceneObjEntries(
  sceneKey: string,
  fileName: string
): Promise<Record<string, unknown>[] | null> {
  if (!state.slug) {
    logger.warn(`[GameDataApi] loadSceneObjEntries failed: game slug is empty`);
    return null;
  }

  try {
    return await fetchGameApi<Record<string, unknown>[]>(
      state.slug,
      `scenes/obj/${encodeURIComponent(sceneKey)}/${encodeURIComponent(fileName)}`
    );
  } catch {
    return null;
  }
}
