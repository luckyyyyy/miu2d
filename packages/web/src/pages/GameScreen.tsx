/**
 * GameScreen - 游戏页面
 *
 * 特点:
 * - 游戏逻辑在引擎实例中运行
 * - React只负责画布和UI
 * - 窗口调整时只更新尺寸
 * - 所有调试功能通过 DebugManager 访问
 * - 顶栏工具按钮 + GlassModal 弹窗（设置/调试/存档）
 * - 支持移动端：虚拟摇杆 + 技能按钮（类似王者荣耀）
 * - 资源路径全局管理：slug 确定后立即设置 /game/{slug}/resources
 */

import { logger } from "@miu2d/engine/core/logger";
import { setResourcePaths } from "@miu2d/engine/config";
import { loadGameData, loadGameConfig, reloadGameData, getGameConfig } from "@miu2d/engine/resource";
import { setLevelConfigGameSlug, initNpcLevelConfig } from "@miu2d/engine/character/level";
import { resourceLoader } from "@miu2d/engine/resource/resourceLoader";
import type { SaveData } from "@miu2d/engine/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { GameHandle } from "../components";
import {
  AuthModal,
  DebugPanel,
  FloatingPanel,
  Game,
  GameCursor,
  GameMenuPanel,
  GameTopBar,
  loadUITheme,
  MobileControls,
  ShareOverlay,
  TitleGui,
  TouchDragIndicator,
} from "../components";
import type { ToolbarButton } from "../components";
import type { MenuTab } from "../components/game/GameMenuPanel";
import type { UITheme } from "../components/game/ui";
import { TouchDragProvider, useAuth } from "../contexts";
import { useMobile } from "../hooks";
import { trpc } from "../lib/trpc";

// 布局常量
const TOP_BAR_HEIGHT = 40;
const RESOLUTION_STORAGE_KEY = "jxqy_resolution";

// 默认分辨率（0x0 表示自适应）
const DEFAULT_RESOLUTION = { width: 0, height: 0 };

// 从 localStorage 读取分辨率
const getStoredResolution = (): { width: number; height: number } => {
  try {
    const stored = localStorage.getItem(RESOLUTION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.width && parsed.height) {
        return { width: parsed.width, height: parsed.height };
      }
    }
  } catch (e) {
    logger.warn("Failed to read resolution from localStorage:", e);
  }
  return DEFAULT_RESOLUTION;
};

// 保存分辨率到 localStorage
const saveResolution = (width: number, height: number) => {
  try {
    localStorage.setItem(RESOLUTION_STORAGE_KEY, JSON.stringify({ width, height }));
  } catch (e) {
    logger.warn("Failed to save resolution to localStorage:", e);
  }
};

// 当前展开的面板类型
type ActivePanel = "none" | "debug" | "menu";

// 游戏阶段：loading = 验证中，error = 游戏不存在，title = 标题界面，playing = 游戏中
type GamePhase = "loading" | "error" | "title" | "playing";

// 移动端画面缩放比例
const MOBILE_SCALE = 0.75;

