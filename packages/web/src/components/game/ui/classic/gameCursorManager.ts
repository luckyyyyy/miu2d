/**
 * GameCursorManager - 独立于 React 的游戏鼠标管理器
 *
 * 实现方式：
 * - 在指定容器内创建一个 overlay div
 * - 使用 CSS cursor 属性设置自定义鼠标图像
 * - 使用 blob URL 存储光标图像
 * - 动态修改 cursor 属性切换帧（不预生成 CSS 类）
 * - 完全脱离 React 机制
 */
import { buildPath } from "@miu2d/engine/config";
import { type AsfData, getFrameCanvas, loadAsf } from "@miu2d/engine/sprite/asf";

// UI 配置
const MOUSE_CONFIG = {
  image: "asf/ui/common/mouse.asf",
};

// 常量
const CURSOR_OVERLAY_ID = "game-cursor-overlay";

// 状态
let isInitialized = false;
let isEnabled = false;
let overlayElement: HTMLDivElement | null = null;
let containerElement: HTMLElement | null = null;
let animationTimer: number | null = null;
let currentFrameIndex = 0;

// 缓存
let cachedAsfData: AsfData | null = null;
let cachedFrameBlobUrls: string[] = [];
let loadPromise: Promise<void> | null = null;

/**
 * 将 canvas 转换为 blob URL
 */
function canvasToBlobUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(URL.createObjectURL(blob));
      } else {
        reject(new Error("Failed to create blob from canvas"));
      }
    }, "image/png");
  });
}

/**
 * 加载鼠标 ASF 资源并转换为 blob URL
 */
async function loadCursorAsf(): Promise<void> {
  if (cachedAsfData && cachedFrameBlobUrls.length > 0) return;

  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = (async () => {
    const fullPath = buildPath(MOUSE_CONFIG.image);
    const data = await loadAsf(fullPath);
    if (data && data.frames.length > 0) {
      cachedAsfData = data;
      // 转换每帧为 blob URL
      cachedFrameBlobUrls = await Promise.all(
        data.frames.map((frame) => {
          const canvas = getFrameCanvas(frame);
          return canvasToBlobUrl(canvas);
        })
      );
    }
  })();

  await loadPromise;
}

/**
 * 在容器内创建 overlay div
 */
function createOverlay(container: HTMLElement): void {
  // 移除旧的 overlay
  const existing = document.getElementById(CURSOR_OVERLAY_ID);
  if (existing) {
    existing.parentNode?.removeChild(existing);
  }

  overlayElement = document.createElement("div");
  overlayElement.id = CURSOR_OVERLAY_ID;
  overlayElement.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 99999;
    pointer-events: none;
  `;
  
  // 确保容器有 position
  const containerStyle = window.getComputedStyle(container);
  if (containerStyle.position === "static") {
    container.style.position = "relative";
  }
  
  container.appendChild(overlayElement);
  containerElement = container;
}

/**
 * 切换到指定帧 - 直接修改 cursor 属性
 */
function switchToFrame(frameIndex: number): void {
  if (!overlayElement || cachedFrameBlobUrls.length === 0) return;
  const blobUrl = cachedFrameBlobUrls[frameIndex];
  overlayElement.style.cursor = `url(${blobUrl}) 0 0, auto`;
  // 同时设置容器的 cursor
  if (containerElement) {
    containerElement.style.cursor = `url(${blobUrl}) 0 0, auto`;
  }
}

/**
 * 启动动画
 */
function startAnimation(): void {
  if (animationTimer !== null) return;
  if (cachedFrameBlobUrls.length === 0) return;

  // 单帧不需要动画
  if (cachedFrameBlobUrls.length === 1) {
    switchToFrame(0);
    return;
  }

  const interval = cachedAsfData?.interval ?? 100;

  const animate = () => {
    currentFrameIndex = (currentFrameIndex + 1) % cachedFrameBlobUrls.length;
    switchToFrame(currentFrameIndex);
    animationTimer = window.setTimeout(animate, interval);
  };

  currentFrameIndex = 0;
  switchToFrame(0);
  animationTimer = window.setTimeout(animate, interval);
}

/**
 * 停止动画
 */
function stopAnimation(): void {
  if (animationTimer !== null) {
    clearTimeout(animationTimer);
    animationTimer = null;
  }
}

// ========== 公共 API ==========

/**
 * 初始化游戏光标系统
 * 只需调用一次，后续可通过 enable/disable 控制
 */
export async function initGameCursor(): Promise<void> {
  if (isInitialized) return;

  await loadCursorAsf();

  isInitialized = true;
}

/**
 * 启用游戏光标
 * @param container 游戏容器元素，overlay 将创建在此容器内
 */
export function enableGameCursor(container: HTMLElement): void {
  if (!isInitialized) {
    console.warn("[GameCursor] 请先调用 initGameCursor()");
    return;
  }

  if (isEnabled) {
    // 如果已启用但容器不同，先禁用再重新启用
    if (containerElement !== container) {
      disableGameCursor();
    } else {
      return;
    }
  }
  
  isEnabled = true;

  createOverlay(container);
  startAnimation();
}

/**
 * 禁用游戏光标
 */
export function disableGameCursor(): void {
  if (!isEnabled) return;
  isEnabled = false;

  stopAnimation();

  // 恢复容器的 cursor
  if (containerElement) {
    containerElement.style.cursor = "";
  }

  // 移除 overlay
  if (overlayElement?.parentNode) {
    overlayElement.parentNode.removeChild(overlayElement);
  }

  overlayElement = null;
  containerElement = null;
}

/**
 * 销毁游戏光标系统
 */
export function destroyGameCursor(): void {
  disableGameCursor();

  // 释放 blob URLs
  cachedFrameBlobUrls.forEach((url) => URL.revokeObjectURL(url));
  cachedFrameBlobUrls = [];
  cachedAsfData = null;
  loadPromise = null;

  isInitialized = false;
}

/**
 * 检查是否已启用
 */
export function isGameCursorEnabled(): boolean {
  return isEnabled;
}

/**
 * 检查是否已初始化
 */
export function isGameCursorInitialized(): boolean {
  return isInitialized;
}
