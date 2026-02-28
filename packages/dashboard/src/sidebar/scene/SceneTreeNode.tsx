/**
 * 单个场景的树节点
 */

import { trpc, useToast } from "@miu2d/shared";
import type { SceneItemKind, SceneListItem } from "@miu2d/types";
import { useCallback, useState } from "react";
import { NavLink } from "react-router-dom";
import { DashboardIcons } from "../../icons";
import { ContextMenu } from "../../modules/fileTree/ContextMenu";
import { SceneKindGroup } from "./SceneKindGroup";
import { type ContextMenuState, kindOrder } from "./scene-list-constants";

export function SceneTreeNode({
  scene,
  basePath,
  isActive,
  isExpanded,
  expandedKinds,
  onToggle,
  onToggleKind,
  gameId,
  confirmDeleteSceneId,
  onConfirmDelete,
  onDeleteScene,
  isDeleting,
  onRefetch,
}: {
  scene: SceneListItem;
  basePath: string;
  isActive: boolean;
  isExpanded: boolean;
  expandedKinds: Set<string>;
  onToggle: () => void;
  onToggleKind: (key: string) => void;
  onNavigate: () => void;
  gameId: string;
  confirmDeleteSceneId: string | null;
  onConfirmDelete: (id: string | null) => void;
  onDeleteScene: (id: string) => void;
  isDeleting: boolean;
  onRefetch: () => void;
}) {
  const counts: Record<SceneItemKind, number> = {
    script: scene.scriptCount,
    trap: scene.trapCount,
    npc: scene.npcCount,
    obj: scene.objCount,
  };

  /** 获取分类下的子项 key 列表 */
  const getItemKeys = (kind: SceneItemKind): string[] => {
    switch (kind) {
      case "script":
        return scene.scriptKeys;
      case "trap":
        return scene.trapKeys;
      case "npc":
        return scene.npcKeys;
      case "obj":
        return scene.objKeys;
    }
  };

  const isConfirmingDelete = confirmDeleteSceneId === scene.id;
  const [sceneContextMenu, setSceneContextMenu] = useState<ContextMenuState | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(scene.name);
  const utils = trpc.useUtils();
  const toast = useToast();

  const renameMutation = trpc.scene.update.useMutation({
    onSuccess: () => {
      toast.success("已重命名");
      setIsRenaming(false);
      utils.scene.list.invalidate({ gameId });
      onRefetch();
    },
    onError: (err) => toast.error(`重命名失败: ${err.message}`),
  });

  const handleRename = useCallback(() => {
    const trimmed = renameName.trim();
    if (!trimmed || trimmed === scene.name) {
      setIsRenaming(false);
      setRenameName(scene.name);
      return;
    }
    renameMutation.mutate({ gameId, id: scene.id, name: trimmed });
  }, [renameName, scene.name, scene.id, gameId, renameMutation]);

  return (
    <div>
      {/* 场景名称 (Level 1) */}
      <div className="flex items-center">
        <button type="button" onClick={onToggle} className="shrink-0 p-0.5 ml-1">
          <span
            className={`text-[#858585] text-xs transition-transform inline-block ${isExpanded ? "rotate-90" : ""}`}
          >
            {DashboardIcons.chevronRight}
          </span>
        </button>
        {isRenaming ? (
          <input
            autoFocus
            className="flex-1 bg-[#3c3c3c] border border-focus-border rounded px-1.5 py-0.5 text-sm text-[#cccccc] outline-none mx-1 min-w-0"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") {
                setIsRenaming(false);
                setRenameName(scene.name);
              }
            }}
            onBlur={handleRename}
          />
        ) : (
          <NavLink
            to={`${basePath}/${scene.id}`}
            className={`flex-1 flex items-center gap-1.5 py-1 pr-2 text-sm transition-colors truncate ${
              isActive ? "bg-[#37373d] text-white" : "hover:bg-[#2a2d2e] text-[#cccccc]"
            }`}
            onClick={() => {
              if (!isExpanded) {
                onToggle();
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setSceneContextMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            <span className="text-[#858585]">{DashboardIcons.map}</span>
            <span className="truncate">{scene.name}</span>
          </NavLink>
        )}
      </div>

      {/* 右键菜单 */}
      {sceneContextMenu && (
        <ContextMenu
          x={sceneContextMenu.x}
          y={sceneContextMenu.y}
          onClose={() => setSceneContextMenu(null)}
          items={[
            { label: scene.name, disabled: true, onClick: () => {} },
            { label: "", divider: true, onClick: () => {} },
            {
              label: "重命名",
              onClick: () => {
                setIsRenaming(true);
                setRenameName(scene.name);
              },
            },
            { label: "删除", danger: true, onClick: () => onConfirmDelete(scene.id) },
          ]}
        />
      )}

      {/* 删除确认条 */}
      {isConfirmingDelete && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-[#3c1f1f] border-y border-[#5c2020] text-xs">
          <span className="text-red-300 flex-1 truncate">确认删除「{scene.name}」？</span>
          <button
            type="button"
            onClick={() => onDeleteScene(scene.id)}
            disabled={isDeleting}
            className="px-2 py-0.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs transition-colors"
          >
            {isDeleting ? "..." : "删除"}
          </button>
          <button
            type="button"
            onClick={() => onConfirmDelete(null)}
            className="px-2 py-0.5 text-[#999] hover:text-white transition-colors"
          >
            取消
          </button>
        </div>
      )}

      {/* 展开后显示分类 (Level 2 + 3) */}
      {isExpanded && (
        <div>
          {kindOrder.map((kind) => {
            const count = counts[kind];
            const kindKey = `${scene.id}_${kind}`;
            const itemKeys = getItemKeys(kind);

            return (
              <SceneKindGroup
                key={kind}
                kind={kind}
                count={count}
                isExpanded={expandedKinds.has(kindKey)}
                onToggle={() => onToggleKind(kindKey)}
                sceneId={scene.id}
                basePath={basePath}
                itemKeys={itemKeys}
                gameId={gameId}
                onRefetch={onRefetch}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
