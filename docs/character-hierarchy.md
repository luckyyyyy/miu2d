# Character 类继承关系

基于 C# JxqyHD 项目的类继承结构。

## ✅ TypeScript 实现状态

已完成类继承重构，与 C# 架构保持一致：

```
src/engine/
├── sprite/
│   ├── sprite.ts          # ✅ Sprite 基类
│   └── index.ts
├── character/
│   ├── characterBase.ts   # ✅ Character 抽象类 (extends Sprite)
│   ├── npc.ts             # ✅ Npc 类 (extends Character)
│   ├── player.ts          # ✅ Player 类 (extends Character)
│   ├── npcManager.ts      # ✅ NPC 管理器 (使用旧数据格式，兼容)
│   ├── playerController.ts# ✅ 玩家控制器 (使用旧数据格式，兼容)
│   ├── character.ts       # ⚠️ 旧代码，保留向后兼容
│   └── index.ts
```

## 继承图

```
Sprite (Engine/Sprite.cs)
   │
   │  位置、动画、方向、速度、帧控制
   │
   ▼
Character (Engine/Character.cs) [abstract]
   │
   │  角色属性（生命、法力、攻击、防御、等级等）
   │  角色行为（移动、战斗、对话、寻路等）
   │  INI 配置加载
   │
   ├──────────────────┬────────────────────┐
   │                  │                    │
   ▼                  ▼                    ▼
Npc                Player              (MagicSprite)
(Engine/Npc.cs)    (Engine/Player.cs)
   │                  │
   │ AI 行为          │ 玩家输入
   │ 巡逻/战斗        │ 背包/金钱
   │ 视野/对话        │ 魔法使用
```

## 各类职责

### Sprite (基类)
**文件**: `Engine/Sprite.cs` → `src/engine/sprite/sprite.ts`

**字段**:
- `_positionInWorld: Vector2` - 世界坐标
- `_mapX, _mapY: int` - 地图格子坐标
- `_velocity: float` - 速度
- `_currentFrameIndex: int` - 当前帧
- `_frameBegin, _frameEnd: int` - 帧范围
- `_currentDirection: int` - 方向
- `_texture: TextureBase` - 纹理(ASF)
- `_isPlayReverse: bool` - 反向播放
- `_leftFrameToPlay: int` - 剩余播放帧数

**方法**:
- `Set(position, velocity, texture, direction)` - 初始化
- `Update(gameTime)` - 更新动画
- `Draw(spriteBatch)` - 绘制
- `PlayFrames(begin, end)` - 播放帧序列
- `PlayCurrentDirOnce()` - 播放当前方向一次

---

### Character (抽象类, 继承 Sprite)
**文件**: `Engine/Character.cs` → `src/engine/character/character.ts`

**字段** (继承 Sprite 的所有字段，加上):
- `_name: string` - 名称
- `_kind: CharacterKind` - 类型 (Player/Fighter/Eventer/Follower/Fighter2/Flyer)
- `_group: int` - 分组
- `_relation: RelationType` - 关系 (Enemy/Friend/None)
- `_state: CharacterState` - 状态 (Stand/Walk/Run/Attack...)
- `_life, _lifeMax: int` - 生命
- `_mana, _manaMax: int` - 法力
- `_thew, _thewMax: int` - 体力
- `_attack, _attack2, _attack3: int` - 攻击力
- `_defend, _defend2, _defend3: int` - 防御力
- `_evade: int` - 闪避
- `_exp, _levelUpExp: int` - 经验
- `_level: int` - 等级
- `_walkSpeed: int` - 行走速度
- `_visionRadius: int` - 视野半径
- `_attackRadius: int` - 攻击半径
- `_dialogRadius: int` - 对话半径
- `_npcIni: StateMapList` - NPC配置
- `_flyIni: Magic` - 飞行魔法
- `_bodyIni: Obj` - 尸体
- `_scriptFile: string` - 脚本
- `_path: LinkedList<Vector2>` - 路径

**方法**:
- `Load(filePath)` / `Load(keyDataCollection)` - 加载INI
- `SetState(state)` - 设置状态
- `MoveTo(direction, elapsedSeconds)` - 移动
- `MoveAlongPath(elapsedSeconds, speedFold)` - 沿路径移动
- `WalkTo(destination)` / `RunTo(destination)` - 走/跑到目标
- `StandingImmediately()` - 立即停止
- `Update(gameTime)` - 更新 (覆写 Sprite)
- `Attack(target)` - 攻击
- `Interact()` - 交互
- `GetRandTilePath(maxStep, isFlyer)` - 随机路径

---

### Npc (继承 Character)
**文件**: `Engine/Npc.cs` → `src/engine/character/npc.ts`

