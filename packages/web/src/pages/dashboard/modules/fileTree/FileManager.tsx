/**
 * 文件管理器组件
 * 左侧：VSCode 风格目录树
 * 右侧：文件预览（ASF/MAP/文本等）
 */
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { trpc } from "../../../../lib/trpc";
import { useDashboard } from "../../DashboardContext";
import {
  FileTree,
  ContextMenu,
  UploadQueue,
  InputDialog,
  ConfirmDialog,
  FilePreview,
  type FileTreeNode,
  type FlatFileTreeNode,
  type ExpandedState,
  fileNodesToTreeNodes,
  normalizeFileName,
} from "../fileTree";

interface UploadItem {
  id: string;
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

export function FileManager() {
  const { currentGame } = useDashboard();
  const utils = trpc.useUtils();
  const [searchParams, setSearchParams] = useSearchParams();

  // 从 URL 读取初始选中的文件路径
  const initialFilePath = searchParams.get("file");

  // 树状态
  const [treeNodes, setTreeNodes] = useState<FileTreeNode[]>([]);
  const [expandedState, setExpandedState] = useState<ExpandedState>(() => new Set());
  const expandedStateRef = useRef(expandedState);
  expandedStateRef.current = expandedState; // 始终保持最新值
  const [selectedNode, setSelectedNode] = useState<FlatFileTreeNode | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // 刷新版本号，用于强制触发 useEffect
  const [refreshVersion, setRefreshVersion] = useState(0);

  // 是否已完成从 URL 恢复选中状态
  const [hasRestoredFromUrl, setHasRestoredFromUrl] = useState(false);

  // 对话框状态
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FlatFileTreeNode } | null>(null);

