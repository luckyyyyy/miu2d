/**
 * 投掷效果 - MoveKind=17 (Throw)
 *
 * 投掷类武功（暗器等）
 */

import type { MagicEffect, ApplyContext, CastContext } from "./types";
import { deductCost, dealDamage } from "./common";

/**
 * 创建投掷效果
 */
export function createThrowEffect(): MagicEffect {
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
 * 投掷效果实例
 */
export const throwEffect = createThrowEffect();
