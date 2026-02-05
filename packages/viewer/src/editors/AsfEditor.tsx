/**
 * ASF 编辑器主页面
 * 左侧文件树 + 右侧 ASF 预览
 */

import type { AsfData } from "@miu2d/engine/resource/asf";
import { initAsfWasm } from "@miu2d/engine/resource/asf";
import { decodeAsfWasm } from "@miu2d/engine/wasm/wasmAsfDecoder";
import { useCallback, useEffect, useState } from "react";
import { AsfViewer } from "../components/AsfViewer";
import { type TreeNode, VirtualTree } from "../components/tree";
import { useFileSystem } from "../hooks/useFileSystem";

export function AsfEditor() {
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
  } = useFileSystem({
    fileFilter: (name) => {
      // 只显示 .asf 文件（目录由 handleToNode 自动处理，不会经过此过滤器）
      return name.toLowerCase().endsWith(".asf");
    },
  });

  // 当前选中的文件
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  // ASF 数据
  const [asfData, setAsfData] = useState<AsfData | null>(null);
  const [isLoadingAsf, setIsLoadingAsf] = useState(false);
  const [asfError, setAsfError] = useState<string | null>(null);
  // WASM 初始化状态
  const [wasmReady, setWasmReady] = useState(false);

  // 初始化 WASM
  useEffect(() => {
    initAsfWasm()
      .then(() => setWasmReady(true))
      .catch((err) => {
        console.error("WASM 初始化失败:", err);
        setAsfError("WASM 解码器初始化失败");
      });
  }, []);

  // 选中文件
  const handleSelect = useCallback((node: TreeNode) => {
    setSelectedNode(node);
  }, []);

  // 打开 ASF 文件
  const handleOpen = useCallback(
    async (node: TreeNode) => {
      if (node.isDirectory) return;

      // 只处理 asf 文件
      if (!node.name.toLowerCase().endsWith(".asf")) return;

      if (!wasmReady) {
        setAsfError("WASM 解码器尚未初始化");
        return;
      }

      try {
        setIsLoadingAsf(true);
        setAsfError(null);

        // 读取文件
        const buffer = await readFile(node.id);
        if (!buffer) {
          setAsfError("无法读取文件");
          return;
        }

        // 解码 ASF
        const asf = decodeAsfWasm(buffer);
        if (!asf) {
          setAsfError("解码失败");
          return;
        }

        setAsfData(asf);
      } catch (err) {
        setAsfError(`加载失败: ${(err as Error).message}`);
      } finally {
        setIsLoadingAsf(false);
      }
    },
    [readFile, wasmReady]
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
            {rootName ? `资源管理器: ${rootName}` : "资源管理器"}
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
              <span className="text-3xl mb-4">📁</span>
              <p className="mb-2">点击上方按钮选择 ASF 资源目录</p>
              <p className="text-xs">
                建议选择：
                <br />
                <code className="text-[#cccccc]">/resources/asf</code>
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
        <AsfViewer
          asf={asfData}
          fileName={selectedNode?.name}
          isLoading={isLoadingAsf}
          error={asfError}
        />
      </div>
    </div>
  );
}
