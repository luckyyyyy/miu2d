/**
 * Combat Utilities - 战斗相关纯函数
 *
 * 放在 core/ 中以消除 magic ↔ npc 循环依赖。
 * 使用最小接口而非具体类，避免对 character/ 模块的依赖。
 */

/**
 * 用于 isEnemy 判断的最小角色接口
 */
export interface CombatCharacter {
  isPlayer: boolean;
  isFighter: boolean;
  isFighterFriend: boolean;
  isPartner: boolean;
  group: number;
}

/**
 * Check if two characters are enemies (pure function)
 *
 * Reference: JxqyHD Npc.IsEnemy / Character.IsEnemy
 */
export function isEnemy(a: CombatCharacter, b: CombatCharacter): boolean {
  // 非战斗者不是敌人
  if ((!a.isPlayer && !a.isFighter) || (!b.isPlayer && !b.isFighter)) return false;
  // 玩家或友方 vs 非玩家、非伙伴、非友方
  if ((a.isPlayer || a.isFighterFriend) && !b.isPlayer && !b.isPartner && !b.isFighterFriend)
    return true;
  // 反过来
  if ((b.isPlayer || b.isFighterFriend) && !a.isPlayer && !a.isPartner && !a.isFighterFriend)
    return true;
  // 不同组
  return a.group !== b.group;
}
