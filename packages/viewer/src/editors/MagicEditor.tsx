import type { MagicData } from "@miu2d/engine/magic";
import { useCallback, useRef, useState } from "react";
import { MagicViewer } from "../components/MagicViewer";
import { type TreeNode, VirtualTree } from "../components/tree";
import { useFileSystem } from "../hooks/useFileSystem";
import { parseMagicIni } from "../utils/magicIniParser";

/**
 * 武功编辑器主页面
 * 左侧目录树 + 右侧武功配置预览/编辑
 *
 * 注意：Chrome 的 File System Access API 会过滤 .ini 文件
 * 请使用拖放方式打开目录以绕过此限制
 * 参见：https://issues.chromium.org/issues/380857453
 */
export function MagicEditor() {
  // 文件系统
  const {
    nodes,
    isLoading: isLoadingDir,
    error: dirError,
    selectDirectory,
    refresh,
    readFile,
    rootName,
    loadChildren,
    setNodesFromDrop,
  } = useFileSystem({
    fileFilter: (name) => {
      // 只显示 .ini 文件（目录由 handleToNode 自动处理，不会经过此过滤器）
      return name.toLowerCase().endsWith(".ini");
    },
  });

  // 拖放状态
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // 当前选中的文件
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  // 武功数据
  const [magicData, setMagicData] = useState<MagicData | null>(null);
  const [isLoadingMagic, setIsLoadingMagic] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);

  // 选中文件
  const handleSelect = useCallback((node: TreeNode) => {
    setSelectedNode(node);
  }, []);

  // 打开武功文件
  const handleOpen = useCallback(
    async (node: TreeNode) => {
      if (node.isDirectory) return;

      // 只处理 .ini 文件
      if (!node.name.toLowerCase().endsWith(".ini")) return;

      try {
        setIsLoadingMagic(true);
        setMagicError(null);

        // 读取文件
        const buffer = await readFile(node.id);
        if (!buffer) {
          setMagicError("无法读取文件");
          return;
        }

        // 解码为文本（尝试 UTF-8，如果失败则尝试 GBK）
        let text: string;
        try {
          text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
        } catch {
          // 尝试 GBK 编码
          text = new TextDecoder("gbk").decode(buffer);
        }

        // 解析武功配置
        const magic = parseMagicIni(text, node.name);
        setMagicData(magic);
      } catch (err) {
        setMagicError(`加载失败: ${(err as Error).message}`);
      } finally {
        setIsLoadingMagic(false);
      }
    },
    [readFile]
  );

  // 展开目录时加载子节点
  const handleExpand = useCallback(
    async (node: TreeNode) => {
      if (node.isDirectory && !node.isLoaded) {
        await loadChildren(node);
      }
    },
    [loadChildren]
  );

  // 拖放处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 只在离开 dropzone 时才设置为 false
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const items = e.dataTransfer.items;
      if (!items || items.length === 0) return;

      // 获取第一个拖放的项目
      const item = items[0];
      if (item.kind !== "file") return;

      // 使用 getAsFileSystemHandle 获取句柄（可以绕过 Chrome 的扩展名过滤）
      const handle = await (item as unknown as { getAsFileSystemHandle(): Promise<FileSystemHandle | null> }).getAsFileSystemHandle();
      if (!handle) return;

      if (handle.kind === "directory") {
        // 如果是目录，使用 setNodesFromDrop 处理
        await setNodesFromDrop(handle as FileSystemDirectoryHandle);
      }
    },
    [setNodesFromDrop]
  );

  // 自定义图标配置
  const iconConfig = {
    folder: "📁",
    folderOpen: "📂",
    file: "📄",
    extensions: {
      ini: "⚙️",
    },
  };

  return (
    <div className="flex h-full bg-[#1e1e1e] overflow-hidden">
      {/* 左侧文件树面板 */}
      <div className="flex w-72 shrink-0 flex-col border-r border-[#3c3c3c] overflow-hidden">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between border-b border-[#3c3c3c] bg-[#252526] px-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[#bbbbbb]">
            {rootName ? `武功配置: ${rootName}` : "武功编辑器"}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded p-1 text-sm hover:bg-[#3c3c3c] text-[#cccccc]"
              onClick={refresh}
              title="刷新"
              disabled={!rootName}
            >
              🔄
            </button>
            <button
              type="button"
              className="rounded p-1 text-sm hover:bg-[#3c3c3c] text-[#cccccc]"
              onClick={selectDirectory}
              title="选择目录"
            >
              📂
            </button>
          </div>
        </div>

        {/* 文件树 */}
        <div
          ref={dropZoneRef}
          className={`flex-1 overflow-hidden transition-colors ${
            isDragging ? "bg-[#264f78] border-2 border-dashed border-[#007acc]" : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isLoadingDir ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            </div>
          ) : dirError ? (
            <div className="p-4 text-center text-red-400 text-sm">{dirError}</div>
          ) : isDragging ? (
            <div className="flex flex-col items-center justify-center h-full text-[#cccccc] text-sm">
              <span className="text-4xl mb-4">📂</span>
              <p>松开鼠标打开目录</p>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#808080] text-sm p-4 text-center">
              <span className="text-3xl mb-4">🧙</span>
              <p className="mb-2">拖放目录到此处</p>
              <p className="text-xs text-amber-400 mb-3">
                ⚠️ Chrome 限制 .ini 文件访问
                <br />
                <span className="text-[#808080]">请使用拖放方式打开目录</span>
              </p>
              <p className="text-xs mb-2">
                建议选择：
                <br />
                <code className="text-[#cccccc]">/resources/ini/magic</code>
              </p>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  className="rounded bg-[#0e639c] px-4 py-2 text-sm text-white hover:bg-[#1177bb]"
                  onClick={selectDirectory}
                >
                  选择目录
                </button>
              </div>
            </div>
          ) : (
            <VirtualTree
              nodes={nodes}
              selectedId={selectedNode?.id}
              onSelect={handleSelect}
              onOpen={handleOpen}
              onExpand={handleExpand}
              iconConfig={iconConfig}
            />
          )}
        </div>

        {/* 底部统计信息 */}
        {nodes.length > 0 && (
          <div className="border-t border-[#3c3c3c] px-3 py-2 text-xs text-[#808080]">
            {countFiles(nodes)} 个武功配置
          </div>
        )}
      </div>

      {/* 右侧预览/编辑区域 */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <MagicViewer
          magic={magicData}
          fileName={selectedNode?.name}
          isLoading={isLoadingMagic}
          error={magicError}
          readOnly={true}
        />
      </div>
    </div>
  );
}

/**
 * 递归统计文件数量
 */
function countFiles(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (!node.isDirectory) {
      count++;
    }
    if (node.children) {
      count += countFiles(node.children);
    }
  }
  return count;
}
