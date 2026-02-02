# Copilot Instructions for Miu2D Engine

## 项目概述

**Miu2D Engine** - 基于 Web 技术的 2D RPG 游戏引擎，复刻《剑侠情缘外传：月影传说》。

- **原版**：西山居 C++ (2001)
- **C# 复刻**：[JxqyHD](https://github.com/mapic91/JxqyHD)
- **本项目**：TypeScript + React 19 + Canvas API

### 技术栈
- TypeScript 5.9 (strict mode)
- React 19, Vite 7 (rolldown-vite)
- HTML5 Canvas 2D
- Tailwind CSS 4
- Web Audio API (OGG Vorbis)
- Biome (lint + format)
- **pnpm monorepo**

### pnpm Monorepo 结构

本项目使用 pnpm workspace 管理多包：

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

**包间依赖：**
```json
// packages/web/package.json
{
  "dependencies": {
    "@miu2d/engine": "workspace:*"  // 引用本地 engine 包
  }
}
```

**常用操作：**
```bash
pnpm install              # 安装所有包依赖
pnpm -r build             # 递归构建所有包
pnpm --filter @miu2d/web dev   # 只运行 web 包
```

### 项目结构

| 部分 | 目录 | 说明 |
|------|------|------|
| **游戏引擎** | `packages/engine/` | 纯 TypeScript，**不依赖 React**，包名 `@miu2d/engine` |
| **React 应用** | `packages/web/` | UI 界面和用户交互，包名 `@miu2d/web` |
| **C# 参考** | `JxqyHD/Engine/` | 原 C# 实现，功能参考来源 |
| **游戏资源** | `resources/` | 地图、精灵、脚本等资源文件 |

### 引擎模块结构

```
packages/engine/src/
├── audio/          # 音频管理（Web Audio API）
├── character/      # 角色系统（base/ 继承链, modules/, level/）
├── config/         # 配置管理（资源路径等）
├── constants/      # 常量定义
├── core/           # 核心类型和工具（types.ts, logger.ts, engineContext.ts）
├── debug/          # 调试系统
├── drop/           # 物品掉落
├── effects/        # 屏幕特效
├── game/           # 游戏引擎主类
├── gui/            # GUI 管理器
├── listManager/    # 列表管理器（伙伴、物品等）
├── magic/          # 武功系统（effects/, manager/, passives/）
├── map/            # 地图系统
├── npc/            # NPC 系统
├── obj/            # 物体系统
├── player/         # 玩家系统（goods/, magic/）
├── resource/       # 资源加载器
├── script/         # 脚本系统（commands/, parser.ts, executor.ts）
├── sprite/         # 精灵基类（sprite.ts, asf.ts）
├── timer/          # 计时器系统
├── ui/             # UI 桥接层
├── utils/          # 工具函数
└── weather/        # 天气系统
```

**导入引擎模块：**
```typescript
// 从主入口导入
import { GameEngine, Direction } from "@miu2d/engine";

// 从子模块导入
import { logger } from "@miu2d/engine/core/logger";
import { resourceLoader } from "@miu2d/engine/resource/resourceLoader";
import type { MagicData } from "@miu2d/engine/magic";
```

---

## 类继承体系

### Sprite 继承链

```
Sprite (packages/engine/src/sprite/sprite.ts)
└── CharacterBase (character/base/characterBase.ts)
    └── CharacterMovement (character/base/characterMovement.ts)
        └── CharacterCombat (character/base/characterCombat.ts)
            └── Character (character/character.ts) [abstract]
                ├── Player (player/player.ts)
                └── Npc (npc/npc.ts)
```

---

## IEngineContext 接口

Sprite 及其子类通过 `this.engine` 访问引擎服务：

