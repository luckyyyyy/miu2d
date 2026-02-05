/**
 * Dashboard 路由配置
 */
import { Route, Routes, Navigate } from "react-router-dom";
import { GameGuard } from "./GameGuard";
import { GameListPage } from "./GameListPage";
import { DashboardLayout } from "./DashboardLayout";
import { DashboardHome } from "./DashboardHome";

// 游戏编辑
import {
  GameConfigPage,
  NewGameScriptPage,
  PlayerConfigPage,
} from "./modules/GameSettingsPages";

// 角色编辑
import { CharactersListPage, CharacterDetailPage } from "./modules/CharactersPages";

// NPC 编辑
import { NpcListPage, NpcDetailPage } from "./modules/npc";

// Object 编辑
import { ObjListPage, ObjDetailPage } from "./modules/obj";

// 物品编辑
import { GoodsListPage, GoodsDetailPage } from "./modules/goods/GoodsPages";

// 商店编辑
import { ShopsListPage, ShopDetailPage } from "./modules/ShopsPages";

// 武功编辑
import { MagicListPage, MagicDetailPage } from "./modules/magic";

// 等级与强度
import { LevelListPage, LevelDetailPage, StrengthConfigPage } from "./modules/level";

// 脚本编辑
import { ScriptsPage } from "./modules/ScriptsPages";

// 场景编辑
import {
  ScenesHomePage,
  MapEditorPage,
  DialogsPage,
  MapNpcsPage,
  MapObjectsPage,
  SceneScriptsPage,
} from "./modules/ScenesPages";

// 资源管理
import {
  ResourcesHomePage,
  ImagesPage,
  MusicPage,
  SoundsPage,
  AsfResourcesPage,
} from "./modules/ResourcesPages";

// 数据统计
import {
  StatisticsHomePage,
  PlayerDataPage,
  PlayerSavesPage,
} from "./modules/StatisticsPages";

/**
 * 设置页面占位符
 */
function SettingsPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">设置</h1>
        <p className="text-[#858585]">Dashboard 设置页面（开发中）</p>
      </div>
    </div>
  );
}

/**
 * Dashboard 应用路由
 * 在 /dashboard/* 路径下渲染
 */
export function DashboardApp() {
  return (
    <Routes>
      {/* 游戏空间列表页面 */}
      <Route index element={<GameListPage />} />

      {/* 带游戏空间ID的路由 - 先验证游戏空间是否存在 */}
      <Route path=":gameId" element={<GameGuard />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />

        {/* 游戏编辑 */}
        <Route path="game">
          <Route index element={<Navigate to="config" replace />} />
          <Route path="config" element={<GameConfigPage />} />
          <Route path="newgame" element={<NewGameScriptPage />} />
          <Route path="player" element={<PlayerConfigPage />} />
        </Route>

        {/* 角色编辑 */}
        <Route path="characters">
          <Route index element={<CharactersListPage />} />
          <Route path=":characterId" element={<CharacterDetailPage />} />
        </Route>

        {/* NPC 编辑 */}
        <Route path="npcs">
          <Route index element={<NpcListPage />} />
          <Route path=":npcId" element={<Navigate to="basic" replace />} />
          <Route path=":npcId/:tab" element={<NpcDetailPage />} />
        </Route>

        {/* Object 编辑 */}
        <Route path="objs">
          <Route index element={<ObjListPage />} />
          <Route path=":objId" element={<Navigate to="basic" replace />} />
          <Route path=":objId/:tab" element={<ObjDetailPage />} />
        </Route>

        {/* 物品编辑 */}
        <Route path="goods">
          <Route index element={<GoodsListPage />} />
          <Route path=":goodsId" element={<GoodsDetailPage />} />
        </Route>

        {/* 商店编辑 */}
        <Route path="shops">
          <Route index element={<ShopsListPage />} />
          <Route path=":shopId" element={<ShopDetailPage />} />
        </Route>

        {/* 等级与强度 */}
        <Route path="levels">
          <Route index element={<LevelListPage />} />
          <Route path=":levelConfigId" element={<Navigate to="basic" replace />} />
          <Route path=":levelConfigId/:tab" element={<LevelDetailPage />} />
        </Route>

        {/* 武功编辑 */}
        <Route path="magic">
          <Route index element={<MagicListPage />} />
          <Route path=":magicId" element={<Navigate to="basic" replace />} />
          <Route path=":magicId/:tab" element={<MagicDetailPage />} />
        </Route>

        {/* 通用脚本编辑 */}
        <Route path="scripts/*" element={<ScriptsPage />} />

        {/* 场景编辑 */}
        <Route path="scenes">
          <Route index element={<ScenesHomePage />} />
          <Route path="map-editor" element={<MapEditorPage />} />
          <Route path="mpc" element={<MapEditorPage />} />
          <Route path="dialogs" element={<DialogsPage />} />
          <Route path="map-npcs" element={<MapNpcsPage />} />
          <Route path="map-objects" element={<MapObjectsPage />} />
          <Route path="scene-scripts" element={<SceneScriptsPage />} />
        </Route>

        {/* 资源管理 */}
        <Route path="resources">
          <Route index element={<ResourcesHomePage />} />
          <Route path="images" element={<ImagesPage />} />
          <Route path="music" element={<MusicPage />} />
          <Route path="sounds" element={<SoundsPage />} />
          <Route path="asf" element={<AsfResourcesPage />} />
        </Route>

        {/* 数据统计 */}
        <Route path="statistics">
          <Route index element={<StatisticsHomePage />} />
          <Route path="player-data" element={<PlayerDataPage />} />
          <Route path="player-saves" element={<PlayerSavesPage />} />
        </Route>

        {/* 设置 */}
        <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
