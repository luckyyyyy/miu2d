/**
 * 虚拟滚动文件树类型定义
 */

/** 文件/文件夹节点 */
export interface TreeNode {
  /** 唯一标识符（文件路径） */
  id: string;
  /** 显示名称 */
  name: string;
  /** 是否为目录 */
  isDirectory: boolean;
  /** 子节点（目录才有） */
  children?: TreeNode[];
  /** 嵌套深度 */
  depth: number;
  /** 是否已加载子节点 */
  isLoaded?: boolean;
  /** 文件大小（字节） */
  size?: number;
  /** 最后修改时间 */
  lastModified?: number;
}

/** 扁平化后的渲染节点（用于虚拟滚动） */
export interface FlatTreeNode extends TreeNode {
  /** 是否展开 */
  isExpanded: boolean;
  /** 父节点 ID */
  parentId: string | null;
  /** 在扁平列表中的索引 */
  flatIndex: number;
}

/** 树的展开状态 */
export type ExpandedState = Set<string>;

/** 文件树事件 */
export interface TreeEvents {
  onSelect?: (node: TreeNode) => void;
  onExpand?: (node: TreeNode) => void;
  onCollapse?: (node: TreeNode) => void;
  onContextMenu?: (node: TreeNode, event: React.MouseEvent) => void;
}

/** 文件图标映射 */
export interface FileIconConfig {
  folder: string;
  folderOpen: string;
  file: string;
  extensions: Record<string, string>;
}

/** 默认图标配置 */
export const defaultIconConfig: FileIconConfig = {
  folder: "📁",
  folderOpen: "📂",
  file: "📄",
  extensions: {
    asf: "🎬",
    ini: "⚙️",
    txt: "📝",
    npc: "👤",
    obj: "📦",
    map: "🗺️",
    mpc: "📦",
    ogg: "🎵",
    wav: "🎵",
    mp3: "🎵",
  },
};
