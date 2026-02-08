/**
 * NPC 预览组件
 *
 * 显示 NPC 的各种姿态动画：
 * - Stand (站立)
 * - Stand1 (待机)
 * - Walk (行走)
 * - Attack (攻击)
 * - Hurt (受伤)
 * - Death (死亡)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AsfData } from "@miu2d/engine/resource/asf";
import { getFrameCanvas } from "@miu2d/engine/resource/asf";
import { initWasm } from "@miu2d/engine/wasm/wasmManager";
import { decodeAsfWasm } from "@miu2d/engine/wasm/wasmAsfDecoder";
import type { Npc, NpcState, NpcResource, NpcAppearance } from "@miu2d/types";
import { NpcStateLabels, npcStateToResourceKey } from "@miu2d/types";

// ========== 类型定义 ==========

interface NpcPreviewProps {
  gameSlug: string;
  npc: Partial<Npc> | null;
  /** 关联的 NPC 资源（用于获取资源） */
  resource?: NpcAppearance;
}

/** 可预览的状态列表 */
const PREVIEW_STATES: NpcState[] = [
  "Stand", "Stand1", "Walk", "Run", "Jump",
  "FightStand", "FightWalk", "FightRun", "FightJump",
  "Attack", "Attack1", "Attack2", "Hurt", "Death", "Sit",
  "Special1", "Special2",
];

// ========== 主组件 ==========

