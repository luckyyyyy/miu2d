/**
 * Level system module exports
 */
export {
  LevelManager,
  getLevelManager,
  loadLevelConfig,
  getLevelDetail,
  calculateLevelUp,
  clearLevelConfigCache,
  DEFAULT_LEVEL_FILE,
  NPC_LEVEL_FILE,
} from './levelManager';

export type { LevelDetail, LevelUpResult } from './levelManager';
