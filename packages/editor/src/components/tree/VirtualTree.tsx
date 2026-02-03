/**
 * 虚拟滚动文件树组件
 * 1:1 复刻 VSCode 的文件目录树样式和行为
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { TreeNode, FlatTreeNode, ExpandedState, FileIconConfig } from "./types";
import { defaultIconConfig } from "./types";
import { flattenTree, sortNodes } from "./treeUtils";
import { useVirtualScroll } from "./useVirtualScroll";
import { TreeRow } from "./TreeRow";

interface VirtualTreeProps {
  /** 树的根节点列表 */
  nodes: TreeNode[];
  /** 选中的节点 ID */
  selectedId?: string | null;
  /** 选中事件 */
  onSelect?: (node: TreeNode) => void;
  /** 双击事件（打开文件） */
  onOpen?: (node: TreeNode) => void;
  /** 展开目录事件（支持异步加载子节点） */
  onExpand?: (node: TreeNode) => void | Promise<void>;
  /** 图标配置 */
  iconConfig?: FileIconConfig;
  /** 缩进大小（像素） */
  indentSize?: number;
  /** 行高（像素） */
  rowHeight?: number;
  /** 初始展开的节点 ID 列表 */
  defaultExpanded?: string[];
  /** 是否显示根节点 */
  showRoot?: boolean;
  /** 类名 */
  className?: string;
  /** 加载目录内容的回调（已废弃，使用 onExpand） */
  onLoadChildren?: (node: TreeNode) => Promise<TreeNode[]>;
}

export function VirtualTree({
  nodes,
  selectedId,
  onSelect,
  onOpen,
  onExpand,
  iconConfig = defaultIconConfig,
  indentSize = 8,
  rowHeight = 22,
  defaultExpanded = [],
  showRoot = false,
  className = "",
  onLoadChildren,
}: VirtualTreeProps) {
  // 展开状态
  const [expandedState, setExpandedState] = useState<ExpandedState>(
    () => new Set(defaultExpanded)
  );

  // 选中状态
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    selectedId ?? null
  );

  // 容器尺寸
  const [containerHeight, setContainerHeight] = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);

  // 同步外部选中状态
  useEffect(() => {
    if (selectedId !== undefined) {
      setInternalSelectedId(selectedId);
    }
  }, [selectedId]);

  // 监听容器大小变化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 排序后的节点
  const sortedNodes = useMemo(() => {
    function sortRecursive(nodeList: TreeNode[]): TreeNode[] {
      return sortNodes(nodeList).map((node) => ({
        ...node,
        children: node.children ? sortRecursive(node.children) : undefined,
      }));
    }
    return sortRecursive(nodes);
  }, [nodes]);

  // 扁平化树结构
  const flatNodes = useMemo(
    () => flattenTree(sortedNodes, expandedState),
    [sortedNodes, expandedState]
  );

  // 虚拟滚动
  const {
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
    onScroll,
    containerRef: scrollContainerRef,
  } = useVirtualScroll({
    itemCount: flatNodes.length,
    itemHeight: rowHeight,
    containerHeight,
    overscan: 5,
  });

  // 合并 ref
  useEffect(() => {
    if (containerRef.current && scrollContainerRef.current === null) {
      // 手动赋值 ref
      (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current =
        containerRef.current;
    }
  }, [scrollContainerRef]);

  // 切换展开状态
  const handleToggle = useCallback(
    async (node: FlatTreeNode) => {
      if (!node.isDirectory) return;

      const isCurrentlyExpanded = expandedState.has(node.id);

      if (isCurrentlyExpanded) {
        // 折叠
        setExpandedState((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      } else {
        // 展开
        // 如果有加载回调且未加载过，先加载子节点
        if (!node.isLoaded) {
          // 先触发加载
          await onExpand?.(node);
        }

        // 加载完成后再展开
        setExpandedState((prev) => {
          const next = new Set(prev);
          next.add(node.id);
          return next;
        });
      }
    },
    [expandedState, onExpand]
  );

  // 选中节点
  const handleSelect = useCallback(
    (node: FlatTreeNode) => {
      setInternalSelectedId(node.id);
      onSelect?.(node);
    },
    [onSelect]
  );

  // 双击打开
  const handleDoubleClick = useCallback(
    (node: FlatTreeNode) => {
      if (node.isDirectory) {
        handleToggle(node);
      } else {
        onOpen?.(node);
      }
    },
    [handleToggle, onOpen]
  );

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = flatNodes.findIndex((n) => n.id === internalSelectedId);
      if (currentIndex === -1) return;

      const currentNode = flatNodes[currentIndex];

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          if (currentIndex > 0) {
            handleSelect(flatNodes[currentIndex - 1]);
          }
          break;

        case "ArrowDown":
          e.preventDefault();
          if (currentIndex < flatNodes.length - 1) {
            handleSelect(flatNodes[currentIndex + 1]);
          }
          break;

        case "ArrowLeft":
          e.preventDefault();
          if (currentNode.isDirectory && currentNode.isExpanded) {
            handleToggle(currentNode);
          } else if (currentNode.parentId) {
            const parent = flatNodes.find((n) => n.id === currentNode.parentId);
            if (parent) handleSelect(parent);
          }
          break;

        case "ArrowRight":
          e.preventDefault();
          if (currentNode.isDirectory) {
            if (!currentNode.isExpanded) {
              handleToggle(currentNode);
            } else if (currentNode.children?.length) {
              // 移动到第一个子节点
              const firstChild = flatNodes.find((n) => n.parentId === currentNode.id);
              if (firstChild) handleSelect(firstChild);
            }
          }
          break;

        case "Enter":
          e.preventDefault();
          handleDoubleClick(currentNode);
          break;

        case " ":
          e.preventDefault();
          if (currentNode.isDirectory) {
            handleToggle(currentNode);
          }
          break;
      }
    },
    [flatNodes, internalSelectedId, handleSelect, handleToggle, handleDoubleClick]
  );

  // 可见的节点
  const visibleNodes = flatNodes.slice(startIndex, endIndex + 1);

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-auto bg-[#252526] text-[#cccccc] outline-none ${className}`}
      onScroll={onScroll}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="tree"
      aria-label="文件浏览器"
    >
      {/* 虚拟滚动容器 */}
      <div
        style={{
          height: totalHeight,
          position: "relative",
        }}
      >
        {/* 可见节点 */}
        <div
          style={{
            position: "absolute",
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {visibleNodes.map((node) => (
            <TreeRow
              key={node.id}
              node={node}
              isSelected={node.id === internalSelectedId}
              isFocused={false}
              iconConfig={iconConfig}
              indentSize={indentSize}
              onSelect={handleSelect}
              onToggle={handleToggle}
              onDoubleClick={handleDoubleClick}
              style={{ height: rowHeight }}
            />
          ))}
        </div>
      </div>

      {/* 空状态 */}
      {flatNodes.length === 0 && (
        <div className="flex items-center justify-center h-full text-[#808080] text-sm">
          没有文件
        </div>
      )}
    </div>
  );
}
