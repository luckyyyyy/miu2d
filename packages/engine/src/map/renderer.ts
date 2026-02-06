/** 地图渲染器 - Canvas 基于的 JxqyMap 渲染 */

import { ResourcePath } from "../config/resourcePaths";
import { logger } from "../core/logger";
import type { Camera, JxqyMapData, Mpc } from "../core/mapTypes";
import { loadMpc } from "../resource/mpc";
import type { IRenderer } from "../webgl/IRenderer";
import { MapBase } from "./mapBase";

/** 单个 MPC 图集：一张 atlas canvas + 每帧的源矩形 */
export interface MpcAtlas {
  canvas: HTMLCanvasElement;
  rects: { x: number; y: number; w: number; h: number }[];
}

export interface MapRenderer {
  mapData: JxqyMapData;
  mpcs: (Mpc | null)[];
  mpcCanvases: (HTMLCanvasElement[][] | null)[];
  /** MPC 图集（每个 MPC 文件一张 atlas） */
  mpcAtlases: (MpcAtlas | null)[];
  camera: Camera;
  isLoading: boolean;
  loadProgress: number;
  loadVersion: number;
  /** 已加载 MPC 中的最大瓦片高度（像素），用于计算视图 padding */
  maxTileHeight: number;
  /** 已加载 MPC 中的最大瓦片宽度（像素） */
  maxTileWidth: number;
  _cameraDebugLogged?: boolean;
}

export function createMapRenderer(): MapRenderer {
  return {
    mapData: null as unknown as JxqyMapData,
    mpcs: [],
    mpcCanvases: [],
    mpcAtlases: [],
    camera: { x: 0, y: 0, width: 800, height: 600 },
    isLoading: true,
    loadProgress: 0,
    loadVersion: 0,
    maxTileHeight: 0,
    maxTileWidth: 0,
  };
}

/** 预渲染 MPC 帧到 canvas（保留用于兼容） */
function createMpcCanvases(mpc: Mpc): HTMLCanvasElement[] {
  return mpc.frames.map((frame) => {
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.putImageData(frame.imageData, 0, 0);
    return canvas;
  });
}

/** 将 MPC 所有帧打包到一张 atlas canvas 中，减少纹理切换 */
function createMpcAtlas(mpc: Mpc): MpcAtlas {
  const frames = mpc.frames;
  if (frames.length === 0) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return { canvas: c, rects: [] };
  }

  // 使用行式排列：所有帧横向排列
  // 如果帧数较多则换行（每行最多 8 帧，避免 atlas 过宽）
  const maxCols = Math.min(frames.length, 8);
  const rows = Math.ceil(frames.length / maxCols);

  // 计算每行的最大尺寸（帧可能大小不一）
  let maxFrameWidth = 0;
  let maxFrameHeight = 0;
  for (const frame of frames) {
    if (frame.width > maxFrameWidth) maxFrameWidth = frame.width;
    if (frame.height > maxFrameHeight) maxFrameHeight = frame.height;
  }

  const atlasWidth = maxCols * maxFrameWidth;
  const atlasHeight = rows * maxFrameHeight;

  const canvas = document.createElement("canvas");
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext("2d");

  const rects: { x: number; y: number; w: number; h: number }[] = [];

  if (ctx) {
    for (let i = 0; i < frames.length; i++) {
      const col = i % maxCols;
      const row = Math.floor(i / maxCols);
      const x = col * maxFrameWidth;
      const y = row * maxFrameHeight;
      ctx.putImageData(frames[i].imageData, x, y);
      rects.push({ x, y, w: frames[i].width, h: frames[i].height });
    }
  }

  return { canvas, rects };
}