  // 上传状态
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessingDrop, setIsProcessingDrop] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mutations
  const createFolderMutation = trpc.file.createFolder.useMutation();
  const renameMutation = trpc.file.rename.useMutation();
  const deleteMutation = trpc.file.delete.useMutation();
  const moveMutation = trpc.file.move.useMutation();
  const prepareUploadMutation = trpc.file.prepareUpload.useMutation();
  const confirmUploadMutation = trpc.file.confirmUpload.useMutation();
  const batchPrepareUploadMutation = trpc.file.batchPrepareUpload.useMutation();
  const batchConfirmUploadMutation = trpc.file.batchConfirmUpload.useMutation();
  const ensureFolderPathMutation = trpc.file.ensureFolderPath.useMutation();

  // 加载根目录
  const { data: rootFiles, isLoading, refetch: refetchRootFiles } = trpc.file.list.useQuery(
    { gameId: currentGame?.id ?? "", parentId: null },
    { enabled: !!currentGame?.id }
  );

  // 初始化根节点 - 当 rootFiles 变化时重建整个树
  useEffect(() => {
    if (!rootFiles || !currentGame?.id) return;

    const loadTree = async () => {
      const currentExpandedState = expandedStateRef.current;

      // 递归加载已展开的目录
      const loadExpandedNodes = async (nodes: FileTreeNode[], depth: number): Promise<FileTreeNode[]> => {
        const result: FileTreeNode[] = [];
        for (const node of nodes) {
          if (node.isDirectory && currentExpandedState.has(node.id)) {
            try {
              const children = await utils.file.list.fetch({
                gameId: currentGame.id,
                parentId: node.id,
              });
              const childNodes = fileNodesToTreeNodes(children, depth + 1);
              const loadedChildren = await loadExpandedNodes(childNodes, depth + 1);
              result.push({ ...node, isLoaded: true, children: loadedChildren });
            } catch {
              result.push(node);
            }
          } else {
            result.push(node);
          }
        }
        return result;
      };

      const rootNodes = fileNodesToTreeNodes(rootFiles, 0);
      const loadedNodes = await loadExpandedNodes(rootNodes, 0);
      setTreeNodes(loadedNodes);
    };

    loadTree();
  }, [rootFiles, currentGame?.id, utils.file.list]); // refreshVersion is intentionally used to force re-run

  // 从 URL 恢复选中状态
  useEffect(() => {
    if (!currentGame?.id || !initialFilePath || hasRestoredFromUrl || treeNodes.length === 0) return;

    const restoreFromUrl = async () => {
      // 解析路径，例如 "ini/magic/player.ini" -> ["ini", "magic", "player.ini"]
      const pathParts = initialFilePath.split("/").filter(Boolean);
      if (pathParts.length === 0) return;

      // 递归查找并展开路径
      let currentParentId: string | null = null;
      let currentNodes = treeNodes;
      const expandIds: string[] = [];

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        const isLast = i === pathParts.length - 1;

        // 在当前层级查找节点
        let foundNode = currentNodes.find((n) => n.name === part);

        // 如果没找到，可能需要先加载父目录
        if (!foundNode && currentParentId) {
          try {
            const children = await utils.file.list.fetch({
              gameId: currentGame.id,
              parentId: currentParentId,
            });
            currentNodes = fileNodesToTreeNodes(children, i);
            foundNode = currentNodes.find((n) => n.name === part);
          } catch {
            break;
          }
        }

        if (!foundNode) break;

        if (isLast) {
          // 最后一个节点，选中它
          // 更新展开状态（展开所有父目录）
          setExpandedState((prev) => {
            const next = new Set(prev);
            for (const id of expandIds) {
              next.add(id);
            }
            return next;
          });

          // 设置选中状态
          setSelectedNode({
            ...foundNode,
            isExpanded: false,
            parentId: currentParentId,
            flatIndex: 0,
          } as FlatFileTreeNode);
        } else if (foundNode.isDirectory) {
          // 中间节点，记录展开ID并继续
          expandIds.push(foundNode.id);
          currentParentId = foundNode.id;

          // 加载子节点
          if (!foundNode.children || !foundNode.isLoaded) {
            try {
              const children = await utils.file.list.fetch({
                gameId: currentGame.id,
                parentId: foundNode.id,
              });
              currentNodes = fileNodesToTreeNodes(children, i + 1);
            } catch {
              break;
            }
          } else {
            currentNodes = foundNode.children;
          }
        } else {
          // 中间节点是文件，无法继续
          break;
        }
      }

      // 触发刷新以加载展开的目录
      if (expandIds.length > 0) {
        setRefreshVersion((v) => v + 1);
      }

      setHasRestoredFromUrl(true);
    };

    restoreFromUrl();
  }, [currentGame?.id, initialFilePath, hasRestoredFromUrl, treeNodes, utils.file.list]);

  // 加载子目录
  const handleExpand = useCallback(async (node: FlatFileTreeNode) => {
    if (!currentGame?.id || node.isLoaded) return;

    const children = await utils.file.list.fetch({
      gameId: currentGame.id,
      parentId: node.id,
    });

    setTreeNodes((prev) => {
      const updateNode = (nodes: FileTreeNode[]): FileTreeNode[] => {
        return nodes.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              isLoaded: true,
              children: fileNodesToTreeNodes(children, node.depth + 1),
            };
          }
          if (n.children) {
            return { ...n, children: updateNode(n.children) };
          }
          return n;
        });
      };
      return updateNode(prev);
    });
  }, [currentGame?.id, utils.file.list]);

  // 刷新树
  const refreshTree = useCallback(async () => {
    if (!currentGame?.id) return;
    await utils.file.list.invalidate();
    await refetchRootFiles();
    setRefreshVersion((v) => v + 1);
  }, [currentGame?.id, utils.file.list, refetchRootFiles]);

  // 选择节点
  const handleSelect = useCallback((node: FlatFileTreeNode) => {
    setSelectedNode(node);
    // 更新 URL 参数
    if (node.path) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("file", node.path!);
        return next;
      }, { replace: true });
    }
  }, [setSearchParams]);

  // 右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent, node: FlatFileTreeNode) => {
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  // 新建文件夹
  const handleCreateFolder = useCallback(async (name: string) => {
    if (!currentGame?.id) return;

    try {
      await createFolderMutation.mutateAsync({
        gameId: currentGame.id,
        parentId: targetParentId,
        name: normalizeFileName(name),
      });
      await refreshTree();
    } finally {
      setShowNewFolderDialog(false);
    }
  }, [currentGame?.id, targetParentId, createFolderMutation, refreshTree]);

  // 新建文件（空文件）
  const handleCreateFile = useCallback(async (name: string) => {
    if (!currentGame?.id) return;

    try {
      const { fileId, uploadUrl } = await prepareUploadMutation.mutateAsync({
        gameId: currentGame.id,
        parentId: targetParentId,
        name: normalizeFileName(name),
        size: 0,
        mimeType: "application/octet-stream",
      });

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: new Blob([]),
        headers: { "Content-Type": "application/octet-stream" },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      await confirmUploadMutation.mutateAsync({ fileId });
      await refreshTree();
    } finally {
      setShowNewFileDialog(false);
    }
  }, [currentGame?.id, targetParentId, prepareUploadMutation, confirmUploadMutation, refreshTree]);

  // 重命名
  const handleRename = useCallback(async (node: FlatFileTreeNode, newName: string) => {
    await renameMutation.mutateAsync({
      fileId: node.id,
      newName: normalizeFileName(newName),
    });
    setRenamingId(null);
    await refreshTree();
  }, [renameMutation, refreshTree]);

  // 删除
  const handleDelete = useCallback(async () => {
    if (!selectedNode) return;

    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync({ fileId: selectedNode.id });
      setSelectedNode(null);
      // 清除 URL 参数
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("file");
        return next;
      }, { replace: true });
      await refreshTree();
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }, [selectedNode, deleteMutation, refreshTree, setSearchParams]);

  // 移动（拖拽）
  const handleMove = useCallback(async (nodeId: string, newParentId: string | null) => {
    await moveMutation.mutateAsync({ fileId: nodeId, newParentId });
    await refreshTree();
  }, [moveMutation, refreshTree]);

  /**
   * 递归读取 FileSystemEntry（支持文件夹）
   * 返回 { relativePath: string, file: File }[] 数组
   */
  const readEntries = useCallback(async (entry: FileSystemEntry, basePath = ""): Promise<{ relativePath: string; file: File }[]> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      return [{ relativePath: basePath + normalizeFileName(entry.name), file }];
    }

    if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const entries: FileSystemEntry[] = [];

      // 需要多次调用 readEntries 直到返回空数组
      let batch: FileSystemEntry[];
      do {
        batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });
        entries.push(...batch);
      } while (batch.length > 0);

      const results: { relativePath: string; file: File }[] = [];
      const folderPath = `${basePath + normalizeFileName(entry.name)}/`;

      for (const child of entries) {
        const childResults = await readEntries(child, folderPath);
        results.push(...childResults);
      }

      return results;
    }

    return [];
  }, []);

  /**
   * 处理拖拽的 DataTransfer，支持文件夹
   */
  const processDataTransfer = useCallback(async (dataTransfer: DataTransfer): Promise<{ relativePath: string; file: File }[]> => {
    const items = dataTransfer.items;
    const results: { relativePath: string; file: File }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== "file") continue;

      // 使用 webkitGetAsEntry 来获取 FileSystemEntry（支持文件夹）
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        const entryResults = await readEntries(entry);
        results.push(...entryResults);
      } else {
        // 降级：不支持 webkitGetAsEntry 的浏览器
        const file = item.getAsFile();
        if (file) {
          results.push({ relativePath: normalizeFileName(file.name), file });
        }
      }
    }

    return results;
  }, [readEntries]);

  /** S3 并发上传数量限制 */
  const S3_CONCURRENCY = 8;
  /** 批量 prepare/confirm 每批大小 */
  const BATCH_SIZE = 100;

  /**
   * 并发池：限制同时运行的 Promise 数量
   */
  const asyncPool = useCallback(async <T,>(
    items: T[],
    concurrency: number,
    fn: (item: T, index: number) => Promise<void>
  ): Promise<void> => {
    const executing = new Set<Promise<void>>();
    for (let i = 0; i < items.length; i++) {
      const p = fn(items[i], i).then(() => { executing.delete(p); });
      executing.add(p);
      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);
  }, []);

  /**
   * 上传单个文件到 S3（仅 PUT，不含 prepare/confirm）
   */
  const uploadFileToS3 = useCallback(async (
    file: File,
    uploadUrl: string,
    uploadItemId: string
  ): Promise<boolean> => {
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploads((prev) =>
              prev.map((u) => (u.id === uploadItemId ? { ...u, progress } : u))
            );
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });
      return true;
    } catch (error) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadItemId
            ? { ...u, status: "error", error: (error as Error).message }
            : u
        )
      );
      return false;
    }
  }, []);

  /**
   * 批量上传核心流程
   * 1. 收集唯一文件夹路径，通过 ensureFolderPath 在服务端创建
   * 2. 分批 batchPrepareUpload（跳过已存在文件）
   * 3. 并发上传到 S3（8 并发）
   * 4. 分批 batchConfirmUpload
   * 5. 上传完毕统一刷新树
   */
  const batchUploadFiles = useCallback(async (
    fileItems: Array<{ relativePath: string; file: File }>,
    rootParentId: string | null
  ) => {
    if (!currentGame?.id || fileItems.length === 0) return;

    // --- 1. 创建上传任务 UI ---
    const newUploads: UploadItem[] = fileItems.map((f, i) => ({
      id: `upload-${Date.now()}-${i}`,
      fileName: f.relativePath,
      progress: 0,
      status: "pending" as const,
    }));
    setUploads((prev) => [...prev, ...newUploads]);

    // --- 2. 收集唯一文件夹路径，服务端批量创建 ---
    const folderPaths = new Set<string>();
    for (const { relativePath } of fileItems) {
      const parts = relativePath.split("/");
      if (parts.length > 1) {
        // 收集所有中间路径: "a/b/c.txt" → "a", "a/b"
        const folderParts = parts.slice(0, -1);
        folderPaths.add(folderParts.join("/"));
      }
    }

    // 调用 ensureFolderPath（并发，4个一组）
    const folderIdCache = new Map<string, string>(); // "a/b" → folderId
    const uniquePaths = [...folderPaths].sort(); // 排序确保父目录先创建
    for (const folderPath of uniquePaths) {
      if (folderIdCache.has(folderPath)) continue;

      const pathParts = folderPath.split("/");

      // 检查是否有已缓存的padre前缀
      let bestParentId = rootParentId;
      let startIdx = 0;
      for (let i = pathParts.length - 1; i >= 1; i--) {
        const prefix = pathParts.slice(0, i).join("/");
        const cached = folderIdCache.get(prefix);
        if (cached) {
          bestParentId = cached;
          startIdx = i;
          break;
        }
      }

      const remainingParts = pathParts.slice(startIdx);
      if (remainingParts.length === 0) continue;

      try {
        const result = await ensureFolderPathMutation.mutateAsync({
          gameId: currentGame.id,
          parentId: bestParentId,
          pathParts: remainingParts,
        });
        folderIdCache.set(folderPath, result.folderId);

        // 也缓存所有中间路径
        for (let i = startIdx + 1; i < pathParts.length; i++) {
          // 中间路径的 folderId 无法从当前 API 获取，但最终路径是准确的
          // 不影响正确性，因为后续 ensureFolderPath 会在服务端检查
        }
      } catch (error) {
        console.error(`Failed to create folder path: ${folderPath}`, error);
      }
    }

    // --- 3. 为每个文件确定 parentId ---
    interface FileWithMeta {
      file: File;
      fileName: string;
      parentId: string | null;
      uploadItemId: string;
    }
    const filesToUpload: FileWithMeta[] = [];

    for (let i = 0; i < fileItems.length; i++) {
      const { relativePath, file } = fileItems[i];
      const parts = relativePath.split("/");
      const fileName = parts[parts.length - 1];
      let parentId = rootParentId;

      if (parts.length > 1) {
        const folderPath = parts.slice(0, -1).join("/");
        parentId = folderIdCache.get(folderPath) ?? rootParentId;
      }

      filesToUpload.push({
        file,
        fileName,
        parentId,
        uploadItemId: newUploads[i].id,
      });
    }

    // --- 4. 分批 batchPrepareUpload ---
    interface PreparedFile {
      meta: FileWithMeta;
      fileId: string;
      uploadUrl: string;
    }
    const preparedFiles: PreparedFile[] = [];
    let skippedCount = 0;

    for (let batchStart = 0; batchStart < filesToUpload.length; batchStart += BATCH_SIZE) {
      const batch = filesToUpload.slice(batchStart, batchStart + BATCH_SIZE);

      try {
        const { results } = await batchPrepareUploadMutation.mutateAsync({
          gameId: currentGame.id,
          files: batch.map((f) => ({
            clientId: f.uploadItemId,
            parentId: f.parentId,
            name: f.fileName,
            size: f.file.size,
            mimeType: f.file.type || "application/octet-stream",
          })),
          skipExisting: true,
        });

        for (const result of results) {
          const meta = batch.find((f) => f.uploadItemId === result.clientId);
          if (!meta) continue;

          if (result.skipped) {
            skippedCount++;
            setUploads((prev) =>
              prev.map((u) =>
                u.id === result.clientId
                  ? { ...u, status: "completed", progress: 100 }
                  : u
              )
            );
          } else {
            preparedFiles.push({
              meta,
              fileId: result.fileId,
              uploadUrl: result.uploadUrl,
            });
            setUploads((prev) =>
              prev.map((u) =>
                u.id === result.clientId
                  ? { ...u, status: "uploading" }
                  : u
              )
            );
          }
        }
      } catch (error) {
        // 标记整批失败
        for (const f of batch) {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === f.uploadItemId
                ? { ...u, status: "error", error: (error as Error).message }
                : u
            )
          );
        }
      }
    }

    // --- 5. 并发上传到 S3 ---
    const confirmedFileIds: string[] = [];
    const pendingConfirm: string[] = [];

    await asyncPool(preparedFiles, S3_CONCURRENCY, async (prepared) => {
      const success = await uploadFileToS3(
        prepared.meta.file,
        prepared.uploadUrl,
        prepared.meta.uploadItemId
      );

      if (success) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === prepared.meta.uploadItemId
              ? { ...u, status: "completed", progress: 100 }
              : u
          )
        );
        pendingConfirm.push(prepared.fileId);

        // 每累积 BATCH_SIZE 个就批量确认一次
        if (pendingConfirm.length >= BATCH_SIZE) {
          const toConfirm = pendingConfirm.splice(0, BATCH_SIZE);
          try {
            await batchConfirmUploadMutation.mutateAsync({ fileIds: toConfirm });
            confirmedFileIds.push(...toConfirm);
          } catch (error) {
            console.error("Batch confirm failed:", error);
          }
        }
      }
    });

    // --- 6. 确认剩余文件 ---
    if (pendingConfirm.length > 0) {
      try {
        await batchConfirmUploadMutation.mutateAsync({ fileIds: pendingConfirm });
        confirmedFileIds.push(...pendingConfirm);
      } catch (error) {
        console.error("Final batch confirm failed:", error);
      }
    }

    // --- 7. 完成后统一刷新树 ---
    setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.status !== "completed"));
    }, 2000);

    await refreshTree();
  }, [currentGame?.id, asyncPool, uploadFileToS3, batchPrepareUploadMutation, batchConfirmUploadMutation, ensureFolderPathMutation, refreshTree]);

  /**
   * 上传单个文件（兼容旧的单文件上传场景，如新建文件）
   */
  const uploadSingleFile = useCallback(async (
    file: File,
    parentId: string | null,
    uploadItemId: string
  ): Promise<void> => {
    if (!currentGame?.id) return;

    try {
      setUploads((prev) =>
        prev.map((u) => (u.id === uploadItemId ? { ...u, status: "uploading" } : u))
      );

      const { fileId, uploadUrl } = await prepareUploadMutation.mutateAsync({
        gameId: currentGame.id,
        parentId,
        name: normalizeFileName(file.name),
        size: file.size,
        mimeType: file.type || "application/octet-stream",
      });

      const success = await uploadFileToS3(file, uploadUrl, uploadItemId);

      if (success) {
        await confirmUploadMutation.mutateAsync({ fileId });
        setUploads((prev) =>
          prev.map((u) => (u.id === uploadItemId ? { ...u, status: "completed", progress: 100 } : u))
        );
      }

      await refreshTree();
    } catch (error) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadItemId
            ? { ...u, status: "error", error: (error as Error).message }
            : u
        )
      );
    }
  }, [currentGame?.id, prepareUploadMutation, confirmUploadMutation, uploadFileToS3, refreshTree]);

  /**
   * 处理拖拽上传（支持文件夹，批量并发）
   */
  const handleDropUpload = useCallback(async (dataTransfer: DataTransfer, targetParentId: string | null) => {
    if (!currentGame?.id) return;

    setIsProcessingDrop(true);
    let files: { relativePath: string; file: File }[];
    try {
      files = await processDataTransfer(dataTransfer);
    } finally {
      setIsProcessingDrop(false);
    }
    if (files.length === 0) return;

    await batchUploadFiles(files, targetParentId);
  }, [currentGame?.id, processDataTransfer, batchUploadFiles]);

  // 上传文件（通过文件选择器）
  const handleUpload = useCallback(async (files: FileList, parentId: string | null = null) => {
    if (!currentGame?.id) return;

    const fileItems = Array.from(files).map((file) => ({
      relativePath: normalizeFileName(file.name),
      file,
    }));

    await batchUploadFiles(fileItems, parentId);
  }, [currentGame?.id, batchUploadFiles]);

  // 拖拽状态（用于左侧目录树）
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [isTreeDragOver, setIsTreeDragOver] = useState(false);

  // 左侧目录树拖拽处理
  const handleTreeDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 检查是否是外部文件拖入
    if (e.dataTransfer.types.includes("Files")) {
      setIsTreeDragOver(true);
    }
  }, []);

  const handleTreeDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 确保是离开容器而不是进入子元素
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      setIsTreeDragOver(false);
      setDropTargetId(null);
    }
  }, []);

  const handleTreeDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsTreeDragOver(false);

    if (e.dataTransfer.types.includes("Files")) {
      // 上传到当前选中的目录或根目录
      const targetParent = selectedNode?.isDirectory ? selectedNode.id : selectedNode?.parentId ?? null;
      handleDropUpload(e.dataTransfer, targetParent);
    }
    setDropTargetId(null);
  }, [selectedNode, handleDropUpload]);

  // 右键菜单项
  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return [];

    const node = contextMenu.node;
    const items = [];

    if (node.isDirectory) {
      items.push({
        label: "新建文件夹",
        onClick: () => {
          setTargetParentId(node.id);
          setShowNewFolderDialog(true);
        },
      });
      items.push({
        label: "新建文件",
        onClick: () => {
          setTargetParentId(node.id);
          setShowNewFileDialog(true);
        },
      });
      items.push({ label: "", divider: true, onClick: () => {} });
    }

    items.push({
      label: "重命名",
      onClick: () => setRenamingId(node.id),
    });

    items.push({
      label: "删除",
      danger: true,
      onClick: () => {
        setSelectedNode(node);
        setShowDeleteDialog(true);
      },
    });

    return items;
  }, [contextMenu]);

  if (!currentGame) {
    return (
      <div className="h-full flex items-center justify-center text-[#666]">
        请先选择游戏空间
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#1e1e1e]">
      {/* 左侧：目录树 */}
      <div
        className={`w-[280px] flex flex-col border-r border-widget-border relative ${isTreeDragOver ? "bg-[#094771]/20" : ""}`}
        onDragOver={handleTreeDragOver}
        onDragLeave={handleTreeDragLeave}
        onDrop={handleTreeDrop}
      >
        {/* 拖拽提示 */}
        {isTreeDragOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-[#094771]/30 border-2 border-dashed border-[#0e639c]">
            <div className="text-center text-[#0e639c]">
              <div className="text-3xl mb-2">📥</div>
              <p className="text-sm">拖放文件/文件夹到此处上传</p>
            </div>
          </div>
        )}
        {/* 解析文件/文件夹中 */}
        {isProcessingDrop && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-[#1e1e1e]/70">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-[#0e639c] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-[#cccccc]">正在解析文件...</p>
            </div>
          </div>
        )}
        {/* 工具栏 */}
        <div className="flex items-center justify-end px-3 py-2 border-b border-widget-border bg-[#252526]">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setTargetParentId(selectedNode?.isDirectory ? selectedNode.id : selectedNode?.parentId ?? null);
                setShowNewFileDialog(true);
              }}
              className="p-1 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-white transition-colors"
              title="新建文件"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M9.5 1H4.5L4 1.5V4H2.5L2 4.5v10l.5.5h7l.5-.5V14H12.5l.5-.5V4l-3-3h-.5zM9 2.5l2.5 2.5H9V2.5zM3 5H4v8.5l.5.5H9v1H3V5zm6 9V10H6.5L6 9.5V6h3.5l.5-.5V2H5v7h4.5l.5.5V14H9z" />
              </svg>
            </button>
            <button
              onClick={() => {
                setTargetParentId(selectedNode?.isDirectory ? selectedNode.id : selectedNode?.parentId ?? null);
                setShowNewFolderDialog(true);
              }}
              className="p-1 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-white transition-colors"
              title="新建文件夹"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14 4H9.618l-1-2H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zm0 9H2V5h12v8z" />
                <path d="M8 6v2H6v1h2v2h1V9h2V8H9V6H8z" />
              </svg>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-white transition-colors"
              title="上传文件"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7.5 1L3 5.5V6h2V4.5l2.5-2 2.5 2V6h2v-.5L7.5 1zM3 14V7h1v6.5l.5.5h7l.5-.5V7h1v7l-1 1H4l-1-1z" />
              </svg>
            </button>
            <button
              onClick={refreshTree}
              className="p-1 hover:bg-[#3c3c3c] rounded text-[#858585] hover:text-white transition-colors"
              title="刷新"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.451 5.609l-.579-.939-1.068.812-.076.094c-.335.415-.927 1.341-1.124 2.876l-.021.165.033.163.071.345c.442 1.654.291 2.9-.449 3.709-.623.68-1.548.828-2.238.828-1.426 0-2.5-1.01-2.5-2.35 0-1.341.846-2.35 1.969-2.35.715 0 1.271.358 1.531.984l.083.202.205-.075c.212-.078.568-.278.705-.41l.108-.105-.103-.109c-.512-.543-1.337-.867-2.206-.867C5.466 8.592 4 10.209 4 12.312c0 2.025 1.543 3.688 3.438 3.688 1.11 0 2.31-.316 3.212-1.300 1.096-1.196 1.285-2.874.564-4.993l-.065-.19.073-.185c.272-.69.71-1.431 1.029-1.796l.137-.155.072.155.06.13 1.018-.588-.087-.145-.001-.003z" />
              </svg>
            </button>
          </div>
        </div>

        {/* 文件树 */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-5 h-5 border-2 border-[#0e639c] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <FileTree
              nodes={treeNodes}
              selectedId={selectedNode?.id}
              expandedState={expandedState}
              onExpandedChange={setExpandedState}
              onSelect={handleSelect}
              onExpand={handleExpand}
              onContextMenu={handleContextMenu}
              onRename={handleRename}
              onMove={handleMove}
              onFileDrop={handleDropUpload}
              renamingId={renamingId}
              onRenameCancel={() => setRenamingId(null)}
            />
          )}
        </div>

        {/* 上传队列 */}
        <UploadQueue uploads={uploads} />

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              const targetParent = selectedNode?.isDirectory ? selectedNode.id : selectedNode?.parentId ?? null;
              handleUpload(e.target.files, targetParent);
              e.target.value = "";
            }
          }}
        />
      </div>

      {/* 右侧：预览区 */}
      <div className="flex-1 overflow-hidden">
        <FilePreview file={selectedNode} />
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 新建文件夹对话框 */}
      {showNewFolderDialog && (
        <InputDialog
          title="新建文件夹"
          placeholder="文件夹名称"
          confirmText="创建"
          onConfirm={handleCreateFolder}
          onCancel={() => setShowNewFolderDialog(false)}
        />
      )}

      {/* 新建文件对话框 */}
      {showNewFileDialog && (
        <InputDialog
          title="新建文件"
          placeholder="文件名（包含扩展名）"
          confirmText="创建"
          onConfirm={handleCreateFile}
          onCancel={() => setShowNewFileDialog(false)}
        />
      )}

      {/* 删除确认对话框 */}
      {showDeleteDialog && selectedNode && (
        <ConfirmDialog
          title="确认删除"
          message={
            <div>
              确定要删除{selectedNode.isDirectory ? "文件夹" : "文件"}{" "}
              <span className="text-white font-medium">"{selectedNode.name}"</span>
              {selectedNode.isDirectory && " 及其所有内容"}？
              <p className="text-red-400 text-[12px] mt-2">此操作不可撤销！</p>
            </div>
          }
          confirmText="删除"
          danger
          loading={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  );
}
