/**
 * File System Access API Hook
 * 使用现代浏览器 API 访问本地文件系统
 *
 * 注意：此 API 需要 HTTPS 或 localhost
 * 参考：https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
 */

import { useState, useCallback, useEffect } from "react";
import type { TreeNode } from "../components/tree/types";

interface UseFileSystemOptions {
  /** 根目录路径（用于 ID 生成） */
  rootPath?: string;
  /** 文件过滤器 */
  fileFilter?: (name: string) => boolean;
  /** 是否自动加载子目录 */
  autoLoadChildren?: boolean;
}

interface UseFileSystemResult {
  /** 根节点列表 */
  nodes: TreeNode[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 选择目录 */
  selectDirectory: () => Promise<void>;
  /** 刷新 */
  refresh: () => Promise<void>;
  /** 读取文件内容 */
  readFile: (path: string) => Promise<ArrayBuffer | null>;
  /** 获取文件的 File 对象 */
  getFile: (path: string) => Promise<File | null>;
  /** 根目录句柄 */
  rootHandle: FileSystemDirectoryHandle | null;
  /** 根目录名称 */
  rootName: string | null;
  /** 加载子目录 */
  loadChildren: (node: TreeNode) => Promise<TreeNode[]>;
  /**
   * 从拖放的目录句柄设置节点
   * 注意：这是绕过 Chrome 对 .ini/.cfg/.dll 文件限制的方法
   */
  setNodesFromDrop: (handle: FileSystemDirectoryHandle) => Promise<void>;
}

/**
 * 将 FileSystemHandle 转换为 TreeNode
 */
async function handleToNode(
  handle: FileSystemHandle,
  parentPath: string,
  depth: number,
  fileFilter?: (name: string) => boolean
): Promise<TreeNode | null> {
  const path = `${parentPath}/${handle.name}`;
  const isDirectory = handle.kind === "directory";

  // 应用过滤器
  if (!isDirectory && fileFilter && !fileFilter(handle.name)) {
    return null;
  }

  const node: TreeNode = {
    id: path,
    name: handle.name,
    isDirectory,
    depth,
    isLoaded: false,
  };

  // 如果是文件，尝试获取大小
  if (!isDirectory) {
    try {
      const file = await (handle as FileSystemFileHandle).getFile();
      node.size = file.size;
      node.lastModified = file.lastModified;
    } catch {
      // 忽略错误
    }
  }

  return node;
}

/**
 * 读取目录内容
 * 注意：Chrome File System Access API 会过滤掉 .ini/.cfg/.dll 等"危险"扩展名
 * 这是 Chrome 的安全限制，不是 bug。使用拖放方式可以绕过此限制。
 * 参见：https://issues.chromium.org/issues/380857453
 */
async function readDirectory(
  dirHandle: FileSystemDirectoryHandle,
  parentPath: string,
  depth: number,
  fileFilter?: (name: string) => boolean
): Promise<TreeNode[]> {
  const nodes: TreeNode[] = [];

  for await (const entry of dirHandle.values()) {
    const node = await handleToNode(entry, parentPath, depth, fileFilter);
    if (node) {
      nodes.push(node);
    }
  }

  return nodes;
}

/**
 * 文件系统访问 Hook
 */
export function useFileSystem({
  rootPath = "",
  fileFilter,
  autoLoadChildren = true,
}: UseFileSystemOptions = {}): UseFileSystemResult {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [rootName, setRootName] = useState<string | null>(null);
  const [handleMap] = useState(() => new Map<string, FileSystemHandle>());

  /**
   * 选择目录
   */
  const selectDirectory = useCallback(async () => {
    try {
      // 检查 API 支持
      if (!("showDirectoryPicker" in window)) {
        setError("您的浏览器不支持 File System Access API");
        return;
      }

      setIsLoading(true);
      setError(null);

      // 打开目录选择器
      const handle = await window.showDirectoryPicker({
        mode: "read",
      });

      setRootHandle(handle);
      setRootName(handle.name);
      handleMap.clear();
      handleMap.set(`/${handle.name}`, handle);

      // 读取根目录
      const rootNodes = await readDirectory(
        handle,
        `/${handle.name}`,
        0,
        fileFilter
      );

      // 存储句柄映射
      for await (const entry of handle.values()) {
        handleMap.set(`/${handle.name}/${entry.name}`, entry);
      }

      setNodes(rootNodes);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // 用户取消选择
        return;
      }
      setError(`读取目录失败: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [fileFilter, handleMap]);

  /**
   * 刷新目录
   */
  const refresh = useCallback(async () => {
    if (!rootHandle) return;

    try {
      setIsLoading(true);
      setError(null);

      const rootNodes = await readDirectory(
        rootHandle,
        `/${rootHandle.name}`,
        0,
        fileFilter
      );

      setNodes(rootNodes);
    } catch (err) {
      setError(`刷新失败: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [rootHandle, fileFilter]);

  /**
   * 加载子目录
   */
  const loadChildren = useCallback(
    async (node: TreeNode): Promise<TreeNode[]> => {
      if (!node.isDirectory || !rootHandle) return [];

      try {
        // 获取目录句柄
        let dirHandle = handleMap.get(node.id) as FileSystemDirectoryHandle | undefined;

        if (!dirHandle) {
          // 需要从根目录遍历找到这个目录
          const pathParts = node.id.split("/").filter(Boolean);
          let currentHandle: FileSystemDirectoryHandle = rootHandle;

          // 跳过根目录名
          for (let i = 1; i < pathParts.length; i++) {
            currentHandle = await currentHandle.getDirectoryHandle(pathParts[i]);
          }

          dirHandle = currentHandle;
          handleMap.set(node.id, dirHandle);
        }

        // 读取子目录
        const children = await readDirectory(dirHandle, node.id, node.depth + 1, fileFilter);

        // 存储子目录句柄
        for await (const entry of dirHandle.values()) {
          handleMap.set(`${node.id}/${entry.name}`, entry);
        }

        // 更新节点
        setNodes((prev) => {
          const updateNode = (nodes: TreeNode[]): TreeNode[] =>
            nodes.map((n) => {
              if (n.id === node.id) {
                return { ...n, children, isLoaded: true };
              }
              if (n.children) {
                return { ...n, children: updateNode(n.children) };
              }
              return n;
            });
          return updateNode(prev);
        });

        return children;
      } catch (err) {
        console.error(`加载目录失败: ${node.id}`, err);
        return [];
      }
    },
    [rootHandle, fileFilter, handleMap]
  );

  /**
   * 读取文件内容
   */
  const readFile = useCallback(
    async (path: string): Promise<ArrayBuffer | null> => {
      if (!rootHandle) return null;

      try {
        let fileHandle = handleMap.get(path) as FileSystemFileHandle | undefined;

        if (!fileHandle) {
          // 从路径解析
          const pathParts = path.split("/").filter(Boolean);
          let currentHandle: FileSystemDirectoryHandle = rootHandle;

          // 遍历到文件所在目录
          for (let i = 1; i < pathParts.length - 1; i++) {
            currentHandle = await currentHandle.getDirectoryHandle(pathParts[i]);
          }

          // 获取文件
          fileHandle = await currentHandle.getFileHandle(pathParts[pathParts.length - 1]);
          handleMap.set(path, fileHandle);
        }

        const file = await fileHandle.getFile();
        return await file.arrayBuffer();
      } catch (err) {
        console.error(`读取文件失败: ${path}`, err);
        return null;
      }
    },
    [rootHandle, handleMap]
  );

  /**
   * 获取文件的 File 对象
   */
  const getFile = useCallback(
    async (path: string): Promise<File | null> => {
      if (!rootHandle) return null;

      try {
        let fileHandle = handleMap.get(path) as FileSystemFileHandle | undefined;

        if (!fileHandle) {
          const pathParts = path.split("/").filter(Boolean);
          let currentHandle: FileSystemDirectoryHandle = rootHandle;

          for (let i = 1; i < pathParts.length - 1; i++) {
            currentHandle = await currentHandle.getDirectoryHandle(pathParts[i]);
          }

          fileHandle = await currentHandle.getFileHandle(pathParts[pathParts.length - 1]);
          handleMap.set(path, fileHandle);
        }

        return await fileHandle.getFile();
      } catch (err) {
        console.error(`获取文件失败: ${path}`, err);
        return null;
      }
    },
    [rootHandle, handleMap]
  );

  /**
   * 从拖放的目录句柄设置节点
   * 这是绕过 Chrome 对 .ini/.cfg/.dll 文件限制的方法
   * 参见：https://issues.chromium.org/issues/380857453
   */
  const setNodesFromDrop = useCallback(
    async (handle: FileSystemDirectoryHandle): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        setRootHandle(handle);
        setRootName(handle.name);
        handleMap.clear();
        handleMap.set(`/${handle.name}`, handle);

        // 读取根目录
        const rootNodes = await readDirectory(
          handle,
          `/${handle.name}`,
          0,
          fileFilter
        );

        // 存储句柄映射
        for await (const entry of handle.values()) {
          handleMap.set(`/${handle.name}/${entry.name}`, entry);
        }

        setNodes(rootNodes);
      } catch (err) {
        setError(`读取目录失败: ${(err as Error).message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [fileFilter, handleMap]
  );

  return {
    nodes,
    isLoading,
    error,
    selectDirectory,
    refresh,
    readFile,
    getFile,
    rootHandle,
    rootName,
    loadChildren,
    setNodesFromDrop,
  };
}

/**
 * 使用预设路径加载目录（通过拖拽或点击选择）
 * 注意：由于安全限制，不能直接指定路径，用户必须主动选择
 */
export function useDirectoryPicker() {
  return useFileSystem();
}
