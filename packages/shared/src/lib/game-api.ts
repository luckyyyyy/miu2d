/**
 * Game API Client — 通用游戏 REST API 请求工具
 *
 * 提供统一的 fetch 封装和响应类型定义，供 @miu2d/engine 和前端包使用。
 * 不包含缓存/状态管理逻辑（由引擎负责）。
 *
 * 注意：本模块为纯 TypeScript，不依赖 React。
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

// ==================== 环境配置 ====================

/**
 * 获取资源域名（从 Vite 环境变量读取）
 *
 * 环境变量: VITE_DEMO_RESOURCES_DOMAIN
 * 例如: https://yych.example.com
 *
 * @returns 资源域名（不带尾部斜杠），如果未配置返回空字符串
 */
export function getResourceDomain(): string {
  const domain = import.meta.env.VITE_DEMO_RESOURCES_DOMAIN as string | undefined;
  if (domain) {
    return domain.replace(/\/+$/, "");
  }
  return "";
}

/**
 * 根据 S3 key 构造公开访问 URL
 *
 * 环境变量: VITE_S3_BASE_URL（默认 /s3/miu2d）
 * 例如: /s3/miu2d 或 https://cdn.example.com/miu2d
 *
 * @param key S3 对象 key，如 saves/userId/saveId.jpg
 */
export function getS3Url(key: string): string {
  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }
  const base = (import.meta.env.VITE_S3_BASE_URL as string | undefined) ?? "/s3/miu2d";
  return `${base.replace(/\/+$/, "")}/${key}`;
}

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
  /** 新剑侠情缘: Effect 叠加 Attack；月影传说/剑侠情缘2: Effect 替代 Attack */
  effectFormulaAdditive?: boolean;
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

// ==================== Fetch 工具 ====================

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
    throw new Error(`[GameApi] ${apiUrl} → HTTP ${response.status}: ${response.statusText}`);
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
    throw new Error(`[GameApi] ${apiUrl} → HTTP ${response.status}: ${response.statusText}`);
  }
  return response.arrayBuffer();
}

/**
 * 获取完整的资源 URL
 *
 * @param path 资源路径（如 /resources/xxx 或 resources/xxx）
 * @returns 完整的资源 URL
 */
export function getResourceUrl(path: string): string {
  const domain = getResourceDomain();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (domain) {
    return `${domain}${normalizedPath}`;
  }
  return normalizedPath;
}
