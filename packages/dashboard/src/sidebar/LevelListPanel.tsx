/**
 * 等级配置列表侧边栏面板
 * LevelListPanel + CreateLevelConfigModal
 */

import { trpc } from "@miu2d/shared";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ModalShell } from "../components/common";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

// ========== 创建等级配置弹窗 ==========
function CreateLevelConfigModal({
  isOpen,
  onClose,
  gameId,
  basePath,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  basePath: string;
  onSuccess: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<"player" | "npc">("player");

  const handleManualCreate = () => {
    navigate(`${basePath}/new?type=${userType}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalShell title="新建等级配置" onClose={onClose} width="w-[420px]">
      {/* 类型选择 */}
      <div>
        <label className="block text-sm text-[#cccccc] mb-2">配置类型</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setUserType("player")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              userType === "player"
                ? "bg-blue-600/20 border-blue-500 text-blue-400"
                : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
            }`}
          >
            <span className="text-lg">👤</span>
            <span>玩家</span>
          </button>
          <button
            type="button"
            onClick={() => setUserType("npc")}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              userType === "npc"
                ? "bg-orange-600/20 border-orange-500 text-orange-400"
                : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
            }`}
          >
            <span className="text-lg">🤖</span>
            <span>NPC</span>
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="space-y-3">
        <p className="text-sm text-[#858585]">点击下方按钮进入编辑器，手动配置等级属性。</p>
        <button
          type="button"
          onClick={handleManualCreate}
          className="w-full px-4 py-2.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>开始创建</span>
          <span>→</span>
        </button>
      </div>
    </ModalShell>
  );
}

// ========== 等级配置列表面板 ==========
export function LevelListPanel({ basePath }: { basePath: string }) {
  const { currentGame, setShowImportAll } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    data: levels,
    isLoading,
    refetch,
  } = trpc.level.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  return (
    <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
      {/* 创建弹窗 */}
      {gameId && (
        <CreateLevelConfigModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          gameId={gameId}
          basePath={basePath}
          onSuccess={(id) => {
            refetch();
            navigate(`${basePath}/${id}`);
          }}
        />
      )}

      {/* 标题栏 */}
      <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
        <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">等级配置</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowImportAll(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-[#cccccc] hover:bg-[#3c3c3c] transition-colors"
            title="批量导入"
          >
            {DashboardIcons.upload}批量导入
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="p-1 text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded transition-colors"
            title="新建配置"
          >
            {DashboardIcons.add}
          </button>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto py-1 relative">
        {isLoading ? (
          <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
        ) : !levels || levels.length === 0 ? (
          <div className="px-4 py-4 text-center">
            <p className="text-sm text-[#858585]">暂无配置</p>
            <p className="text-xs text-[#666] mt-2">点击 + 按钮创建配置</p>
          </div>
        ) : (
          levels.map((level) => (
            <NavLink
              key={level.id}
              to={`${basePath}/${level.id}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                }`
              }
            >
              <span className="text-lg">{level.userType === "player" ? "👤" : "🤖"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{level.name}</span>
                  <span
                    className={`text-xs ${
                      level.userType === "player" ? "text-blue-400" : "text-orange-400"
                    }`}
                  >
                    {level.userType === "player" ? "玩家" : "NPC"}
                  </span>
                </div>
                <div className="text-xs text-[#858585] truncate">
                  {level.key} · {level.maxLevel}级
                </div>
              </div>
            </NavLink>
          ))
        )}
      </div>
    </div>
  );
}
