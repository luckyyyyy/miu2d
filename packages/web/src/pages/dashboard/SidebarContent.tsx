/**
 * Dashboard 侧边栏面板
 * 根据当前选中的模块显示不同的子菜单
 *
 * 组件拆分到 ./sidebar/ 目录下：
 * - SidebarShared: 共享组件（SidebarPanel, TreeView, ListPanel）和树数据
 * - MagicListPanel: 武功列表面板
 * - LevelListPanel: 等级配置面板
 * - ShopListPanel: 商店列表面板
 * - GoodsListPanel: 物品列表面板
 * - NpcListPanel: NPC 列表面板
 * - ObjListPanel: Object 列表面板
 * - GameModulesPanel: 游戏模块聚合面板（含二级 tab 导航）
 */
import { useParams, useLocation } from "react-router-dom";
import { SidebarPanel, TreeView, ListPanel, gameSettingsTree, scenesTree, statisticsTree } from "./sidebar/SidebarShared";
import { GameModulesPanel } from "./sidebar/GameModulesPanel";

export function SidebarContent() {
  const { gameId } = useParams();
  const location = useLocation();

  const basePath = gameId ? `/dashboard/${gameId}` : "/dashboard";

  // 根据当前路径确定显示哪个面板
  const pathParts = location.pathname.split("/").filter(Boolean);
  const currentModule = pathParts[2] || "game"; // dashboard/gameId/module

  switch (currentModule) {
    case "game":
      return (
        <SidebarPanel title="游戏编辑">
          <TreeView nodes={gameSettingsTree} basePath={`${basePath}/game`} />
        </SidebarPanel>
      );

    case "characters":
      return (
        <ListPanel
          title="角色列表"
          basePath={`${basePath}/characters`}
          items={[
            { id: "player", name: "主角" },
            { id: "partner1", name: "仙儿" },
            { id: "partner2", name: "月儿" },
          ]}
          onAdd={() => console.log("添加角色")}
        />
      );

    case "game-modules":
    case "npcs":
    case "magic":
    case "goods":
    case "objs":
    case "shops":
    case "levels":
      return <GameModulesPanel basePath={basePath} />;

    case "scripts":
      return (
        <SidebarPanel title="通用脚本">
          <TreeView
            nodes={[
              {
                id: "common-scripts",
                label: "common",
                icon: "folder",
                children: [
                  { id: "init", label: "init.txt", path: "common/init" },
                  { id: "utils", label: "utils.txt", path: "common/utils" },
                ],
              },
              { id: "newgame", label: "newgame.txt", path: "newgame", icon: "file" },
            ]}
            basePath={`${basePath}/scripts`}
          />
        </SidebarPanel>
      );

    case "scenes":
      return (
        <SidebarPanel title="场景编辑">
          <TreeView nodes={scenesTree} basePath={`${basePath}/scenes`} />
        </SidebarPanel>
      );

    case "resources":
      // 资源管理器不需要子菜单，直接显示文件管理器
      return null;

    case "statistics":
      return (
        <SidebarPanel title="数据统计">
          <TreeView nodes={statisticsTree} basePath={`${basePath}/statistics`} />
        </SidebarPanel>
      );

    default:
      return (
        <SidebarPanel title="Dashboard">
          <div className="px-4 py-2 text-sm text-[#858585]">
            请选择一个模块
          </div>
        </SidebarPanel>
      );
  }
}
