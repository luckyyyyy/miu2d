/**
 * 跟随敌人效果 - MoveKind=16 (FollowEnemy)
 *
 * 追踪敌人的武功
 */

import type { MagicEffect, ApplyContext, CastContext } from "./types";
import { deductCost, dealDamage } from "./common";

/**
 * 创建跟随敌人效果
 */
export function createFollowEnemyEffect(): MagicEffect {
  return {
    /**
     * 释放时：扣除消耗
     */
    onCast(ctx: CastContext): void {
      deductCost(ctx);
    },

    /**
     * 命中时：造成伤害
     */
    apply(ctx: ApplyContext): void {
      dealDamage(ctx);
    },
  };
}

/**
 * 跟随敌人效果实例
 */
export const followEnemyEffect = createFollowEnemyEffect();
