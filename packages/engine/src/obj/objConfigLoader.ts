/**
 * OBJ Config Loader - 从 API 缓存获取物体配置
 *
 * 替代原有的 INI 文件加载，从统一数据加载器获取配置。
 */

import {
  getObjsData,
  isGameDataLoaded,
  registerCacheBuilder,
  type ApiObjData,
} from "../resource/resourceLoader";
import { getResourceRoot } from "../config/resourcePaths";
import { logger } from "../core/logger";

// ========== 类型定义 ==========

/**
 * ObjKind 枚举（本地定义避免循环依赖）
 * 与 obj.ts 中的 ObjKind 保持一致
 */
enum ObjKindLocal {
  Dynamic = 0,
  Static = 1,
  Body = 2,
  LoopingSound = 3,
  RandSound = 4,
  Door = 5,
  Trap = 6,
  Drop = 7,
}

export interface ObjResInfo {
  imagePath: string;
  soundPath: string;
}

export interface ObjConfig {
  name: string;
  kind: number;
  image: string;
  shadow: string;
  script: string;
  sound: string;
  switchSound: string;
  triggerRadius: number;
  interval: number;
  level: number;
  height: number;
}

// ========== 缓存 ==========

const objConfigCache = new Map<string, ObjConfig>();

// ========== Kind 映射 ==========

const KIND_MAP: Record<string, number> = {
  Dynamic: ObjKindLocal.Dynamic,
  Static: ObjKindLocal.Static,
  Body: ObjKindLocal.Body,
  LoopingSound: ObjKindLocal.LoopingSound,
  RandSound: ObjKindLocal.RandSound,
  Door: ObjKindLocal.Door,
  Trap: ObjKindLocal.Trap,
  Drop: ObjKindLocal.Drop,
};

// ========== API -> ObjConfig 转换 ==========

function convertApiObjToConfig(api: ApiObjData): ObjConfig {
  return {
    name: api.name ?? "",
    kind: KIND_MAP[api.kind] ?? ObjKindLocal.Dynamic,
    // 从 resources.common 读取资源
    image: api.resources?.common?.image ?? "",
    shadow: "",
    script: api.scriptFile ?? "",
    sound: api.resources?.common?.sound ?? "",
    switchSound: api.switchSound ?? "",
    triggerRadius: api.triggerRadius ?? 0,
    interval: api.interval ?? 0,
    level: api.level ?? 0,
    height: api.height ?? 0,
  };
}

// ========== 缓存键规范化 ==========

function normalizeKey(fileName: string): string {
  let key = fileName.replace(/\\/g, "/");

  const root = getResourceRoot();
  if (key.startsWith(root)) {
    key = key.slice(root.length);
  }
  if (key.startsWith("/")) {
    key = key.slice(1);
  }
  if (key.startsWith("ini/obj/")) {
    key = key.slice("ini/obj/".length);
  } else if (key.startsWith("ini/objres/")) {
    key = key.slice("ini/objres/".length);
  }

  return key.toLowerCase();
}

// ========== ObjRes 缓存 ==========

const objResCache = new Map<string, ObjResInfo>();

// ========== 构建缓存 ==========

function buildObjConfigCache(): void {
  const data = getObjsData();
  if (!data) return;

  objConfigCache.clear();
  objResCache.clear();

  // 1. 构建 Obj 配置缓存
  for (const api of data.objs) {
    const config = convertApiObjToConfig(api);
    const cacheKey = normalizeKey(api.key);
    objConfigCache.set(cacheKey, config);
  }

  // 2. 构建 ObjRes 资源缓存（用 objres 文件名作为 key）
  for (const resData of data.resources) {
    const cacheKey = normalizeKey(resData.key);
    const resInfo: ObjResInfo = {
      imagePath: resData.resources?.common?.image ?? "",
      soundPath: resData.resources?.common?.sound ?? "",
    };
    objResCache.set(cacheKey, resInfo);
  }

  logger.info(`[ObjConfigLoader] Built cache: ${data.objs.length} objs, ${objResCache.size} objres`);
}

registerCacheBuilder(buildObjConfigCache);

// ========== 公共 API ==========

export function getObjConfigFromCache(fileName: string): ObjConfig | null {
  return objConfigCache.get(normalizeKey(fileName)) ?? null;
}

/**
 * 获取 ObjRes 资源映射
 * fileName 是 objres 文件名（如 obj-宝箱1.ini）
 */
export function getObjResFromCache(fileName: string): ObjResInfo | null {
  return objResCache.get(normalizeKey(fileName)) ?? null;
}

export function isObjConfigLoaded(): boolean {
  return isGameDataLoaded() && objConfigCache.size > 0;
}

export function getAllObjConfigKeys(): string[] {
  return Array.from(objConfigCache.keys());
}
