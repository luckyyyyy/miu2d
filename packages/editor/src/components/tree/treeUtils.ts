/**
 * 文件树工具函数
 */

import type { ExpandedState, FileIconConfig, FlatTreeNode, TreeNode } from "./types";

/**
 * 将树结构扁平化为虚拟滚动列表
 * 只包含可见节点（父节点展开的节点）
 */
export function flattenTree(
  nodes: TreeNode[],
  expandedState: ExpandedState,
  parentId: string | null = null,
  startIndex = { value: 0 }
): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];

  for (const node of nodes) {
    const isExpanded = expandedState.has(node.id);
    const flatNode: FlatTreeNode = {
      ...node,
      isExpanded,
      parentId,
      flatIndex: startIndex.value++,
    };
    result.push(flatNode);

    // 如果是展开的目录且有子节点，递归处理
    if (node.isDirectory && isExpanded && node.children) {
      const childNodes = flattenTree(node.children, expandedState, node.id, startIndex);
      result.push(...childNodes);
    }
  }

  return result;
}

/**
 * 对节点进行排序：目录在前，文件在后，同类按名称排序
 */
export function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    // 目录优先
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    // 同类按名称排序（忽略大小写）
    return a.name.localeCompare(b.name, "zh-CN", { sensitivity: "base" });
  });
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : "";
}

/**
 * 获取文件图标
 */
export function getFileIcon(node: TreeNode, isExpanded: boolean, config: FileIconConfig): string {
  if (node.isDirectory) {
    return isExpanded ? config.folderOpen : config.folder;
  }

  const ext = getFileExtension(node.name);
  return config.extensions[ext] || config.file;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 过滤节点（保持树结构）
 */
export function filterTree(nodes: TreeNode[], filter: string): TreeNode[] {
  if (!filter.trim()) return nodes;

  const lowerFilter = filter.toLowerCase();

  function filterNode(node: TreeNode): TreeNode | null {
    // 检查当前节点是否匹配
    const nameMatches = node.name.toLowerCase().includes(lowerFilter);

    if (node.isDirectory && node.children) {
      // 递归过滤子节点
      const filteredChildren = node.children
        .map(filterNode)
        .filter((n): n is TreeNode => n !== null);

      // 如果有匹配的子节点，保留此目录
      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
    }

    // 文件直接检查名称
    return nameMatches ? node : null;
  }

  return nodes.map(filterNode).filter((n): n is TreeNode => n !== null);
}

/**
 * 查找节点的所有祖先节点 ID
 */
export function getAncestorIds(nodeId: string, flatNodes: FlatTreeNode[]): string[] {
  const node = flatNodes.find((n) => n.id === nodeId);
  if (!node || !node.parentId) return [];

  const ancestors: string[] = [];
  let currentParentId: string | null = node.parentId;

  while (currentParentId) {
    ancestors.push(currentParentId);
    const parent = flatNodes.find((n) => n.id === currentParentId);
    currentParentId = parent?.parentId ?? null;
  }

  return ancestors;
}

/**
 * 展开节点到指定节点（展开所有祖先）
 */
export function expandToNode(
  nodeId: string,
  flatNodes: FlatTreeNode[],
  currentExpanded: ExpandedState
): ExpandedState {
  const ancestors = getAncestorIds(nodeId, flatNodes);
  const newExpanded = new Set(currentExpanded);
  for (const id of ancestors) {
    newExpanded.add(id);
  }
  return newExpanded;
}
