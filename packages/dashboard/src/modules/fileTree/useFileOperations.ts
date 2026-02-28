/**
 * useFileOperations — 文件 CRUD 操作
 *
 * 职责：
 * - 创建文件夹 / 文件（乐观插入到树）
 * - 重命名（乐观更新节点名称）
 * - 删除（乐观移除节点，不等服务端递归完成）
 * - 移动/拖拽（乐观移动节点）
 * - 所有操作失败时回滚 + 局部刷新
 */

import { trpc } from "@miu2d/shared";
import { useCallback, useRef } from "react";
import type { FileTreeNode, FlatFileTreeNode } from "./types";
import { normalizeFileName } from "./types";

interface UseFileOperationsOptions {
  gameId: string | undefined;
  setTreeNodes: React.Dispatch<React.SetStateAction<FileTreeNode[]>>;
  updateNodeInTree: (
    nodes: FileTreeNode[],
    id: string,
    updater: (n: FileTreeNode) => FileTreeNode
  ) => FileTreeNode[];
  removeNodeFromTree: (nodes: FileTreeNode[], id: string) => FileTreeNode[];
  insertNodeInTree: (
    nodes: FileTreeNode[],
    parentId: string | null,
    node: FileTreeNode
  ) => FileTreeNode[];
  refreshFolder: (parentId: string | null) => Promise<void>;
}

