/**
 * 武功列表侧边栏面板
 * MagicListPanel + CreateMagicModal
 */

import { trpc } from "@miu2d/shared";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { CreateEntityModal } from "../components/common";
import { LazyAsfIcon } from "../components/common/LazyAsfIcon";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

export function MagicListPanel({ basePath }: { basePath: string }) {
  const { currentGame, setShowImportAll } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "player" | "npc">("all");

  const {
    data: magics,
    isLoading,
    refetch,
  } = trpc.magic.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  // 根据过滤条件筛选武功
  const filteredMagics = magics?.filter((m) =>
    filterType === "all" ? true : m.userType === filterType
  );

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            武功列表
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
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建武功</span>
          </button>
        </div>

        {/* 类型过滤器 */}
        <div className="flex gap-1 px-2 py-1.5 border-b border-panel-border">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterType === "all" ? "bg-[#094771] text-white" : "text-[#cccccc] hover:bg-[#3c3c3c]"
            }`}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setFilterType("player")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterType === "player"
                ? "bg-blue-600 text-white"
                : "text-blue-400 hover:bg-[#3c3c3c]"
            }`}
          >
            玩家
          </button>
          <button
            type="button"
            onClick={() => setFilterType("npc")}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              filterType === "npc"
                ? "bg-orange-600 text-white"
                : "text-orange-400 hover:bg-[#3c3c3c]"
            }`}
          >
            NPC
          </button>
        </div>

        {/* 武功列表 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : !filteredMagics || filteredMagics.length === 0 ? (
            <div className="px-4 py-2 text-sm text-[#858585]">
              {magics && magics.length > 0 ? "没有匹配的武功" : "暂无武功"}
            </div>
          ) : (
            filteredMagics.map((magic) => (
              <NavLink
                key={magic.id}
                to={`${basePath}/${magic.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                  }`
                }
              >
                <LazyAsfIcon
                  iconPath={magic.icon}
                  gameSlug={currentGame?.slug}
                  size={36}
                  prefix="asf/magic/"
                  fallback={
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-[#888]"
                      style={{ width: 31.5, height: 31.5 }}
                    >
                      <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{magic.name}</span>
                    <span
                      className={`text-xs ${magic.userType === "player" ? "text-blue-400" : "text-orange-400"}`}
                    >
                      {magic.userType === "player" ? "玩家" : "NPC"}
                    </span>
                  </div>
                  <div className="text-xs text-[#858585] truncate">{magic.key}</div>
                </div>
              </NavLink>
            ))
          )}
        </div>
      </div>

      {/* 新建武功模态框 */}
      {showCreateModal && (
        <CreateMagicModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

// ========== 新建武功弹窗 ==========
function CreateMagicModal({
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
  const [userType, setUserType] = useState<"player" | "npc">("player");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [intro, setIntro] = useState("");

  const createMutation = trpc.magic.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}/basic`);
    },
  });

  return (
    <CreateEntityModal
      title="新建武功"
      onClose={onClose}
      onCreate={() =>
        createMutation.mutate({
          gameId,
          userType,
          key: key || `magic_${Date.now()}`,
          name: name || "新武功",
          intro: intro || undefined,
        })
      }
      createDisabled={!name.trim()}
      isPending={createMutation.isPending}
      error={createMutation.error}
      width="w-[480px]"
    >
      {/* 类型选择 */}
      <div>
        <label className="block text-sm text-[#cccccc] mb-2">武功类型</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setUserType("player")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
              userType === "player"
                ? "bg-blue-600/20 border-blue-500 text-blue-400"
                : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
            }`}
          >
            <span className="text-lg">👤</span>
            <span>玩家武功</span>
          </button>
          <button
            type="button"
            onClick={() => setUserType("npc")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
              userType === "npc"
                ? "bg-orange-600/20 border-orange-500 text-orange-400"
                : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
            }`}
          >
            <span className="text-lg">🤖</span>
            <span>NPC 武功</span>
          </button>
        </div>
      </div>
      {/* 武功名称 */}
      <div>
        <label className="block text-sm text-[#cccccc] mb-1">
          武功名称 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：降龙十八掌"
          className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
        />
      </div>
      {/* 标识符 */}
      <div>
        <label className="block text-sm text-[#cccccc] mb-1">标识符 (Key)</label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="例如：player-magic-降龙十八掌.ini（留空自动生成）"
          className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
        />
      </div>
      {/* 武功介绍 */}
      <div>
        <label className="block text-sm text-[#cccccc] mb-1">武功介绍</label>
        <textarea
          rows={2}
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="简单描述武功的效果..."
          className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border resize-none"
        />
      </div>
    </CreateEntityModal>
  );
}
