/**
 * Magic System - exports
 * 武功系统导出
 */

// Effects System (主动效果)
export * from "./effects";
// Loader
export {
  getMagic,
  getMagicAtLevel,
  preloadMagicAsf,
  preloadMagics,
} from "./magic-loader";
// Magic Config Loader (API)
export {
  getAllCachedMagicFileNames,
  getMagicFromApiCache,
  isMagicApiLoaded,
} from "./magic-config-loader";
// Magic Renderer
export { MagicRenderer } from "./magic-renderer";
// MagicSprite class (inherits from Sprite)
// 武功精灵类
export { MagicSprite, type WorkItem } from "./magic-sprite";
// Magic Manager (refactored)
export { MagicManager, type MagicManagerDeps } from "./manager";

// Passives System (被动效果 - 修炼武功)
export * from "./passives";
// Types (includes MAGIC_BASE_SPEED)
export * from "./types";