export function useFileOperations({
  gameId,
  setTreeNodes,
  updateNodeInTree,
  removeNodeFromTree,
  insertNodeInTree,
  refreshFolder,
}: UseFileOperationsOptions) {
  const utils = trpc.useUtils();
  const createFolderMutation = trpc.file.createFolder.useMutation();
  const renameMutation = trpc.file.rename.useMutation();
  const deleteMutation = trpc.file.delete.useMutation();
  const moveMutation = trpc.file.move.useMutation();
  const prepareUploadMutation = trpc.file.prepareUpload.useMutation();
  const confirmUploadMutation = trpc.file.confirmUpload.useMutation();

  // 防止并发操作冲突
  const operationLock = useRef(false);

  // === 创建文件夹 ===
  const createFolder = useCallback(
    async (name: string, parentId: string | null) => {
      if (!gameId) return;
      const normalizedName = normalizeFileName(name);

      try {
        const result = await createFolderMutation.mutateAsync({
          gameId,
          parentId,
          name: normalizedName,
        });

        // 乐观插入新文件夹节点
        const newNode: FileTreeNode = {
          id: result.id,
          name: result.name,
          isDirectory: true,
          depth: 0, // 会被排序后正确计算
          isLoaded: true,
          children: [],
          parentId,
          gameId,
          path: result.path,
        };
        setTreeNodes((prev) => insertNodeInTree(prev, parentId, newNode));
      } catch (error) {
        // 刷新目录获取正确状态
        await refreshFolder(parentId);
        throw error;
      }
    },
    [gameId, createFolderMutation, setTreeNodes, insertNodeInTree, refreshFolder]
  );

  // === 创建空文件 ===
  const createFile = useCallback(
    async (name: string, parentId: string | null) => {
      if (!gameId) return;
      const normalizedName = normalizeFileName(name);

      try {
        const { fileId, uploadUrl } = await prepareUploadMutation.mutateAsync({
          gameId,
          parentId,
          name: normalizedName,
          size: 0,
          mimeType: "application/octet-stream",
        });

        const resp = await fetch(uploadUrl, {
          method: "PUT",
          body: new Blob([]),
          headers: { "Content-Type": "application/octet-stream" },
        });

        if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);

        await confirmUploadMutation.mutateAsync({ fileId });

        // 局部刷新获取正确节点
        await refreshFolder(parentId);
      } catch (error) {
        await refreshFolder(parentId);
        throw error;
      }
    },
    [gameId, prepareUploadMutation, confirmUploadMutation, refreshFolder]
  );

  // === 重命名 ===
  const renameNode = useCallback(
    async (node: FlatFileTreeNode, newName: string) => {
      const normalizedName = normalizeFileName(newName);
      const oldName = node.name;

      // 乐观更新
      setTreeNodes((prev) =>
        updateNodeInTree(prev, node.id, (n) => ({ ...n, name: normalizedName }))
      );

      try {
        await renameMutation.mutateAsync({ fileId: node.id, newName: normalizedName });
        // 刷新父目录以获取更新后的 path
        await refreshFolder(node.parentId);
      } catch {
        // 回滚
        setTreeNodes((prev) => updateNodeInTree(prev, node.id, (n) => ({ ...n, name: oldName })));
      }
    },
    [setTreeNodes, updateNodeInTree, renameMutation, refreshFolder]
  );

  // === 删除 ===
  const deleteNode = useCallback(
    async (node: FlatFileTreeNode) => {
      if (operationLock.current) return;
      operationLock.current = true;

      // 保存快照用于回滚
      const snapshotRef = { current: null as FileTreeNode[] | null };
      setTreeNodes((prev) => {
        snapshotRef.current = prev;
        return prev;
      });

      // 乐观移除 — 立即从树中删除，不等服务端完成
      setTreeNodes((prev) => removeNodeFromTree(prev, node.id));
      // 注意：不在这里调用 clearSelection()，避免对话框因 selectedNode 变 null 而提前消失

      try {
        await deleteMutation.mutateAsync({ fileId: node.id });
        // 成功：直接更新 React Query 缓存，避免 refreshFolder 带回尚未完成删除的节点
        // （服务端递归删除大目录时可能有延迟）
        if (gameId) {
          utils.file.list.setData({ gameId, parentId: node.parentId }, (old) =>
            old ? old.filter((item) => item.id !== node.id) : old
          );
        }
      } catch {
        // 回滚
        if (snapshotRef.current) {
          setTreeNodes(snapshotRef.current);
        }
      } finally {
        operationLock.current = false;
      }
    },
    [gameId, utils.file.list, setTreeNodes, removeNodeFromTree, deleteMutation]
  );

  // === 移动（拖拽） ===
  const moveNode = useCallback(
    async (nodeId: string, newParentId: string | null) => {
      // 防止并发移动导致树状态错乱
      if (operationLock.current) return;
      operationLock.current = true;

      // 乐观：先移除再插入
      let movedNode: FileTreeNode | null = null;
      let oldParentId: string | null = null;

      setTreeNodes((prev) => {
        // 找到节点及其父节点 ID
        const findNode = (
          nodes: FileTreeNode[],
          parentId: string | null
        ): [FileTreeNode | null, string | null] => {
          for (const n of nodes) {
            if (n.id === nodeId) return [n, parentId];
            if (n.children) {
              const [found, pid] = findNode(n.children, n.id);
              if (found) return [found, pid];
            }
          }
          return [null, null];
        };
        [movedNode, oldParentId] = findNode(prev, null);
        if (!movedNode) return prev;

        const withoutNode = removeNodeFromTree(prev, nodeId);
        return insertNodeInTree(withoutNode, newParentId, movedNode);
      });

      try {
        await moveMutation.mutateAsync({ fileId: nodeId, newParentId });

        // ★ 关键修复：移动成功后先让缓存失效，确保 refreshFolder 拿到服务端最新数据。
        // 全局 staleTime=5min，若不主动失效，fetch 会直接返回 5 分钟内的旧缓存，
        // 导致"树不刷新"或"旧目录旧数据覆盖乐观更新"等问题。
        if (gameId) {
          await utils.file.list.invalidate({ gameId, parentId: newParentId });
          if (oldParentId !== newParentId) {
            await utils.file.list.invalidate({ gameId, parentId: oldParentId });
          }
        }

        // 刷新 source 和 target 目录（此时缓存已失效，一定会发起网络请求）
        await refreshFolder(newParentId);
        if (oldParentId !== newParentId) {
          await refreshFolder(oldParentId);
        }
      } catch {
        // 回滚：把节点移回原位
        if (movedNode) {
          setTreeNodes((prev) => {
            const withoutNode = removeNodeFromTree(prev, nodeId);
            return insertNodeInTree(withoutNode, oldParentId, movedNode!);
          });
        }
      } finally {
        operationLock.current = false;
      }
    },
    [gameId, utils.file.list, setTreeNodes, removeNodeFromTree, insertNodeInTree, moveMutation, refreshFolder]
  );

  return {
    createFolder,
    createFile,
    renameNode,
    deleteNode,
    moveNode,
    isDeleting: deleteMutation.isPending,
  };
}
