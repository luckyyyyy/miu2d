/**
 * 修炼武功效果 - XiuLian Effect
 *
 * 实现装备到修炼栏的武功的被动效果：
 * - 普通攻击时释放 AttackFile 武功
 * - 击杀敌人时获得修炼经验
 */

import type { PassiveEffect, AttackContext, KillContext } from "./types";
import { PassiveTrigger } from "./types";
import type { MagicData, MagicItemInfo } from "../types";
import { CharacterState } from "../../core/types";
import { loadMagic } from "../magicLoader";

// 缓存加载的 AttackFile 武功
const attackMagicCache = new Map<string, MagicData | null>();

/**
 * 获取 AttackFile 对应的武功数据
 */
async function getAttackMagic(attackFile: string): Promise<MagicData | null> {
  if (attackMagicCache.has(attackFile)) {
    return attackMagicCache.get(attackFile) ?? null;
  }

  try {
    const magic = await loadMagic(attackFile);
    attackMagicCache.set(attackFile, magic);
    return magic;
  } catch (error) {
    console.warn(`[XiuLian] Failed to load attack magic: ${attackFile}`, error);
    attackMagicCache.set(attackFile, null);
    return null;
  }
}

/**
 * 清除 AttackFile 武功缓存
 */
export function clearAttackMagicCache(): void {
  attackMagicCache.clear();
}

/**
 * 修炼武功攻击效果
 *
 * 当普通攻击（Attack2 状态）时，释放修炼武功的 AttackFile
 */
export const xiuLianAttackEffect: PassiveEffect = {
  name: "xiuLianAttack",
  trigger: PassiveTrigger.OnAttack,

  onAttack(ctx: AttackContext, xiuLianMagic: MagicItemInfo): MagicData | null {
    const magic = xiuLianMagic.magic;
    if (!magic) return null;

    // 只在 Attack2 状态触发（普通攻击的第二段）
    // C# 参考: if (State == (int)CharacterState.Attack2 && ...)
    if (ctx.attackState !== CharacterState.Attack2) {
      return null;
    }

    // 检查是否有 AttackFile
    if (!magic.attackFile) {
      return null;
    }

    // 同步返回缓存的武功，异步加载在外部处理
    const cachedMagic = attackMagicCache.get(magic.attackFile);
    if (cachedMagic) {
      return cachedMagic;
    }

    // 触发异步加载（不阻塞当前攻击）
    getAttackMagic(magic.attackFile);
    return null;
  },
};

/**
 * 预加载修炼武功的 AttackFile
 * 在装备修炼武功时调用
 */
export async function preloadXiuLianAttackMagic(xiuLianMagic: MagicItemInfo): Promise<void> {
  const magic = xiuLianMagic.magic;
  if (!magic?.attackFile) return;

  await getAttackMagic(magic.attackFile);
}

/**
 * 修炼经验获得效果
 *
 * 击杀敌人时，修炼武功获得经验
 */
export const xiuLianExpEffect: PassiveEffect = {
  name: "xiuLianExp",
  trigger: PassiveTrigger.OnKill,

  onKill(ctx: KillContext, xiuLianMagic: MagicItemInfo): void {
    // C# 参考: AddMagicExp(XiuLianMagic, (int)(amount * Utils.XiuLianMagicExpFraction))
    const expFraction = 0.3; // 修炼武功获得 30% 经验
    const xiuLianExp = Math.floor(ctx.expGained * expFraction);

    if (xiuLianExp > 0 && xiuLianMagic) {
      xiuLianMagic.exp += xiuLianExp;
      console.log(
        `[XiuLian] ${xiuLianMagic.magic?.name} gained ${xiuLianExp} exp (total: ${xiuLianMagic.exp})`
      );
    }
  },
};
