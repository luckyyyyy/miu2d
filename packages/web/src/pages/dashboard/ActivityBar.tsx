/**
 * Dashboard 活动条 (Activity Bar)
 * VS Code 风格的左侧图标导航栏
 */
import { NavLink, useParams, useLocation } from "react-router-dom";
import { useDashboard } from "./DashboardContext";
import { DashboardIcons, type IconName } from "./icons";
import type { ModuleId } from "./types";

interface ActivityBarItem {
  id: ModuleId;
  icon: IconName;
  label: string;
  path: string;
  /** 子模块路径前缀（点击此项时，如果当前已在子模块中则保持不跳转） */
  childPaths?: string[];
}

const activityBarItems: ActivityBarItem[] = [
  { id: "gameSettings", icon: "game", label: "游戏编辑", path: "game" },
  { id: "characters", icon: "character", label: "角色编辑", path: "characters" },
  {
    id: "gameModules",
    icon: "gameModules",
    label: "游戏模块",
    path: "game-modules",
    childPaths: ["npcs", "magic", "goods", "objs", "shops", "levels"],
  },
  { id: "scripts", icon: "script", label: "通用脚本", path: "scripts" },
  { id: "scenes", icon: "map", label: "场景编辑", path: "scenes" },
  { id: "resources", icon: "folder", label: "资源管理器", path: "resources" },
  { id: "statistics", icon: "chart", label: "数据统计", path: "statistics" },
];

export function ActivityBar() {
  const { gameId } = useParams();
  const { activeModule, setActiveModule } = useDashboard();
  const location = useLocation();

  const basePath = gameId ? `/dashboard/${gameId}` : "/dashboard";

  return (
    <div className="flex w-12 flex-col bg-[#333333] border-r border-[#252526]">
      {/* 主导航图标 */}
      <nav className="flex flex-1 flex-col">
        {activityBarItems.map((item) => {
          // 判断是否激活：自身路径 或 子模块路径
          const isSelfActive = location.pathname.startsWith(`${basePath}/${item.path}`);
          const isChildActive = item.childPaths?.some((cp) =>
            location.pathname.startsWith(`${basePath}/${cp}`)
          );
          const isActive = isSelfActive || !!isChildActive;

          return (
            <NavLink
              key={item.id}
              to={`${basePath}/${item.path}`}
              onClick={() => setActiveModule(item.id)}
              title={item.label}
              className={`group relative flex h-12 w-full items-center justify-center transition-colors ${
                isActive
                  ? "bg-[#252526] text-white before:absolute before:left-0 before:h-full before:w-0.5 before:bg-white"
                  : "text-[#858585] hover:bg-[#2a2d2e] hover:text-white"
              }`}
            >
              {DashboardIcons[item.icon]}
              {/* Tooltip */}
              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-[#252526] px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50 border border-[#454545]">
                {item.label}
              </span>
            </NavLink>
          );
        })}
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
