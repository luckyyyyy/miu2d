# Copilot Instructions for Miu2D Engine

**Miu2D Engine** — TypeScript + React 19 + WebGL，复刻《剑侠情缘外传：月影传说》。pnpm monorepo，Hono + tRPC 后端，PostgreSQL + MinIO 存储。

---

## 开发命令

```bash
make dev                           # 启动 web + server（自动启动 db + minio）
pnpm install                       # 安装所有包依赖
make tsc                           # 类型检查（修改后必须通过）
make lint                          # Biome lint（修改后必须通过）
pnpm biome lint packages/          # 手动 lint
```

**端口**：前端 `5173`，后端 `4000`，PostgreSQL `5432`

**不要直接运行前端和后端，直接使用 curl 测试，无需重启，自动热更新**

---

## 包结构

| 包名 | 目录 | 说明 |
|------|------|------|
| `@miu2d/engine` | `packages/engine/` | 纯 TypeScript 游戏引擎，**不依赖 React** |
| `@miu2d/engine-wasm` | `packages/engine-wasm/` | Rust WASM 模块（PathFinder/AsfDecoder/SpatialHash） |
| `@miu2d/types` | `packages/types/` | 共享 Zod Schema 和 TypeScript 类型 |
| `@miu2d/shared` | `packages/shared/` | 前后端共享：i18n、tRPC 客户端、contexts、hooks |
| `@miu2d/ui` | `packages/ui/` | 通用 UI 组件，**不依赖任何业务包** |
| `@miu2d/game` | `packages/game/` | 游戏运行时（GameScreen、GamePlaying） |
| `@miu2d/dashboard` | `packages/dashboard/` | 编辑器仪表盘 |
| `@miu2d/viewer` | `packages/viewer/` | 资源查看器（ASF/Map/MPC/XnbAudio） |
| `@miu2d/web` | `packages/web/` | 应用壳：路由入口、landing、登录注册 |
| `@miu2d/server` | `packages/server/` | Hono + tRPC 后端 |
| `@miu2d/converter` | `packages/converter/` | Rust CLI 资源转换工具 |
| **C# 参考** | `JxqyHD/Engine/` | 原 C# 实现，引擎功能参考来源 |

**包间依赖（不得循环）：**

```
web → dashboard, engine, game, shared, ui
game → engine, shared, types, ui
dashboard → engine, shared, types, ui, viewer
viewer → engine
shared → server(仅类型), types
server → shared, types
```

---

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

### `packages/dashboard/src/`
```
modules/     # 模块编辑页（magic/npc/obj/goods/player/talk/level/shop/scene）
sidebar/     # 侧边栏列表面板
components/  # 仪表盘通用组件
```

### `packages/server/src/`
```
modules/     # auth/ user/ game/ file/ magic/ goods/ level/ npc/ obj/ player/ shop/ talk/ save/ scene/
db/schema.ts # Drizzle 表结构
trpc/        # decorators, middlewares, context
```

### `packages/shared/src/`
```
contexts/    hooks/    i18n/    lib/    locales/zh.ts|en.ts
```

---

## 资源与数据访问

**二进制资源**（地图/精灵/音频）仍走 MinIO，路径格式 `/game/:gameSlug/resources/*`：
- 前端：`GameScreen` 调用 `setResourcePaths({ root: '/game/${gameSlug}/resources' })`
- 后端：`FileController` 处理该路由，从 MinIO 读取

**游戏配置数据**全部从服务器获取，禁止读取本地 `resources/` 目录：

| REST 接口 | 说明 |
|---|---|
| `GET /game/:gameSlug/api/config` | 游戏全局配置（`GameConfigData`） |
| `GET /game/:gameSlug/api/data` | 聚合数据：`magics`、`goods`、`shops`、`npcs`、`objs`、`players`、`portraits`、`talks` |

引擎内部通过 `resourceLoader` 加载二进制/文本资源（`.map`、`.asf`、`.mpc`、`.ogg` 等）；**游戏数据（武功/NPC/物品等）只从上面的 REST 接口取，不解析本地 `.ini`/`.txt` 文件**。

