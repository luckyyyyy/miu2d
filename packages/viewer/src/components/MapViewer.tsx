/**
 * 地图预览组件
 * 参考 AsfViewer 实现，复用 engine 中的 map 渲染逻辑
 */

import type { JxqyMapData } from "@miu2d/engine/core/mapTypes";
import {
  createMapRenderer,
  getViewTileRange,
  loadMapMpcs,
  MapBase,
  type MapRenderer,
  renderLayer,
  setCameraSize,
  updateCamera,
} from "@miu2d/engine/map";
import { Canvas2DRenderer } from "@miu2d/engine/webgl";
import { useCallback, useEffect, useRef, useState } from "react";

interface MapViewerProps {
  /** 地图数据 */
  mapData: JxqyMapData | null;
  /** 地图文件名（不含扩展名，用于加载 MPC） */
  mapName: string | null;
  /** 文件名（显示用） */
  fileName?: string;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 文件句柄（用于读取 MPC 文件） */
  rootHandle?: FileSystemDirectoryHandle | null;
  /** 读取文件函数 */
  readFile?: (path: string) => Promise<ArrayBuffer | null>;
  /** 资源根目录（用于编辑器等场景覆盖默认路径） */
  resourceRoot?: string;
}

// 障碍类型颜色
const BARRIER_COLORS: Record<number, string> = {
  0: "transparent", // None
  128: "rgba(255, 0, 0, 0.5)", // Obstacle
  160: "rgba(255, 128, 0, 0.5)", // CanOverObstacle
  64: "rgba(0, 0, 255, 0.5)", // Trans
  96: "rgba(0, 128, 255, 0.5)", // CanOverTrans
  32: "rgba(0, 255, 0, 0.5)", // CanOver
};

// 陷阱颜色
const TRAP_COLOR = "rgba(255, 255, 0, 0.6)";

