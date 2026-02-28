<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo-dark.svg" />
    <img src="logo.svg" width="300" alt="Miu2D Logo" />
  </picture>
</p>

<p align="center">
  <b>从零构建的 2D ARPG 引擎 — 原生 WebGL 渲染，零游戏框架依赖</b>
</p>

<p align="center">
  <a href="https://miu2d.com">在线演示</a> · <a href="README.md">English</a>
</p>

---

Miu2D 是一个 **176,000 行**的 2D ARPG 引擎，使用 TypeScript 和 Rust 编写，通过**原生 WebGL** 渲染——不依赖 Unity、Godot、Phaser、PixiJS 或任何其他游戏框架。所有子系统——精灵批量渲染、A* 寻路、二进制格式解码、脚本虚拟机、天气粒子、屏幕特效——全部从零实现。

作为引擎的验证项目，Miu2D 已完整复刻了**西山居三款经典武侠 RPG**，均可在任意现代浏览器中直接运行。

> **Vibe Coding** — 本项目从第一天起就采用 AI 辅助编程方式开发。

---

### <img src="packages/web/public/screenshot/logo-yuying.webp" height="32" style="vertical-align:middle"> 剑侠情缘外传：月影传说 · 2001

| **开发商** | 西山居（金山软件） |
|---|---|
| **类型** | 即时动作 RPG |
| **亮点** | 7 种以上结局 · 100+ 剧情事件 · 30 人团队（20+ 美术） · 14 个月研发 |

西山居迄今规模最大的制作。剧情根据玩家对名利、情缘、忠义的不同选择分叉演进，影响主角正邪值与情感值，最终导向七种以上不同结局。场景采用 3D＋2D 混合渲染技术，画面细腻写实；音乐由西山居资深音乐师罗晓音领衔，将中国民乐与现代流行手法完美融合。这也是一款**即时动作 RPG**——战斗完全实时进行，有别于回合制武侠游戏。

![月影传说](packages/web/public/screenshot/game-yuying.png)

---

### <img src="packages/web/public/screenshot/logo-sword2.png" height="32" style="vertical-align:middle"> 剑侠情缘贰 · 1998

| **开发商** | 西山居（金山软件） |
|---|---|
| **类型** | 即时动作 RPG |
| **亮点** | 暗黑式即时战斗 · 200+ NPC · 640×480 16 位真彩色 · 主题曲《天仙子》谢雨欣演唱 |

故事发生在前作二十年后，主角南宫飞云——一代男女主角之子——在救下神秘少女若雪后踏上漫长江湖之旅。本作大胆抛弃回合制，引入类《暗黑破坏神》的即时动作战斗体系，开创了国产武侠 RPG 的新纪元。历时三年、耗资近 300 万元、近 30 人团队打造。

![剑侠情缘2](packages/web/public/screenshot/game-sword2.png)

---

### <img src="packages/web/public/screenshot/logo-new-swords.png" height="32" style="vertical-align:middle"> 新剑侠情缘 · 2001

| **开发商** | 西山居（金山软件） |
|---|---|
| **类型** | 即时动作 RPG |
| **亮点** | 1997 年原作重制 · 110+ 场景地图 · 引入室内地图概念 · 沿用剑侠贰即时战斗引擎 |

以《剑侠情缘贰》成熟的即时动作引擎重新诠释 1997 年的系列首作，剧情忠实还原原著，可玩性大幅提升。场景地图扩充至 110 余张，并首次引入室内地图切换机制，使游戏内容更加紧凑丰富。

![新剑侠情缘](packages/web/public/screenshot/game-new-swords.png)

---

<details>
<summary><b>移动端 & 编辑器截图</b></summary>

**移动端 — 虚拟摇杆 + 触控操作：**

![移动端](packages/web/public/screenshot/mobile.png)

**地图编辑器 — 可视化瓦片编辑、碰撞区域：**

![地图编辑器](packages/web/public/screenshot/map-editor.png)

**ASF 编辑器 — 精灵动画帧查看与调试：**

