/**
 * Object 列表侧边栏面板
 * ObjListPanel + CreateObjModal + CreateObjResourceModal
 */

import { trpc } from "@miu2d/shared";
import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { CreateEntityModal } from "../components/common";
import { LazyAsfIcon } from "../components/common/LazyAsfIcon";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

export function ObjListPanel({ basePath }: { basePath: string }) {
  const { currentGame, setShowImportAll } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<"obj" | "resource">("obj");
  const [filterKind, setFilterKind] = useState<"all" | "obj" | "resource">("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const {
    data: objList,
    isLoading: objLoading,
    refetch: refetchObjs,
  } = trpc.obj.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  const {
    data: resourceList,
    isLoading: resourceLoading,
    refetch: refetchResources,
  } = trpc.objResource.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  const refetch = () => {
    refetchObjs();
    refetchResources();
  };

  // 按类型分组
  const groupedObjs = useMemo(() => {
    if (!objList) return { Static: [], Dynamic: [], Trap: [], Other: [] };

    const groups: Record<string, typeof objList> = {
      Static: [],
      Dynamic: [],
      Trap: [],
      Other: [],
    };

    for (const obj of objList) {
      const kind = obj.kind || "Static";
      if (kind === "Static") groups.Static.push(obj);
      else if (kind === "Dynamic") groups.Dynamic.push(obj);
      else if (kind === "Trap") groups.Trap.push(obj);
      else groups.Other.push(obj);
    }

    return groups;
  }, [objList]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const kindLabels: Record<string, string> = {
    Static: "静态物体",
    Dynamic: "动态物体",
    Trap: "陷阱",
    Other: "其他",
  };

  const kindIcons: Record<string, string> = {
    Static: "📦",
    Dynamic: "⚙️",
    Trap: "🪤",
    Other: "❓",
  };

  const isLoading = objLoading || resourceLoading;
  const showObjs = filterKind === "all" || filterKind === "obj";
  const showResources = filterKind === "all" || filterKind === "resource";

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            Object 列表
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-1 p-2 border-b border-panel-border">
          <button
            type="button"
            onClick={() => setShowImportAll(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.upload}
            <span>批量导入</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateType("obj");
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建 Object</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateType("resource");
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建 Object 资源</span>
          </button>
        </div>

        {/* 类型过滤器 */}
        <div className="flex gap-1 px-2 py-1.5 border-b border-panel-border">
          <button
            type="button"
            onClick={() => setFilterKind("all")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterKind === "all" ? "bg-[#094771] text-white" : "text-[#cccccc] hover:bg-[#3c3c3c]"
            }`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setFilterKind("obj")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterKind === "obj" ? "bg-[#094771] text-white" : "text-[#cccccc] hover:bg-[#3c3c3c]"
            }`}
          >
            Object
          </button>
          <button
            type="button"
            onClick={() => setFilterKind("resource")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterKind === "resource"
                ? "bg-purple-600 text-white"
                : "text-purple-400 hover:bg-[#3c3c3c]"
            }`}
          >
            资源
          </button>
        </div>

        {/* Object 列表 - 按类型分组 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : (
            <>
              {/* Object 列表 - 按类型分组 */}
              {showObjs && (
                <>
                  {filterKind === "all" && (
                    <div className="px-3 py-1.5 text-xs font-medium text-[#569cd6] border-b border-panel-border">
                      📦 Object ({objList?.length || 0})
                    </div>
                  )}
                  {!objList || objList.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-[#858585]">暂无 Object</div>
                  ) : (
                    Object.entries(groupedObjs).map(([kind, objs]) => {
                      if (!objs || objs.length === 0) return null;
                      return (
                        <div key={kind}>
                          <button
                            type="button"
                            onClick={() => toggleGroup(kind)}
                            className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                          >
                            <span
                              className={`transition-transform ${collapsedGroups[kind] ? "" : "rotate-90"}`}
                            >
                              ▶
                            </span>
                            <span>{kindIcons[kind]}</span>
                            <span>{kindLabels[kind]}</span>
                            <span className="text-[#666]">({objs.length})</span>
                          </button>
                          {!collapsedGroups[kind] &&
                            objs.map((obj) => (
                              <NavLink
                                key={obj.id}
                                to={`${basePath}/${obj.id}`}
                                className={({ isActive }) =>
                                  `flex items-center gap-3 px-3 py-2 pl-6 text-sm transition-colors ${
                                    isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                                  }`
                                }
                              >
                                <LazyAsfIcon
                                  iconPath={obj.icon}
                                  gameSlug={currentGame?.slug}
                                  size={32}
                                  prefix="asf/object/"
                                  fallback={kindIcons[obj.kind] || "📦"}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate font-medium">{obj.name}</span>
                                  </div>
                                  <span className="text-xs text-[#858585] truncate block">
                                    {obj.key}
                                  </span>
                                </div>
                              </NavLink>
                            ))}
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* Object 资源列表 */}
              {showResources && (
                <>
                  {filterKind === "all" && (
                    <div className="px-3 py-1.5 text-xs font-medium text-purple-400 border-b border-panel-border mt-2">
                      🎨 Object 资源 ({resourceList?.length || 0})
                    </div>
                  )}
                  {!resourceList || resourceList.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-[#858585]">暂无 Object 资源</div>
                  ) : (
                    resourceList.map((resource) => (
                      <NavLink
                        key={resource.id}
                        to={`${basePath}/resource/${resource.id}`}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                            isActive ? "bg-purple-600/50 text-white" : "hover:bg-[#2a2d2e]"
                          }`
                        }
                      >
                        <LazyAsfIcon
                          iconPath={resource.icon}
                          gameSlug={currentGame?.slug}
                          size={32}
                          prefix="asf/object/"
                          fallback="🎨"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="truncate font-medium block">{resource.name}</span>
                          <span className="text-xs text-[#858585] truncate block">
                            {resource.key}
                          </span>
                        </div>
                      </NavLink>
                    ))
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 新建 Object 模态框 */}
      {showCreateModal && createType === "obj" && (
        <CreateObjModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}

      {/* 新建 Object 资源模态框 */}
      {showCreateModal && createType === "resource" && (
        <CreateObjResourceModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

// ===== 新建 Object 弹窗 =====
function CreateObjModal({
  onClose,
  basePath,
  gameId,
  onSuccess,
}: {
  onClose: () => void;
  basePath: string;
  gameId: string;
  onSuccess: () => void;
}) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<"Static" | "Dynamic" | "Trap">("Static");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");

  const createMutation = trpc.obj.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}`);
    },
  });

  return (
    <CreateEntityModal
      title="新建 Object"
      onClose={onClose}
      onCreate={() =>
        createMutation.mutate({
          gameId,
          key: key || `obj_${Date.now()}`,
          name,
          kind,
        })
      }
      createDisabled={!name.trim()}
      isPending={createMutation.isPending}
      error={createMutation.error}
    >
      <div>
        <label className="block text-xs text-[#858585] mb-1">名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
          placeholder="输入 Object 名称"
        />
      </div>
      <div>
        <label className="block text-xs text-[#858585] mb-1">标识符 (可选)</label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
          placeholder="留空将自动生成"
        />
      </div>
      <div>
        <label className="block text-xs text-[#858585] mb-1">类型</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setKind("Static")}
            className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
              kind === "Static"
                ? "bg-gray-600 text-white"
                : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
          >
            📦 静态
          </button>
          <button
            type="button"
            onClick={() => setKind("Dynamic")}
            className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
              kind === "Dynamic"
                ? "bg-blue-600 text-white"
                : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
          >
            ⚙️ 动态
          </button>
          <button
            type="button"
            onClick={() => setKind("Trap")}
            className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
              kind === "Trap"
                ? "bg-red-600 text-white"
                : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
          >
            🪤 陷阱
          </button>
        </div>
      </div>
    </CreateEntityModal>
  );
}

// ===== 新建 Object 资源弹窗 =====
function CreateObjResourceModal({
  onClose,
  basePath,
  gameId,
  onSuccess,
}: {
  onClose: () => void;
  basePath: string;
  gameId: string;
  onSuccess: () => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");

  const createMutation = trpc.objResource.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/resource/${data.id}`);
    },
  });

  return (
    <CreateEntityModal
      title="新建 Object 资源"
      onClose={onClose}
      onCreate={() =>
        createMutation.mutate({
          gameId,
          key: key || `objres_${Date.now()}.ini`,
          name,
        })
      }
      createDisabled={!name.trim()}
      isPending={createMutation.isPending}
      error={createMutation.error}
      createButtonClass="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
    >
      <div className="text-xs text-[#858585] bg-[#1e1e1e] p-3 rounded">
        <p>Object 资源用于定义物体的动画和音效。</p>
        <p className="mt-1">多个 Object 可以共享同一个资源配置。</p>
      </div>
      <div>
        <label className="block text-xs text-[#858585] mb-1">名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
          placeholder="输入资源名称"
        />
      </div>
      <div>
        <label className="block text-xs text-[#858585] mb-1">标识符 (可选)</label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
          placeholder="留空将自动生成 (建议以 .ini 结尾)"
        />
      </div>
    </CreateEntityModal>
  );
}
