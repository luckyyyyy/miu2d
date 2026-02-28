<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo-dark.svg" />
    <img src="logo.svg" width="300" alt="Miu2D Logo" />
  </picture>
</p>

<p align="center">
  <b>A from-scratch 2D ARPG engine — raw WebGL, zero game-framework dependencies</b>
</p>

<p align="center">
  <a href="https://miu2d.com">Live Demo</a> · <a href="README_CN.md">中文文档</a>
</p>

---

Miu2D is a **176,000-line** 2D ARPG engine written in TypeScript and Rust, rendering through **raw WebGL** with no dependency on Unity, Godot, Phaser, PixiJS, or any other game framework. Every subsystem — sprite batching, A* pathfinding, binary format decoders, scripting VM, weather particles, screen effects — is implemented from first principles.

As a proof of concept, Miu2D has been used to rebuild **three classic Kingsoft (西山居) wuxia RPGs**, all fully playable in any modern browser.

> **Vibe Coding** — This project is developed with AI-assisted programming from day one.

---

### <img src="packages/web/public/screenshot/logo-yuying.webp" height="32" style="vertical-align:middle"> Legend of Yue Ying (剑侠情缘外传：月影传说) · 2001

| **Developer** | Xishanju (西山居 / Kingsoft) |
|---|---|
| **Genre** | Action RPG |
| **Highlights** | 7+ endings · 100+ story events · 30-person team (20+ artists) · 14-month production |

The largest production Xishanju had ever mounted at the time. The story branches dramatically based on player choices — loyalty, love, wealth — shaping the protagonist's morality and emotional alignment to produce seven or more distinct endings. Scenes were built with a pioneering 3D+2D hybrid rendering technique, and the soundtrack blended classical Chinese instruments with contemporary pop production.

![Legend of Yue Ying](packages/web/public/screenshot/game-yuying.png)

---

### <img src="packages/web/public/screenshot/logo-sword2.png" height="32" style="vertical-align:middle"> Swords of Legends 2 (剑侠情缘贰) · 1998

| **Developer** | Xishanju (西山居 / Kingsoft) |
|---|---|
| **Genre** | Action RPG |
| **Highlights** | Diablo-style real-time combat · 200+ NPCs · 640×480 16-bit color · theme song by 谢雨欣 |

Set twenty years after the original, hero 南宫飞云 — son of the first game's protagonists — stumbles into a perilous journey after rescuing a mysterious girl named 若雪. The sequel boldly abandoned turn-based combat for a real-time action system inspired by *Diablo*, a revolutionary move for Chinese RPGs of the era. Three years in development with a budget of nearly ¥3 million and a team of 30.

![Swords of Legends 2](packages/web/public/screenshot/game-sword2.png)

---

### <img src="packages/web/public/screenshot/logo-new-swords.png" height="32" style="vertical-align:middle"> New Swords of Legends (新剑侠情缘) · 2001

| **Developer** | Xishanju (西山居 / Kingsoft) |
|---|---|
| **Genre** | Action RPG |
| **Highlights** | Remake of the 1997 original · 110+ maps · indoor map system · real-time combat engine from Swords 2 |

A remake of the franchise's 1997 debut, rebuilt with the acclaimed real-time action combat engine from *Swords of Legends 2*. The story remains faithful to the original while greatly expanding the map count to 110+ scenes and introducing seamless indoor/outdoor transitions.

![New Swords of Legends](packages/web/public/screenshot/game-new-swords.png)

---

<details>
<summary><b>Mobile & Editor Screenshots</b></summary>

**Mobile — virtual joystick + touch controls:**

![Mobile](packages/web/public/screenshot/mobile.png)

**Map Editor — visual tilemap editing, collision zones:**

![Map Editor](packages/web/public/screenshot/map-editor.png)

**ASF Editor — sprite animation frame viewer & debugger:**

![ASF Editor](packages/web/public/screenshot/asf-editor.png)

</details>

---

## Why Build a Game Engine from Scratch?