本地 `resources/`、`resources-sword2/`、`resources-sword2-new/` 等目录**仅供参考**，不在运行时读取。

---

## 类继承体系（engine）

```
Sprite
└── CharacterBase → CharacterMovement → CharacterCombat → Character [abstract]
    ├── PlayerBase → PlayerCombat → Player
    └── Npc
```

`Sprite` 子类通过 `this.engine` 访问所有管理器（`player`, `map`, `audio`, `guiManager`, `npcManager`, `objManager`, `scriptExecutor` 等）。

---

## 新增 tRPC 路由

1. 在 `@miu2d/types` 中定义 `Schema` 和类型
2. 在 `packages/server/src/modules/<name>/<name>.router.ts` 创建 `@Router` 类
3. 在 `modules/index.ts` 中 `import "./<name>"`

```typescript
@Router({ alias: "example" })
export class ExampleRouter {
  @UseMiddlewares(requireUser)
  @Query({ input: z.object({ id: z.string() }), output: ExampleSchema })
  async getById(input: { id: string }, @Ctx() ctx: AuthenticatedContext) { ... }
}
```

---

## 核心规范

### 必须遵守

1. **禁止 `any`** — 使用 `unknown` + 类型守卫
2. **参考 C# 实现** — 修改引擎功能先查 `JxqyHD/Engine/`
3. **修改后必须通过 `make tsc` 和 `make lint`**
4. **使用 `resourceLoader`** — 加载二进制/文本资源禁止直接 `fetch()`；REST API（`/api/config`、`/api/data`）用 `fetch()` 正常调用
5. **使用 `logger`** — 禁止直接 `console.log`

### 禁止

```typescript
// ❌
function process(data: any) {}
try { } catch { }           // 静默忽略错误
get name() { return this._name; }  // 无意义 getter

// ✅
function process(data: unknown) { if (isValid(data)) { ... } }
try { } catch (e) { logger.error(e); throw e; }
name = "";  // 直接公共属性
```

### 资源加载

```typescript
import { resourceLoader } from "@miu2d/engine/resource/resourceLoader";
const text = await resourceLoader.loadText(path);    // UTF-8 文本
const buf  = await resourceLoader.loadBinary(path);  // 二进制（.map/.asf/.mpc）
```

**游戏配置数据（武功/NPC/物品等）从 REST API 取，不读本地文件：**
```typescript
// 游戏配置
const config = await fetch(`/game/${gameSlug}/api/config`).then(r => r.json());
// 聚合数据
const data = await fetch(`/game/${gameSlug}/api/data`).then(r => r.json());
// data.magics / data.goods / data.shops / data.npcs / data.objs / data.players / data.portraits / data.talks
```

### 日志

```typescript
import { logger } from "@miu2d/engine/core/logger";
logger.info("[Module] 信息");   // 避免在 update loop 中调用
```

### 命名

- 类: `PascalCase` | 函数/变量: `camelCase` | 常量: `UPPER_SNAKE_CASE`
- 文件: TS `kebab-case.ts`, React `PascalCase.tsx`

---

## scripts/ Python 脚本

`scripts/` 目录存放**本地临时工具脚本**，不属于项目主体代码。

### AI 操作规范

- **禁止修改已有脚本**：目录中现有的 `.py` 文件由开发者维护，不得重构、删除或添加功能
- **可以新建临时脚本**：需要批量操作（数据迁移、格式转换、文件处理等）时，可在此目录创建新的 `.py` 脚本
- **用完即清理**：任务完成后，判断新建脚本是否还有保留价值；若为一次性操作，**主动删除**，不留垃圾文件
- **禁止迁移到 `packages/`**：这些脚本的逻辑不属于引擎/应用代码，不得移入任何业务包

**Python 环境**由 [uv](https://docs.astral.sh/uv/) 统一管理，配置见 `pyproject.toml`，使用说明见 `docs/python-scripts.md`。如用户问起如何运行这些脚本，参考该文档。
