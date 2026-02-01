/**
 * Character Traits Index
 * Exports all utility functions from character trait modules
 */

// Combat utilities
export {
  calculateHitRate,
  rollForHit,
  hasImmunityShield,
  calculateShieldReduction,
  calculateSimpleShieldReduction,
  calculateDeathExp,
  applyMinimumDamage,
  capDamageToLife,
  logCombatHit,
  logCombatMiss,
} from "./combatUtils";

// Magic utilities
export {
  parseMagicList,
  parseMagicListNoDistance,
  buildFlyIniInfosFromList,
  buildFlyIniInfos,
  addMagicToInfos,
  removeMagicFromInfos,
  getRandomMagicWithUseDistance,
} from "./magicUtils";

// Movement utilities
export {
  DIRECTION_VECTORS,
  TILE_OFFSETS,
  JUMP_SPEED_FOLD,
  DISTANCE_OFFSET,
  calculateSpeedMultiplier,
  calculateMoveDistance,
  getDirectionVector,
  findNeighborInDirection,
  findDistanceTileInDirection,
  isAtTileCenter,
  pixelDistance,
  reachedWaypoint,
  normalizeDirection,
} from "./movementUtils";
