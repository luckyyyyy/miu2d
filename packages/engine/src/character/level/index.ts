/**
 * Level system module exports
 */

export type { LevelDetail, LevelUpResult } from "./levelManager";
export {
  calculateLevelUp,
  getLevelDetail,
  getNpcLevelConfig,
  getNpcLevelDetail,
  initNpcLevelConfig,
  LevelManager,
} from "./levelManager";

export {
  clearLevelConfigCache,
  getDefaultNpcLevelKey,
  getDefaultPlayerLevelKey,
  getLevelConfigFromCache,
  loadLevelConfig,
  setLevelConfigGameSlug,
} from "./levelConfigLoader";
