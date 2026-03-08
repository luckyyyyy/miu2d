# Miu2D Engine

TypeScript + React 19 + WebGL，复刻《剑侠情缘外传：月影传说》。pnpm monorepo，Hono + tRPC 后端，PostgreSQL + MinIO 存储。前端 `5173`，后端 `4000`。不要直接启动前后端，用 curl 测试，自动热更新。

## 架构分层

| 层 | 包 | 说明 |
|---|---|---|
| 应用壳 | `@miu2d/web` · `packages/web/` | 路由入口、landing、登录注册 |
| 游戏运行时 | `@miu2d/game` · `packages/game/` | GameScreen、GamePlaying |
| 编辑器 | `@miu2d/dashboard` · `packages/dashboard/` | 仪表盘编辑器 |
| 资源查看器 | `@miu2d/viewer` · `packages/viewer/` | ASF/Map/MPC/XnbAudio |
| 引擎核心 | `@miu2d/engine` · `packages/engine/` | 纯 TS，不依赖 React |
| WASM | `@miu2d/engine-wasm` · `packages/engine-wasm/` | Rust 模块 |
| 共享层 | `@miu2d/shared` / `@miu2d/types` / `@miu2d/ui` | i18n、tRPC 客户端、Zod Schema、UI 组件 |
| 后端 | `@miu2d/server` · `packages/server/` | Hono + tRPC |
| C++ 参考 | `JXQY-all-in-one/src/` | 原始实现，修改引擎前优先查阅 |

**依赖规则（禁止循环）：**

```
web → dashboard, engine, game, shared, ui
game → engine, shared, types, ui
dashboard → engine, shared, types, ui, viewer
viewer → engine
shared → server(仅类型), types
server → shared, types
```

## 技术约束

- **禁止**：antd、emoji、`any`、`console.log`、直接 `fetch()` 加载二进制资源
- **必须**：`lucide-react`（图标）、Zod v4（schema）、Biome（lint）、`logger`（日志）、`resourceLoader`（资源加载）

## 数据库

```bash
docker exec apps-postgres psql -U postgres -d apps_db -c "<SQL>"
```

## CI 命令

```bash
make tsc     # 类型检查（修改后必须通过）
make lint    # Biome lint（修改后必须通过）
```
