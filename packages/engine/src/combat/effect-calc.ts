/**
 * Effect Calculation - 效果计算纯函数
 *
 * 从 magic/effects/common.ts 提取的纯计算函数。
 * 独立的 combat 模块，消除 character ↔ magic 循环依赖。
 */

/**
 * 用于 getEffectAmount 的最小角色接口
 * 允许继承链中间层使用
 */
export interface EffectCharacter {
  isPlayer: boolean;
  attack: number;
  realAttack: number;
  attack2: number;
  attack3: number;
  /** 新剑侠情缘: Effect 叠加 Attack；月影传说/剑侠情缘2: Effect 替代 Attack */
  effectFormulaAdditive?: boolean;
  getAddMagicEffectPercent?(): number;
  getAddMagicEffectAmount?(): number;
}

/**
 * MagicManager.GetEffectAmount
 * 计算武功效果值（含装备加成）
 *
 * @param magic 武功数据
 * @param belongCharacter 归属角色（用于计算加成）
 * @param effectType 效果类型: 'effect' | 'effect2' | 'effect3'
 */
export function getEffectAmount(
  magic: {
    effect: number;
    effect2: number;
    effect3: number;
    effectExt: number;
    name?: string;
    type?: string;
  },
  belongCharacter: EffectCharacter,
  effectType: "effect" | "effect2" | "effect3" = "effect"
): number {
  const isPlayer = belongCharacter.isPlayer;

  let baseEffect: number;
  if (effectType === "effect") {
    // 新剑侠情缘 (effectFormulaAdditive): Effect + Attack（叠加制）
    // 月影传说/剑侠情缘2: Effect 替代 Attack（替代制）
    if (magic.effect !== 0 && isPlayer) {
      baseEffect = belongCharacter.effectFormulaAdditive
        ? magic.effect + belongCharacter.attack
        : magic.effect;
    } else {
      baseEffect = belongCharacter.realAttack;
    }
    // effectExt 只加在 effect 上
    baseEffect += magic.effectExt || 0;
  } else if (effectType === "effect2") {
    baseEffect = magic.effect2 === 0 || !isPlayer ? belongCharacter.attack2 : magic.effect2;
  } else {
    baseEffect = magic.effect3 === 0 || !isPlayer ? belongCharacter.attack3 : magic.effect3;
  }

  // AddMagicEffect - 应用装备等加成
  return addMagicEffect(belongCharacter, baseEffect);
}

/**
 * MagicManager.AddMagicEffect
 * 应用武功效果加成（百分比 + 固定值）
 */
export function addMagicEffect(belongCharacter: EffectCharacter, effect: number): number {
  // 只有玩家有装备加成
  if (!belongCharacter.isPlayer) {
    return effect;
  }

  // 获取角色的加成属性
  const percent = belongCharacter.getAddMagicEffectPercent?.() ?? 0;
  const amount = belongCharacter.getAddMagicEffectAmount?.() ?? 0;

  // 还有按武功名称/类型的加成 (GetAddMagicEffectInfoWithName/Type)
  // 低优先级功能，暂未实现

  if (percent > 0) {
    effect += Math.floor((effect * percent) / 100);
  }
  effect += amount;

  return effect;
}

/**
 * 命中率检查（比例制，含 5% 兜底）
 *
 * Reference: JxqyHD MagicSprite.cs CharacterHited
 *
 * 设 a = attacker.realEvade，t = target.realEvade：
 *   if t >= a: hitRatio = 5% + (a/t) × 50%          （最低 5%，最高 55%）
 *   else:      hitRatio = 5% + 50% + clamp((a-t)/100, 0,1) × 45%  （最高 100%）
 *
 * 玄慈(29) 打 31 级玩家(137)：5% + (29/137)×50% ≈ 15.6%
 */
export function calcMagicHit(
  target: { realEvade: number },
  attacker: { realEvade: number } | null
): boolean {
  const a = attacker?.realEvade ?? 0;
  const t = target.realEvade;
  let hitRatio: number;
  if (t >= a) {
    hitRatio = 0.05 + (t > 0 ? a / t : 1) * 0.5;
  } else {
    const upOffset = Math.min((a - t) / 100, 1);
    hitRatio = 0.05 + 0.5 + upOffset * 0.45;
  }
  return Math.floor(Math.random() * 101) <= Math.floor(hitRatio * 100);
}

/**
 * 计算击杀经验
 * Reference: Utils.GetCharacterDeathExp(dead, killer)
 * 奖励 = max(dead.level × killer.level, 4) + dead.expBonus（Boss 额外奖励）
 * 任一参数为 null 时返回最低值 1。
 */
export function getCharacterDeathExp(
  dead: { level: number; expBonus?: number } | null,
  killer: { level: number } | null
): number {
  if (!dead || !killer) return 1;
  const exp = killer.level * dead.level + (dead.expBonus ?? 0);
  return exp < 4 ? 4 : exp;
}
