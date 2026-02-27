/**
 * NPC 列表侧边栏面板
 * NpcListPanel + CreateNpcModal + CreateNpcResourceModal
 */

import { trpc } from "@miu2d/shared";
import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { CreateEntityModal } from "../components/common";
import { LazyAsfIcon } from "../components/common/LazyAsfIcon";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

export function NpcListPanel({ basePath }: { basePath: string }) {
  const { currentGame, setShowImportAll } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<"npc" | "resource">("npc");
  const [filterKind, setFilterKind] = useState<"all" | "npc" | "resource">("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const {
    data: npcList,
    isLoading: npcLoading,
    refetch: refetchNpcs,
  } = trpc.npc.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  const {
    data: resourceList,
    isLoading: resourceLoading,
    refetch: refetchResources,
  } = trpc.npcResource.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  const refetch = () => {
    refetchNpcs();
    refetchResources();
  };

  // 按关系类型分组 NPC
  const groupedNpcs = useMemo(() => {
    if (!npcList) return { Friendly: [], Hostile: [], Neutral: [], Partner: [] };

    const groups: Record<string, typeof npcList> = {
      Friendly: [],
      Hostile: [],
      Neutral: [],
      Partner: [],
    };

    for (const npc of npcList) {
      const relation = npc.relation || "Neutral";
      if (!groups[relation]) groups[relation] = [];
      groups[relation].push(npc);
    }

    return groups;
  }, [npcList]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const relationLabels: Record<string, string> = {
    Friendly: "友好",
    Hostile: "敌对",
    Neutral: "中立",
    Partner: "伙伴",
  };

  const relationIcons: Record<string, string> = {
    Friendly: "🟢",
    Hostile: "🔴",
    Neutral: "🟡",
    Partner: "🔵",
  };

  const isLoading = npcLoading || resourceLoading;
  const showNpcs = filterKind === "all" || filterKind === "npc";
  const showResources = filterKind === "all" || filterKind === "resource";

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            NPC 列表
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
              setCreateType("npc");
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建 NPC</span>
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
            <span>新建 NPC 资源</span>
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
            onClick={() => setFilterKind("npc")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterKind === "npc" ? "bg-[#094771] text-white" : "text-[#cccccc] hover:bg-[#3c3c3c]"
            }`}
          >
            NPC
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

        {/* 列表内容 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : (
            <>
              {/* NPC 列表 - 按关系分组 */}
              {showNpcs && (
                <>
                  {filterKind === "all" && (
                    <div className="px-3 py-1.5 text-xs font-medium text-[#569cd6] border-b border-panel-border">
                      🧙 NPC ({npcList?.length || 0})
                    </div>
                  )}
                  {!npcList || npcList.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-[#858585]">暂无 NPC</div>
                  ) : (
                    Object.entries(groupedNpcs).map(([relation, npcs]) => {
                      if (!npcs || npcs.length === 0) return null;
                      return (
                        <div key={relation}>
                          <button
                            type="button"
                            onClick={() => toggleGroup(relation)}
                            className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                          >
                            <span
                              className={`transition-transform ${collapsedGroups[relation] ? "" : "rotate-90"}`}
                            >
                              ▶
                            </span>
                            <span>{relationIcons[relation]}</span>
                            <span>{relationLabels[relation]}</span>
                            <span className="text-[#666]">({npcs.length})</span>
                          </button>
                          {!collapsedGroups[relation] &&
                            npcs.map((npc) => (
                              <NavLink
                                key={npc.id}
                                to={`${basePath}/${npc.id}`}
                                className={({ isActive }) =>
                                  `flex items-center gap-3 px-3 py-2 pl-6 text-sm transition-colors ${
                                    isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                                  }`
                                }
                              >
                                <LazyAsfIcon
                                  iconPath={npc.icon}
                                  gameSlug={currentGame?.slug}
                                  size={32}
                                  prefix="asf/character/"
                                  fallback="🧙"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate font-medium">{npc.name}</span>
                                    <span
                                      className={`text-xs ${
                                        npc.kind === "Fighter" ? "text-red-400" : "text-green-400"
                                      }`}
                                    >
                                      Lv.{npc.level ?? 1}
                                    </span>
                                  </div>
                                  <span className="text-xs text-[#858585] truncate block">
                                    {npc.key}
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

              {/* NPC 资源列表 */}
              {showResources && (
                <>
                  {filterKind === "all" && (
                    <div className="px-3 py-1.5 text-xs font-medium text-purple-400 border-b border-panel-border mt-2">
                      🎨 NPC 资源 ({resourceList?.length || 0})
                    </div>
                  )}
                  {!resourceList || resourceList.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-[#858585]">暂无 NPC 资源</div>
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
                          prefix="asf/character/"
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

      {/* 新建模态框 */}
      {showCreateModal && createType === "npc" && (
        <CreateNpcModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}
      {showCreateModal && createType === "resource" && (
        <CreateNpcResourceModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

// ===== 新建 NPC 弹窗 =====
function CreateNpcModal({
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
  const [kind, setKind] = useState<"Normal" | "Fighter">("Normal");
  const [relation, setRelation] = useState<"Friend" | "Enemy" | "Neutral">("Friend");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");

  const createMutation = trpc.npc.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}`);
    },
  });

  return (
    <CreateEntityModal
      title="新建 NPC"
      onClose={onClose}
      onCreate={() =>
        createMutation.mutate({
          gameId,
          key: key || `npc_${Date.now()}`,
          name,
          kind,
          relation,
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
          placeholder="输入 NPC 名称"
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
            onClick={() => setKind("Normal")}
            className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
              kind === "Normal"
                ? "bg-green-600 text-white"
                : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
          >
            🧑 普通
          </button>
          <button
            type="button"
            onClick={() => setKind("Fighter")}
            className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
              kind === "Fighter"
                ? "bg-red-600 text-white"
                : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
          >
            ⚔️ 战斗
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs text-[#858585] mb-1">关系</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRelation("Friend")}
            className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
              relation === "Friend"
                ? "bg-green-600 text-white"
                : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
          >
            🟢 友好
          </button>
          <button
            type="button"
            onClick={() => setRelation("Neutral")}
            className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
              relation === "Neutral"
                ? "bg-yellow-600 text-white"
                : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
          >
            🟡 中立
          </button>
          <button
            type="button"
            onClick={() => setRelation("Enemy")}
            className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
              relation === "Enemy"
                ? "bg-red-600 text-white"
                : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            }`}
          >
            🔴 敌对
          </button>
        </div>
      </div>
    </CreateEntityModal>
  );
}

// ===== 新建 NPC 资源弹窗 =====
function CreateNpcResourceModal({
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

  const createMutation = trpc.npcResource.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/resource/${data.id}`);
    },
  });

  return (
    <CreateEntityModal
      title="新建 NPC 资源"
      onClose={onClose}
      onCreate={() =>
        createMutation.mutate({
          gameId,
          key: key || `npcres_${Date.now()}`,
          name,
        })
      }
      createDisabled={!name.trim()}
      isPending={createMutation.isPending}
      error={createMutation.error}
      createButtonClass="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
    >
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
          placeholder="留空将自动生成"
        />
      </div>
      <div className="text-xs text-[#858585] bg-[#1e1e1e] p-3 rounded">
        <p>💡 NPC 资源用于定义 NPC 的视觉表现（动画、图标等），可被多个 NPC 共享使用。</p>
      </div>
    </CreateEntityModal>
  );
}
