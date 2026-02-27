/**
 * 玩家角色列表侧边栏面板
 * 支持从 save/game/ 目录导入 PlayerX.ini + MagicX.ini + GoodsX.ini
 */

import { trpc } from "@miu2d/shared";
import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BatchItemRow,
  CreateEntityModal,
  ImportIniModal,
  readDroppedFiles,
} from "../components/common";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

/** 批量导入项：包含 PlayerX.ini + 对应的 MagicX.ini / GoodsX.ini */
interface PlayerImportItem {
  fileName: string;
  iniContent: string;
  magicIniContent?: string;
  goodsIniContent?: string;
}

export function PlayerListPanel({ basePath }: { basePath: string }) {
  const { currentGame } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    data: playerList,
    isLoading,
    refetch,
  } = trpc.player.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  const batchImportMutation = trpc.player.batchImportFromIni.useMutation({
    onSuccess: (result) => {
      refetch();
      setShowImportModal(false);
      if (result.success.length > 0) {
        navigate(`${basePath}/${result.success[0].id}`);
      }
      // 显示导入警告（武功/物品引用未匹配）
      if (result.warnings && result.warnings.length > 0) {
        const warnText = result.warnings.join("\n");
        console.warn("[Player Import Warnings]", warnText);
        alert(`导入成功，但有 ${result.warnings.length} 条引用警告：\n\n${warnText}`);
      }
    },
  });

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
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.upload}
            <span>从 INI 导入</span>
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

      {/* INI 导入模态框 */}
      {showImportModal && (
        <ImportIniModal<PlayerImportItem>
          title="从 INI 导入角色"
          icon="🎮"
          dropHint="拖放 save/game/ 目录到此处"
          dropSubHint="自动匹配 PlayerX.ini + MagicX.ini + GoodsX.ini"
          entityLabel="角色"
          onClose={() => setShowImportModal(false)}
          onImport={(items) =>
            batchImportMutation.mutate({
              gameId: gameId!,
              items,
              clearBeforeImport: true,
            })
          }
          isLoading={batchImportMutation.isPending}
          batchResult={batchImportMutation.data ?? null}
          processFiles={async (dt) => {
            // 读取所有 .ini 文件
            const allFiles = await readDroppedFiles(dt, (name) =>
              /\.(ini)$/i.test(name)
            );

            // 按文件名分类
            const playerFiles = new Map<number, string>(); // index → iniContent
            const magicFiles = new Map<number, string>();
            const goodsFiles = new Map<number, string>();
            const playerFileNames = new Map<number, string>(); // index → fileName

            for (const f of allFiles) {
              const playerMatch = f.fileName.match(/^Player(\d+)\.ini$/i);
              if (playerMatch) {
                const idx = parseInt(playerMatch[1], 10);
                playerFiles.set(idx, f.content);
                playerFileNames.set(idx, f.fileName);
                continue;
              }
              const magicMatch = f.fileName.match(/^Magic(\d+)\.ini$/i);
              if (magicMatch) {
                const idx = parseInt(magicMatch[1], 10);
                magicFiles.set(idx, f.content);
                continue;
              }
              const goodsMatch = f.fileName.match(/^Goods(\d+)\.ini$/i);
              if (goodsMatch) {
                const idx = parseInt(goodsMatch[1], 10);
                goodsFiles.set(idx, f.content);
                continue;
              }
            }

            // 组装：Player + 对应 Magic + Goods
            const items: PlayerImportItem[] = [];
            for (const [idx, iniContent] of [...playerFiles.entries()].sort(
              (a, b) => a[0] - b[0]
            )) {
              items.push({
                fileName: playerFileNames.get(idx) ?? `Player${idx}.ini`,
                iniContent,
                magicIniContent: magicFiles.get(idx),
                goodsIniContent: goodsFiles.get(idx),
              });
            }
            return items;
          }}
          renderItem={(item, _i, onRemove) => (
            <BatchItemRow
              key={item.fileName}
              fileName={item.fileName}
              onRemove={onRemove}
              badge={
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                  角色
                </span>
              }
              extra={
                <span className="text-xs text-[#858585] ml-1">
                  {item.magicIniContent ? "⚔️武功" : ""}
                  {item.magicIniContent && item.goodsIniContent ? " · " : ""}
                  {item.goodsIniContent ? "🎒物品" : ""}
                </span>
              }
            />
          )}
          renderSuccessItem={(s) => (
            <>
              Player{(s as { index?: number }).index} - {s.name || s.fileName}
            </>
          )}
          description={
            <div className="text-xs text-[#858585] bg-[#1e1e1e] p-3 rounded">
              <p className="mb-1">支持拖入以下文件或目录：</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>
                  <code className="text-[#ce9178]">save/game/</code> 目录 - 自动匹配所有角色
                </li>
                <li>
                  <code className="text-[#ce9178]">Player0.ini</code> +{" "}
                  <code className="text-[#ce9178]">Magic0.ini</code> +{" "}
                  <code className="text-[#ce9178]">Goods0.ini</code>
                </li>
              </ul>
              <p className="mt-2 text-yellow-400/80">
                ⚠️ 导入将清空现有所有角色数据后重新导入
              </p>
            </div>
          }
        />
      )}

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
