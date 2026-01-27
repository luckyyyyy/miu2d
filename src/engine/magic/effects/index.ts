/**
 * Magic Effects System - 武功效果系统
 *
 * 导出效果类型、注册表和所有效果实现
 */

// 类型定义
export type {
  MagicEffect,
  CastContext,
  ApplyContext,
  EndContext,
  CharacterRef,
  SpriteUpdateContext,
} from "./types";

export {
  getLife,
  setLife,
  getLifeMax,
  getMana,
  setMana,
  getManaMax,
  getThew,
  setThew,
  getThewMax,
  getAttack,
  getDefend,
  getPosition,
  getCharacterId,
} from "./types";

// 通用效果函数
export {
  deductCost,
  calculateDamage,
  dealDamage,
  healTarget,
  restoreMana,
  restoreThew,
} from "./common";

// 效果注册表
export { getEffect, registerEffect, getRegisteredMoveKinds } from "./registry";

// 各种效果实现
export { normalAttackEffect, createNormalAttackEffect } from "./normalAttack";
export { followCharacterEffect, createFollowCharacterEffect } from "./followCharacter";
export { superModeEffect, createSuperModeEffect } from "./superMode";
export { fixedPositionEffect, createFixedPositionEffect } from "./fixedPosition";
export { throwEffect, createThrowEffect } from "./throw";
export { followEnemyEffect, createFollowEnemyEffect } from "./followEnemy";