export function NpcPreview({ gameSlug, npc, resource }: NpcPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // WASM 状态
  const [wasmReady, setWasmReady] = useState(false);

  // 当前选中的状态
  const [selectedState, setSelectedState] = useState<NpcState>("Stand");

  // 当前方向（0-7）
  const [direction, setDirection] = useState(2); // 默认向右

  // ASF 数据
  const [asfData, setAsfData] = useState<AsfData | null>(null);

  // 动画帧（使用 ref 避免触发 effect 重新执行）
  const frameRef = useRef(0);

  // 累积时间（模拟引擎的 elapsedMilliSecond）
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(0);

  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 获取实际使用的资源配置（优先使用关联的资源，否则使用 NPC 自身的资源）
  const resources = resource?.resources ?? npc?.resources;

  // ========== 初始化 WASM ==========
  useEffect(() => {
    initWasm()
      .then(() => setWasmReady(true))
      .catch((err) => {
        console.error("Failed to init WASM:", err);
      });
  }, []);

  // ========== 规范化图像路径 ==========
  const normalizeImagePath = useCallback((imagePath: string | null | undefined): string | null => {
    if (!imagePath) return null;

    let path = imagePath.trim();
    if (!path) return null;

    // 规范化路径分隔符
    path = path.replace(/\\/g, "/");

    // 移除开头的斜杠
    if (path.startsWith("/")) {
      path = path.slice(1);
    }

    // 判断是否是绝对路径
    const lowerPath = path.toLowerCase();
    if (lowerPath.startsWith("asf/") || lowerPath.startsWith("mpc/")) {
      return path.toLowerCase();
    }

    // 相对路径：添加默认前缀
    return `asf/character/${path}`.toLowerCase();
  }, []);

  // ========== 获取当前状态的资源路径 ==========
  const getResourcePath = useCallback((state: NpcState): string | null => {
    if (!resources) return null;

    const stateKey = npcStateToResourceKey(state);
    const resource = resources[stateKey];

    // 规范化路径（兼容旧数据）
    return normalizeImagePath(resource?.image);
  }, [resources, normalizeImagePath]);

  // ========== 加载 ASF 文件 ==========
  const loadAsf = useCallback(
    async (imagePath: string): Promise<AsfData | null> => {
      if (!wasmReady || !gameSlug) return null;

      try {
        const url = `/game/${gameSlug}/resources/${imagePath}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        return decodeAsfWasm(buffer);
      } catch (err) {
        console.error(`Failed to load ASF: ${imagePath}`, err);
        return null;
      }
    },
    [wasmReady, gameSlug]
  );

  // ========== 加载选中状态的资源 ==========
  useEffect(() => {
    if (!wasmReady || !npc) return;

    const loadSelectedState = async () => {
      const path = getResourcePath(selectedState);
      if (!path) {
        setAsfData(null);
        setLoadError(`${NpcStateLabels[selectedState]} 状态未配置动画资源`);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      setAsfData(null);
      // 重置动画状态
      frameRef.current = 0;
      elapsedRef.current = 0;
      lastTimeRef.current = 0;

      const data = await loadAsf(path);
      if (data) {
        setAsfData(data);
      } else {
        setLoadError(`无法加载 ${path}`);
      }
      setIsLoading(false);
    };

    loadSelectedState();
  }, [wasmReady, npc, selectedState, getResourcePath, loadAsf]);

  // ========== 动画渲染 ==========
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !asfData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { frames, framesPerDirection, interval } = asfData;
    if (frames.length === 0) return;

    // 计算帧索引
    const directionOffset = direction * framesPerDirection;
    const totalDirectionFrames = Math.min(framesPerDirection, frames.length - directionOffset);

    if (totalDirectionFrames <= 0) return;

    // 重置动画状态
    frameRef.current = 0;
    elapsedRef.current = 0;
    lastTimeRef.current = 0;

    // 帧间隔：使用 ASF 文件中的原始值，与游戏引擎一致
    const frameInterval = interval || 100;

    const animate = (time: number) => {
      // 计算 deltaTime（毫秒）
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }
      const deltaMs = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // 累积时间（模拟引擎的 elapsedMilliSecond）
      elapsedRef.current += deltaMs;

      // 当累积时间超过帧间隔时切换帧
      if (elapsedRef.current >= frameInterval) {
        elapsedRef.current -= frameInterval;
        frameRef.current = (frameRef.current + 1) % totalDirectionFrames;
      }

      // 计算当前帧索引
      const frameIndex = directionOffset + frameRef.current;

      // 清空画布
      ctx.fillStyle = "#1e1e1e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制帧
      if (frameIndex < frames.length) {
        const frameCanvas = getFrameCanvas(frames[frameIndex]);
        if (frameCanvas) {
          // 居中绘制，放大 2 倍
          const scale = 2;
          const x = (canvas.width - frameCanvas.width * scale) / 2;
          const y = (canvas.height - frameCanvas.height * scale) / 2;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            frameCanvas,
            x,
            y,
            frameCanvas.width * scale,
            frameCanvas.height * scale
          );
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [asfData, direction]);

  // ========== 获取可用的状态列表 ==========
  const availableStates = PREVIEW_STATES.filter((state) => {
    const stateKey = npcStateToResourceKey(state);
    return npc?.resources?.[stateKey]?.image;
  });

  // ========== 方向控制 ==========
  const handleDirectionChange = (delta: number) => {
    setDirection((d) => (d + delta + 8) % 8);
    // 重置帧
    frameRef.current = 0;
    elapsedRef.current = 0;
  };

  // 方向标签
  const directionLabels = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

  return (
    <div className="space-y-4">
      {/* 画布 */}
      <div className="relative bg-[#1e1e1e] rounded-lg overflow-hidden aspect-square">
        <canvas
          ref={canvasRef}
          width={256}
          height={256}
          className="w-full h-full"
          style={{ imageRendering: "pixelated" }}
        />

        {/* 加载中 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-sm text-[#858585]">加载中...</div>
          </div>
        )}

        {/* 错误提示 */}
        {loadError && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xs text-[#858585] text-center px-4">{loadError}</div>
          </div>
        )}

        {/* 方向控制 */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleDirectionChange(-1)}
            className="w-6 h-6 flex items-center justify-center rounded bg-black/50 hover:bg-black/70 text-white text-xs"
          >
            ◀
          </button>
          <span className="w-6 h-6 flex items-center justify-center rounded bg-black/50 text-white text-sm">
            {directionLabels[direction]}
          </span>
          <button
            type="button"
            onClick={() => handleDirectionChange(1)}
            className="w-6 h-6 flex items-center justify-center rounded bg-black/50 hover:bg-black/70 text-white text-xs"
          >
            ▶
          </button>
        </div>
      </div>

      {/* 状态选择 */}
      <div className="grid grid-cols-3 gap-1">
        {PREVIEW_STATES.map((state) => {
          const isAvailable = availableStates.includes(state);
          const isSelected = state === selectedState;

          return (
            <button
              key={state}
              type="button"
              onClick={() => isAvailable && setSelectedState(state)}
              disabled={!isAvailable}
              className={`px-2 py-1.5 text-xs rounded transition-colors ${
                isSelected
                  ? "bg-[#094771] text-white"
                  : isAvailable
                  ? "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#4c4c4c]"
                  : "bg-[#2a2a2a] text-[#555] cursor-not-allowed"
              }`}
            >
              {NpcStateLabels[state]}
            </button>
          );
        })}
      </div>

      {/* NPC 信息 */}
      {npc && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#858585]">名称</span>
            <span className="text-[#cccccc]">{npc.name || "未命名"}</span>
          </div>
          {npc.level !== undefined && (
            <div className="flex justify-between">
              <span className="text-[#858585]">等级</span>
              <span className="text-[#cccccc]">{npc.level}</span>
            </div>
          )}
          {npc.life !== undefined && (
            <div className="flex justify-between">
              <span className="text-[#858585]">生命</span>
              <span className="text-[#cccccc]">{npc.life} / {npc.lifeMax || npc.life}</span>
            </div>
          )}
          {npc.attack !== undefined && (
            <div className="flex justify-between">
              <span className="text-[#858585]">攻击</span>
              <span className="text-[#cccccc]">{npc.attack}</span>
            </div>
          )}
          {npc.defend !== undefined && (
            <div className="flex justify-between">
              <span className="text-[#858585]">防御</span>
              <span className="text-[#cccccc]">{npc.defend}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
