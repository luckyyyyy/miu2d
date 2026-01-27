/**
 * 普通攻击效果 - MoveKind 2,3,4,5,6,7,8 等飞行武功
 *
 * 特点：释放时扣蓝，命中时造成伤害
 */

import type { MagicEffect, ApplyContext, CastContext } from "./types";
import { deductCost, dealDamage } from "./common";

/**
 * 创建普通攻击效果
 */
export function createNormalAttackEffect(): MagicEffect {
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
 * 普通攻击效果实例
 * 用于 MoveKind: SingleMove, LineMove, CircleMove, HeartMove, SpiralMove, SectorMove 等
 */
export const normalAttackEffect = createNormalAttackEffect();