Most web game projects reach for PixiJS, Phaser, or a WASM-compiled Unity/Godot build. Miu2D takes a different path: the entire rendering pipeline talks directly to `WebGLRenderingContext`, the pathfinder lives in Rust compiled to WASM with zero-copy shared memory, and the scripting engine interprets 182 game commands through a custom parser/executor pair. The result is a system whose every layer is visible, debuggable, and tailored to 2D RPG mechanics.

**What this buys you:**

- **Full control over the render loop** — a `SpriteBatcher` coalesces ~4,800 map tile draws into 1–5 WebGL draw calls; a `RectBatcher` reduces ~300 weather particles to a single call.
- **No abstraction tax** — no unused scene graph, no 3D math overhead, no framework event model to work around.
- **Rust-speed where it matters** — A* pathfinding runs in ~0.2 ms via WASM with obstacle data written directly into linear memory (no serialization, no FFI copy).
- **Clean architecture for study** — an 8-level class hierarchy (Sprite → CharacterBase → Movement → Combat → Character → PlayerBase → PlayerCombat → Player) with clear separation of concerns, ideal for understanding how a full 2D RPG engine works under the hood.

---

## Architecture at a Glance

| Layer | Package | Details |
|---|---|---|
| **UI** | `@miu2d/game` | React 19 · 3 themes (Classic / Modern / Mobile) · 84 components |
| **Engine** | `@miu2d/engine` | Pure TypeScript · 215 files · 19 modules · no React dependency |
| ↳ Renderer | `renderer/` | Raw WebGL · SpriteBatcher · Canvas2D fallback · GLSL filters |
| ↳ Script VM | `script/` | 218 commands · custom parser + async executor |
| ↳ Character | `character/` | 8-level inheritance chain · NPC AI · bezier movement |
| ↳ Magic | `magic/` | 22 MoveKind trajectories · 10 SpecialKind effects |
| **WASM** | `@miu2d/engine-wasm` | Rust → WebAssembly · A\* pathfinder · decoders · SpatialHash · zstd |
| **Backend** | `@miu2d/server` | Hono + tRPC + Drizzle ORM · 21 PostgreSQL tables · 19 routers |
| **Editor** | `@miu2d/dashboard` | VS Code-style layout · 13 editing modules |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.9 (strict) · Rust · GLSL |
| Frontend | React 19 · Vite 7 (rolldown) · Tailwind CSS 4 |
| Rendering | Raw WebGL API (Canvas 2D fallback) |
| Audio | Web Audio API (OGG Vorbis) |
| Performance | Rust → WebAssembly (wasm-bindgen, zero-copy) |
| Backend | Hono (lightweight HTTP) · tRPC 11 · Drizzle ORM |
| Database | PostgreSQL 16 · MinIO / S3 |
| Validation | Zod 4 (shared schemas across client & server) |
| Quality | Biome (lint + format) · TypeScript strict mode |
| Monorepo | pnpm workspaces (11 packages) |

---

## Engine Systems

Miu2D implements **17 integrated ARPG subsystems** (218 script commands) entirely from first principles:

| System | Module | Highlights |
|--------|--------|------------|
| **Rendering** | `renderer/` | Raw WebGL sprite batcher (~4,800 tiles → 1–5 draw calls), Canvas2D fallback, GLSL color filters (poison / freeze / petrify), screen effects (fade, flash, water ripple), **local lighting** (additive lum masks for dark scenes) |
| **Character** | `character/` | 8-level inheritance chain (Sprite → CharacterBase → Movement → Combat → Character → PlayerBase → PlayerCombat → Player/NPC); stats, status flags, bezier-curve movement |
| **Combat** | `character/` | Hit detection, damage formula, knockback, death & respawn, party/enemy faction logic |
| **Magic / Skill** | `magic/` | 22 MoveKind trajectories (line, spiral, homing, AoE, summon, time-stop…) × 10 SpecialKind effects; per-level config, passive XiuLian system |
| **NPC & AI** | `npc/` | Behavior state machine (idle / patrol / chase / flee / dead), interaction scripts, spatial grid for fast neighbor lookup |
| **Player** | `player/` | Controller, inventory (goods system), equipment slots, magic slots, experience & leveling |
| **Map** | `map/` | Multi-layer tile parsing, obstacle grid, trap zones, event areas, layer-sorted rendering |
| **Script / Event** | `script/` | Custom VM: parser + async executor, 218 commands across 9 categories (dialog, player, NPC, state, audio, effects, objects, items, misc) |
| **Pathfinding** | `wasm/` | Rust WASM A* with zero-copy shared memory; 5 strategies (greedy → full A*); ~0.2 ms per query, ≈10× faster than TS |
| **Collision** | `wasm/` | SpatialHash in Rust/WASM for O(1) broad-phase entity queries |
| **Audio** | `audio/` | Web Audio API manager: streamed BGM (OGG/MP3), positional SFX (WAV/OGG), fade transitions |
| **Weather / Particles** | `weather/` | Wind-driven rain + splash + lightning flash; wobbling snowflakes; screen-droplet lens effect |
| **Object / Prop** | `obj/` | Interactable scene objects (chests, doors, barriers, traps) with script hooks and sprite animation |
| **GUI / HUD** | `gui/` | Dialog system (branching choices, portraits), shop/buy panel, mini-map, status bars, UI bridge to React |
| **Inventory / Items** | `player/` | 10 goods categories, equip/unequip, use effects, loot drops with configurable drop tables |
| **Save / Load** | `storage/` | Multiple save slots, full game-state serialization to IndexedDB + server-side cloud saves |
| **Resource Loading** | `resource/` | Async loader for 8 binary formats (ASF, MPC, MAP, SHD, XNB, MSF, MMF, INI/OBJ); GBK/UTF-8 decoding |

---

## Engine Deep Dive

### Renderer — Raw WebGL with Automatic Batching

The renderer directly calls `WebGLRenderingContext` — no wrapper library.

- **SpriteBatcher** — accumulates vertex data and flushes per texture change; typical map frame: ~4,800 tiles → 1–5 draw calls
- **RectBatcher** — weather particles and UI rectangles batched into a single draw call
- **GPU texture management** — `ImageData` → `WebGLTexture` with `WeakMap` caching and `FinalizationRegistry` for automatic GPU resource cleanup
- **GLSL color filters** — grayscale (petrification), blue tint (frozen), green tint (poison) applied per-sprite in the fragment shader
- **Screen effects** — fade in/out, color overlays, screen flash, water ripple, all composited in the render loop
- **Canvas 2D fallback** — same `Renderer` interface, full feature parity for devices without WebGL
- **Local lighting (LumMask)** — when `SetMainLum` darkens the scene, light-emitting entities (objects, NPCs, magic projectiles) generate an additive white 800×400 elliptical glow mask at their position. A per-tile dedup (matching C++ `Weather::drawElementLum`) prevents double-drawing. A `noLum` flag on magic sub-projectiles suppresses redundant light sources for dense spell patterns, accurately matching the C++ reference:
  - **LineMove**: 1-in-3 sub-projectiles emit light (`i % 3 === 1`)
  - **Square region**: 1-in-9 (`i % 3 === 1 && j % 3 === 1`)
  - **Wave / Rectangle region**: 1-in-4 (`i % 2 !== 0 && j % 2 !== 0`)
  - **CircleMove** (e.g. 依风剑法): 1-in-8 of the 32 projectiles emit light

### Script Engine — 218 Commands

A custom **parser** tokenizes game script files; an **executor** interprets them with blocking/async support. Commands span 9 categories:

| Category | Examples |
|----------|---------|
| Dialog | `Say`, `Talk`, `Choose`, `ChooseMultiple`, `DisplayMessage` |
| Player | `AddLife`, `AddMana`, `SetPlayerPos`, `PlayerGoto`, `Equip` |
| NPC | `AddNpc`, `DelNpc`, `SetNpcRelation`, `NpcAttack`, `MergeNpc` |
| Game State | `LoadMap`, `Assign`, `If/Goto`, `RunScript`, `RunParallelScript` |
| Audio | `PlayMusic`, `StopMusic`, `PlaySound` |
| Effects | `FadeIn`, `FadeOut`, `BeginRain`, `ShowSnow`, `OpenWaterEffect` |
| Objects | `AddObj`, `DelObj`, `OpenObj`, `SetObjScript` |
| Items | `AddGoods`, `DelGoods`, `ClearGoods`, `AddRandGoods` |
| Misc | `Sleep`, `Watch`, `PlayMovie`, `DisableInput`, `ReturnToTitle` |