/** 加载地图的所有 MPC 文件 */
export async function loadMapMpcs(
  renderer: MapRenderer,
  mapData: JxqyMapData,
  mapNameWithoutExt: string,
  onProgress?: (progress: number) => void,
  /** 可选的资源根目录，用于编辑器等场景覆盖默认路径 */
  resourceRoot?: string
): Promise<boolean> {
  renderer.loadVersion++;
  const currentLoadVersion = renderer.loadVersion;

  renderer.mapData = null as unknown as JxqyMapData;
  renderer.mpcs = [];
  renderer.mpcCanvases = [];
  renderer.mpcAtlases = [];
  renderer.isLoading = true;
  renderer.loadProgress = 0;
  renderer.maxTileHeight = 0;
  renderer.maxTileWidth = 0;

  // 确定 MPC 基础路径
  let mpcBasePath = mapData.mpcDirPath;
  if (!mpcBasePath || mpcBasePath.trim() === "") {
    mpcBasePath = `mpc/map/${mapNameWithoutExt}`;
  } else {
    mpcBasePath = mpcBasePath.replace(/\\/g, "/");
  }
  if (!mpcBasePath.startsWith("/")) {
    // 如果提供了 resourceRoot，使用它；否则使用全局配置
    if (resourceRoot) {
      const normalized = mpcBasePath.startsWith("/") ? mpcBasePath.slice(1) : mpcBasePath;
      mpcBasePath = `${resourceRoot}/${normalized}`;
    } else {
      mpcBasePath = ResourcePath.from(mpcBasePath);
    }
  }

  const totalMpcs = mapData.mpcFileNames.filter((n) => n !== null).length;
  let loadedCount = 0;

  // Temporary arrays to hold loaded data
  const tempMpcs: (Mpc | null)[] = [];
  const tempMpcCanvases: (HTMLCanvasElement[][] | null)[] = [];
  const tempMpcAtlases: (MpcAtlas | null)[] = [];
  let maxTileHeight = 0;
  let maxTileWidth = 0;

  for (let i = 0; i < mapData.mpcFileNames.length; i++) {
    // Check if this load has been superseded
    if (renderer.loadVersion !== currentLoadVersion) {
      logger.log("Load cancelled due to newer load request");
      return false;
    }

    const mpcFileName = mapData.mpcFileNames[i];
    if (mpcFileName === null) {
      tempMpcs.push(null);
      tempMpcCanvases.push(null);
      tempMpcAtlases.push(null);
      continue;
    }

    const mpcUrl = `${mpcBasePath}/${mpcFileName}`;
    try {
      const mpc = await loadMpc(mpcUrl);
      tempMpcs.push(mpc);
      if (mpc) {
        tempMpcCanvases.push([createMpcCanvases(mpc)]);
        tempMpcAtlases.push(createMpcAtlas(mpc));
        // 跟踪最大瓦片尺寸（用于视图 padding 计算）
        for (const frame of mpc.frames) {
          if (frame.height > maxTileHeight) maxTileHeight = frame.height;
          if (frame.width > maxTileWidth) maxTileWidth = frame.width;
        }
      } else {
        tempMpcCanvases.push(null);
        tempMpcAtlases.push(null);
      }
    } catch (error) {
      logger.warn(`Failed to load MPC: ${mpcUrl}`, error);
      tempMpcs.push(null);
      tempMpcCanvases.push(null);
      tempMpcAtlases.push(null);
    }

    loadedCount++;
    renderer.loadProgress = loadedCount / totalMpcs;
    onProgress?.(renderer.loadProgress);
  }

  // Final check before committing data
  if (renderer.loadVersion !== currentLoadVersion) {
    logger.log("Load cancelled due to newer load request");
    return false;
  }

  // Commit all data atomically
  renderer.mapData = mapData;
  renderer.mpcs = tempMpcs;
  renderer.mpcCanvases = tempMpcCanvases;
  renderer.mpcAtlases = tempMpcAtlases;
  renderer.maxTileHeight = maxTileHeight;
  renderer.maxTileWidth = maxTileWidth;
  renderer.isLoading = false;
  renderer.loadProgress = 1;

  return true;
}

/** 获取当前视图的瓦片范围（动态 padding，基于实际瓦片尺寸） */
export function getViewTileRange(
  camera: Camera,
  mapData: JxqyMapData,
  maxTileHeight = 320,
  maxTileWidth = 320
): { startX: number; startY: number; endX: number; endY: number } {
  const start = MapBase.ToTilePosition(camera.x, camera.y);
  const end = MapBase.ToTilePosition(camera.x + camera.width, camera.y + camera.height);

  // 瓦片从锚点向上延伸 (height - 16) 像素，行间距 16px
  // 所以视图下方需要更多 padding 才能看到向上延伸的高大瓦片
  const paddingBottom = Math.ceil((maxTileHeight - 16) / 16) + 2;
  const paddingTop = 3;
  // 瓦片从中心向左右延伸 width/2 像素，列间距 64px
  const paddingX = Math.ceil(maxTileWidth / 2 / 64) + 2;

  return {
    startX: Math.max(0, start.x - paddingX),
    startY: Math.max(0, start.y - paddingTop),
    endX: Math.min(mapData.mapColumnCounts, end.x + paddingX),
    endY: Math.min(mapData.mapRowCounts, end.y + paddingBottom),
  };
}

