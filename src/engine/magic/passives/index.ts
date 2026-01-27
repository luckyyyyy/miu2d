/**
 * Passive Effects System - 被动效果系统
 *
 * 处理装备到修炼栏的武功被动效果
 */

// 类型定义
export type {
  PassiveEffect,
  PassiveManagerConfig,
  AttackContext,
  HitContext,
  KillContext,
  DamagedContext,
  UpdateContext,
} from "./types";

export { PassiveTrigger } from "./types";

// 管理器
export { PassiveManager } from "./passiveManager";

// 修炼武功效果
export {
  xiuLianAttackEffect,
  xiuLianExpEffect,
  preloadXiuLianAttackMagic,
  clearAttackMagicCache,
} from "./xiuLianEffect";
