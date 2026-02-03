import { NavLink } from "react-router-dom";

// VS Code 风格的 SVG 图标
const Icons = {
  home: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  ),
  asf: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
      <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
    </svg>
  ),
  character: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
      <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z" />
    </svg>
  ),
  script: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
  ),
  magic: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
      <path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29a.996.996 0 0 0-1.41 0L1.29 18.96a.996.996 0 0 0 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05a.996.996 0 0 0 0-1.41l-2.33-2.35zm-1.03 5.49l-2.12-2.12 2.44-2.44 2.12 2.12-2.44 2.44z" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  ),
};

interface NavItem {
  path: string;
  label: string;
  icon: keyof typeof Icons;
}

const navItems: NavItem[] = [
  { path: "/editor", label: "首页", icon: "home" },
  { path: "/editor/asf", label: "ASF 动画", icon: "asf" },
  { path: "/editor/character", label: "角色", icon: "character" },
  { path: "/editor/map", label: "地图", icon: "map" },
  { path: "/editor/script", label: "脚本", icon: "script" },
  { path: "/editor/magic", label: "武功", icon: "magic" },
];

/**
 * VS Code 风格的 Activity Bar
 * 只保留左侧图标栏，带 tooltip
 */
export function EditorSidebar() {
  return (
    <aside className="flex h-full">
      {/* Activity Bar - VS Code 左侧图标栏 */}
      <div className="flex w-12 flex-col bg-[#333333] border-r border-[#252526]">
        {/* 导航图标 */}
        <nav className="flex flex-1 flex-col">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/editor"}
              title={item.label}
              className={({ isActive }) =>
                `group relative flex h-12 w-full items-center justify-center transition-colors ${
                  isActive
                    ? "bg-[#252526] text-white before:absolute before:left-0 before:h-full before:w-0.5 before:bg-white"
                    : "text-[#858585] hover:bg-[#2a2d2e] hover:text-white"
                }`
              }
            >
              {Icons[item.icon]}
              {/* Tooltip */}
              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-[#252526] px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50 border border-[#454545]">
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* 底部图标 */}
        <div className="flex flex-col border-t border-[#252526]">
          <a
            href="/"
            className="group relative flex h-12 w-full items-center justify-center text-[#858585] transition-colors hover:bg-[#2a2d2e] hover:text-white"
          >
            {Icons.back}
            {/* Tooltip */}
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-[#252526] px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50 border border-[#454545]">
              返回游戏
            </span>
          </a>
        </div>
      </div>
    </aside>
  );
}