/** 绘制单个瓦片层 */
function drawTileLayer(
  renderer: IRenderer,
  mapRenderer: MapRenderer,
  layer: "layer1" | "layer2" | "layer3",
  col: number,
  row: number
): void {
  const mapData = mapRenderer.mapData;
  const tileIndex = col + row * mapData.mapColumnCounts;

  if (tileIndex < 0 || tileIndex >= mapData[layer].length) return;

  const tileData = mapData[layer][tileIndex];
  if (tileData.mpcIndex === 0) return;

  const mpcIndex = tileData.mpcIndex - 1;

  // 优先使用 atlas（单纹理，减少纹理切换）
  const atlas = mapRenderer.mpcAtlases[mpcIndex];
  if (atlas && tileData.frame < atlas.rects.length) {
    const rect = atlas.rects[tileData.frame];
    const pixelPos = MapBase.ToPixelPosition(col, row);
    const drawX = Math.floor(pixelPos.x - rect.w / 2 - mapRenderer.camera.x);
    const drawY = Math.floor(pixelPos.y - (rect.h - 16) - mapRenderer.camera.y);

    renderer.drawSourceEx(
      atlas.canvas,
      drawX,
      drawY,
      {
        srcX: rect.x,
        srcY: rect.y,
        srcWidth: rect.w,
        srcHeight: rect.h,
        dstWidth: rect.w + 1,
        dstHeight: rect.h + 1,
      }
    );
    return;
  }

  // 回退到旧的 per-frame canvas 方式
  const mpcCanvases = mapRenderer.mpcCanvases[mpcIndex];
  if (!mpcCanvases?.[0]) return;

  const frameCanvas = mpcCanvases[0][tileData.frame];
  if (!frameCanvas || !mapRenderer.mpcs[mpcIndex]) return;

  const pixelPos = MapBase.ToPixelPosition(col, row);
  const drawX = Math.floor(pixelPos.x - frameCanvas.width / 2 - mapRenderer.camera.x);
  const drawY = Math.floor(pixelPos.y - (frameCanvas.height - 16) - mapRenderer.camera.y);

  renderer.drawSourceEx(
    frameCanvas,
    drawX,
    drawY,
    {
      srcWidth: frameCanvas.width,
      srcHeight: frameCanvas.height,
      dstWidth: frameCanvas.width + 1,
      dstHeight: frameCanvas.height + 1,
    }
  );
}

/** 渲染指定图层 */
export function renderLayer(
  renderer: IRenderer,
  mapRenderer: MapRenderer,
  layer: "layer1" | "layer2" | "layer3"
): void {
  const { camera, mapData } = mapRenderer;
  if (!mapData || mapRenderer.isLoading) return;

  const { startX, startY, endX, endY } = getViewTileRange(
    camera, mapData, mapRenderer.maxTileHeight, mapRenderer.maxTileWidth
  );

  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(renderer, mapRenderer, layer, col, row);
    }
  }
}

/** 在指定位置绘制 layer2 瓦片（用于交错渲染） */
export function drawLayer1TileAt(
  renderer: IRenderer,
  mapRenderer: MapRenderer,
  col: number,
  row: number
): void {
  if (!mapRenderer.mapData || mapRenderer.isLoading) return;
  drawTileLayer(renderer, mapRenderer, "layer2", col, row);
}

