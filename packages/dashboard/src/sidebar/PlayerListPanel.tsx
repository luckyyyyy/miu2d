/**
 * 玩家角色列表侧边栏面板
 * 支持从 save/game/ 目录导入 PlayerX.ini + MagicX.ini + GoodsX.ini
 */

import { trpc } from "@miu2d/shared";
import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { CreateEntityModal } from "../components/common";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

export function PlayerListPanel({ basePath }: { basePath: string }) {
  const { currentGame, setShowImportAll } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    data: playerList,
    isLoading,
    refetch,
  } = trpc.player.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  const sortedPlayers = useMemo(() => {
    if (!playerList) return [];
    return [...playerList].sort((a, b) => a.index - b.index);
  }, [playerList]);

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            角色列表
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
            <span>新建角色</span>
          </button>
        </div>

        {/* 列表内容 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : !sortedPlayers.length ? (
            <div className="px-4 py-2 text-sm text-[#858585]">暂无角色</div>
          ) : (
            sortedPlayers.map((player) => (
              <NavLink
                key={player.id}
                to={`${basePath}/${player.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                  }`
                }
              >
                <span className="text-lg">🎮</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {player.name || `Player${player.index}`}
                    </span>
                    <span className="text-xs text-green-400">Lv.{player.level ?? 1}</span>
                  </div>
                  <span className="text-xs text-[#858585] truncate block">
                    Player{player.index} · {player.key}
                  </span>
                </div>
              </NavLink>
            ))
          )}
        </div>
      </div>

      {/* 新建角色模态框 */}
      {showCreateModal && gameId && (
        <CreatePlayerModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

// ========== 新建角色模态框 ==========

function CreatePlayerModal({
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

  const createMutation = trpc.player.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}`);
    },
  });

  return (
    <CreateEntityModal
      title="新建角色"
      onClose={onClose}
      onCreate={() => createMutation.mutate({ gameId, key, name })}
      createDisabled={!key.trim() || !name.trim()}
      isPending={createMutation.isPending}
      error={createMutation.error}
    >
      <div>
        <label className="block text-xs text-[#858585] mb-1">
          角色 Key <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
          placeholder="如 Player0.ini"
        />
        <p className="text-xs text-[#666] mt-1">唯一标识符，对应 INI 文件名</p>
      </div>
      <div>
        <label className="block text-xs text-[#858585] mb-1">
          角色名称 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm focus:outline-none focus:border-focus-border"
          placeholder="输入角色名称"
        />
      </div>
    </CreateEntityModal>
  );
}
