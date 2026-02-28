/**
 * 场景列表侧边栏面板
 * 3 层树形结构：场景 → 分类(脚本/陷阱/NPC/物件) → 子项
 *
 * 子项数据全部来自 scene.data（不再调用 listItems API）
 * URL 参数: ?kind=script&key=fileName / ?kind=npc
 *
 * 支持操作：
 * - 删除场景（从数据库删除）
 * - 删除子项文件（从 scene.data JSONB 中删除 key）
 * - 新建子项文件（在 scene.data JSONB 中新增 key）
 */

import { trpc, useToast } from "@miu2d/shared";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useDashboard } from "../../DashboardContext";
import { DashboardIcons } from "../../icons";
import { SceneEntryListPanels } from "./SceneEntryListPanels";
import { SceneTreeNode } from "./SceneTreeNode";

export function SceneListPanel({ basePath }: { basePath: string }) {
  const { currentGame, setShowImportAll } = useDashboard();
  const navigate = useNavigate();
  const { sceneId: activeSceneId } = useParams();
  const [searchParams] = useSearchParams();
  const gameId = currentGame?.id;
  const toast = useToast();

  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set());
  /** 正在确认删除的场景 ID */
  const [confirmDeleteSceneId, setConfirmDeleteSceneId] = useState<string | null>(null);

  // 根据 URL 参数自动展开树节点
  useEffect(() => {
    if (!activeSceneId) return;
    setExpandedScenes((prev) => {
      if (prev.has(activeSceneId)) return prev;
      const next = new Set(prev);
      next.add(activeSceneId);
      return next;
    });

    const kind = searchParams.get("kind");
    const npcKey = searchParams.get("npcKey");
    const objKey = searchParams.get("objKey");

    setExpandedKinds((prev) => {
      const next = new Set(prev);
      let changed = false;
      if (npcKey) {
        const npcKindKey = `${activeSceneId}_npc`;
        if (!next.has(npcKindKey)) {
          next.add(npcKindKey);
          changed = true;
        }
      }
      if (objKey) {
        const objKindKey = `${activeSceneId}_obj`;
        if (!next.has(objKindKey)) {
          next.add(objKindKey);
          changed = true;
        }
      }
      if (kind === "script" || kind === "trap") {
        const kindKey = `${activeSceneId}_${kind}`;
        if (!next.has(kindKey)) {
          next.add(kindKey);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeSceneId, searchParams]);

  const {
    data: scenes,
    isLoading,
    refetch,
  } = trpc.scene.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  const toggleScene = useCallback((sceneId: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  }, []);

  const toggleKind = useCallback((key: string) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // 删除场景
  const deleteSceneMutation = trpc.scene.delete.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("场景已删除");
      refetch();
      setConfirmDeleteSceneId(null);
      // 如果删除的是当前正在查看的场景，跳回场景首页
      if (activeSceneId === variables.id) {
        navigate(basePath);
      }
    },
    onError: (err) => {
      toast.error(`删除失败: ${err.message}`);
      setConfirmDeleteSceneId(null);
    },
  });

  const handleDeleteScene = useCallback(
    (sceneId: string) => {
      if (!gameId) return;
      deleteSceneMutation.mutate({ gameId, id: sceneId });
    },
    [gameId, deleteSceneMutation],
  );

  return (
    <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
      {/* 标题栏 */}
      <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border shrink-0">
        <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">场景编辑</span>
        <button
          type="button"
          onClick={() => setShowImportAll(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-[#cccccc] hover:bg-[#3c3c3c] transition-colors"
          title="批量导入"
        >
          {DashboardIcons.upload}
          <span>导入</span>
        </button>
      </div>

      {/* 场景列表 */}
      <div className="flex-1 overflow-y-auto py-1 min-h-0">
        {isLoading ? (
          <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
        ) : !scenes || scenes.length === 0 ? (
          <div className="px-4 py-3 text-center">
            <p className="text-sm text-[#858585] mb-2">暂无场景数据</p>
            <button
              type="button"
              onClick={() => setShowImportAll(true)}
              className="text-xs text-[#0098ff] hover:text-[#1177bb] transition-colors"
            >
              点击批量导入
            </button>
          </div>
        ) : (
          scenes.map((scene) => (
            <SceneTreeNode
              key={scene.id}
              scene={scene}
              basePath={basePath}
              isActive={activeSceneId === scene.id}
              isExpanded={expandedScenes.has(scene.id)}
              expandedKinds={expandedKinds}
              onToggle={() => toggleScene(scene.id)}
              onToggleKind={toggleKind}
              onNavigate={() => navigate(`${basePath}/${scene.id}`)}
              gameId={gameId!}
              confirmDeleteSceneId={confirmDeleteSceneId}
              onConfirmDelete={setConfirmDeleteSceneId}
              onDeleteScene={handleDeleteScene}
              isDeleting={deleteSceneMutation.isPending}
              onRefetch={refetch}
            />
          ))
        )}
      </div>

      {/* 底部 NPC/OBJ 条目列表面板 */}
      {activeSceneId && gameId && <SceneEntryListPanels sceneId={activeSceneId} gameId={gameId} />}
    </div>
  );
}
