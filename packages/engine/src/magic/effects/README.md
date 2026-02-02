# Magic Effects System - 武功效果系统

## 概述

武功效果系统基于生命周期函数设计，每种武功由几个函数组成：

- **onCast** - 释放时触发（扣蓝、触发特殊状态等）
- **apply** - 作用时触发（对目标造成伤害/治疗等）
- **onEnd** - 结束时触发（清理 BUFF、状态等）

## 目录结构

```
effects/
├── index.ts              # 导出
├── types.ts              # 核心类型定义
├── common.ts             # 通用效果函数（伤害、治疗等）
├── registry.ts           # MoveKind → MagicEffect 映射
│
├── normalAttack.ts       # 普通飞行攻击效果
├── followCharacter.ts    # 自身增益效果（治疗、BUFF）
├── superMode.ts          # 全屏攻击效果
├── fixedPosition.ts      # 固定位置效果
├── throw.ts              # 投掷效果
└── followEnemy.ts        # 追踪敌人效果
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

- **CastContext** - 释放上下文：caster, magic, origin, destination, target
- **ApplyContext** - 作用上下文：caster, target, magic, sprite
- **EndContext** - 结束上下文：caster, magic, sprite

## 使用示例

### 定义新效果

```typescript
// 普通攻击：释放扣蓝，命中造成伤害
const normalAttackEffect: MagicEffect = {
  onCast(ctx) {
    deductCost(ctx);  // 扣除内力/体力/生命消耗
  },
  apply(ctx) {
    dealDamage(ctx);  // 对目标造成伤害
  },
};
```

### 自身增益效果 (MoveKind=13)

```typescript
// 治疗类武功：释放扣蓝，立即治疗自己
const healEffect: MagicEffect = {
  onCast(ctx) {
    deductCost(ctx);
  },
  apply(ctx) {
    healTarget(ctx.caster, amount, ctx.guiManager);
  },
};
```

### 注册效果

```typescript
import { registerEffect } from "./registry";
import { MagicMoveKind } from "../types";

registerEffect(MagicMoveKind.SingleMove, normalAttackEffect);
```

## 效果与 MoveKind 对应关系

| MoveKind | 效果类型 | 说明 |
|----------|----------|------|
| 1, 22 | fixedPosition | 固定位置（陷阱、法阵）|
| 2, 3, 4, 5, 6, 7, 8, 10, 24 | normalAttack | 普通飞行攻击 |
| 13, 23 | followCharacter | 自身增益（治疗、BUFF）|
| 15 | superMode | 全屏攻击 |
| 16 | followEnemy | 追踪敌人 |
| 17 | throw | 投掷 |

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

## 扩展指南

### 添加新的效果类型

1. 在 `effects/` 下创建新文件
2. 实现 `MagicEffect` 接口
3. 在 `registry.ts` 中注册
4. 在 `index.ts` 中导出

### 添加新的通用函数

在 `common.ts` 中添加，并在 `index.ts` 中导出。

## C# 参考

- `MagicManager.cs` - 武功管理器
- `MagicSprite.cs` - 武功精灵（碰撞检测、效果应用）
- `Magic.cs` - 武功数据定义
