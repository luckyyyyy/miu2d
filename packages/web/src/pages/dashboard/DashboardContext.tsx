/**
 * Dashboard 上下文
 * 管理当前选中的游戏空间和侧边栏状态
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Game } from "@miu2d/types";

/**
 * 编辑数据缓存 - 用于跨 tab 持久化编辑中的数据
 * key 格式: "magic:${id}" 或 "npc:${id}" 等
 */
interface EditCache {
  /** 获取缓存的编辑数据 */
  get: <T>(key: string) => T | undefined;
  /** 设置缓存的编辑数据 */
  set: <T>(key: string, data: T) => void;
  /** 删除缓存的编辑数据 */
  remove: (key: string) => void;
  /** 检查是否有未保存的更改 */
  has: (key: string) => boolean;
  /** 清除所有缓存 */
  clear: () => void;
}

interface DashboardContextType {
  // 当前游戏空间
  currentGame: Game | null;
  setCurrentGame: (game: Game | null) => void;

  // 侧边栏状态
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // 展开的菜单节点
  expandedNodes: Set<string>;
  toggleNode: (nodeId: string) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;

  // 活动条选中的模块
  activeModule: string | null;
  setActiveModule: (moduleId: string | null) => void;

  // 编辑数据缓存（跨 tab 持久化）
  editCache: EditCache;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined
);

interface DashboardProviderProps {
  children: ReactNode;
  initialGame?: Game | null;
}

export function DashboardProvider({
  children,
  initialGame = null,
}: DashboardProviderProps) {
  const [currentGame, setCurrentGame] = useState<Game | null>(initialGame);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [activeModule, setActiveModule] = useState<string | null>("game-settings");

  // 编辑数据缓存 - 使用 ref 避免重新渲染
  const editCacheRef = useRef<Map<string, unknown>>(new Map());

  const editCache: EditCache = {
    get: <T,>(key: string) => editCacheRef.current.get(key) as T | undefined,
    set: <T,>(key: string, data: T) => {
      editCacheRef.current.set(key, data);
    },
    remove: (key: string) => {
      editCacheRef.current.delete(key);
    },
    has: (key: string) => editCacheRef.current.has(key),
    clear: () => {
      editCacheRef.current.clear();
    },
  };

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const expandNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => new Set(prev).add(nodeId));
  }, []);

  const collapseNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  const value: DashboardContextType = {
    currentGame,
    setCurrentGame,
    sidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
    expandedNodes,
    toggleNode,
    expandNode,
    collapseNode,
    activeModule,
    setActiveModule,
    editCache,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
