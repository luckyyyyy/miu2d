/**
 * Magic System - exports
 * 武功系统导出
 */

// Re-export utils for backward compatibility
// 向后兼容：从 utils 重新导出
export {
  getDirection8,
  getDirection32List,
  getDirectionIndex,
  getDirectionOffset8,
  getVOffsets,
  normalizeVector,
} from "../utils";
export { getSpeedRatio } from "../utils/math";
// Effects System (主动效果)
export * from "./effects";
// Loader
export {
  getMagic,
  getMagicAtLevel,
  preloadMagicAsf,
  preloadMagics,
} from "./magicLoader";
// Magic Config Loader (API)
export {
  getAllCachedMagicFileNames,
  getMagicFromApiCache,
  isMagicApiLoaded,
} from "./magicConfigLoader";
// Magic Renderer
export { MagicRenderer } from "./magicRenderer";
// MagicSprite class (inherits from Sprite)
// 武功精灵类
export { MagicSprite, type WorkItem } from "./magicSprite";
// Magic Manager (refactored)
export { MagicManager, type MagicManagerDeps } from "./manager";

// Passives System (被动效果 - 修炼武功)
export * from "./passives";
// Types (includes MAGIC_BASE_SPEED)
export * from "./types";
