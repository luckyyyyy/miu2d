# UI 适配器架构方案

## 实现状态

✅ **已完成：**
- `src/engine/ui/contract.ts` - UI 数据契约定义
- `src/engine/ui/uiBridge.ts` - UIBridge 实现（引擎与 UI 的桥梁）
- `src/components/game/adapters/useUIBridge.ts` - React Hook 适配器
- `src/engine/game/gameEngine.ts` - UIBridge 集成
- `src/components/game/GameUI.tsx` - 已迁移使用 UIBridge
- `src/hooks/useGameUI.ts` - 已删除（不再需要）

---

## 当前架构

采用混合模式：
- **动作派发**: 所有 UI 交互通过 `dispatch(UIAction)` 统一派发
- **状态读取**:
  - 面板可见性、对话、选择、消息等通过 UIBridge 订阅获取
  - 物品、武功、商店数据从 engine 直接读取（保持与现有组件类型兼容）

## 背景

为了支持未来开发现代化 Web UI，需要将 UI 层与引擎完全解耦，实现多套 UI 可插拔。

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                      Game Engine                         │
│  (纯逻辑，不依赖任何 UI 实现)                              │
└─────────────────────┬───────────────────────────────────┘
                      │ UIContract (接口层)
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   UI Contract                            │
│  - 定义数据结构 (readonly, 单向流动)                      │
│  - 定义事件类型 (用户操作 → 引擎)                          │
│  - 定义状态订阅 (引擎状态 → UI)                            │
└─────────────────────┬───────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Classic UI     │     │  Modern UI      │
│  (当前复古风格)  │     │  (未来现代风格)  │
│  - React + CSS  │     │  - React + UI库 │
│  - 像素字体      │     │  - 现代设计      │
└─────────────────┘     └─────────────────┘
```

## 核心组件

### 1. UI 契约层 (`src/engine/ui/contract.ts`)

定义引擎与 UI 之间的数据契约：

- **UIPlayerState**: 玩家状态数据
- **UIGoodsSlot**: 物品槽数据
- **UIPanelVisibility**: 面板可见性
- **UIAction**: UI 动作类型 (UI → 引擎)
- **UIStateSubscriber**: 状态订阅接口 (引擎 → UI)

### 2. UI 桥接器 (`src/engine/ui/uiBridge.ts`)

负责：
- 监听引擎事件，转换为 UI 状态
- 接收 UI 动作，转发给引擎
- 管理订阅者

### 3. React 适配器 (`src/components/game/adapters/useUIBridge.ts`)

将 UIBridge 适配为 React hooks，提供：
- 响应式状态
- dispatch 函数

## 目录结构

```
src/
├── engine/
│   └── ui/
│       ├── contract.ts      # 接口契约
│       ├── uiBridge.ts      # 桥接器
│       └── index.ts
└── components/
    └── game/
        ├── adapters/
        │   └── useUIBridge.ts   # React 适配器
        ├── classic/              # 复古风格 UI
        │   ├── ClassicGameUI.tsx
        │   ├── panels/
        │   └── index.ts
        └── modern/               # 现代风格 UI (未来)
            └── ...
```

## 优势

| 特性 | 说明 |
|------|------|
| 完全解耦 | 引擎 0 行 React 代码，UI 不直接访问引擎内部 |
| 可替换 | 随时切换 classic/modern，甚至 Vue/Svelte 实现 |
| 类型安全 | 契约层定义清晰的数据边界 |
| 按需更新 | 每个 UI 只订阅自己关心的状态 |
| 易测试 | 可 mock UIBridge 测试 UI，mock UI 测试引擎 |

## 迁移路径

1. **阶段 1**: 定义契约层 + UIBridge
2. **阶段 2**: 重构当前 UI 使用 useUIBridge
3. **阶段 3**: 开发现代 UI (未来)
