/**
 * 游戏模块面板 - 上方显示子模块切换 tab，下方显示对应子模块面板
 */
import { NavLink, useLocation } from "react-router-dom";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";
import { NpcListPanel } from "./NpcListPanel";
import { MagicListPanel } from "./MagicListPanel";
import { GoodsListPanel } from "./GoodsListPanel";
import { ObjListPanel } from "./ObjListPanel";
import { ShopListPanel } from "./ShopListPanel";
import { LevelListPanel } from "./LevelListPanel";

// 游戏模块二级导航项
const gameModuleNavItems = [
  { id: "npcs", label: "NPC", path: "npcs", icon: "npc" as const },
  { id: "magic", label: "武功", path: "magic", icon: "magic" as const },
  { id: "goods", label: "物品", path: "goods", icon: "goods" as const },
  { id: "objs", label: "物件", path: "objs", icon: "obj" as const },
  { id: "shops", label: "商店", path: "shops", icon: "shop" as const },
  { id: "levels", label: "等级", path: "levels", icon: "level" as const },
];

/** 游戏模块二级导航 tab 栏 */
function GameModulesTabs({ basePath }: { basePath: string }) {
  const location = useLocation();
  const pathParts = location.pathname.split("/").filter(Boolean);
  const currentModule = pathParts[2];

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-[#1e1e1e] bg-[#252526]">
      {gameModuleNavItems.map((item) => {
        const isActive = currentModule === item.id;
        return (
          <NavLink
            key={item.id}
            to={`${basePath}/${item.path}`}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              isActive
                ? "bg-[#094771] text-white"
                : "text-[#cccccc] hover:bg-[#3c3c3c]"
            }`}
          >
            <span className="scale-75">{DashboardIcons[item.icon]}</span>
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}

/** 游戏模块面板 - 上方显示子模块切换 tab，下方显示对应子模块面板 */
export function GameModulesPanel({ basePath }: { basePath: string }) {
  const { sidebarCollapsed } = useDashboard();
  const location = useLocation();

  if (sidebarCollapsed) return null;

  const pathParts = location.pathname.split("/").filter(Boolean);
  const currentModule = pathParts[2]; // dashboard/gameId/module

  // 渲染当前子模块的面板内容（不含外壳）
  const renderSubPanel = () => {
    switch (currentModule) {
      case "npcs":
        return <NpcListPanel basePath={`${basePath}/npcs`} />;
      case "magic":
        return <MagicListPanel basePath={`${basePath}/magic`} />;
      case "goods":
        return <GoodsListPanel basePath={`${basePath}/goods`} />;
      case "objs":
        return <ObjListPanel basePath={`${basePath}/objs`} />;
      case "shops":
        return <ShopListPanel basePath={`${basePath}/shops`} />;
      case "levels":
        return <LevelListPanel basePath={`${basePath}/levels`} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* 二级导航 tab - 固定在顶部 */}
      <div className="w-60 shrink-0 bg-[#252526] border-r border-[#1e1e1e]">
        <GameModulesTabs basePath={basePath} />
      </div>

      {/* 子模块面板 */}
      <div className="flex-1 min-h-0">
        {renderSubPanel()}
      </div>
    </div>
  );
}
