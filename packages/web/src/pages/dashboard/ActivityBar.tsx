/**
 * Dashboard 活动条 (Activity Bar)
 * VS Code 风格的左侧图标导航栏
 */
import { NavLink, useParams } from "react-router-dom";
import { useDashboard } from "./DashboardContext";
import { DashboardIcons, type IconName } from "./icons";
import { DASHBOARD_MODULES, type ModuleId } from "./types";

interface ActivityBarItem {
  id: ModuleId;
  icon: IconName;
  label: string;
  path: string;
}

const activityBarItems: ActivityBarItem[] = [
  { id: "gameSettings", icon: "game", label: "游戏编辑", path: "game" },
  { id: "characters", icon: "character", label: "角色编辑", path: "characters" },
  { id: "npcs", icon: "npc", label: "NPC编辑", path: "npcs" },
  { id: "goods", icon: "goods", label: "物品编辑", path: "goods" },
  { id: "shops", icon: "shop", label: "商店编辑", path: "shops" },
  { id: "levels", icon: "level", label: "等级与强度", path: "levels" },
  { id: "magic", icon: "magic", label: "武功编辑", path: "magic" },
  { id: "scripts", icon: "script", label: "通用脚本", path: "scripts" },
  { id: "scenes", icon: "map", label: "场景编辑", path: "scenes" },
  { id: "resources", icon: "folder", label: "资源管理器", path: "resources" },
  { id: "statistics", icon: "chart", label: "数据统计", path: "statistics" },
];

export function ActivityBar() {
  const { gameId } = useParams();
  const { activeModule, setActiveModule } = useDashboard();

  const basePath = gameId ? `/dashboard/${gameId}` : "/dashboard";

  return (
    <div className="flex w-12 flex-col bg-[#333333] border-r border-[#252526]">
      {/* 主导航图标 */}
      <nav className="flex flex-1 flex-col">
        {activityBarItems.map((item) => (
          <NavLink
            key={item.id}
            to={`${basePath}/${item.path}`}
            onClick={() => setActiveModule(item.id)}
            title={item.label}
            className={({ isActive }) =>
              `group relative flex h-12 w-full items-center justify-center transition-colors ${
                isActive
                  ? "bg-[#252526] text-white before:absolute before:left-0 before:h-full before:w-0.5 before:bg-white"
                  : "text-[#858585] hover:bg-[#2a2d2e] hover:text-white"
              }`
            }
          >
            {DashboardIcons[item.icon]}
            {/* Tooltip */}
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-[#252526] px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50 border border-[#454545]">
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* 底部图标 */}
      <div className="flex flex-col border-t border-[#252526]">
        <NavLink
          to={`${basePath}/settings`}
          title="设置"
          className={({ isActive }) =>
            `group relative flex h-12 w-full items-center justify-center transition-colors ${
              isActive
                ? "bg-[#252526] text-white"
                : "text-[#858585] hover:bg-[#2a2d2e] hover:text-white"
            }`
          }
        >
          {DashboardIcons.settings}
          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-[#252526] px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50 border border-[#454545]">
            设置
          </span>
        </NavLink>

        <a
          href="/"
          title="返回首页"
          className="group relative flex h-12 w-full items-center justify-center text-[#858585] transition-colors hover:bg-[#2a2d2e] hover:text-white"
        >
          {DashboardIcons.back}
          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-[#252526] px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50 border border-[#454545]">
            返回首页
          </span>
        </a>
      </div>
    </div>
  );
}