![ASF 编辑器](packages/web/public/screenshot/asf-editor.png)

</details>

---

## 为什么从零造引擎？

绝大多数 Web 游戏项目会选择 PixiJS、Phaser，或编译 Unity/Godot 到 WASM。Miu2D 走了一条不同的路：整个渲染管线直接与 `WebGLRenderingContext` 对话，寻路器用 Rust 编译到 WASM 并通过零拷贝共享内存传输数据，脚本引擎既支持通过自研解析器/执行器解释 218 条 DSL 指令，也支持完整的 **Lua 5.4 运行时**（通过 wasmoon），两者共享同一套 GameAPI。最终得到的是一个每一层都可见、可调试、专为 2D ARPG 机制定制的系统。

**这带来了什么：**

- **完全掌控渲染循环** — `SpriteBatcher` 将约 4,800 张地图瓦片合并为 1–5 次 WebGL 绘制调用；`RectBatcher` 将约 300 个天气粒子归为 1 次调用
- **零抽象税** — 没有用不到的场景图，没有 3D 数学开销，没有需要绕开的框架事件模型
- **关键路径用 Rust 加速** — A* 寻路通过 WASM 运行，障碍物数据直接写入线性内存（零序列化、零 FFI 拷贝），单次寻路约 **0.2ms**，比同等 TypeScript 实现快约 **10 倍**
- **可学习的干净架构** — 8 层类继承体系（Sprite → CharacterBase → Movement → Combat → Character → PlayerBase → PlayerCombat → Player）职责分明，是学习完整 2D ARPG 引擎底层原理的理想参考

---

## 架构全景

| 层级 | 包 | 说明 |
|---|---|---|
| **UI** | `@miu2d/game` | React 19 · 3 套主题（经典 / 现代 / 移动端）· 84 个组件 |
| **引擎** | `@miu2d/engine` | 纯 TypeScript · 215 个文件 · 19 个模块 · 不依赖 React |
| ↳ 渲染器 | `renderer/` | 原生 WebGL · SpriteBatcher · Canvas2D 回退 · GLSL 滤镜 |
| ↳ 脚本 VM | `script/` | 218 条指令 · 自研解析器 + 异步执行器 · **Lua 5.4**（wasmoon WASM） |
| ↳ 角色系统 | `character/` | 8 层继承链 · NPC AI · 贝塞尔曲线移动 |
| ↳ 武功系统 | `magic/` | 22 种 MoveKind 轨迹 · 10 种 SpecialKind 状态效果 |
| **WASM** | `@miu2d/engine-wasm` | Rust → WebAssembly · A\* 寻路 · 解码器 · 空间哈希 · zstd |
| **后端** | `@miu2d/server` | Hono + tRPC + Drizzle ORM · 21 张 PostgreSQL 表 · 19 个路由 |
| **编辑器** | `@miu2d/dashboard` | VS Code 风格布局 · 13 个编辑模块 |

### 技术栈

| 层级 | 技术选型 |
|------|---------|
| 语言 | TypeScript 5.9 (strict) · Rust · GLSL |
| 前端 | React 19 · Vite 7 (rolldown) · Tailwind CSS 4 |
| 渲染 | 原生 WebGL API（Canvas 2D 回退） |
| 音频 | Web Audio API (OGG Vorbis) |
| 性能 | Rust → WebAssembly（wasm-bindgen，零拷贝） |
| 后端 | Hono（轻量 HTTP 框架）· tRPC 11 · Drizzle ORM |
| 数据库 | PostgreSQL 16 · MinIO / S3 |
| 校验 | Zod 4（前后端共享 Schema） |
| 代码质量 | Biome (lint + format) · TypeScript strict 模式 |
| 项目管理 | pnpm workspaces（11 个包） |

---

## 引擎系统全览

Miu2D 从零实现了 **17 个完整的 ARPG 子系统**（218 条脚本指令）：

