# Passive Effects System - 被动效果系统（修炼武功）

## 概述

被动效果系统处理装备到修炼栏的武功。当武功装备到修炼栏后，普通攻击会触发额外效果。

## C# 原版机制

参考 `Player.cs`:

```csharp
// 属性：修炼中的武功
public MagicListManager.MagicItemInfo XiuLianMagic { get; set; }

// 攻击时触发修炼武功
protected override void OnAttacking(Vector2 attackDestinationPixelPosition)
{
    if (State == (int)CharacterState.Attack2 &&
        XiuLianMagic != null &&
        XiuLianMagic.TheMagic != null &&
        XiuLianMagic.TheMagic.AttackFile != null)
    {
        MagicManager.UseMagic(this,
            XiuLianMagic.TheMagic.AttackFile,  // 攻击时释放的武功
            PositionInWorld,
            attackDestinationPixelPosition);
    }
}
```

## 关键概念

### 修炼武功 (XiuLianMagic)

- 武功可装备到修炼栏（`XiuLianIndex` 来自 `MAGIC_LIST_CONFIG`）
- 装备后获得被动效果
- 攻击时自动触发 `AttackFile` 指定的武功
- AttackFile 在 `addMagic` 时预加载（`preloadXiuLianAttackMagic`），战斗中同步获取

### 武功属性

- **AttackFile**: 普通攻击时释放的武功文件
- **ActionFile**: 攻击动画文件（改变角色攻击姿势）

## 触发时机

| 事件 | 触发条件 | 效果 |
|------|----------|------|
| onAttack | 普通攻击（Attack2 状态） | 释放 AttackFile 武功（`xiuLianAttackEffect`） |
| onKill | 击杀敌人 | 修炼武功获得经验（`xiuLianExpEffect`） |

## 架构设计

```
passives/
├── index.ts              # 导出
├── types.ts              # 被动效果类型定义（PassiveEffect, PassiveTrigger, 各种 Context）
├── passive-manager.ts    # PassiveManager — 管理器，注册 + 触发被动效果
└── xiu-lian-effect.ts    # 修炼武功效果（攻击触发 + 击杀经验）
```

### PassiveManager

```typescript
class PassiveManager {
  // 当前修炼武功
  private _xiuLianMagic: MagicItemInfo | null;

  // 注册默认效果
  constructor() {
    this.registerEffect(xiuLianAttackEffect);  // 攻击触发
    this.registerEffect(xiuLianExpEffect);     // 击杀经验
  }

  // 设置修炼武功（装备管理器调用）
  setXiuLianMagic(magic: MagicItemInfo | null): void;

  // 触发回调（由 Player 在对应时机调用）
  onAttack(ctx: AttackContext): void;
  onHit(ctx: HitContext): void;
  onKill(ctx: KillContext): void;
  onDamaged(ctx: DamagedContext): void;
  onUpdate(ctx: UpdateContext): void;
}
```

### PassiveEffect 接口

```typescript
interface PassiveEffect {
  trigger: PassiveTrigger;                     // 触发类型
  handler: (ctx: Context, magic: MagicData) => void;  // 效果处理
}

enum PassiveTrigger {
  OnAttack = "onAttack",
  OnHit = "onHit",
  OnKill = "onKill",
  OnDamaged = "onDamaged",
  OnUpdate = "onUpdate",
}
```

## 使用方式

```typescript
// PassiveManager 由 Player 内部持有
// 装备修炼武功时自动设置
player.equipMagic(xiuLianIndex, magicItemInfo);

// 攻击时 Player 内部调用
// → PassiveManager.onAttack()
// → xiuLianAttackEffect 检查 Attack2 状态
// → 释放 AttackFile 武功

// 击杀时 Player 内部调用
// → PassiveManager.onKill()
// → xiuLianExpEffect 为修炼武功增加经验
```

## C# 参考

- `Player.cs` — 修炼武功属性和攻击触发
- `MagicListManager.cs` — 武功列表管理（含修炼槽位）