```typescript
interface IEngineContext {
  // ===== 核心服务（只读属性）=====
  readonly player: IPlayer;           // 玩家实例
  readonly npcManager: INpcManager;   // NPC 管理器
  readonly map: MapBase;              // 地图（障碍检测、陷阱、坐标转换）
  readonly audio: AudioManager;       // 音频管理器

  // ===== 便捷方法（高频操作）=====
  runScript(path: string, belongObject?: { type: string; id: string }): Promise<void>;
  queueScript(path: string): void;
  getCurrentMapName(): string;
  getScriptBasePath(): string;
  isDropEnabled(): boolean;
  getScriptVariable(name: string): number;
  notifyPlayerStateChanged(): void;   // 通知 UI 刷新

  // ===== 低频管理器 =====
  getManager<T extends ManagerType>(type: T): ManagerMap[T];
}

// ManagerType: "magic" | "obj" | "gui" | "debug" | "weather" | "buy" | "interaction" | "magicHandler" | "mapRenderer" | "script"
```

**使用示例：**

```typescript
class Obj extends Sprite {
  async interact() {
    // 核心服务直接访问
    const player = this.engine.player;
    const isBlocked = this.engine.map.isObstacleForCharacter(x, y);
    this.engine.audio.playSound("click.wav");

    // 低频管理器通过 getManager（类型安全）
    const gui = this.engine.getManager("gui");
    gui.showDialog("Hello");
  }
}
```

---

## 核心规范

### 必须遵守

1. **禁止 `any`** - 使用 `unknown` + 类型守卫
2. **参考 C# 实现** - 功能实现前先阅读 `/JxqyHD/Engine/` 对应代码
3. **每次修改后运行 `pnpm tsc`** - 不提交有类型错误的代码
4. **使用 `resourceLoader`** - 不直接使用 `fetch()`
5. **使用 `logger`** - 不直接使用 `console.log`

### 禁止事项

```typescript
// ❌ any
function process(data: any) { ... }

// ❌ 保留废弃代码
/** @deprecated */ oldMethod() { ... }

// ❌ 无意义的 getter/setter
private _name = "";
get name() { return this._name; }

// ❌ 静默忽略错误
try { ... } catch { }

// ✅ 正确
function process(data: unknown) { if (isValid(data)) { ... } }
name = "";  // 直接公共属性
try { ... } catch (e) { logger.error(e); throw e; }
```

---

## 资源加载

```typescript
import { resourceLoader } from "@miu2d/engine/resource/resourceLoader";

// UTF-8 文本
const text = await resourceLoader.loadText("/resources/script/xxx.txt");

// 二进制
const buffer = await resourceLoader.loadBinary("/resources/map/xxx.map");

// GBK 编码文件（如 .obj 存档）
const buffer = await resourceLoader.loadBinary(path);
const content = new TextDecoder("gbk").decode(buffer);

// 音频文件
const audioBuffer = await resourceLoader.loadAudio("/resources/sound/xxx.ogg");
```

| 格式 | 用途 | 编码 |
|------|------|------|
| `.map` | 地图数据 | 二进制 |
| `.asf` | 精灵动画 | 二进制 |
| `.mpc` | 资源包 | 二进制 |
| `.shd` | 阴影数据 | 二进制 |
| `.obj` | 物体存档 | GBK |
| `.ini`, `.npc`, `.txt` | 配置/脚本 | UTF-8 |
| `.ogg`, `.mp3`, `.wav` | 音频文件 | Web Audio API |

---

## 日志系统

```typescript
import { logger } from "@miu2d/engine/core/logger";

logger.debug("[Module] 调试信息");
logger.info("[Module] 一般信息");
logger.warn("[Module] 警告");
logger.error("[Module] 错误");
```

⚠️ 避免在 update loop 中打印日志

---

## 命名约定

- 类: `PascalCase`
- 函数/变量: `camelCase`
- 常量: `UPPER_SNAKE_CASE`
- 文件: TS `camelCase.ts`, React `PascalCase.tsx`

---

## 常用命令

```bash
# 开发
pnpm dev          # 启动开发服务器

# 类型检查
pnpm tsc          # 全项目类型检查（必须通过）

# 代码质量
pnpm lint         # Biome 代码检查
pnpm format       # Biome 格式化
pnpm check        # lint + format

# 构建
pnpm build        # 构建所有包
pnpm preview      # 预览构建结果
```

---