| 系统 | 模块 | 要点 |
|------|------|------|
| **渲染系统** | `renderer/` | 原生 WebGL 精灵批处理（约 4,800 瓦片 → 1–5 次绘制调用）、Canvas2D 回退、GLSL 颜色滤镜（中毒 / 冰冻 / 石化）、屏幕特效（淡入淡出、闪光、水波纹）、**局部光照**（暗场景下的加法光晕蒙版） |
| **角色系统** | `character/` | 8 层继承链（Sprite → CharacterBase → Movement → Combat → Character → PlayerBase → PlayerCombat → Player/NPC）；属性、状态标记、贝塞尔曲线移动 |
| **战斗系统** | `character/` | 命中检测、伤害公式、击退、死亡与复活、阵营/敌我逻辑 |
| **武功 / 技能系统** | `magic/` | 22 种 MoveKind 轨迹（直线、螺旋、追踪、范围、召唤、时间停止……）× 10 种 SpecialKind 状态；分等级配置、被动修炼系统 |
| **NPC 与 AI 系统** | `npc/` | 行为状态机（待机 / 巡逻 / 追击 / 逃跑 / 死亡）、交互脚本、快速邻居查询的空间网格 |
| **玩家系统** | `player/` | 控制器、背包（物品系统）、装备槽、武功槽、经验与升级 |
| **地图系统** | `map/` | 多图层瓦片解析、障碍网格、陷阱区域、事件区域、分层排序渲染 |
| **脚本 / 事件系统** | `script/` | 自研虚拟机：解析器 + 异步执行器，218 条指令涵盖 9 大类（对话、玩家、NPC、状态、音频、特效、物体、物品、杂项）；**Lua 5.4** 脚本支持（wasmoon WASM，完整 GameAPI 绑定，170 个大驼峰函数） |
| **寻路系统** | `wasm/` | Rust WASM A* + 零拷贝共享内存；5 种策略（贪心 → 完整 A*）；单次约 0.2ms，比 TS 快约 10 倍 |
| **碰撞系统** | `wasm/` | Rust/WASM 实现的空间哈希，O(1) 宽相实体查询 |
| **音频系统** | `audio/` | Web Audio API 管理器：流式 BGM（OGG/MP3）、位置音效（WAV/OGG）、淡入淡出过渡 |
| **天气 / 粒子系统** | `weather/` | 受风力影响的雨滴 + 落地溅射 + 闪电；摇曳雪花；屏幕水珠透镜效果 |
| **场景物体系统** | `obj/` | 可交互场景物体（宝箱、门、屏障、陷阱），带脚本钩子和精灵动画 |
| **GUI / HUD 系统** | `gui/` | 对话系统（分支选择、头像）、商店购买面板、小地图、状态条、与 React 的 UI 桥接 |
| **背包 / 物品系统** | `player/` | 10 种物品类别、装备/卸载、使用效果、可配置掉落表 |
| **存档 / 读档系统** | `storage/` | 多存档槽、完整游戏状态序列化至 IndexedDB + 服务端云存档 |
| **资源加载系统** | `resource/` | 8 种二进制格式异步加载器（ASF、MPC、MAP、SHD、XNB、MSF、MMF、INI/OBJ）；GBK/UTF-8 解码 |

---

## 引擎深度解析

### 渲染器 — 原生 WebGL + 自动批处理

渲染器直接操作 `WebGLRenderingContext`——没有任何封装库。

