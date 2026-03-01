/**
 * Combat - 战斗领域共享函数
 *
 * 纯函数模块，使用最小接口（非具体类）避免循环依赖。
 * 被 character/、magic/、npc/、player/ 等模块共享。
 *
 * 包含:
 * - isEnemy(): 判断两个角色是否为敌对关系
 * - getEffectAmount() / addMagicEffect(): 武功效果计算（含装备加成）
 * - getCharacterDeathExp(): 击杀经验计算
 */

export * from "./combat-utils";
export * from "./effect-calc";
