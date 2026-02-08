/**
 * GameTopBar - 游戏页面顶栏
 *
 * 左侧显示游戏名字，右侧显示登录头像
 */

import { Link } from "react-router-dom";
import { useAuth } from "@/contexts";

export interface GameTopBarProps {
  gameName: string;
}

export function GameTopBar({ gameName }: GameTopBarProps) {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="h-10 bg-black/40 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 z-20 flex-shrink-0">
      {/* 左侧：游戏名称 */}
      <div className="text-white/80 text-sm font-medium truncate">
        {gameName}
      </div>

      {/* 右侧：用户信息 */}
      <div className="flex items-center gap-2">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-xs">{user.name}</span>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        ) : (
          <Link
            to="/login"
            className="px-3 py-1 text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            登录
          </Link>
        )}
      </div>
    </div>
  );
}