- **SpriteBatcher** — 累积顶点数据，按纹理切换时 flush；典型地图帧：约 4,800 张瓦片 → 1–5 次绘制调用
- **RectBatcher** — 天气粒子和 UI 矩形合并为单次绘制调用
- **GPU 纹理管理** — `ImageData` → `WebGLTexture`，使用 `WeakMap` 缓存 + `FinalizationRegistry` 自动回收 GPU 资源
- **GLSL 着色滤镜** — 灰度（石化）、蓝色调（冰冻）、绿色调（中毒），在片段着色器中逐精灵应用
- **屏幕特效** — 淡入淡出、颜色叠加、屏幕闪烁、水波纹效果，全部在渲染循环中合成
- **Canvas 2D 回退** — 实现相同的 `Renderer` 接口，在无 WebGL 的设备上功能完全对等
- **局部光照（LumMask）** — 当 `SetMainLum` 压暗场景时，发光实体（物体、NPC、武功精灵）会在其位置叠加一个 800×400 的白色椭圆渐变光晕（加法混合）。基于 tile 的去重逻辑（对应 C++ `Weather::drawElementLum`）防止同一格重复绘制。武功子弹的 `noLum` 标志抑制密集法术中多余的光源，精确还原 C++ 参考实现：
  - **LineMove**：每 3 颗只有 1 颗发光（`i % 3 === 1`）
  - **Square 区域**：每 9 格只有 1 格发光（`i % 3 === 1 && j % 3 === 1`）
  - **Wave / Rectangle 区域**：每 4 格只有 1 格发光（`i % 2 !== 0 && j % 2 !== 0`）
  - **CircleMove**（如依风剑法）：32 颗子弹中每 8 颗只有 1 颗发光

### 脚本引擎 — 218 条指令 + Lua 5.4

引擎支持两种脚本模式，共享同一套 GameAPI：

**DSL 模式（`.txt` / `.npc`）** — 自研**解析器**词法分析游戏脚本；**执行器**支持阻塞/异步执行。指令涵盖 9 大类：

| 类别 | 示例 |
|------|------|
| 对话 | `Say`、`Talk`、`Choose`、`ChooseMultiple`、`DisplayMessage` |
| 玩家 | `AddLife`、`AddMana`、`SetPlayerPos`、`PlayerGoto`、`Equip` |
| NPC | `AddNpc`、`DelNpc`、`SetNpcRelation`、`NpcAttack`、`MergeNpc` |
| 游戏状态 | `LoadMap`、`Assign`、`If/Goto`、`RunScript`、`RunParallelScript` |
| 音频 | `PlayMusic`、`StopMusic`、`PlaySound` |
| 特效 | `FadeIn`、`FadeOut`、`BeginRain`、`ShowSnow`、`OpenWaterEffect` |
| 物体 | `AddObj`、`DelObj`、`OpenObj`、`SetObjScript` |
| 物品 | `AddGoods`、`DelGoods`、`ClearGoods`、`AddRandGoods` |
| 杂项 | `Sleep`、`Watch`、`PlayMovie`、`DisableInput`、`ReturnToTitle` |

