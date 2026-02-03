/**
 * Character Modules - 角色模块导出
 * 使用组合模式提取的功能模块，保持类型推导完整
 */

// NpcMagicCache moved to npc/modules
export { NpcMagicCache, type SpecialMagicType } from "../../npc/modules";
export {
  type BezierMoveData,
  BezierMover,
  type BezierMoveUpdateResult,
  type JumpObstacleChecker,
} from "./bezierMover";
export { type FlyIniInfo, FlyIniManager } from "./flyIniManager";
export { StatusEffectsManager, type StatusEffectsUpdateResult } from "./statusEffects";
