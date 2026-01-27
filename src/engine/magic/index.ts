/**
 * Magic System - exports
 * 武功系统导出
 */

// Types
export * from "./types";

// Loader
export {
  loadMagic,
  parseMagicIni,
  getMagicAtLevel,
  getCachedMagic,
  clearMagicCache,
  preloadMagics,
} from "./magicLoader";

// List Manager
export {
  MagicListManager,
  MAGIC_LIST_CONFIG,
  type MagicListCallbacks,
} from "./magicListManager";

// Magic Manager
export { MagicManager, type MagicManagerDeps } from "./magicManager";

// Magic Sprites (Factory and Adder)
export {
  MagicSpriteFactory,
  MagicSpriteAdder,
  type WorkItem,
} from "./magicSprites";

// Magic Utils
export {
  MAGIC_BASE_SPEED,
  normalizeVector,
  getDirectionIndex,
  getDirection8,
  getDirection32List,
  getSpeedRatio,
  getVOffsets,
  getDirectionOffset8,
} from "./magicUtils";

// Magic Renderer
export { MagicRenderer, magicRenderer } from "./magicRenderer";

// Effects System (主动效果)
export * from "./effects";

// Passives System (被动效果 - 修炼武功)
export * from "./passives";
