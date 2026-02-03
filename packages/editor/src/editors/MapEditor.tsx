import { useState, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { VirtualTree, type TreeNode } from "../components/tree";
import { useFileSystem } from "../hooks/useFileSystem";
import { MapViewer } from "../components/MapViewer";
import { parseMap } from "@miu2d/engine/map";
import type { JxqyMapData } from "@miu2d/engine/core/mapTypes";

/**
 * 地图编辑器
 * 参考 AsfEditor 实现
 * 左侧文件树 + 右侧地图预览
 */
export function MapEditor() {
  const { mapId } = useParams();

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
    rootHandle,
  } = useFileSystem({
    fileFilter: (name) => {
      // 只显示 .map 文件
      return name.toLowerCase().endsWith(".map");
    },
  });

  // 当前选中的文件
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  // 地图数据
  const [mapData, setMapData] = useState<JxqyMapData | null>(null);
  const [mapName, setMapName] = useState<string | null>(null);
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // 选中文件
  const handleSelect = useCallback((node: TreeNode) => {
    setSelectedNode(node);
  }, []);

  // 打开地图文件
  const handleOpen = useCallback(
    async (node: TreeNode) => {
      if (node.isDirectory) return;

      // 只处理 map 文件
      if (!node.name.toLowerCase().endsWith(".map")) return;

      try {
        setIsLoadingMap(true);
        setMapError(null);

        // 读取文件
        const buffer = await readFile(node.id);
        if (!buffer) {
          setMapError("无法读取文件");
          return;
        }

        // 解析地图
        const data = await parseMap(buffer, node.name);
        if (!data) {
          setMapError("解析地图失败");
          return;
        }

        // 提取地图名称（不含扩展名）
        const name = node.name.replace(/\.map$/i, "");
        setMapName(name);
        setMapData(data);
      } catch (err) {
        setMapError(`加载失败: ${(err as Error).message}`);
      } finally {
        setIsLoadingMap(false);
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

  return (
    <div className="flex h-full bg-[#1e1e1e] overflow-hidden">
      {/* 左侧文件树面板 */}
      <div className="flex w-72 shrink-0 flex-col border-r border-[#3c3c3c] overflow-hidden">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between border-b border-[#3c3c3c] bg-[#252526] px-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[#bbbbbb]">
            {rootName ? `地图文件: ${rootName}` : "地图文件"}
          </span>
          <div className="flex gap-1">
            <button
              className="rounded p-1 text-sm hover:bg-[#3c3c3c] text-[#cccccc]"
              onClick={refresh}
              title="刷新"
              disabled={!rootName}
            >
              🔄
            </button>
            <button
              className="rounded p-1 text-sm hover:bg-[#3c3c3c] text-[#cccccc]"
              onClick={selectDirectory}
              title="选择目录"
            >
              📂
            </button>
          </div>
        </div>

        {/* 文件树 */}
        <div className="flex-1 overflow-hidden">
          {isLoadingDir ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            </div>
          ) : dirError ? (
            <div className="p-4 text-center text-red-400 text-sm">{dirError}</div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#808080] text-sm p-4 text-center">
              <span className="text-3xl mb-4">🗺️</span>
              <p className="mb-2">点击上方按钮选择地图目录</p>
              <p className="text-xs">
                建议选择：
                <br />
                <code className="text-[#cccccc]">/resources/map</code>
              </p>
              <button
                className="mt-4 rounded bg-[#0e639c] px-4 py-2 text-sm text-white hover:bg-[#1177bb]"
                onClick={selectDirectory}
              >
                选择目录
              </button>
            </div>
          ) : (
            <VirtualTree
              nodes={nodes}
              selectedId={selectedNode?.id}
              onSelect={handleSelect}
              onOpen={handleOpen}
              onExpand={handleExpand}
            />
          )}
        </div>
      </div>

      {/* 右侧预览区域 */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <MapViewer
          mapData={mapData}
          mapName={mapName}
          fileName={selectedNode?.name}
          isLoading={isLoadingMap}
          error={mapError}
          rootHandle={rootHandle}
          readFile={readFile}
        />
      </div>
    </div>
  );
}
