/**
 * 通用效果 - 基础伤害/治疗函数
 *
 * 这些是被各种 MoveKind 效果复用的基础函数
 */

import type { ApplyContext, CastContext, CharacterRef } from "./types";
import {
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
} from "./types";

/**
 * 扣除施法消耗（内力、体力、生命）
 */
export function deductCost(ctx: CastContext): void {
  const { caster, magic, guiManager } = ctx;

  // 扣内力
  if (magic.manaCost > 0) {
    const currentMana = getMana(caster);
    const newMana = Math.max(0, currentMana - magic.manaCost);
    setMana(caster, newMana);
  }

  // 扣体力
  if (magic.thewCost > 0) {
    const currentThew = getThew(caster);
    const newThew = Math.max(0, currentThew - magic.thewCost);
    setThew(caster, newThew);
  }

  // 扣生命
  if (magic.lifeCost > 0) {
    const currentLife = getLife(caster);
    const newLife = Math.max(1, currentLife - magic.lifeCost);
    setLife(caster, newLife);
  }
}

/**
 * 计算伤害值
 */
export function calculateDamage(
  caster: CharacterRef,
  target: CharacterRef,
  magic: { effect: number; effectExt: number }
): number {
  const attack = getAttack(caster);
  const defend = getDefend(target);

  // 基础伤害 = 武功效果 + 攻击力 - 防御力
  let damage = magic.effect + magic.effectExt + attack - defend;

  // 随机浮动 ±10%
  const variance = 0.1;
  const randomFactor = 1 + (Math.random() * 2 - 1) * variance;
  damage = Math.floor(damage * randomFactor);

  return Math.max(1, damage); // 最小 1 点伤害
}

/**
 * 对目标造成伤害
 */
export function dealDamage(ctx: ApplyContext): number {
  const { caster, target, magic, guiManager } = ctx;

  const damage = calculateDamage(caster, target, magic);
  const currentLife = getLife(target);
  const newLife = Math.max(0, currentLife - damage);
  setLife(target, newLife);

  return damage;
}

/**
 * 治疗目标
 */
export function healTarget(
  target: CharacterRef,
  amount: number,
  guiManager?: { showMessage: (msg: string) => void }
): number {
  const currentLife = getLife(target);
  const maxLife = getLifeMax(target);
  const newLife = Math.min(maxLife, currentLife + amount);
  const actualHealed = newLife - currentLife;

  setLife(target, newLife);

  return actualHealed;
}

/**
 * 恢复内力
 */
export function restoreMana(
  target: CharacterRef,
  amount: number,
  guiManager?: { showMessage: (msg: string) => void }
): number {
  const currentMana = getMana(target);
  const maxMana = getManaMax(target);
  const newMana = Math.min(maxMana, currentMana + amount);
  const actualRestored = newMana - currentMana;

  setMana(target, newMana);

  return actualRestored;
}

/**
 * 恢复体力
 */
export function restoreThew(
  target: CharacterRef,
  amount: number,
  guiManager?: { showMessage: (msg: string) => void }
): number {
  const currentThew = getThew(target);
  const maxThew = getThewMax(target);
  const newThew = Math.min(maxThew, currentThew + amount);
  const actualRestored = newThew - currentThew;

  setThew(target, newThew);

  return actualRestored;
}
