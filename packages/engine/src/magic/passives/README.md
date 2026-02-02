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

- 武功可装备到修炼栏（`XiuLianIndex = 49`）
- 装备后获得被动效果
- 攻击时自动触发 `AttackFile` 指定的武功

### 武功属性

- **AttackFile**: 普通攻击时释放的武功文件
- **ActionFile**: 攻击动画文件（改变角色攻击姿势）

## 触发时机

| 事件 | 触发条件 | 效果 |
|------|----------|------|
| onAttack | 普通攻击（Attack2 状态） | 释放 AttackFile 武功 |
| onHit | 攻击命中敌人 | 可添加额外效果 |
| onKill | 击杀敌人 | 修炼武功获得经验 |

## 架构设计

```
passives/
├── index.ts              # 导出
├── types.ts              # 被动效果类型定义
├── passiveManager.ts     # 被动效果管理器
└── xiuLianEffect.ts      # 修炼武功效果
```

## 使用方式

```typescript
// Player 装备修炼武功
player.setXiuLianMagic(magicItemInfo);

// 攻击时检查并触发被动效果
// 在 Player.onAttack() 中调用
if (player.xiuLianMagic?.magic?.attackFile) {
  magicManager.useMagic({
    userId: "player",
    magic: attackFileMagic,
    origin: player.position,
    destination: attackTarget,
  });
}
```
