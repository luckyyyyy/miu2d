/**
 * 分类组 (脚本/陷阱/NPC/物件)
 */

import { trpc, useToast } from "@miu2d/shared";
import type { SceneData, SceneItemKind } from "@miu2d/types";
import { useCallback, useState } from "react";
import { DashboardIcons } from "../../icons";
import { ContextMenu } from "../../modules/fileTree/ContextMenu";
import { SceneKindItems } from "./SceneKindItems";
import { type ContextMenuState, kindIcons, kindLabels } from "./scene-list-constants";

export function SceneKindGroup({
  kind,
  count,
  isExpanded,
  onToggle,
  sceneId,
  basePath,
  itemKeys,
  gameId,
  onRefetch,
}: {
  kind: SceneItemKind;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  sceneId: string;
  basePath: string;
  itemKeys: string[];
  gameId: string;
  onRefetch: () => void;
}) {
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState("");
  const [kindContextMenu, setKindContextMenu] = useState<ContextMenuState | null>(null);
  const utils = trpc.useUtils();
  const toast = useToast();

  // 获取当前场景完整数据（用于构建更新后的 data）
  const { data: scene } = trpc.scene.get.useQuery(
    { gameId, id: sceneId },
    { enabled: showNewInput },
  );

  const updateMutation = trpc.scene.update.useMutation({
    onSuccess: () => {
      toast.success("已新建");
      setShowNewInput(false);
      setNewName("");
      utils.scene.get.invalidate({ gameId, id: sceneId });
      utils.scene.list.invalidate({ gameId });
      onRefetch();
    },
    onError: (err) => toast.error(`新建失败: ${err.message}`),
  });

  /** 新建子项文件（在 scene.data 中添加 key） */
  const handleCreate = useCallback(() => {
    if (!newName.trim() || !scene) return;

    const sceneData = (scene.data ?? {}) as SceneData;
    const newData: SceneData = { ...sceneData };
    const fileName = newName.trim();
    if (kind === "script" || kind === "trap") {
      const field = kind === "trap" ? "traps" : "scripts";
      if (sceneData[field]?.[fileName]) {
        toast.error("同名文件已存在");
        return;
      }
      newData[field] = { ...(sceneData[field] ?? {}), [fileName]: "" };
    } else if (kind === "npc") {
      if (sceneData.npc?.[fileName]) {
        toast.error("同名文件已存在");
        return;
      }
      newData.npc = { ...(sceneData.npc ?? {}), [fileName]: { key: fileName, entries: [] } };
    } else {
      if (sceneData.obj?.[fileName]) {
        toast.error("同名文件已存在");
        return;
      }
      newData.obj = { ...(sceneData.obj ?? {}), [fileName]: { key: fileName, entries: [] } };
    }

    updateMutation.mutate({ gameId, id: sceneId, data: newData as Record<string, unknown> });
  }, [newName, scene, kind, gameId, sceneId, updateMutation, toast]);

  return (
    <div>
      {/* 分类标题 — 右键菜单新建 */}
      <button
        type="button"
        onClick={onToggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setKindContextMenu({ x: e.clientX, y: e.clientY });
        }}
        className="flex w-full items-center gap-1 py-0.5 pr-2 text-left text-xs hover:bg-[#2a2d2e] transition-colors"
        style={{ paddingLeft: 28 }}
      >
        <span
          className={`text-[#858585] text-xs transition-transform inline-block ${isExpanded ? "rotate-90" : ""}`}
        >
          {DashboardIcons.chevronRight}
        </span>
        <span className="text-[#858585]">{DashboardIcons[kindIcons[kind]]}</span>
        <span className="text-[#cccccc]">{kindLabels[kind]}</span>
        <span className="text-[#555] ml-auto">{count}</span>
      </button>

      {/* 右键菜单 */}
      {kindContextMenu && (
        <ContextMenu
          x={kindContextMenu.x}
          y={kindContextMenu.y}
          onClose={() => setKindContextMenu(null)}
          items={[
            { label: kindLabels[kind], disabled: true, onClick: () => {} },
            { label: "", divider: true, onClick: () => {} },
            {
              label: `新建${kindLabels[kind]}`,
              onClick: () => {
                setShowNewInput(true);
                if (!isExpanded) onToggle();
              },
            },
          ]}
        />
      )}

      {/* 新建输入框 */}
      {showNewInput && (
        <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: 48 }}>
          <input
            autoFocus
            className="flex-1 bg-[#3c3c3c] border border-[#555] rounded px-1.5 py-0.5 text-xs text-[#cccccc] outline-none focus:border-focus-border min-w-0"
            placeholder={`文件名`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setShowNewInput(false);
                setNewName("");
              }
            }}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || updateMutation.isPending}
            className="text-xs text-[#0098ff] hover:text-[#1177bb] disabled:opacity-30 transition-colors"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewInput(false);
              setNewName("");
            }}
            className="text-xs text-[#666] hover:text-[#ccc] transition-colors"
          >
            ✗
          </button>
        </div>
      )}

      {isExpanded && (
        <SceneKindItems
          sceneId={sceneId}
          kind={kind}
          basePath={basePath}
          itemKeys={itemKeys}
          gameId={gameId}
          onRefetch={onRefetch}
        />
      )}
    </div>
  );
}