export function MapViewer({
  mapData,
  mapName,
  fileName,
  isLoading,
  error,
  rootHandle,
  readFile,
  resourceRoot,
}: MapViewerProps) {
  // 渲染器
  const rendererRef = useRef<MapRenderer | null>(null);

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 状态
  const [zoom, setZoom] = useState(0.25); // 默认 25% 缩放
  const [loadProgress, setLoadProgress] = useState(0);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [_mapLoadError, setMapLoadError] = useState<string | null>(null);

  // 图层显示控制
  const [showLayer1, setShowLayer1] = useState(true);
  const [showLayer2, setShowLayer2] = useState(true);
  const [showLayer3, setShowLayer3] = useState(true);
  const [showObstacles, setShowObstacles] = useState(false);
  const [showTraps, setShowTraps] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  // 鼠标状态
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [tilePos, setTilePos] = useState({ x: 0, y: 0 });
  const [mouseClientPos, setMouseClientPos] = useState({ x: 0, y: 0 }); // 鼠标在容器内的位置
  const [isHovering, setIsHovering] = useState(false); // 是否在地图上悬停
  const [isDragging, setIsDragging] = useState(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // 初始化渲染器
  useEffect(() => {
    if (!rendererRef.current) {
      rendererRef.current = createMapRenderer();
    }
  }, []);

  // 地图加载后计算合适的初始缩放，并重置相机位置
  useEffect(() => {
    if (!mapData) return;
    const container = containerRef.current;
    const renderer = rendererRef.current;
    if (!container || !renderer) return;

    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    // 重置相机位置到左上角
    renderer.camera.x = 0;
    renderer.camera.y = 0;

    // 计算能完整显示地图的缩放比例
    const scaleX = width / mapData.mapPixelWidth;
    const scaleY = height / mapData.mapPixelHeight;
    const fitScale = Math.min(scaleX, scaleY, 1); // 不超过 100%
    setZoom(Math.max(0.05, Math.min(1, fitScale)));
  }, [mapData]);

  // 加载 MPC 资源
  useEffect(() => {
    if (!mapData || !mapName) return;

    // 立刻设置加载状态，防止显示旧地图
    setIsMapLoading(true);
    setMapLoadError(null);
    setLoadProgress(0);

    const loadMpcs = async () => {
      try {
        const renderer = rendererRef.current;
        if (!renderer) return;

        // 使用 engine 的 loadMapMpcs
        const success = await loadMapMpcs(
          renderer,
          mapData,
          mapName,
          (progress: number) => setLoadProgress(progress),
          resourceRoot
        );

        if (!success) {
          setMapLoadError("加载 MPC 资源失败");
        }
      } catch (err) {
        setMapLoadError(`加载失败: ${(err as Error).message}`);
      } finally {
        setIsMapLoading(false);
      }
    };

    loadMpcs();
  }, [mapData, mapName, resourceRoot]);

  // 设置 canvas 大小
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;

    if (!container || !canvas || !renderer) return;

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      // 设置相机的逻辑尺寸（考虑缩放）
      setCameraSize(renderer, width / zoom, height / zoom);
    };

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    // 初始化时也要更新一次
    updateSize();

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [zoom]); // zoom 变化时重新设置相机尺寸

  // 绘制地图
  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    const container = containerRef.current;

    if (!canvas || !renderer || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 确保 canvas 尺寸与容器同步（防止初始化时尺寸不对）
    const rect = container.getBoundingClientRect();
    if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
      canvas.width = Math.floor(rect.width);
      canvas.height = Math.floor(rect.height);
    }

    // 如果 canvas 尺寸无效，跳过绘制
    if (canvas.width === 0 || canvas.height === 0) return;

    // 清除画布
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 如果没有地图数据，显示提示
    if (!mapData) {
      ctx.fillStyle = "#808080";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("选择一个 .map 文件查看", canvas.width / 2, canvas.height / 2);
      return;
    }

    // 如果正在加载 MPC 资源，显示加载进度（全屏遮罩）
    if (isMapLoading || renderer.isLoading) {
      // 半透明遮罩
      ctx.fillStyle = "rgba(26, 26, 46, 0.95)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 加载文字
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        `加载地图资源中... ${Math.round(loadProgress * 100)}%`,
        canvas.width / 2,
        canvas.height / 2 - 10
      );

      // 进度条
      const barWidth = 200;
      const barHeight = 4;
      const barX = (canvas.width - barWidth) / 2;
      const barY = canvas.height / 2 + 10;

      ctx.fillStyle = "#333";
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.fillStyle = "#0e639c";
      ctx.fillRect(barX, barY, barWidth * loadProgress, barHeight);
      return;
    }

    // 更新相机的逻辑尺寸（缩放后能看到的世界范围）
    renderer.camera.width = canvas.width / zoom;
    renderer.camera.height = canvas.height / zoom;

    // 应用缩放变换
    ctx.save();
    ctx.imageSmoothingEnabled = false; // 防止像素模糊产生黑线
    ctx.scale(zoom, zoom);

    // 获取视图范围
    const { startX, startY, endX, endY } = getViewTileRange(
      renderer.camera, mapData, renderer.maxTileHeight, renderer.maxTileWidth
    );

    // 绘制网格背景
    if (showGrid) {
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 1 / zoom;
      for (let row = startY; row < endY; row++) {
        for (let col = startX; col < endX; col++) {
          const pixelPos = MapBase.toPixelPosition(col, row);
          const screenX = pixelPos.x - renderer.camera.x;
          const screenY = pixelPos.y - renderer.camera.y;

          // 绘制菱形网格
          ctx.beginPath();
          ctx.moveTo(screenX, screenY - 16);
          ctx.lineTo(screenX + 32, screenY);
          ctx.lineTo(screenX, screenY + 16);
          ctx.lineTo(screenX - 32, screenY);
          ctx.closePath();
          ctx.stroke();
        }
      }
    }

    // 分别绘制各图层（根据开关控制）
    // 使用 Canvas2DRenderer 适配 renderLayer 的 IRenderer 参数
    const tileRenderer = new Canvas2DRenderer();
    tileRenderer.init(canvas);
    if (showLayer1) {
      renderLayer(tileRenderer, renderer, "layer1");
    }
    if (showLayer2) {
      renderLayer(tileRenderer, renderer, "layer2");
    }
    if (showLayer3) {
      renderLayer(tileRenderer, renderer, "layer3");
    }

    // 绘制障碍物层
    if (showObstacles) {
      for (let row = startY; row < endY; row++) {
        for (let col = startX; col < endX; col++) {
          const tileIndex = col + row * mapData.mapColumnCounts;
          const tileInfo = mapData.tileInfos[tileIndex];
          if (!tileInfo || tileInfo.barrierType === 0) continue;

          const color = BARRIER_COLORS[tileInfo.barrierType] || "rgba(128, 128, 128, 0.5)";
          const pixelPos = MapBase.toPixelPosition(col, row);
          const screenX = pixelPos.x - renderer.camera.x;
          const screenY = pixelPos.y - renderer.camera.y;

          // 绘制菱形
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(screenX, screenY - 16);
          ctx.lineTo(screenX + 32, screenY);
          ctx.lineTo(screenX, screenY + 16);
          ctx.lineTo(screenX - 32, screenY);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // 绘制陷阱层
    if (showTraps) {
      for (let row = startY; row < endY; row++) {
        for (let col = startX; col < endX; col++) {
          const tileIndex = col + row * mapData.mapColumnCounts;
          const tileInfo = mapData.tileInfos[tileIndex];
          if (!tileInfo || tileInfo.trapIndex === 0) continue;

          const pixelPos = MapBase.toPixelPosition(col, row);
          const screenX = pixelPos.x - renderer.camera.x;
          const screenY = pixelPos.y - renderer.camera.y;

          // 绘制菱形
          ctx.fillStyle = TRAP_COLOR;
          ctx.beginPath();
          ctx.moveTo(screenX, screenY - 16);
          ctx.lineTo(screenX + 32, screenY);
          ctx.lineTo(screenX, screenY + 16);
          ctx.lineTo(screenX - 32, screenY);
          ctx.closePath();
          ctx.fill();

          // 显示陷阱索引
          ctx.fillStyle = "#000";
          ctx.font = "10px Arial";
          ctx.textAlign = "center";
          ctx.fillText(String(tileInfo.trapIndex), screenX, screenY + 4);
        }
      }
    }

    // 绘制 hover 瓦片高亮
    if (
      tilePos.x >= 0 &&
      tilePos.y >= 0 &&
      tilePos.x < mapData.mapColumnCounts &&
      tilePos.y < mapData.mapRowCounts
    ) {
      const pixelPos = MapBase.toPixelPosition(tilePos.x, tilePos.y);
      const screenX = pixelPos.x - renderer.camera.x;
      const screenY = pixelPos.y - renderer.camera.y;

      // 绘制半透明菱形高亮
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY - 16);
      ctx.lineTo(screenX + 32, screenY);
      ctx.lineTo(screenX, screenY + 16);
      ctx.lineTo(screenX - 32, screenY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }, [
    mapData,
    isMapLoading,
    loadProgress,
    zoom,
    showGrid,
    showLayer1,
    showLayer2,
    showLayer3,
    showObstacles,
    showTraps,
    tilePos,
  ]);

  // 动画循环
  useEffect(() => {
    let animationId: number;

    const animate = () => {
      drawMap();
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [drawMap]);

  // 鼠标事件处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      const container = containerRef.current;
      if (!canvas || !renderer || !container) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;

      // 记录鼠标在容器内的位置（用于浮动提示框）
      setMouseClientPos({ x: canvasX, y: canvasY });
      setIsHovering(true);

      // 更新鼠标位置（世界坐标，考虑缩放）
      const worldX = canvasX / zoom + renderer.camera.x;
      const worldY = canvasY / zoom + renderer.camera.y;
      setMousePos({ x: Math.floor(worldX), y: Math.floor(worldY) });

      // 更新瓦片位置
      const tile = MapBase.toTilePosition(worldX, worldY);
      setTilePos({ x: tile.x, y: tile.y });

      // 拖拽移动（考虑缩放）
      if (isDragging) {
        const deltaX = (lastMouseRef.current.x - e.clientX) / zoom;
        const deltaY = (lastMouseRef.current.y - e.clientY) / zoom;
        updateCamera(renderer, deltaX, deltaY);
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [isDragging, zoom]
  );

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setIsHovering(false);
  }, []);

  // 滚轮事件：直接滚轮缩放
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      if (!renderer || !canvas) return;

      // 获取鼠标在 canvas 中的位置
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // 计算鼠标对应的世界坐标（缩放前）
      const worldX = mouseX / zoom + renderer.camera.x;
      const worldY = mouseY / zoom + renderer.camera.y;

      // 计算新的缩放值
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1; // 使用乘法更平滑
      const newZoom = Math.max(0.05, Math.min(4, zoom * zoomDelta));

      // 调整相机位置，使鼠标指向的世界坐标保持不变
      const newCameraX = worldX - mouseX / newZoom;
      const newCameraY = worldY - mouseY / newZoom;

      // 更新相机位置（带边界检查，取整避免亚像素渲染问题）
      renderer.camera.x = Math.floor(Math.max(0, newCameraX));
      renderer.camera.y = Math.floor(Math.max(0, newCameraY));

      setZoom(newZoom);
    },
    [zoom]
  );

  // 获取当前瓦片信息
  const getCurrentTileInfo = useCallback(() => {
    if (!mapData) return null;
    const { x, y } = tilePos;
    if (x < 0 || y < 0 || x >= mapData.mapColumnCounts || y >= mapData.mapRowCounts) {
      return null;
    }
    const tileIndex = x + y * mapData.mapColumnCounts;
    return {
      layer1: mapData.layer1[tileIndex],
      layer2: mapData.layer2[tileIndex],
      layer3: mapData.layer3[tileIndex],
      tileInfo: mapData.tileInfos[tileIndex],
    };
  }, [mapData, tilePos]);

  // 加载/错误状态
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mx-auto" />
          <span className="text-[#808080]">加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
        <div className="text-center text-red-400">
          <span className="text-2xl">❌</span>
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!mapData) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
        <div className="text-center text-[#808080]">
          <span className="text-4xl">🗺️</span>
          <p className="mt-4">选择一个 .map 文件查看</p>
        </div>
      </div>
    );
  }

  const tileInfo = getCurrentTileInfo();

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e] overflow-hidden">
      {/* 工具栏 */}
      <div className="flex shrink-0 items-center gap-4 border-b border-[#3c3c3c] bg-[#252526] px-4 py-2 z-10 relative">
        {/* 文件名 */}
        <div className="flex-1">
          <span className="text-sm text-[#cccccc]">{fileName || "未选择"}</span>
        </div>

        {/* 图层控制 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#808080]">图层:</span>
          <button
            className={`rounded px-2 py-1 text-xs ${
              showLayer1 ? "bg-[#0e639c] text-white" : "bg-[#3c3c3c] text-[#cccccc]"
            }`}
            onClick={() => setShowLayer1(!showLayer1)}
            title="地面层 (底层)"
          >
            L1
          </button>
          <button
            className={`rounded px-2 py-1 text-xs ${
              showLayer2 ? "bg-[#0e639c] text-white" : "bg-[#3c3c3c] text-[#cccccc]"
            }`}
            onClick={() => setShowLayer2(!showLayer2)}
            title="物体层 (中层)"
          >
            L2
          </button>
          <button
            className={`rounded px-2 py-1 text-xs ${
              showLayer3 ? "bg-[#0e639c] text-white" : "bg-[#3c3c3c] text-[#cccccc]"
            }`}
            onClick={() => setShowLayer3(!showLayer3)}
            title="顶层 (遮挡层)"
          >
            L3
          </button>
        </div>

        {/* 调试层控制 */}
        <div className="flex items-center gap-2">
          <button
            className={`rounded px-2 py-1 text-xs ${
              showObstacles ? "bg-red-600 text-white" : "bg-[#3c3c3c] text-[#cccccc]"
            }`}
            onClick={() => setShowObstacles(!showObstacles)}
            title="显示障碍物"
          >
            🚧
          </button>
          <button
            className={`rounded px-2 py-1 text-xs ${
              showTraps ? "bg-yellow-600 text-white" : "bg-[#3c3c3c] text-[#cccccc]"
            }`}
            onClick={() => setShowTraps(!showTraps)}
            title="显示陷阱"
          >
            ⚠️
          </button>
          <button
            className={`rounded px-2 py-1 text-xs ${
              showGrid ? "bg-[#0e639c] text-white" : "bg-[#3c3c3c] text-[#cccccc]"
            }`}
            onClick={() => setShowGrid(!showGrid)}
            title="显示网格"
          >
            #
          </button>
        </div>

        {/* 缩放控制 */}
        <div className="flex items-center gap-2">
          <button
            className="rounded px-2 py-1 text-xs bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}
            title="缩小"
          >
            -
          </button>
          <span className="text-xs text-[#cccccc] w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            className="rounded px-2 py-1 text-xs bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
            onClick={() => setZoom((z) => Math.min(4, z + 0.1))}
            title="放大"
          >
            +
          </button>
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[#cccccc] border-none"
          >
            <option value={0.1}>10%</option>
            <option value={0.25}>25%</option>
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
            <option value={3}>300%</option>
            <option value={4}>400%</option>
          </select>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex flex-1 min-h-0">
        {/* 地图画布区 */}
        <div
          ref={containerRef}
          className="relative flex-1 min-w-0 overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ imageRendering: "pixelated" }}
          />

          {/* 跟随鼠标的瓦片信息提示框 */}
          {isHovering && tileInfo && !isDragging && (
            <div
              className="absolute pointer-events-none bg-[#1e1e1e]/90 border border-[#3c3c3c] rounded px-2 py-1.5 text-xs shadow-lg"
              style={{
                left: mouseClientPos.x + 16,
                top: mouseClientPos.y + 16,
                transform:
                  mouseClientPos.x > (containerRef.current?.clientWidth ?? 0) - 200
                    ? "translateX(-100%)"
                    : undefined,
              }}
            >
              <div className="text-[#cccccc] font-medium mb-1">
                瓦片 ({tilePos.x}, {tilePos.y})
              </div>
              <div className="space-y-0.5 text-[#808080]">
                <div>
                  L1: MPC:{tileInfo.layer1.mpcIndex} F:{tileInfo.layer1.frame}
                </div>
                <div>
                  L2: MPC:{tileInfo.layer2.mpcIndex} F:{tileInfo.layer2.frame}
                </div>
                <div>
                  L3: MPC:{tileInfo.layer3.mpcIndex} F:{tileInfo.layer3.frame}
                </div>
                {tileInfo.tileInfo.barrierType !== 0 && (
                  <div className="text-red-400">
                    障碍: 0x
                    {tileInfo.tileInfo.barrierType.toString(16).toUpperCase().padStart(2, "0")}
                  </div>
                )}
                {tileInfo.tileInfo.trapIndex !== 0 && (
                  <div className="text-yellow-400">陷阱: {tileInfo.tileInfo.trapIndex}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 信息面板 */}
        <div className="w-64 shrink-0 border-l border-[#3c3c3c] bg-[#252526] p-4 overflow-y-auto">
          {/* 地图信息 */}
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium text-[#cccccc]">地图信息</h3>
            <div className="space-y-1 text-xs text-[#808080]">
              <div className="flex justify-between">
                <span>尺寸:</span>
                <span className="text-[#cccccc]">
                  {mapData.mapColumnCounts} × {mapData.mapRowCounts}
                </span>
              </div>
              <div className="flex justify-between">
                <span>像素尺寸:</span>
                <span className="text-[#cccccc]">
                  {mapData.mapPixelWidth} × {mapData.mapPixelHeight}
                </span>
              </div>
              <div className="flex justify-between">
                <span>MPC 路径:</span>
                <span
                  className="text-[#cccccc] text-right truncate max-w-[120px]"
                  title={mapData.mpcDirPath}
                >
                  {mapData.mpcDirPath || "默认"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>MPC 数量:</span>
                <span className="text-[#cccccc]">
                  {mapData.mpcFileNames.filter(Boolean).length}
                </span>
              </div>
            </div>
          </div>

          {/* 当前位置 */}
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium text-[#cccccc]">当前位置</h3>
            <div className="space-y-1 text-xs text-[#808080]">
              <div className="flex justify-between">
                <span>像素:</span>
                <span className="text-[#cccccc]">
                  ({mousePos.x}, {mousePos.y})
                </span>
              </div>
              <div className="flex justify-between">
                <span>瓦片:</span>
                <span className="text-[#cccccc]">
                  ({tilePos.x}, {tilePos.y})
                </span>
              </div>
            </div>
          </div>

          {/* 障碍类型图例 */}
          {showObstacles && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-medium text-[#cccccc]">障碍类型图例</h3>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ background: BARRIER_COLORS[0x80] }} />
                  <span className="text-[#808080]">障碍物 Obstacle (0x80)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ background: BARRIER_COLORS[0xa0] }} />
                  <span className="text-[#808080]">可越过障碍 CanOverObstacle (0xA0)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ background: BARRIER_COLORS[0x40] }} />
                  <span className="text-[#808080]">传送点 Trans (0x40)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ background: BARRIER_COLORS[0x60] }} />
                  <span className="text-[#808080]">可越过传送点 CanOverTrans (0x60)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded" style={{ background: BARRIER_COLORS[0x20] }} />
                  <span className="text-[#808080]">可越过 CanOver (0x20)</span>
                </div>
              </div>
            </div>
          )}

          {/* MPC 文件列表 */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-[#cccccc]">MPC 文件</h3>
            <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
              {mapData.mpcFileNames.map((name, index) => {
                if (!name) return null;
                return (
                  <div
                    key={index}
                    className="flex justify-between text-[#808080] hover:bg-[#3c3c3c] px-1 rounded"
                  >
                    <span className="text-[#569cd6]">[{index + 1}]</span>
                    <span className="text-[#cccccc] truncate ml-2" title={name}>
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 状态栏 */}
      <div className="flex shrink-0 h-6 items-center gap-4 border-t border-[#3c3c3c] bg-[#007acc] px-4 text-xs text-white">
        <span>
          坐标: ({mousePos.x}, {mousePos.y})
        </span>
        <span>
          瓦片: ({tilePos.x}, {tilePos.y})
        </span>
        <span>缩放: {Math.round(zoom * 100)}%</span>
        {isMapLoading && <span>加载中: {Math.round(loadProgress * 100)}%</span>}
      </div>
    </div>
  );
}
