# Magic Effects System - 武功效果系统

## 概述

武功效果系统基于生命周期函数设计，每种武功由几个函数组成：

- **onCast** - 释放时触发（扣蓝、触发特殊状态等）
- **apply** - 作用时触发（对目标造成伤害/治疗等）
- **onEnd** - 结束时触发（清理 BUFF、状态等）

## 目录结构

```
effects/
├── index.ts                # 导出
├── types.ts                # 核心类型定义（CharacterRef, CastContext, ApplyContext, EndContext）
├── common.ts               # 通用效果函数（伤害、治疗、状态效果等）
├── registry.ts             # MoveKind → MagicEffect 映射表 + getEffect/registerEffect API
│
├── damage-effects.ts       # 伤害类效果（simpleDamage, regionBased, superMode）
├── follow-character.ts     # 自身增益效果（治疗、BUFF、时间停止）
└── special-move-kinds.ts   # 特殊类型效果（传送、召唤、控制、Kind19 留痕）
```

## 核心类型

### CharacterRef - 角色引用

```typescript
type CharacterRef =
  | { type: "player"; player: Player }
  | { type: "npc"; npc: Npc; id: string };
```

### MagicEffect - 效果接口

```typescript
interface MagicEffect {
  onCast?: (ctx: CastContext) => void;   // 释放时
  apply?: (ctx: ApplyContext) => void;    // 作用时
  onEnd?: (ctx: EndContext) => void;      // 结束时
}
```

### 上下文类型

- **CastContext** - 释放上下文：caster, magic, origin, destination, target, guiManager, audioManager, screenEffects, npcManager
- **ApplyContext** - 作用上下文：caster, target, magic, sprite, guiManager, audioManager, screenEffects, npcManager
- **EndContext** - 结束上下文：caster, magic, sprite, guiManager, audioManager, screenEffects, npcManager

## 效果与 MoveKind 对应关系

| MoveKind | 效果实现 | 说明 |
|----------|----------|------|
| 1 (FixedPosition), 9 (FixedWall) | `simpleDamageEffect` | 固定位置伤害 |
| 2, 3, 4, 5, 6, 7, 8, 10, 24 | `simpleDamageEffect` | 普通飞行攻击（Single/Line/Circle/Heart/Spiral/Sector/RandomSector/Wall/V） |
| 11 (RegionBased) | `regionBasedEffect` | 区域伤害 |
| 13 (FollowCharacter), 23 (TimeStop) | `followCharacterEffect` | 自身增益（治疗/BUFF/时间停止） |
| 15 (SuperMode) | `superModeEffect` | 全屏攻击 |
| 16 (FollowEnemy) | `simpleDamageEffect` | 追踪敌人伤害 |
| 17 (Throw) | `simpleDamageEffect` | 投掷伤害 |
| 19 (Kind19) | `kind19Effect` | 持续留痕 |
| 20 (Transport) | `transportEffect` | 传送 |
| 21 (PlayerControl) | `controlCharacterEffect` | 玩家控制角色 |
| 22 (Summon) | `summonEffect` | 召唤 NPC |

## 通用函数 (common.ts)

### 消耗函数
- `deductCost(ctx)` - 扣除释放消耗（内力、体力、生命）

### 伤害/治疗函数
- `calculateDamage(caster, target, magic)` - 计算伤害值
- `dealDamage(ctx)` - 对目标造成伤害
- `healTarget(target, amount)` - 治疗目标
- `restoreMana(target, amount)` - 恢复内力
- `restoreThew(target, amount)` - 恢复体力

## MagicManager 集成

MagicManager 在以下时机调用效果函数：

1. **useMagic()** → `effect.onCast()`
2. **checkCollision()** → `effect.apply()` (命中敌人时)
3. **spriteEnd()** → `effect.onEnd()` (精灵销毁时)

特殊情况：
- **FollowCharacter (13)**: 创建时立即调用 `apply()`（作用于自己）
- **SuperMode (15)**: 销毁时对所有视野内敌人调用 `apply()`
- **TimeStop (23)**: 与 FollowCharacter 共享效果逻辑

## 扩展指南

### 添加新的效果类型

1. 在 `effects/` 下创建新文件或在现有文件中添加
2. 实现 `MagicEffect` 接口
3. 在 `registry.ts` 中注册到 `effectRegistry` 映射表
4. 在 `index.ts` 中导出

### 添加新的通用函数

在 `common.ts` 中添加，并在 `index.ts` 中导出。

## C# 参考

- `MagicManager.cs` - 武功管理器
- `MagicSprite.cs` - 武功精灵（碰撞检测、效果应用）
- `Magic.cs` - 武功数据定义