**字段** (继承 Character 的所有字段，加上):
- `_actionPathTilePositionList: List<Vector2>` - 巡逻路径
- `_idledFrame: int` - 待机帧数
- `_keepDistanceCharacterWhenFriendDeath: Character` - 友方死亡时保持距离的目标
- `_blindMilliseconds: float` - 致盲时间
- `IsAIDisabled: bool` - 是否禁用AI

**特有属性**:
- `PathType` - 寻路类型 (根据 Kind 和 PathFinder 返回不同类型)

**方法**:
- `Npc(filePath)` - 从INI加载
- `Npc(keyDataCollection)` - 从配置加载
- `Update(gameTime)` - AI更新 (覆写 Character)
- `PerformAction()` - 执行AI行为

---

### Player (继承 Character)
**文件**: `Engine/Player.cs` → `src/engine/character/player.ts`

**字段** (继承 Character 的所有字段，加上):
- `_money: int` - 金钱
- `_doing: int` - 当前动作
- `_desX, _desY: int` - 目标坐标
- `_belong: int` - 归属
- `_fight: int` - 战斗状态
- `_isRun: bool` - 是否跑步
- `_currentMagicInUse: MagicItemInfo` - 当前使用魔法
- `_xiuLianMagic: MagicItemInfo` - 修炼魔法
- `_standingMilliseconds: float` - 站立时间
- `_sittedMilliseconds: float` - 坐下时间
- `_autoAttackTarget: Character` - 自动攻击目标

**常量**:
- `ThewUseAmountWhenAttack = 5` - 攻击消耗体力
- `ThewUseAmountWhenJump = 10` - 跳跃消耗体力
- `LifeRestorePercent = 0.01f` - 生命恢复比例
- `ThewRestorePercent = 0.03f` - 体力恢复比例
- `ManaRestorePercent = 0.02f` - 法力恢复比例

**方法**:
- `Update(gameTime)` - 更新 (覆写 Character, 处理玩家输入)
- `HandleInput(input)` - 处理输入
- `CanRunning()` - 是否可以跑
- `UseMagic()` - 使用魔法
- `AddMoney(amount)` / `UseMoney(amount)` - 金钱操作
- `AddExp(amount)` - 获得经验
- `LevelUp()` - 升级

---

## ✅ TypeScript 实现完成

### 实际文件结构
```
src/engine/
├── sprite/
│   ├── sprite.ts          # ✅ Sprite 基类
│   └── index.ts
├── character/
│   ├── characterBase.ts   # ✅ Character 抽象类 (extends Sprite)
│   ├── npc.ts             # ✅ Npc 类 (extends Character)
│   ├── player.ts          # ✅ Player 类 (extends Character)
│   ├── npcManager.ts      # NPC 管理器 (兼容旧数据格式)
│   ├── playerController.ts# 玩家控制器 (兼容旧数据格式)
│   ├── character.ts       # 旧代码，保留向后兼容
│   └── index.ts
```

### 类定义示例

```typescript
// sprite/sprite.ts
export class Sprite {
  protected _positionInWorld: Vector2;
  protected _mapX: number;
  protected _mapY: number;
  protected _velocity: number;
  protected _currentDirection: number;
  protected _texture: AsfData | null;
  protected _currentFrameIndex: number;
  protected _frameBegin: number;
  protected _frameEnd: number;
  protected _leftFrameToPlay: number;
  protected _isShow: boolean;
  // ...
}

// character/characterBase.ts
export abstract class Character extends Sprite {
  protected _name: string;
  protected _kind: CharacterKind;
  protected _relation: RelationType;
  protected _life: number;
  protected _lifeMax: number;
  protected _mana: number;
  protected _manaMax: number;
  protected _thew: number;
  protected _thewMax: number;
  protected _attack: number;
  protected _defend: number;
  protected _walkSpeed: number;
  protected _path: Vector2[];
  protected _state: CharacterState;
  // ...
}

// character/npc.ts
export class Npc extends Character {
  private _id: string;
  private _actionPathTilePositions: Vector2[];
  private _isAIDisabled: boolean;
  private _blindMilliseconds: number;
  // ...
}

// character/player.ts
export class Player extends Character {
  private _money: number;
  private _doing: number;
  private _isRun: boolean;
  private _walkIsRun: number;
  private _isRunDisabled: boolean;
  // ...
}
```

### 类实例统一

所有代码现在直接使用 `Npc` 和 `Player` 类实例，不再使用 `NpcData` 数据对象格式。
`PlayerData` 仅用于序列化/状态传输场景。

// player.ts
export class Player extends Character {
  private money: number;
  private currentMagicInUse: MagicItemInfo | null;
  // ...
}
```

---

## 注意事项

1. **Character 是 abstract 类**，不能直接实例化
2. **Npc 和 Player 是具体实现**，包含各自特有的逻辑
3. 当前 TS 实现使用**接口 + 函数**方式，需要重构为**类继承**
4. 保持与 C# 的属性/方法命名一致，便于对照
5. TypeScript 使用 `protected` 替代 C# 的 `protected`/`private`
