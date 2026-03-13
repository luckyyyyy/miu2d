/**
 * Core enums used broadly across engine modules (sprite, runtime, script, magic, etc.)
 */

export enum CharacterState {
  Stand = 0, // acStand
  Stand1 = 1, // acStand1
  Walk = 2, // acWalk
  Run = 3, // acRun
  Jump = 4, // acJump
  Attack = 5, // acAttack
  Attack1 = 6, // acAttack1
  Attack2 = 7, // acAttack2
  Magic = 8, // acMagic
  Hurt = 9, // acHurt
  Sit = 10, // acSit
  Death = 11, // acDeath
  Special = 12, // acSpecial
  Sitting = 13, // acSitting（正在坐下过渡动作）
  FightStand = 20, // acAStand（持剑站立）
  FightWalk = 21, // acAWalk（持剑走）
  FightRun = 22, // acARun（持剑跑）
  FightJump = 23, // acAJump（持剑跳）
  SpecialAttack = 24, // acSpecialAttack
  Hide = 255, // acHide（死后隐藏）
}

/**
 * 8方向枚举，从 South 开始顺时针，direction 0 = (0,1) = South
 */
export enum Direction {
  South = 0,
  SouthWest = 1,
  West = 2,
  NorthWest = 3,
  North = 4,
  NorthEast = 5,
  East = 6,
  SouthEast = 7,
}