export default function GameScreen() {
  // 从 URL 获取 gameSlug 和 shareCode
  const { gameSlug, shareCode } = useParams<{ gameSlug: string; shareCode?: string }>();
  const searchParams = useSearchParams()[0];
  const loadSaveId = searchParams.get("loadSave");
  const isEmbed = searchParams.get("embed") === "1";
  const { user, isAuthenticated } = useAuth();

  const gameRef = useRef<GameHandle>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>("loading");
  const [gameError, setGameError] = useState("");
  const [activePanel, setActivePanel] = useState<ActivePanel>("none"); // 弹窗面板状态
  const [menuTab, setMenuTab] = useState<MenuTab>("save"); // 菜单面板当前 Tab
  const [gameResolution, setGameResolution] = useState(getStoredResolution);
  const [, forceUpdate] = useState({});
  // API 数据（gameConfig + gameData）是否已加载完成
  const [isDataReady, setIsDataReady] = useState(false);
  // UI 主题状态
  const [uiTheme, setUITheme] = useState<UITheme>(loadUITheme);
  // 登录弹窗
  const [showAuthModal, setShowAuthModal] = useState(false);
  // 分享存档 overlay 状态
  const [showShareOverlay, setShowShareOverlay] = useState(!!shareCode);
  // 游戏名（从 config 获取）
  const [gameName, setGameName] = useState("");
  // 游戏 Logo URL
  const [gameLogoUrl, setGameLogoUrl] = useState("");
  // 初始存档数据（分享存档加载、标题界面读档时传入 Game 组件）
  const [initialSaveData, setInitialSaveData] = useState<SaveData | undefined>(undefined);

  // 移动端检测
  const { isMobile, isLandscape, screenWidth, screenHeight } = useMobile();

  // 通过 URL ?loadSave=<saveId> 自动读档
  const loadSaveTriggeredRef = useRef(false);
  useEffect(() => {
    if (!loadSaveId || !isDataReady || !gameSlug || loadSaveTriggeredRef.current) return;
    loadSaveTriggeredRef.current = true;

    // 从服务端获取存档数据，然后自动进入游戏
    const fetchAndLoad = async () => {
      try {
        logger.info(`[GameScreen] Auto-loading save ${loadSaveId}`);
        const result = await utils.save.adminGet.fetch({ saveId: loadSaveId });
        setInitialSaveData(result.data as unknown as SaveData);
        setGamePhase("playing");
        logger.info(`[GameScreen] Save loaded successfully, starting game`);
      } catch (error) {
        logger.error(`[GameScreen] Auto-load save failed:`, error);
        // 加载失败回退到 title
        setGamePhase("title");
      }
    };

    fetchAndLoad();
  }, [loadSaveId, isDataReady, gameSlug]);

  const utils = trpc.useUtils();

  // 全局资源路径：slug 已知时立即设置
  useEffect(() => {
    if (gameSlug) {
      setResourcePaths({ root: `/game/${gameSlug}/resources` });
      setLevelConfigGameSlug(gameSlug);
      logger.info(`[GameScreen] Resource root set to /game/${gameSlug}/resources`);
    }
  }, [gameSlug]);

  // 通过 /api/config 验证游戏是否存在 + 加载配置和数据（一步完成，无需 tRPC game.validate）
  useEffect(() => {
    if (!gameSlug) {
      setGamePhase("error");
      setGameError("缺少游戏标识");
      return;
    }

    let cancelled = false;
    setGamePhase("loading");
    setIsDataReady(false);

    (async () => {
      try {
        // 1. 加载游戏配置（/api/config）—— 404 表示游戏不存在
        await loadGameConfig(gameSlug, true);
        if (cancelled) return;

        // 从 config 更新游戏名和 logo
        const config = getGameConfig();
        if (config?.gameName) {
          setGameName(config.gameName);
          document.title = config.gameName;
        }
        if (config?.logoUrl) {
          setGameLogoUrl(config.logoUrl);
          const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
            || document.createElement("link");
          link.rel = "icon";
          link.href = config.logoUrl;
          if (!link.parentNode) document.head.appendChild(link);
        }

        // 2. 并行加载游戏数据 + NPC 等级配置
        await Promise.all([
          loadGameData(gameSlug),
          initNpcLevelConfig().catch((error) => {
            logger.warn(`[GameScreen] Failed to load NPC level config:`, error);
          }),
        ]);
        if (cancelled) return;

        setIsDataReady(true);
        // 有 loadSave 参数时跳过 title，保持 loading 等待存档加载
        if (!loadSaveId) {
          setGamePhase("title");
        }
        logger.info(`[GameScreen] Game config and data loaded for ${gameSlug}`);
      } catch (error) {
        if (cancelled) return;
        logger.error(`[GameScreen] Failed to load game:`, error);
        setGamePhase("error");
        setGameError(`游戏 "${gameSlug}" 不存在或未开放`);
      }
    })();

    return () => { cancelled = true; };
  }, [gameSlug]);

  // 获取 DebugManager（稳定引用，通过 ref 访问）
  const getDebugManager = useCallback(() => gameRef.current?.getDebugManager(), []);
  const getEngine = useCallback(() => gameRef.current?.getEngine(), []);

  // 计算窗口尺寸的函数
  // 0x0 表示自适应模式，使用最大可用空间
  // 移动端：全屏 + 缩放
  const calculateWindowSize = useCallback(
    (resolution: { width: number; height: number }) => {
      // 移动端：全屏显示，应用缩放
      if (isMobile) {
        const scale = MOBILE_SCALE;
        // 移动端全屏，缩放后的画布尺寸
        return {
          width: Math.floor(screenWidth / scale),
          height: Math.floor(screenHeight / scale),
          scale,
        };
      }

      // 桌面端：考虑顶栏（embed 模式无顶栏）
      const topBarOffset = isEmbed ? 0 : TOP_BAR_HEIGHT;
      const maxWidth = window.innerWidth;
      const maxHeight = window.innerHeight - topBarOffset;

      // 自适应模式：使用最大可用空间
      if (resolution.width === 0 || resolution.height === 0) {
        return { width: maxWidth, height: maxHeight, scale: 1 };
      }

      // 固定分辨率模式：限制在指定分辨率内
      return {
        width: Math.min(maxWidth, resolution.width),
        height: Math.min(maxHeight, resolution.height),
        scale: 1,
      };
    },
    [isMobile, isEmbed, screenWidth, screenHeight]
  );

  // 窗口尺寸 - 受游戏分辨率和窗口大小共同限制
  const [windowSize, setWindowSize] = useState(() => calculateWindowSize(gameResolution));

  // 监听窗口大小变化和分辨率变化
  useEffect(() => {
    const updateSize = () => {
      setWindowSize(calculateWindowSize(gameResolution));
    };
    window.addEventListener("resize", updateSize);
    updateSize(); // 初始化时也更新
    return () => window.removeEventListener("resize", updateSize);
  }, [gameResolution, calculateWindowSize]);

  // 分辨率切换回调
  const handleSetResolution = useCallback(
    (width: number, height: number) => {
      const newResolution = { width, height };
      setGameResolution(newResolution);
      saveResolution(width, height);
      // 立即更新窗口尺寸
      setWindowSize(calculateWindowSize(newResolution));
      if (width === 0 || height === 0) {
        logger.log("[分辨率] 切换至 自适应");
      } else {
        logger.log(`[分辨率] 切换至 ${width}×${height}`);
      }
    },
    [calculateWindowSize]
  );

  // 返回标题界面（需要在 useEffect 之前定义）
  const handleReturnToTitle = useCallback(() => {
    logger.log("[GameScreen] Returning to title...");

    // 销毁引擎
    gameRef.current?.getEngine()?.dispose();

    // 重置状态
    setGamePhase("title");
    setActivePanel("none");
    setInitialSaveData(undefined);

    logger.log("[GameScreen] Returned to title");
  }, []);

  // 定期更新调试面板（只在游戏中）
  useEffect(() => {
    if (gamePhase !== "playing") return;

    const interval = setInterval(() => {
      forceUpdate({});
    }, 500);
    return () => clearInterval(interval);
  }, [gamePhase]);

  // 标题界面 - 开始新游戏
  const handleNewGame = useCallback(() => {
    logger.log("[GameScreen] Starting new game...");
    setGamePhase("playing");
  }, []);

  // 标题界面 - 读取存档（显示存档面板）
  const handleLoadGame = useCallback(() => {
    setMenuTab("save");
    setActivePanel("menu");
  }, []);

  // 引擎系统菜单/存档面板 → 打开 Web 透明模态窗
  const handleOpenMenu = useCallback((tab: "save" | "settings") => {
    setMenuTab(tab);
    setActivePanel("menu");
  }, []);

  // 切换面板
  const togglePanel = (panel: ActivePanel) => {
    if (activePanel === panel) {
      setActivePanel("none");
    } else {
      setActivePanel(panel);
    }
  };

  // 收集存档数据（用于 WebSaveLoadPanel）
  const collectSaveData = useCallback(() => {
    const engine = getEngine();
    if (!engine) return null;
    try {
      const saveData = engine.collectSaveData();
      // 截图
      const canvas = engine.getCanvas();
      let screenshot: string | undefined;
      if (canvas) {
        try {
          screenshot = canvas.toDataURL("image/jpeg", 0.6);
        } catch {
          // ignore screenshot failure
        }
      }
      return {
        data: saveData as unknown as Record<string, unknown>,
        screenshot,
        mapName: saveData.state?.map ?? "",
        level: saveData.player?.level ?? 1,
        playerName: saveData.player?.name ?? "",
      };
    } catch (error) {
      logger.error("[GameScreen] Failed to collect save data:", error);
      return null;
    }
  }, [getEngine]);

  // 加载存档数据（从服务器获取的 data 传入引擎）
  const loadSaveData = useCallback(async (data: Record<string, unknown>): Promise<boolean> => {
    const engine = getEngine();
    if (!engine) return false;
    try {
      await engine.loadGameFromJSON(data as unknown as import("@miu2d/engine/runtime").SaveData);
      return true;
    } catch (error) {
      logger.error("[GameScreen] Failed to load save data:", error);
      return false;
    }
  }, [getEngine]);

  // 截图功能
  const takeScreenshot = () => {
    const engine = getEngine();
    if (!engine) return;

    const canvas = engine.getCanvas();
    if (!canvas) {
      logger.warn("No canvas available for screenshot");
      return;
    }

    try {
      // 将 canvas 转为 PNG 数据
      const dataUrl = canvas.toDataURL("image/png");

      // 创建下载链接
      const link = document.createElement("a");
      link.download = `jxqy_screenshot_${Date.now()}.png`;
      link.href = dataUrl;

      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      logger.log("[GameScreen] Screenshot saved");
    } catch (error) {
      logger.error("[GameScreen] Screenshot failed:", error);
    }
  };

  // 音频控制函数 - 使用 useCallback 稳定引用，避免因 forceUpdate 导致子组件重复渲染
  // getEngine 已通过 useCallback([]) 稳定化，不需要作为依赖
  const getMusicVolume = useCallback(
    () => getEngine()?.getAudioManager()?.getMusicVolume() ?? 0.7,
    [getEngine]
  );
  const setMusicVolume = useCallback(
    (volume: number) => getEngine()?.getAudioManager()?.setMusicVolume(volume),
    [getEngine]
  );
  const getSoundVolume = useCallback(
    () => getEngine()?.getAudioManager()?.getSoundVolume() ?? 1.0,
    [getEngine]
  );
  const setSoundVolume = useCallback(
    (volume: number) => getEngine()?.getAudioManager()?.setSoundVolume(volume),
    [getEngine]
  );

  // 环境音音量
  const getAmbientVolume = useCallback(
    () => getEngine()?.getAudioManager()?.getAmbientVolume() ?? 1.0,
    [getEngine]
  );
  const setAmbientVolume = useCallback(
    (volume: number) => getEngine()?.getAudioManager()?.setAmbientVolume(volume),
    [getEngine]
  );

  // 自动播放权限
  const isAutoplayAllowed = useCallback(
    () => getEngine()?.getAudioManager()?.isAutoplayAllowed() ?? false,
    [getEngine]
  );
  const requestAutoplayPermission = useCallback(async () => {
    const audioManager = getEngine()?.getAudioManager();
    if (audioManager) {
      return await audioManager.requestAutoplayPermission();
    }
    return false;
  }, [getEngine]);

  // 获取调试数据（从 DebugManager）
  const debugManager = getDebugManager();

  // 存档按钮点击：未登录时弹登录弹窗，已登录时打开菜单存档面板
  const handleSaveClick = useCallback(() => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
    } else {
      setMenuTab("save");
      setActivePanel("menu");
    }
  }, [isAuthenticated]);

  // 顶栏工具栏按钮（仅在游戏中显示）
  const toolbarButtons: ToolbarButton[] = useMemo(() => {
    if (gamePhase !== "playing") return [];
    return [
      {
        id: "debug",
        icon: <span className="text-base">🔧</span>,
        tooltip: "调试",
        onClick: () => togglePanel("debug"),
        active: activePanel === "debug",
      },
      {
        id: "saveload",
        icon: <span className="text-base">💾</span>,
        tooltip: "存档",
        onClick: handleSaveClick,
        active: activePanel === "menu" && menuTab === "save",
      },
      {
        id: "settings",
        icon: <span className="text-base">⚙️</span>,
        tooltip: "设置",
        onClick: () => {
          setMenuTab("settings");
          setActivePanel(activePanel === "menu" && menuTab === "settings" ? "none" : "menu");
        },
        active: activePanel === "menu" && menuTab === "settings",
      },
      {
        id: "screenshot",
        icon: <span className="text-base">📷</span>,
        tooltip: "截图",
        onClick: takeScreenshot,
      },
      {
        id: "github",
        icon: (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        ),
        tooltip: "GitHub",
        onClick: () => window.open("https://github.com/luckyyyyy/miu2d", "_blank"),
      },
    ];
  }, [gamePhase, activePanel, menuTab, handleSaveClick]);

  // 是否显示顶栏（title 和 playing 都显示；embed 模式隐藏）
  const showTopBar = !isEmbed && (gamePhase === "title" || gamePhase === "playing");

  return (
    <TouchDragProvider>
      <div className="w-full h-full flex flex-col overflow-hidden">
        {/* 移动端竖屏提示 */}
        {isMobile && !isLandscape && (
          <div className="mobile-landscape-hint">
            <span>请将设备横屏游玩</span>
          </div>
        )}

        {/* 顶栏 - 统一渲染，避免 phase 切换时重新挂载导致闪烁 */}
        {showTopBar && (
          <div className={`flex-shrink-0 z-[1100] ${gamePhase === "title" ? "absolute top-0 left-0 right-0" : "relative"}`}>
            <GameTopBar
              gameName={gameName}
              logoUrl={gameLogoUrl}
              toolbarButtons={gamePhase === "playing" ? toolbarButtons : undefined}
              onLoginClick={() => setShowAuthModal(true)}
            />
          </div>
        )}

        {/* 加载中 - 酷炫动画 */}
        {gamePhase === "loading" && (
          <div className="w-full flex-1 flex flex-col items-center justify-center bg-black relative overflow-hidden">
            {/* 背景粒子光效 */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px] animate-pulse" />
              <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[80px] animate-[pulse_3s_ease-in-out_infinite_0.5s]" />
              <div className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] animate-[pulse_4s_ease-in-out_infinite_1s]" />
            </div>

            {/* 旋转环 */}
            <div className="relative w-20 h-20 mb-8">
              <div className="absolute inset-0 rounded-full border-2 border-white/5" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400/60 animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-cyan-400/40 animate-[spin_1.5s_linear_infinite_reverse]" />
              <div className="absolute inset-4 rounded-full border border-transparent border-t-purple-400/30 animate-[spin_2s_linear_infinite]" />
              {/* 中心光点 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-blue-400/80 shadow-[0_0_12px_rgba(96,165,250,0.6)] animate-pulse" />
              </div>
            </div>

            {/* 文字 */}
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="text-white/40 text-sm tracking-[0.3em] uppercase animate-[pulse_2s_ease-in-out_infinite]">
                正在连接
              </div>
              {/* 加载点动画 */}
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-[bounce_1s_ease-in-out_infinite]" />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-[bounce_1s_ease-in-out_infinite_0.15s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-[bounce_1s_ease-in-out_infinite_0.3s]" />
              </div>
            </div>
          </div>
        )}

        {/* 游戏不存在 */}
        {gamePhase === "error" && (
          <div className="w-full flex-1 flex flex-col items-center justify-center bg-black gap-4">
            <div className="text-red-400 text-lg font-semibold">游戏不可用</div>
            <div className="text-white/50 text-sm">{gameError}</div>
            <a
              href="/"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm rounded-lg transition-colors"
            >
              返回首页
            </a>
          </div>
        )}

        {/* 标题界面 */}
        {gamePhase === "title" && (
          <div className="w-full flex-1 relative">
            <TitleGui
              gameSlug={gameSlug}
              screenWidth={window.innerWidth}
              screenHeight={window.innerHeight}
              onNewGame={handleNewGame}
              onLoadGame={handleLoadGame}
            />
            {/* 分享存档 overlay */}
            {showShareOverlay && shareCode && gameSlug && (
              <ShareOverlayWithFetch
                gameSlug={gameSlug}
                shareCode={shareCode}
                onDone={(data) => {
                  setShowShareOverlay(false);
                  if (data) {
                    setInitialSaveData(data as unknown as SaveData);
                    setGamePhase("playing");
                  }
                }}
              />
            )}
          </div>
        )}

        {/* 游戏界面 */}
        {gamePhase === "playing" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Game Area - 全宽，无侧边栏 */}
            <div
              ref={gameAreaRef}
              className={`flex-1 flex items-center justify-center relative bg-black ${isMobile ? "overflow-hidden" : ""}`}
            >
              {/* 游戏光标 - 在游戏区域内 */}
              {!isMobile && <GameCursor enabled={true} containerRef={gameAreaRef} />}

              {/* 移动端：应用缩放 */}
              <div
                style={
                  isMobile
                    ? {
                        transform: `scale(${windowSize.scale})`,
                        transformOrigin: "center center",
                        width: windowSize.width,
                        height: windowSize.height,
                      }
                    : undefined
                }
              >
                {isDataReady ? (
                  <Game
                    ref={gameRef}
                    width={windowSize.width}
                    height={windowSize.height}
                    initialSaveData={initialSaveData}
                    onReturnToTitle={handleReturnToTitle}
                    uiTheme={uiTheme}
                    onOpenMenu={handleOpenMenu}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-gray-400">
                    加载游戏数据...
                  </div>
                )}
              </div>

              {/* 移动端控制层 */}
              {isMobile && (
                <MobileControls
                  engine={getEngine() ?? null}
                  canvasSize={{ width: windowSize.width, height: windowSize.height }}
                  scale={windowSize.scale}
                  onOpenMenu={() => handleReturnToTitle()}
                />
              )}

              {/* 触摸拖拽指示器（移动端） */}
              {isMobile && <TouchDragIndicator />}
            </div>
          </div>
        )}

        {/* ===== 共享弹窗层（所有 phase 共用，避免 phase 切换时重新挂载） ===== */}

        {/* 调试面板 - 可拖拽浮动面板，无背景遮罩 */}
        <FloatingPanel
          panelId="debug"
          visible={activePanel === "debug"}
          onClose={() => setActivePanel("none")}
          title="调试面板"
          defaultWidth={480}
        >
              <DebugPanel
                isGodMode={debugManager?.isGodMode() ?? false}
                playerStats={debugManager?.getPlayerStats() ?? undefined}
                playerPosition={debugManager?.getPlayerPosition() ?? undefined}
                loadedResources={debugManager?.getLoadedResources() ?? undefined}
                resourceStats={resourceLoader.getStats()}
                performanceStats={getEngine()?.getPerformanceStats()}
                gameVariables={debugManager?.getGameVariables()}
                xiuLianMagic={debugManager?.getXiuLianMagic() ?? undefined}
                triggeredTrapIds={debugManager?.getTriggeredTrapIds()}
                currentScriptInfo={debugManager?.getCurrentScriptInfo() ?? undefined}
                scriptHistory={debugManager?.getScriptHistory()}
                onFullAll={() => debugManager?.fullAll()}
                onSetLevel={(level) => debugManager?.setLevel(level)}
                onAddMoney={(amount) => debugManager?.addMoney(amount)}
                onToggleGodMode={() => debugManager?.toggleGodMode()}
                onReduceLife={() => debugManager?.reduceLife()}
                onKillAllEnemies={() => debugManager?.killAllEnemies()}
                onExecuteScript={async (script) => {
                  const dm = getDebugManager();
                  if (!dm) return "DebugManager not initialized";
                  return await dm.executeScript(script);
                }}
                onAddItem={async (itemFile) => {
                  await getDebugManager()?.addItem(itemFile);
                }}
                onAddMagic={async (magicFile) => {
                  await getDebugManager()?.addMagic(magicFile);
                }}
                onAddAllMagics={async () => {
                  await getDebugManager()?.addAllMagics();
                }}
                onXiuLianLevelUp={() => getDebugManager()?.xiuLianLevelUp()}
                onXiuLianLevelDown={() => getDebugManager()?.xiuLianLevelDown()}
                onReloadMagicConfig={async () => {
                  if (gameSlug) {
                    await reloadGameData(gameSlug);
                  }
                }}
              />
        </FloatingPanel>

        {/* 游戏菜单面板（存档 + 设置） */}
        {gameSlug && (
          <GameMenuPanel
            visible={activePanel === "menu"}
            onClose={() => setActivePanel("none")}
            activeTab={menuTab}
            onTabChange={setMenuTab}
            gameSlug={gameSlug}
            canSave={gamePhase === "playing"}
            onCollectSaveData={gamePhase === "playing" ? collectSaveData : () => null}
            onLoadSaveData={gamePhase === "playing" ? loadSaveData : async (data) => {
              setActivePanel("none");
              setInitialSaveData(data as unknown as SaveData);
              setGamePhase("playing");
              return true;
            }}
            settingsProps={{
              getMusicVolume,
              setMusicVolume,
              getSoundVolume,
              setSoundVolume,
              getAmbientVolume,
              setAmbientVolume,
              isAutoplayAllowed,
              requestAutoplayPermission,
              currentResolution: gameResolution,
              setResolution: handleSetResolution,
              currentTheme: uiTheme,
              setTheme: setUITheme,
            }}
          />
        )}

        {/* 登录弹窗 */}
        <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    </TouchDragProvider>
  );
}

/**
 * ShareOverlayWithFetch - 获取分享存档并显示 overlay
 */
function ShareOverlayWithFetch({
  gameSlug,
  shareCode,
  onDone,
}: {
  gameSlug: string;
  shareCode: string;
  onDone: (data: Record<string, unknown> | null) => void;
}) {
  const sharedQuery = trpc.save.getShared.useQuery(
    { gameSlug, shareCode },
    { retry: false },
  );

  const sharedSave = sharedQuery.data
    ? {
        userName: sharedQuery.data.userName ?? "未知用户",
        saveName: sharedQuery.data.name,
        mapName: sharedQuery.data.mapName,
        level: sharedQuery.data.level,
        data: sharedQuery.data.data as Record<string, unknown>,
      }
    : null;

  return (
    <ShareOverlay
      sharedSave={sharedSave}
      error={sharedQuery.error ? "分享存档不存在或已失效" : null}
      onDone={onDone}
    />
  );
}