**Lua 模式（`.lua`）** — 通过 [wasmoon](https://github.com/ceifa/wasmoon)（Lua 编译为 WASM）提供完整的 **Lua 5.4** 运行时。所有 170 个 GameAPI 函数以大驼峰命名方式注册为 Lua 全局函数。wasmoon 的代理机制自动将 JS 异步函数桥接为 Lua 协程——`PlayerWalkTo()`、`Talk()` 等阻塞操作开箱即用，无需手动 yield/resume。按文件后缀分发：同一个 `ScriptExecutor` 将 `.lua` 文件路由到 `LuaExecutor`，将 `.txt`/`.npc` 路由到 DSL 执行器。

```lua
-- Lua 游戏脚本示例
FadeOut()
LoadMap("map/town.map")
SetPlayerPos(10, 15)
FadeIn()
Talk(0, "欢迎来到村庄。")
local choice = Choose("加入任务？", "是", "否")
if choice == 1 then
  AddMagic("magic/fireball.ini")
  AddExp(500)
end
```

脚本驱动着整个游戏叙事——过场动画、分支对话、NPC 生成、地图切换、战斗触发、天气变化……

### 武功系统 — 22 种轨迹 × 10 种特殊效果

每个武功攻击遵循 **22 种 MoveKind** 轨迹之一，各有独立的物理和渲染逻辑：

| 轨迹类型 | 行为表现 |
|----------|---------|
| LineMove | 多飞弹直线发射——数量随等级递增 |
| CircleMove | 环绕轨道模式 |
| SpiralMove | 向外扩展的螺旋 |
| SectorMove | 扇形扩散 |
| HeartMove | 心形飞行路径 |
| FollowEnemy | 追踪目标的导弹 |
| Throw | 抛物线弧形投射 |
| Transport | 瞬间传送 |
| Summon | 召唤 NPC 助战 |
| TimeStop | 冻结全场实体 |
| VMove | V 字形分散发射 |
| *……另有 11 种* | |

搭配 **10 种 SpecialKind** 状态效果（冰冻、中毒、石化、隐身、治疗、增益、变身、解除异常……），可组合出数百种独特法术。系统包含专用精灵工厂、碰撞处理器和被动效果管理器（修炼系统）。

### 寻路 — Rust WASM 零拷贝

A* 寻路器用 Rust 编写，编译为 WebAssembly，通过共享线性内存消除所有 FFI 开销：

1. JavaScript 通过 `wasm.memory.buffer` 上的 `Uint8Array` 视图**直接写入**障碍物位图到 WASM 线性内存
2. WASM 在共享内存上就地执行 A* 算法
3. JavaScript 通过 `Int32Array` 指针视图**直接读取**路径结果——**零序列化、零拷贝**

5 种路径策略（从贪心到完整 A* + 可配置最大迭代数）让游戏可以在精度和速度间灵活权衡。典型寻路耗时：**约 0.2ms**，比等价 TypeScript 实现快约 **10 倍**。

### 二进制格式解码

引擎解析来自原版游戏的 **8 种二进制文件格式**——全部逆向工程实现，不依赖第三方解析库：

| 格式 | 说明 |
|------|------|
| **ASF** | 精灵动画帧（RLE 压缩，调色板索引 RGBA） |
| **MPC** | 资源包容器（打包的精灵表） |
| **MAP** | 瓦片地图数据（多图层、障碍网格、陷阱区域） |
| **SHD** | 地形阴影/高度图数据 |
| **XNB** | XNA 二进制格式（来自原版游戏的音频资源） |
| **MSF** | Miu Sprite Format v2 — 自研索引调色板 + zstd 压缩格式 |
| **MMF** | Miu Map Format — 自研 zstd 压缩二进制地图格式 |
| **INI/OBJ** | 配置文件（GBK 中文遗留编码 + UTF-8） |

### 天气系统 — 粒子驱动

粒子物理与渲染：

- **雨天** — 受风力影响的粒子，落地溅射，周期性闪电照亮场景
- **屏幕水滴** — 模拟水珠沿镜头流淌的折射/透镜效果
- **雪天** — 独立雪花物理：摇摆、旋转、飘移、逐渐融化

### 角色系统 — 8 层继承体系

深层次、结构清晰的类继承体系，职责分明：

```
Sprite
 └─ CharacterBase — 属性、数值、状态标记
     └─ CharacterMovement — A* 寻路、格子行走、贝塞尔曲线
         └─ CharacterCombat — 攻击、伤害计算、状态效果
             └─ Character — NPC/玩家共享逻辑 [抽象类]
                 ├─ PlayerBase → PlayerCombat → Player
                 └─ Npc — AI 行为、交互脚本、空间网格
```

---

## 游戏数据编辑器（Dashboard）

项目内置 VS Code 风格游戏编辑器，包含活动栏、侧边栏和内容面板：

| 编辑模块 | 编辑内容 |
|----------|---------|
| 武功编辑器 | 法术配置 + ASF 精灵实时预览 |
| NPC 编辑器 | 属性、脚本、AI 行为、精灵预览 |
| 场景编辑器 | 地图数据、出生点、陷阱、触发器 |
| 物品编辑器 | 武器、防具、消耗品、掉落表 |
| 商店编辑器 | 商店库存和定价 |
| 对话编辑器 | 分支对话树 + 头像指定 |
| 玩家编辑器 | 初始属性、装备、技能槽 |
| 等级编辑器 | 经验曲线和属性成长 |
| 全局配置 | 游戏全局设置（掉落、玩家默认值） |
| 文件管理器 | 完整文件树 + 拖放上传 |
| 资源浏览 | 资源浏览器与查看器集成 |
| 数据统计 | 数据总览仪表盘 |

---

## 项目结构

pnpm monorepo 中的 11 个包，总计约 **176,000 行**代码：

| 包名 | 职责 |
|------|------|
| `@miu2d/engine` | 纯 TS 游戏引擎 — 19 模块，不依赖 React |
| `@miu2d/dashboard` | VS Code 风格游戏数据编辑器（13 模块） |
| `@miu2d/game` | 游戏运行时 + 3 套 UI 主题（经典/现代/移动端） |
| `@miu2d/server` | Hono + tRPC 后端（21 表、19 路由） |
| `@miu2d/types` | 共享 Zod 4 Schema（18 个领域模块） |
| `@miu2d/web` | 应用壳、路由、落地页 |
| `@miu2d/converter` | Rust CLI：ASF/MPC → MSF、MAP → MMF 批量转换 |
| `@miu2d/engine-wasm` | Rust → WASM：寻路、解码器、空间哈希、zstd |
| `@miu2d/viewer` | 资源查看器（ASF/地图/MPC/音频） |
| `@miu2d/ui` | 通用 UI 组件（无业务依赖） |
| `@miu2d/shared` | i18n、tRPC 客户端、React Context |

还包括：`resources/`（游戏资源）、`docs/`（格式规范文档）、`JxqyHD/`（原版引擎 C# 参考代码）。

---

## 快速开始

**环境要求：** Node.js 18+、pnpm 9+、支持 WebGL 的现代浏览器

```bash
git clone https://github.com/nicologies/miu2d.git
cd miu2d
pnpm install
pnpm dev            # → http://localhost:5173
```

### 全栈启动（含后端 + 数据库）

```bash
make init           # Docker: PostgreSQL + MinIO, 迁移, 种子数据
make dev            # 同时启动 web + server + db studio
```

### 常用命令

| 命令 | 用途 |
|------|------|
| `pnpm dev` | 前端开发服务器（端口 5173） |
| `make dev` | 全栈开发（web + server + db） |
| `make tsc` | 全包类型检查 |
| `pnpm lint` | Biome 代码检查 |
| `make test` | 运行引擎测试（vitest） |
| `make convert` | 批量转换游戏资源（Rust CLI） |
| `make convert-verify` | 像素级转换验证 |

---

## 操作方式

### 桌面端

| 输入方式 | 操作 |
|---|---|
| 左键单击（地面） | 移动到目标位置 |
| 左键单击（NPC / 物体） | 交互 |
| 右键单击（NPC / 物体） | 备用交互 |
| Ctrl + 左键单击 | 原地攻击 |
| `Q` | 与最近物体交互 |
| `E` | 与最近 NPC 交互 |
| `A` `S` `D` `F` `G` | 施放武功（技能槽 1–5） |
| `Z` `X` `C` | 使用物品（快捷槽 1–3） |
| `V` | 切换打坐 / 修炼状态 |

### 移动端

| 输入方式 | 操作 |
|---|---|
| 虚拟摇杆 | 移动 |
| 轻触（NPC / 物体） | 交互 |

---

## 部署

| 目标 | 方式 |
|------|------|
| **前端** | Vercel — `pnpm build:web` → 静态 SPA |
| **全栈** | Docker Compose — PostgreSQL + MinIO + Hono + Nginx |

详见 [deploy/](deploy/) 目录中的生产 Docker 配置。

---

## 参与贡献

1. Fork → 功能分支 → 参考[开发指南](.github/copilot-instructions.md) → PR
2. 提交前运行 `make tsc` 和 `pnpm lint`

---

## 致谢

- **原作游戏**：西山居 (Kingsoft) —《剑侠情缘外传：月影传说》(2001)
> 这是一个粉丝制作的学习项目。游戏素材和知识产权归原始创作者所有。

---

<div align="center">

**⚔️ 剑气纵横三万里，一剑光寒十九洲 ⚔️**

*用现代 Web 技术重现经典武侠*

</div>
