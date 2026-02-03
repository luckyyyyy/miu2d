/**
 * 文件树行组件
 * 渲染单个文件/文件夹节点
 */

import type { FlatTreeNode, FileIconConfig } from "./types";
import { getFileIcon } from "./treeUtils";

interface TreeRowProps {
  node: FlatTreeNode;
  isSelected: boolean;
  isFocused: boolean;
  iconConfig: FileIconConfig;
  indentSize: number;
  onSelect: (node: FlatTreeNode) => void;
  onToggle: (node: FlatTreeNode) => void;
  onDoubleClick: (node: FlatTreeNode) => void;
  style: React.CSSProperties;
}

export function TreeRow({
  node,
  isSelected,
  isFocused,
  iconConfig,
  indentSize,
  onSelect,
  onToggle,
  onDoubleClick,
  style,
}: TreeRowProps) {
  const icon = getFileIcon(node, node.isExpanded, iconConfig);
  const indent = node.depth * indentSize;

  // 单击：选中 + 打开/展开
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node);
    // 单击直接触发打开/展开（原双击行为）
    onDoubleClick(node);
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isDirectory) {
      onToggle(node);
    }
  };

  // VSCode 风格的样式
  const rowClass = `
    flex items-center h-[22px] cursor-pointer select-none
    text-[13px] leading-[22px] whitespace-nowrap
    ${isSelected ? "bg-[#04395e]" : "hover:bg-[#2a2d2e]"}
    ${isFocused ? "outline outline-1 outline-[#007fd4] -outline-offset-1" : ""}
  `;

  return (
    <div
      className={rowClass}
      style={style}
      onClick={handleClick}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={node.isDirectory ? node.isExpanded : undefined}
      tabIndex={-1}
    >
      {/* 缩进 */}
      <span style={{ width: indent, flexShrink: 0 }} />

      {/* 展开/折叠箭头 */}
      <span
        className={`w-4 h-4 flex items-center justify-center text-[10px] text-[#c5c5c5] ${
          node.isDirectory ? "cursor-pointer" : "invisible"
        }`}
        onClick={handleChevronClick}
      >
        {node.isDirectory && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            className={`transition-transform duration-100 ${node.isExpanded ? "rotate-90" : ""}`}
            fill="currentColor"
          >
            <path d="M6 4v8l4-4-4-4z" />
          </svg>
        )}
      </span>

      {/* 图标 */}
      <span className="w-4 h-4 flex items-center justify-center text-[14px] mr-1.5">
        {icon}
      </span>

      {/* 文件名 */}
      <span className="text-[#cccccc] overflow-hidden text-ellipsis">
        {node.name}
      </span>
    </div>
  );
}
