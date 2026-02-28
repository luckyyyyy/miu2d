/**
 * 分类下的子项列表 (Level 3) — 直接从 scene 数据派生，无需 API 请求
 */

import { trpc, useToast } from "@miu2d/shared";
import type { SceneData, SceneItemKind } from "@miu2d/types";
import { useCallback, useState } from "react";
import { NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DashboardIcons } from "../../icons";
import { ContextMenu } from "../../modules/fileTree/ContextMenu";
import { buildSearchParams } from "./scene-list-constants";

export function SceneKindItems({
  sceneId,
  kind,
  basePath,
  itemKeys,
  gameId,
  onRefetch,
}: {
  sceneId: string;
  kind: SceneItemKind;
  basePath: string;
  itemKeys: string[];
  gameId: string;
  onRefetch: () => void;
}) {
  const { sceneId: activeSceneId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [itemContextMenu, setItemContextMenu] = useState<{
    key: string;
    x: number;
    y: number;
  } | null>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const utils = trpc.useUtils();
  const toast = useToast();

  const updateMutation = trpc.scene.update.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      setConfirmDeleteKey(null);
      utils.scene.get.invalidate({ gameId, id: sceneId });
      utils.scene.list.invalidate({ gameId });
      onRefetch();
    },
    onError: (err) => {
      toast.error(`删除失败: ${err.message}`);
      setConfirmDeleteKey(null);
    },
  });

  const renameMutation = trpc.scene.update.useMutation({
    onSuccess: () => {
      toast.success("已重命名");
      setRenamingKey(null);
      utils.scene.get.invalidate({ gameId, id: sceneId });
      utils.scene.list.invalidate({ gameId });
      onRefetch();
    },
    onError: (err) => toast.error(`重命名失败: ${err.message}`),
  });

  // 获取当前场景完整数据 — 删除或重命名时需要
  const { data: scene } = trpc.scene.get.useQuery(
    { gameId, id: sceneId },
    { enabled: confirmDeleteKey !== null || renamingKey !== null },
  );

  /** 删除子项文件（从 scene.data JSONB 中移除该 key） */
  const handleDeleteItem = useCallback(
    (key: string) => {
      if (!scene) return;

      const sceneData = (scene.data ?? {}) as SceneData;
      const newData: SceneData = { ...sceneData };

      if (kind === "script") {
        const { [key]: _, ...rest } = sceneData.scripts ?? {};
        newData.scripts = rest;
      } else if (kind === "trap") {
        const { [key]: _, ...rest } = sceneData.traps ?? {};
        newData.traps = rest;
      } else if (kind === "npc") {
        const { [key]: _, ...rest } = sceneData.npc ?? {};
        newData.npc = rest;
      } else {
        const { [key]: _, ...rest } = sceneData.obj ?? {};
        newData.obj = rest;
      }

      updateMutation.mutate({ gameId, id: sceneId, data: newData as Record<string, unknown> });

      // 如果删除的恰好是当前正选中的子项，清除对应 URL 参数
      const currentNpcKey = searchParams.get("npcKey");
      const currentObjKey = searchParams.get("objKey");
      const currentScriptKey = searchParams.get("scriptKey");
      const currentTrapKey = searchParams.get("trapKey");
      if (
        (kind === "script" && currentScriptKey === key) ||
        (kind === "trap" && currentTrapKey === key) ||
        (kind === "npc" && currentNpcKey === key) ||
        (kind === "obj" && currentObjKey === key)
      ) {
        navigate(`${basePath}/${sceneId}`);
      }
    },
    [scene, kind, gameId, sceneId, updateMutation, searchParams, navigate, basePath],
  );

  /** 重命名子项文件（在 scene.data JSONB 中换 key） */
  const handleRenameItem = useCallback(
    (oldKey: string) => {
      if (!scene) return;
      const newKey = renameValue.trim();
      if (!newKey || newKey === oldKey) {
        setRenamingKey(null);
        return;
      }

      const sceneData = (scene.data ?? {}) as SceneData;
      const newData: SceneData = { ...sceneData };

      if (kind === "script" || kind === "trap") {
        const field = kind === "trap" ? "traps" : "scripts";
        const bucket = sceneData[field] ?? {};
        if (newKey !== oldKey && bucket[newKey]) {
          toast.error("同名文件已存在");
          return;
        }
        const { [oldKey]: content, ...rest } = bucket;
        newData[field] = { ...rest, [newKey]: content ?? "" };
      } else if (kind === "npc") {
        const bucket = sceneData.npc ?? {};
        if (newKey !== oldKey && bucket[newKey]) {
          toast.error("同名文件已存在");
          return;
        }
        const { [oldKey]: entry, ...rest } = bucket;
        newData.npc = { ...rest, [newKey]: entry ?? { key: newKey, entries: [] } };
      } else {
        const bucket = sceneData.obj ?? {};
        if (newKey !== oldKey && bucket[newKey]) {
          toast.error("同名文件已存在");
          return;
        }
        const { [oldKey]: entry, ...rest } = bucket;
        newData.obj = { ...rest, [newKey]: entry ?? { key: newKey, entries: [] } };
      }

      renameMutation.mutate({ gameId, id: sceneId, data: newData as Record<string, unknown> });
    },
    [scene, renameValue, kind, gameId, sceneId, renameMutation, toast],
  );

  if (itemKeys.length === 0) {
    return <div className="pl-12 py-0.5 text-xs text-[#555]">暂无</div>;
  }

  /** 渲染单个子项（右键菜单 + 内联重命名 + 确认删除） */
  const renderItem = (key: string, isActive: boolean, qs: string) => (
    <div key={key}>
      {renamingKey === key ? (
        <div className="flex items-center gap-1 px-1 py-0.5" style={{ paddingLeft: 44 }}>
          <input
            autoFocus
            className="flex-1 bg-[#3c3c3c] border border-focus-border rounded px-1.5 py-0.5 text-xs text-[#cccccc] outline-none min-w-0"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameItem(key);
              if (e.key === "Escape") setRenamingKey(null);
            }}
            onBlur={() => handleRenameItem(key)}
          />
        </div>
      ) : (
        <NavLink
          to={`${basePath}/${sceneId}?${qs}`}
          className={`flex items-center gap-1.5 py-0.5 pr-2 text-xs transition-colors truncate ${
            isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e] text-[#999]"
          }`}
          style={{ paddingLeft: 48 }}
          onContextMenu={(e) => {
            e.preventDefault();
            setItemContextMenu({ key, x: e.clientX, y: e.clientY });
          }}
        >
          <span className="text-[#666]">{DashboardIcons.file}</span>
          <span className="truncate">{key}</span>
        </NavLink>
      )}
      {/* 删除确认 */}
      {confirmDeleteKey === key && (
        <div
          className="flex items-center gap-1 px-2 py-1 bg-[#3c1f1f] text-xs"
          style={{ paddingLeft: 48 }}
        >
          <span className="text-red-300 flex-1 truncate">确认删除？</span>
          <button
            type="button"
            onClick={() => handleDeleteItem(key)}
            disabled={updateMutation.isPending}
            className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs transition-colors"
          >
            {updateMutation.isPending ? "..." : "删除"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteKey(null)}
            className="px-1.5 py-0.5 text-[#999] hover:text-white transition-colors"
          >
            取消
          </button>
        </div>
      )}
    </div>
  );

  /** 共享的右键菜单（名称 + 分割线 + 重命名 + 删除） */
  const renderContextMenu = () =>
    itemContextMenu ? (
      <ContextMenu
        x={itemContextMenu.x}
        y={itemContextMenu.y}
        onClose={() => setItemContextMenu(null)}
        items={[
          { label: itemContextMenu.key, disabled: true, onClick: () => {} },
          { label: "", divider: true, onClick: () => {} },
          {
            label: "重命名",
            onClick: () => {
              setRenamingKey(itemContextMenu.key);
              setRenameValue(itemContextMenu.key);
            },
          },
          { label: "删除", danger: true, onClick: () => setConfirmDeleteKey(itemContextMenu.key) },
        ]}
      />
    ) : null;

  // NPC/OBJ/Script/Trap: 统一使用独立 key 参数
  const paramName =
    kind === "npc"
      ? "npcKey"
      : kind === "obj"
        ? "objKey"
        : kind === "script"
          ? "scriptKey"
          : "trapKey";
  const activeKey = searchParams.get(paramName);
  return (
    <>
      {itemKeys.map((key) => {
        const isActive = activeSceneId === sceneId && activeKey === key;
        const qs = buildSearchParams(searchParams, kind, key);
        return renderItem(key, isActive, qs);
      })}
      {renderContextMenu()}
    </>
  );
}
