---
applyTo: "packages/engine/**,packages/game/**"
---

# Engine 详细说明

## 类继承体系

```
Sprite
└── CharacterBase → CharacterMovement → CharacterCombat → Character [abstract]
    ├── PlayerBase → PlayerCombat → Player
    └── Npc
```

`Sprite` 子类通过 `this.engine` 访问所有管理器（`player`、`map`、`audio`、`guiManager`、`npcManager`、`objManager`、`scriptExecutor` 等）。

## 资源加载

```typescript
import { resourceLoader } from "@miu2d/engine/resource/resourceLoader";
const text = await resourceLoader.loadText(path);    // UTF-8 文本
const buf  = await resourceLoader.loadBinary(path);  // 二进制（.map/.asf/.mpc）
```

- 加载二进制/文本资源**禁止**直接 `fetch()`，必须使用 `resourceLoader`
- REST API（`/api/config`、`/api/data`）用 `fetch()` 正常调用

## 游戏数据访问

| REST 接口 | 说明 |
|---|---|
| `GET /game/:gameSlug/api/config` | 游戏全局配置（`GameConfigData`） |
| `GET /game/:gameSlug/api/data` | 聚合数据：`magics`、`goods`、`shops`、`npcs`、`objs`、`players`、`portraits`、`talks` |

**游戏数据（武功/NPC/物品等）只从上面的 REST 接口取，不解析本地 `.ini`/`.txt` 文件。**

```typescript
const config = await fetch(`/game/${gameSlug}/api/config`).then(r => r.json());
const data   = await fetch(`/game/${gameSlug}/api/data`).then(r => r.json());
// data.magics / data.goods / data.shops / data.npcs / data.objs / data.players / data.portraits / data.talks
```

## 目录结构

### `packages/engine/src/`

```
audio/       character/   core/        data/        gui/
magic/       map/         npc/         obj/         player/
renderer/    resource/    runtime/     script/      sprite/
storage/     utils/       wasm/        weather/
```

### `packages/game/src/`

```
components/adapters/    # 引擎适配器
components/ui/          # classic/ mobile/ modern/
contexts/               # 游戏 Context
hooks/                  # 自定义 Hooks
pages/GameScreen.tsx    # 游戏界面
pages/GamePlaying.tsx   # 游戏进行中
```

## 参考实现

修改引擎功能前先查阅 `JxqyHD/Engine/`（原 C# 实现）。