Scripts drive the entire game narrative — cutscenes, branching dialogs, NPC spawning, map transitions, combat triggers, and weather changes.

### Magic System — 22 Movement Types × 10 Special Effects

Every magic attack follows one of **22 MoveKind** trajectories, each with its own physics and rendering:

| Movement | Behavior |
|----------|----------|
| LineMove | Multi-projectile line — count scales with level |
| CircleMove | Orbital ring pattern |
| SpiralMove | Expanding spiral outward |
| SectorMove | Fan-shaped spread |
| HeartMove | Heart-shaped flight path |
| FollowEnemy | Homing missile tracking |
| Throw | Parabolic arc projectile |
| Transport | Teleportation |
| Summon | Spawn allied NPC |
| TimeStop | Freeze all entities |
| VMove | V-shaped diverging spread |
| *...and 11 more* | |

Combined with **10 SpecialKind** effects (freeze, poison, petrify, invisibility, heal, buff, transform, remove-debuff…), this produces hundreds of unique spell combinations. The system includes specialized sprite factories, a collision handler, and a passive effect manager (XiuLian/修炼).

### Pathfinding — Rust WASM, Zero-Copy Memory

The A* pathfinder is written in Rust, compiled to WebAssembly. It eliminates all FFI overhead through shared linear memory:

1. JavaScript writes obstacle bitmaps directly into WASM linear memory via `Uint8Array` views on `wasm.memory.buffer`
2. WASM executes A* in-place on shared memory
3. JavaScript reads path results via `Int32Array` pointer views — **zero serialization, zero copying**

Five path strategies (from greedy to full A* with configurable max iterations) let the game trade accuracy for speed. Typical pathfind: **~0.2 ms**, roughly **10× faster** than the equivalent TypeScript implementation.

### Binary Format Decoders

The engine parses **8 binary file formats** from the original game — all reverse-engineered and implemented without third-party parsing libraries:

| Format | Description |
|--------|------------|
| **ASF** | Sprite animation frames (RLE-compressed, palette-indexed RGBA) |
| **MPC** | Resource pack container (bundled sprite sheets) |
| **MAP** | Tile map data (multiple layers, obstacle grid, trap zones) |
| **SHD** | Shadow / height map data for terrain |
| **XNB** | XNA Binary format (audio assets from the original game) |
| **MSF** | Miu Sprite Format v2 — custom indexed-palette + zstd compression |
| **MMF** | Miu Map Format — custom zstd-compressed binary map data |
| **INI/OBJ** | Config files in GBK (Chinese legacy encoding) and UTF-8 |

### Weather System — Particle-Driven

Particle physics and rendering:

- **Rain** — wind-affected particles with splash on contact, periodic lightning flash illuminating the scene
- **Screen droplets** — simulated refraction/lens effect of water running down the camera
- **Snow** — individual snowflake physics with wobble, spin, drift, and gradual melt

### Character System — 8-Level Inheritance

A deep, well-structured class hierarchy with clear separation of concerns:

```
Sprite
 └─ CharacterBase — stats, properties, status flags
     └─ CharacterMovement — A* pathfinding, tile walking, bezier curves
         └─ CharacterCombat — attack, damage calc, status effects
             └─ Character — shared NPC/Player logic [abstract]
                 ├─ PlayerBase → PlayerCombat → Player
                 └─ Npc — AI behavior, interaction scripts, spatial grid
```

---

## Game Data Editor (Dashboard)

The project includes a VS Code-style game editor with Activity Bar, Sidebar, and Content panels:

| Module | What it edits |
|--------|---------------|
| Magic Editor | Spell config with live ASF sprite preview |
| NPC Editor | Stats, scripts, AI behavior, sprite preview |
| Scene Editor | Map data, spawn points, traps, triggers |
| Item Editor | Weapons, armor, consumables, drop tables |
| Shop Editor | Store inventories and pricing |
| Dialog Editor | Branching conversation trees + portrait assignment |
| Player Editor | Starting stats, equipment, skill slots |
| Level Editor | Experience curves and stat growth |
| Game Config | Global game settings (drops, player defaults) |
| File Manager | Full file tree with drag-and-drop upload |
| Resources | Resource browser and viewer integration |
| Statistics | Data overview dashboard |

---

## Project Structure

11 packages in a pnpm monorepo, **~176,000 lines** total:

| Package | Role |
|---------|------|
| `@miu2d/engine` | Pure TS game engine — 19 modules, no React dependency |
| `@miu2d/dashboard` | VS Code-style game data editor (13 modules) |
| `@miu2d/game` | Game runtime with 3 UI themes (classic/modern/mobile) |
| `@miu2d/server` | Hono + tRPC backend (21 tables, 19 routers) |
| `@miu2d/types` | Shared Zod 4 schemas (18 domain modules) |
| `@miu2d/web` | App shell, routing, landing page |
| `@miu2d/converter` | Rust CLI: ASF/MPC → MSF, MAP → MMF batch conversion |
| `@miu2d/engine-wasm` | Rust → WASM: pathfinder, decoders, spatial hash, zstd |
| `@miu2d/viewer` | Resource viewers (ASF/Map/MPC/Audio) |
| `@miu2d/ui` | Generic UI components (no business deps) |
| `@miu2d/shared` | i18n, tRPC client, React contexts |

Also included: `resources/` (game assets), `docs/` (format specs), `JxqyHD/` (C# reference from the original engine).

---

## Quick Start

**Requirements:** Node.js 18+, pnpm 9+, modern browser with WebGL

```bash
git clone https://github.com/nicologies/miu2d.git
cd miu2d
pnpm install
pnpm dev            # → http://localhost:5173
```

### Full Stack (with backend + database)

```bash
make init           # Docker: PostgreSQL + MinIO, migrate, seed
make dev            # web + server + db studio concurrently
```

### Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Frontend dev server (port 5173) |
| `make dev` | Full-stack dev (web + server + db) |
| `make tsc` | Type check all packages |
| `pnpm lint` | Biome lint |
| `make test` | Run engine tests (vitest) |
| `make convert` | Batch convert game resources (Rust CLI) |
| `make convert-verify` | Pixel-perfect conversion verification |

---

## Controls

### Desktop

| Input | Action |
|---|---|
| Left click (ground) | Move to position |
| Left click (NPC / object) | Interact |
| Right click (NPC / object) | Alternate interact |
| Ctrl + Left click | Attack in place |
| `Q` | Interact with nearest object |
| `E` | Interact with nearest NPC |
| `A` `S` `D` `F` `G` | Cast magic (skill slots 1 – 5) |
| `Z` `X` `C` | Use item (quick slots 1 – 3) |
| `V` | Toggle sitting / meditate (修炼) |

### Mobile

| Input | Action |
|---|---|
| Virtual joystick | Move |
| Tap (NPC / object) | Interact |

---

## Deployment

| Target | Method |
|--------|--------|
| **Frontend** | Vercel — `pnpm build:web` → static SPA |
| **Full Stack** | Docker Compose — PostgreSQL + MinIO + Hono + Nginx |

See [deploy/](deploy/) for production Docker configs.

---

## Contributing

1. Fork → feature branch → reference the [dev guide](.github/copilot-instructions.md) → PR
2. Run `make tsc` and `pnpm lint` before submitting

---

## Credits

- **Original Game**: Kingsoft (西山居) — *剑侠情缘外传：月影传说* (2001)

> This is a fan-made learning project. Game assets and IP belong to their original creators.

---

<div align="center">

**⚔️ Sword spirit spans thirty thousand miles ⚔️**

*Recreating classic wuxia with modern web technology*

</div>
