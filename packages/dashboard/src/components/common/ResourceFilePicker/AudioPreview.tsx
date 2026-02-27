/**
 * 音频预览组件
 * 支持 WAV/OGG/MP3/XNB 播放
 *
 * XNB 文件使用自定义解析器解码
 */

import { parseXnbAudio, xnbToAudioBuffer } from "@miu2d/engine/resource/format/xnb";
import { useCallback, useEffect, useRef, useState } from "react";
import { getResourceRoot } from "../../../utils/resourcePath";

interface AudioPreviewProps {
  /** 游戏 slug */
  gameSlug: string;
  /** 音频文件路径 */
  path: string;
  /** 是否紧凑模式（用于悬停预览） */
  compact?: boolean;
  /** 是否自动播放 */
  autoPlay?: boolean;
}

// Web Audio API context（懒加载）
let audioContextInstance: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!audioContextInstance) {
    audioContextInstance = new AudioContext();
  }
  return audioContextInstance;
}

export function AudioPreview({ gameSlug, path, compact, autoPlay }: AudioPreviewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  // Web Audio API 用于播放 XNB
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isXnb, setIsXnb] = useState(false);
  // 追踪是否已尝试回退到原始格式
  const triedFallbackRef = useRef(false);

  // 构建音频 URL（路径自动转小写）
  const buildAudioUrl = useCallback(
    (filePath: string, useOgg: boolean): string => {
      let finalPath = filePath.toLowerCase();
      // 如果是 wav 文件且需要尝试 ogg
      if (useOgg && finalPath.endsWith(".wav")) {
        finalPath = finalPath.replace(/\.wav$/, ".ogg");
      }
      return `${getResourceRoot(gameSlug)}/${finalPath}`;
    },
    [gameSlug]
  );

  // 播放/暂停
  const togglePlay = useCallback(() => {
    if (isXnb) {
      // XNB 使用 Web Audio API
      const ctx = getAudioContext();
      if (isPlaying) {
        // 暂停
        if (sourceNodeRef.current) {
          sourceNodeRef.current.stop();
          sourceNodeRef.current = null;
          pausedAtRef.current = ctx.currentTime - startTimeRef.current;
        }
        setIsPlaying(false);
      } else {
        // 播放
        if (audioBufferRef.current) {
          const source = ctx.createBufferSource();
          source.buffer = audioBufferRef.current;
          source.connect(ctx.destination);
          source.onended = () => {
            setIsPlaying(false);
            setCurrentTime(0);
            pausedAtRef.current = 0;
          };
          source.start(0, pausedAtRef.current);
          startTimeRef.current = ctx.currentTime - pausedAtRef.current;
          sourceNodeRef.current = source;
          setIsPlaying(true);
        }
      }
    } else {
      // 普通音频使用 HTML5 Audio
      const audio = audioRef.current;
      if (!audio) return;

      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch((e) => {
          setError(`播放失败: ${e.message}`);
        });
      }
    }
  }, [isPlaying, isXnb]);

  // 停止
  const stop = useCallback(() => {
    if (isXnb) {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      }
      pausedAtRef.current = 0;
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
    }
    setCurrentTime(0);
    setIsPlaying(false);
  }, [isXnb]);

  // 更新 XNB 播放进度
  useEffect(() => {
    if (!isXnb || !isPlaying) return;

    const ctx = getAudioContext();
    const interval = setInterval(() => {
      const elapsed = ctx.currentTime - startTimeRef.current;
      setCurrentTime(elapsed);
      if (elapsed >= duration) {
        setIsPlaying(false);
        setCurrentTime(0);
        pausedAtRef.current = 0;
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isXnb, isPlaying, duration]);

  // 事件处理
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
      setError(null);
      // 自动播放
      if (autoPlay) {
        audio.play().catch(() => {});
      }
    };
    const handleError = () => {
      // 如果 OGG 失败且还没尝试过回退，尝试原始路径
      if (!triedFallbackRef.current && path.toLowerCase().endsWith(".wav")) {
        triedFallbackRef.current = true;
        audio.src = buildAudioUrl(path, false);
        audio.load();
        return;
      }
      setError("无法加载音频文件");
      setIsLoaded(false);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("error", handleError);
    };
  }, [autoPlay, path, buildAudioUrl]);

  // 加载音频
  useEffect(() => {
    if (!path) return;

    setError(null);
    setIsLoaded(false);
    triedFallbackRef.current = false;
    pausedAtRef.current = 0;

    // 停止之前的播放
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }

    const lowerPath = path.toLowerCase();

    // 检查是否是 XNB 文件
    if (lowerPath.endsWith(".xnb")) {
      setIsXnb(true);

      // 使用 XNB 解析器加载
      const loadXnb = async () => {
        try {
          const url = `${getResourceRoot(gameSlug)}/${lowerPath}`;
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const buffer = await response.arrayBuffer();

          const xnbResult = parseXnbAudio(buffer);
          if (!xnbResult.success || !xnbResult.data) {
            throw new Error(xnbResult.error || "XNB 解析失败");
          }

          const ctx = getAudioContext();
          const audioBuffer = xnbToAudioBuffer(xnbResult.data, ctx);
          audioBufferRef.current = audioBuffer;
          setDuration(audioBuffer.duration);
          setIsLoaded(true);

          if (autoPlay) {
            // 自动播放
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.onended = () => {
              setIsPlaying(false);
              setCurrentTime(0);
              pausedAtRef.current = 0;
            };
            source.start();
            startTimeRef.current = ctx.currentTime;
            sourceNodeRef.current = source;
            setIsPlaying(true);
          }
        } catch (e) {
          setError(`XNB 加载失败: ${e instanceof Error ? e.message : String(e)}`);
          setIsLoaded(false);
        }
      };

      loadXnb();
    } else {
      // 普通音频文件
      setIsXnb(false);
      audioBufferRef.current = null;

      const audio = audioRef.current;
      if (!audio) return;

      // 先尝试 OGG 格式（如果是 wav）
      audio.src = buildAudioUrl(path, true);
      audio.load();
    }
  }, [path, buildAudioUrl, gameSlug, autoPlay]);

  // 格式化时间
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // 获取文件名
  const fileName = path.split("/").pop() || path;

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-red-400 ${compact ? "text-xs" : "text-sm"}`}>
        <span>❌</span>
        <span className="truncate" title={path}>
          {fileName}: {error}
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <audio ref={audioRef} preload="metadata" />
        <button
          type="button"
          onClick={togglePlay}
          disabled={!isLoaded}
          className="p-1 rounded hover:bg-[#3c3c3c] text-[#cccccc] disabled:opacity-50"
          title={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? "⏸️" : "▶️"}
        </button>
        <span className="text-xs text-[#808080]">
          {isLoaded ? formatTime(duration) : "加载中..."}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2 bg-[#2d2d2d] rounded">
      <audio ref={audioRef} preload="metadata" />

      {/* 播放控制 */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={!isLoaded}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#cccccc] disabled:opacity-50"
        title={isPlaying ? "暂停" : "播放"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>
      <button
        type="button"
        onClick={stop}
        disabled={!isLoaded}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#3c3c3c] text-[#cccccc] disabled:opacity-50"
        title="停止"
      >
        ⏹
      </button>

      {/* 进度条 */}
      <div className="flex-1 flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={(e) => {
            const audio = audioRef.current;
            if (audio) {
              audio.currentTime = Number(e.target.value);
            }
          }}
          disabled={!isLoaded}
          className="flex-1 h-1 bg-[#454545] rounded appearance-none cursor-pointer disabled:opacity-50"
        />
        <span className="text-xs text-[#808080] w-16 text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* 文件名 */}
      <span className="text-xs text-[#858585] max-w-32 truncate" title={path}>
        🔊 {path.split("/").pop()}
      </span>
    </div>
  );
}
