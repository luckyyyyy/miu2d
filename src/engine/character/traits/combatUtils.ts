/**
 * Character Combat Utilities
 * Pure utility functions for combat calculations
 *
 * C# Reference: Character.cs and MagicSprite.cs combat calculations
 */

import { logger } from "../../core/logger";
import type { MagicSprite } from "../../magic/magicSprite";
import { getEffectAmount } from "../../magic/effects/common";
import type { Character } from "../character";

/**
 * Calculate hit rate between attacker and target
 * C# Reference: MagicSprite.CharacterHited hit rate calculation
 *
 * @param targetEvade Target's evade value
 * @param attackerEvade Attacker's evade value
 * @returns Hit rate as a decimal (0.0 - 1.0)
 */
export function calculateHitRate(targetEvade: number, attackerEvade: number): number {
  const maxOffset = 100;
  const baseHitRatio = 0.05;
  const belowRatio = 0.5;
  const upRatio = 0.45;

  let hitRatio = baseHitRatio;
  if (targetEvade >= attackerEvade) {
    // Target has higher or equal evade
    // hitRatio += (attackerEvade / targetEvade) * belowRatio
    // Range: 5% - 55%
    if (targetEvade > 0) {
      hitRatio += (attackerEvade / targetEvade) * belowRatio;
    } else {
      hitRatio += belowRatio;
    }
  } else {
    // Attacker has higher evade
    // hitRatio += belowRatio + ((attackerEvade - targetEvade) / maxOffset) * upRatio
    // Range: 55% - 100%
    let upOffsetRatio = (attackerEvade - targetEvade) / maxOffset;
    if (upOffsetRatio > 1) upOffsetRatio = 1;
    hitRatio += belowRatio + upOffsetRatio * upRatio;
  }

  return hitRatio;
}

/**
 * Roll for hit based on hit rate
 * @returns true if hit, false if miss
 */
export function rollForHit(hitRate: number): boolean {
  const roll = Math.random();
  return roll <= hitRate;
}

/**
 * Check for immunity shield in magic sprites
 * C# Reference: MagicSprite.CharacterHited - SpecialKind=6 immunity check
 *
 * @param magicSprites Array of magic sprites in effect
 * @returns true if character has immunity shield
 */
export function hasImmunityShield(magicSprites: MagicSprite[]): boolean {
  for (const sprite of magicSprites) {
    if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 6) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate damage reduction from shields
 * C# Reference: MagicSprite.CharacterHited - SpecialKind=3 shield reduction
 *
 * @param magicSprites Array of magic sprites in effect
 * @param character Character being protected
 * @param damageType Type of damage ("effect" | "effect2" | "effect3")
 * @returns Total damage reduction
 */
export function calculateShieldReduction(
  magicSprites: MagicSprite[],
  character: Character,
  damageType: "effect" | "effect2" | "effect3"
): number {
  let reduction = 0;
  for (const sprite of magicSprites) {
    if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 3) {
      reduction += getEffectAmount(sprite.magic, character, damageType);
    }
  }
  return reduction;
}

/**
 * Calculate simple shield reduction for basic damage
 * Used for takeDamage (single damage type)
 *
 * @param magicSprites Array of magic sprites in effect
 * @param characterAttack Character's attack value for fallback
 * @returns Total damage reduction
 */
export function calculateSimpleShieldReduction(
  magicSprites: MagicSprite[],
  characterAttack: number
): number {
  let reduction = 0;
  for (const sprite of magicSprites) {
    if (sprite.magic.moveKind === 13 && sprite.magic.specialKind === 3) {
      const effect = sprite.magic.effect === 0 ? characterAttack : sprite.magic.effect;
      reduction += effect + (sprite.magic.effectExt || 0);
    }
  }
  return reduction;
}

/**
 * Calculate experience from killing a character
 * C# Reference: Character.GetCharacterDeathExp
 *
 * @param killerLevel Killer's level
 * @param deadLevel Dead character's level
 * @param expBonus Dead character's experience bonus
 * @returns Experience points to award
 */
export function calculateDeathExp(killerLevel: number, deadLevel: number, expBonus: number = 0): number {
  const exp = killerLevel * deadLevel + expBonus;
  return exp < 4 ? 4 : exp;
}

/**
 * Apply minimum damage floor
 * C# Reference: MagicSprite.CharacterHited - MinimalDamage = 5
 *
 * @param damage Calculated damage
 * @param minDamage Minimum damage floor (default 5)
 * @returns Damage with minimum applied
 */
export function applyMinimumDamage(damage: number, minDamage: number = 5): number {
  return damage < minDamage ? minDamage : damage;
}

/**
 * Cap damage to not exceed remaining life
 *
 * @param damage Calculated damage
 * @param currentLife Character's current life
 * @returns Capped damage
 */
export function capDamageToLife(damage: number, currentLife: number): number {
  return damage > currentLife ? currentLife : damage;
}

/**
 * Log combat hit result
 */
export function logCombatHit(
  attackerName: string,
  targetName: string,
  damage: number,
  remainingLife: number,
  maxLife: number,
  hitRate: number
): void {
  logger.log(
    `[Character] ${targetName} took ${damage} damage from ${attackerName} ` +
    `(${remainingLife}/${maxLife} HP, hit rate: ${(hitRate * 100).toFixed(1)}%)`
  );
}

/**
 * Log combat miss result
 */
export function logCombatMiss(
  attackerName: string,
  targetName: string,
  roll: number,
  hitRate: number
): void {
  logger.log(
    `[Character] ${attackerName} missed ${targetName} ` +
    `(roll ${(roll * 100).toFixed(1)}% > ${(hitRate * 100).toFixed(1)}% hit rate)`
  );
}