/** 获取瓦片纹理的世界坐标区域（用于碰撞检测） */
export function getTileTextureRegion(
  renderer: MapRenderer,
  col: number,
  row: number,
  layer: "layer1" | "layer2" | "layer3"
): { x: number; y: number; width: number; height: number } | null {
  const mapData = renderer.mapData;
  if (!mapData || renderer.isLoading) return null;

  const tileIndex = col + row * mapData.mapColumnCounts;
  if (tileIndex < 0 || tileIndex >= mapData[layer].length) return null;

  const tileData = mapData[layer][tileIndex];
  if (tileData.mpcIndex === 0) return null;

  const mpcCanvases = renderer.mpcCanvases[tileData.mpcIndex - 1];
  if (!mpcCanvases?.[0]) return null;

  const frameCanvas = mpcCanvases[0][tileData.frame];
  if (!frameCanvas) return null;

  const pixelPos = MapBase.ToPixelPosition(col, row);
  return {
    x: pixelPos.x - frameCanvas.width / 2,
    y: pixelPos.y - (frameCanvas.height - 16),
    width: frameCanvas.width,
    height: frameCanvas.height,
  };
}

/** 检查指定瓦片是否有纹理 */
export function hasTileTexture(
  renderer: MapRenderer,
  col: number,
  row: number,
  layer: "layer1" | "layer2" | "layer3"
): boolean {
  const mapData = renderer.mapData;
  if (!mapData || renderer.isLoading) return false;

  const tileIndex = col + row * mapData.mapColumnCounts;
  if (tileIndex < 0 || tileIndex >= mapData[layer].length) return false;

  return mapData[layer][tileIndex].mpcIndex !== 0;
}

/** 交错渲染地图（layer1 -> layer2+角色 -> layer3） */
export function renderMapInterleaved(
  renderer: IRenderer,
  mapRenderer: MapRenderer,
  drawCharactersAtRow?: (row: number, startCol: number, endCol: number) => void
): void {
  const { camera, mapData } = mapRenderer;

  if (!mapData || mapRenderer.isLoading) {
    const ctx = renderer.getContext2D();
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        `加载中... ${Math.round(mapRenderer.loadProgress * 100)}%`,
        camera.width / 2,
        camera.height / 2
      );
    }
    return;
  }

  const { startX, startY, endX, endY } = getViewTileRange(
    camera, mapData, mapRenderer.maxTileHeight, mapRenderer.maxTileWidth
  );

  // 1. 绘制 layer1 (地面)
  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(renderer, mapRenderer, "layer1", col, row);
    }
  }

  // 2. layer2 与角色交错渲染
  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(renderer, mapRenderer, "layer2", col, row);
    }
    drawCharactersAtRow?.(row, startX, endX);
  }

  // 3. 绘制 layer3 (顶层物体)
  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      drawTileLayer(renderer, mapRenderer, "layer3", col, row);
    }
  }
}

/** 渲染地图到画布（不含角色交错） */
export function renderMap(renderer: IRenderer, mapRenderer: MapRenderer): void {
  const { camera, mapData } = mapRenderer;
  renderer.fillRect({
    x: 0,
    y: 0,
    width: camera.width,
    height: camera.height,
    color: "#1a1a2e",
  });

  if (!mapData || mapRenderer.isLoading) {
    const ctx = renderer.getContext2D();
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        `加载中... ${Math.round(mapRenderer.loadProgress * 100)}%`,
        camera.width / 2,
        camera.height / 2
      );
    }
    return;
  }

  const { startX, startY, endX, endY } = getViewTileRange(
    camera, mapData, mapRenderer.maxTileHeight, mapRenderer.maxTileWidth
  );

  // 按层次绘制: layer1 -> layer2 -> layer3
  for (const layer of ["layer1", "layer2", "layer3"] as const) {
    for (let row = startY; row < endY; row++) {
      for (let col = startX; col < endX; col++) {
        drawTileLayer(renderer, mapRenderer, layer, col, row);
      }
    }
  }
}

/** 更新相机位置（带边界检查） */
export function updateCamera(renderer: MapRenderer, deltaX: number, deltaY: number): void {
  if (!renderer.mapData) return;

  const { camera, mapData } = renderer;
  const newX = Math.max(0, Math.min(camera.x + deltaX, mapData.mapPixelWidth - camera.width));
  const newY = Math.max(0, Math.min(camera.y + deltaY, mapData.mapPixelHeight - camera.height));

  camera.x = Math.floor(newX);
  camera.y = Math.floor(newY);
}

export function setCameraSize(renderer: MapRenderer, width: number, height: number): void {
  renderer.camera.width = width;
  renderer.camera.height = height;
}
