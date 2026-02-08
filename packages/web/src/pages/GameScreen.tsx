/**
 * GameScreen - 游戏页面
 *
 * 特点:
 * - 游戏逻辑在引擎实例中运行
 * - React只负责画布和UI
 * - 窗口调整时只更新尺寸
 * - 所有调试功能通过 DebugManager 访问
 * - 左侧图标菜单栏 + 面板展开（类似 VS Code 侧边栏）
 * - 支持移动端：虚拟摇杆 + 技能按钮（类似王者荣耀）
 */

import { logger } from "@miu2d/engine/core/logger";
import { GameEvents, type UIPanelChangeEvent } from "@miu2d/engine/core/gameEvents";
import { setResourcePaths } from "@miu2d/engine/config";
import { loadGameData, loadGameConfig, reloadGameData, getGameConfig } from "@miu2d/engine/resource";
import { setLevelConfigGameSlug, initNpcLevelConfig } from "@miu2d/engine/character/level";
import { resourceLoader } from "@miu2d/engine/resource/resourceLoader";
import type { SaveData } from "@miu2d/engine/runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { GameHandle } from "../components";
import {
  DebugPanel,
  Game,
  GameCursor,
  GameTopBar,
  loadUITheme,
  MobileControls,
  SettingsPanel,
  ShareOverlay,
  TitleGui,
  TouchDragIndicator,
  WebSaveLoadPanel,
} from "../components";
import type { UITheme } from "../components/game/ui";
import { TouchDragProvider, useAuth } from "../contexts";
import { useMobile } from "../hooks";
import { trpc } from "../lib/trpc";

// 侧边栏宽度常量
const SIDEBAR_WIDTH = 48;
const PANEL_MIN_WIDTH = 200;
const PANEL_MAX_WIDTH = 600;
const PANEL_DEFAULT_WIDTH = 280;
const TOP_BAR_HEIGHT = 40;
const PANEL_WIDTH_STORAGE_KEY = "jxqy_panel_width";
const RESOLUTION_STORAGE_KEY = "jxqy_resolution";

// 默认分辨率（0x0 表示自适应）
const DEFAULT_RESOLUTION = { width: 0, height: 0 };

// 从 localStorage 读取面板宽度
const getStoredPanelWidth = (): number => {
  try {
    const stored = localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    if (stored) {
      const width = parseInt(stored, 10);
      if (width >= PANEL_MIN_WIDTH && width <= PANEL_MAX_WIDTH) {
        return width;
      }
    }
  } catch (e) {
    logger.warn("Failed to read panel width from localStorage:", e);
  }
  return PANEL_DEFAULT_WIDTH;
};

// 保存面板宽度到 localStorage
const savePanelWidth = (width: number) => {
  try {
    localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(width));
  } catch (e) {
    logger.warn("Failed to save panel width to localStorage:", e);
  }
};

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

// 当前展开的面板类型（存档已移至全屏 WebSaveLoadPanel）
type ActivePanel = "none" | "debug" | "settings";

// 游戏阶段：title = 标题界面，playing = 游戏中
type GamePhase = "title" | "playing";

// 移动端画面缩放比例
const MOBILE_SCALE = 0.75;

export default function GameScreen() {
  // 从 URL 获取 gameSlug 和 shareCode
  const { gameSlug, shareCode } = useParams<{ gameSlug: string; shareCode?: string }>();
  const { user, isAuthenticated } = useAuth();

  const gameRef = useRef<GameHandle>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>("title");
  const [activePanel, setActivePanel] = useState<ActivePanel>("none"); // 标题界面时默认不显示面板
  const [panelWidth, setPanelWidth] = useState(getStoredPanelWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [gameResolution, setGameResolution] = useState(getStoredResolution);
  const [, forceUpdate] = useState({});
  // API 数据（gameConfig + gameData）是否已加载完成
  const [isDataReady, setIsDataReady] = useState(false);
  // UI 主题状态
  const [uiTheme, setUITheme] = useState<UITheme>(loadUITheme);
  // 新的 Web 存档面板（全屏半透明）
  const [showWebSaveLoad, setShowWebSaveLoad] = useState(false);
  // 分享存档 overlay 状态
  const [showShareOverlay, setShowShareOverlay] = useState(!!shareCode);
  // 游戏名（从 config 获取）
  const [gameName, setGameName] = useState("");
  // 初始存档数据（分享存档加载、标题界面读档时传入 Game 组件）
  const [initialSaveData, setInitialSaveData] = useState<SaveData | undefined>(undefined);

  // 移动端检测
  const { isMobile, isLandscape, screenWidth, screenHeight } = useMobile();

  // 设置资源路径（基于 gameSlug）并加载游戏数据，设置等级配置 gameSlug
  useEffect(() => {
    if (gameSlug) {
      setResourcePaths({ root: `/game/${gameSlug}/resources` });
      logger.info(`[GameScreen] Resource root set to /game/${gameSlug}/resources`);

      // 设置等级配置的 gameSlug（按需加载时使用）
      setLevelConfigGameSlug(gameSlug);

      // 初始化 NPC 等级配置（从 API 按需加载）
      initNpcLevelConfig().catch((error) => {
        logger.warn(`[GameScreen] Failed to load NPC level config:`, error);
      });

      // 先加载游戏全局配置，再加载游戏数据（阻塞引擎初始化）
      setIsDataReady(false);
      loadGameConfig(gameSlug)
        .then(() => {
          // 读取游戏名
          const config = getGameConfig();
          if (config?.gameName) {
            setGameName(config.gameName);
          }
          return loadGameData(gameSlug);
        })
        .then(() => {
          setIsDataReady(true);
          logger.info(`[GameScreen] Game config and data loaded for ${gameSlug}`);
        })
        .catch((error) => {
          logger.warn(`[GameScreen] Failed to load game config/data from API:`, error);
          // 即使失败也标记就绪，避免永远卡住
          setIsDataReady(true);
        });
    }
  }, [gameSlug]);

  // 获取 DebugManager（稳定引用，通过 ref 访问）
  const getDebugManager = useCallback(() => gameRef.current?.getDebugManager(), []);
  const getEngine = useCallback(() => gameRef.current?.getEngine(), []);

  // 计算当前面板占用宽度（移动端不显示侧边栏和面板）
  const _currentPanelWidth = !isMobile && activePanel !== "none" ? panelWidth : 0;

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

      // 桌面端：考虑侧边栏、面板和顶栏
      const activePanelWidth = activePanel !== "none" ? panelWidth : 0;
      const maxWidth = window.innerWidth - SIDEBAR_WIDTH - activePanelWidth;
      const maxHeight = window.innerHeight - TOP_BAR_HEIGHT;

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
    [activePanel, panelWidth, isMobile, screenWidth, screenHeight]
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

  // 拖拽调整面板宽度
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX - SIDEBAR_WIDTH;
      const clampedWidth = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, newWidth));
      setPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      savePanelWidth(panelWidth);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, panelWidth]);

  // 返回标题界面（需要在 useEffect 之前定义）
  const handleReturnToTitle = useCallback(() => {
    logger.log("[GameScreen] Returning to title...");

    // 销毁引擎
    gameRef.current?.getEngine()?.dispose();

    // 重置状态
    setGamePhase("title");
    setActivePanel("none");
    setShowWebSaveLoad(false);
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
    setActivePanel("debug"); // 游戏中默认显示调试面板
  }, []);

  // 标题界面 - 读取存档（显示 WebSaveLoadPanel）
  const handleLoadGame = useCallback(() => {
    setShowWebSaveLoad(true);
  }, []);

  // 拦截游戏内存档界面：当引擎试图打开存档面板时，替换为 WebSaveLoadPanel
  useEffect(() => {
    if (gamePhase !== "playing") return;
    const engine = gameRef.current?.getEngine();
    if (!engine) return;

    const unsub = engine.getEvents().on(GameEvents.UI_PANEL_CHANGE, (event: UIPanelChangeEvent) => {
      if (event.panel === "saveLoad" && event.isOpen) {
        // 拦截：关闭引擎内的存档面板，打开 Web 存档面板
        engine.getGameManager().getGuiManager().showSaveLoad(false);
        setShowWebSaveLoad(true);
      }
    });

    return () => unsub();
  }, [gamePhase]);

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

  // 侧边栏按钮配置
  const sidebarButtons = [
    {
      id: "debug" as const,
      icon: "🔧",
      tooltip: "调试",
    },
    {
      id: "saveload" as const,
      icon: "💾",
      tooltip: "存档",
      action: () => setShowWebSaveLoad(true), // 打开全屏WebSaveLoadPanel
    },
    {
      id: "settings" as const,
      icon: "⚙️",
      tooltip: "设置",
    },
    {
      id: "screenshot" as const,
      icon: "📷",
      tooltip: "截图",
      action: takeScreenshot, // 截图不展开面板，直接执行
    },
  ];

  return (
    <TouchDragProvider>
      <div className="w-full h-full flex">
        {/* 移动端竖屏提示 */}
        {isMobile && !isLandscape && (
          <div className="mobile-landscape-hint">
            <span>请将设备横屏游玩</span>
          </div>
        )}

        {/* 标题界面 */}
        {gamePhase === "title" && (
          <div className="w-full h-full relative">
            {/* 顶栏 */}
            <div className="absolute top-0 left-0 right-0 z-[1100]">
              <GameTopBar gameName={gameName} />
            </div>
            <TitleGui
              gameSlug={gameSlug}
              screenWidth={window.innerWidth}
              screenHeight={window.innerHeight}
              onNewGame={handleNewGame}
              onLoadGame={handleLoadGame}
            />
            {/* Web 存档面板（标题界面读档 - 只能读不能存） */}
            {showWebSaveLoad && gameSlug && (
              <WebSaveLoadPanel
                gameSlug={gameSlug}
                visible={showWebSaveLoad}
                canSave={false}
                onCollectSaveData={() => null}
                onLoadSaveData={async (data) => {
                  // 标题界面读档：设置初始存档数据，进入游戏时直接加载（不会运行 NewGame.txt）
                  setShowWebSaveLoad(false);
                  setInitialSaveData(data as unknown as SaveData);
                  setGamePhase("playing");
                  setActivePanel("debug");
                  return true;
                }}
                onClose={() => setShowWebSaveLoad(false)}
              />
            )}
            {/* 分享存档 overlay */}
            {showShareOverlay && shareCode && gameSlug && (
              <ShareOverlayWithFetch
                gameSlug={gameSlug}
                shareCode={shareCode}
                onDone={(data) => {
                  setShowShareOverlay(false);
                  if (data) {
                    // 设置初始存档数据，进入游戏时直接加载（不会运行 NewGame.txt）
                    setInitialSaveData(data as unknown as SaveData);
                    setGamePhase("playing");
                    setActivePanel("debug");
                  }
                }}
              />
            )}
          </div>
        )}

        {/* 游戏界面 */}
        {gamePhase === "playing" && (
          <div className="flex h-full w-full flex-col overflow-hidden">
            {/* 顶栏 - 正常流布局，不遮挡游戏画面 */}
            <GameTopBar gameName={gameName} />

            {/* 主体区域 */}
            <div className="flex flex-1 overflow-hidden">
            {/* 左侧图标菜单栏 - 移动端隐藏 */}
            {!isMobile && (
              <div className="w-12 bg-[#1a1a2e] flex flex-col items-center py-2 gap-1 border-r border-gray-700/50 z-10">
                {sidebarButtons.map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => {
                      if ("action" in btn && btn.action) {
                        btn.action();
                      } else {
                        togglePanel(btn.id as ActivePanel);
                      }
                    }}
                    className={`
                  w-10 h-10 flex items-center justify-center rounded-lg text-xl
                  transition-all duration-200 relative group
                  ${
                    activePanel === btn.id
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                      : "bg-transparent text-gray-400 hover:bg-gray-700/50 hover:text-white"
                  }
                `}
                    title={btn.tooltip}
                  >
                    {btn.icon}
                    {/* Tooltip */}
                    <span
                      className="
                  absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs
                  rounded whitespace-nowrap opacity-0 pointer-events-none
                  group-hover:opacity-100 transition-opacity z-50
                "
                    >
                      {btn.tooltip}
                    </span>
                  </button>
                ))}

                {/* 底部填充区域 */}
                <div className="flex-1" />

                {/* GitHub 按钮固定在底部 */}
                <a
                  href="https://github.com/luckyyyyy/JXQY-WEB"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                w-10 h-10 flex items-center justify-center rounded-lg
                transition-all duration-200 relative group
                bg-transparent text-gray-400 hover:bg-gray-700/50 hover:text-white
              "
                  title="GitHub"
                >
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  {/* Tooltip */}
                  <span
                    className="
                absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs
                rounded whitespace-nowrap opacity-0 pointer-events-none
                group-hover:opacity-100 transition-opacity z-50
              "
                  >
                    GitHub
                  </span>
                </a>
              </div>
            )}

            {/* 展开的面板区域 - 移动端隐藏 */}
            {!isMobile && activePanel !== "none" && (
              <div
                className="border-r border-gray-700/50 flex-shrink-0 relative"
                style={
                  {
                    width: panelWidth,
                    height: "100%",
                    "--panel-width": `${panelWidth}px`,
                  } as React.CSSProperties
                }
              >
                {/* 调试面板 */}
                {activePanel === "debug" && (
                  <div className="h-full bg-[#0d0d1a] overflow-y-auto">
                    <DebugPanel
                      onClose={() => setActivePanel("none")}
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
                        // 在回调时重新获取 debugManager，避免闭包捕获到 undefined
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
                          // 一键重载：清除所有缓存（API + resourceLoader + NPC）并重新加载
                          await reloadGameData(gameSlug);
                        }
                      }}
                    />
                  </div>
                )}

                {/* 存档/读档面板 - 已移至全屏 WebSaveLoadPanel */}

                {/* 设置面板 */}
                {activePanel === "settings" && (
                  <SettingsPanel
                    getMusicVolume={getMusicVolume}
                    setMusicVolume={setMusicVolume}
                    getSoundVolume={getSoundVolume}
                    setSoundVolume={setSoundVolume}
                    getAmbientVolume={getAmbientVolume}
                    setAmbientVolume={setAmbientVolume}
                    isAutoplayAllowed={isAutoplayAllowed}
                    requestAutoplayPermission={requestAutoplayPermission}
                    currentResolution={gameResolution}
                    setResolution={handleSetResolution}
                    currentTheme={uiTheme}
                    setTheme={setUITheme}
                    onClose={() => setActivePanel("none")}
                  />
                )}

                {/* 拖拽调整宽度手柄 */}
                <div
                  className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500/70 z-20"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsResizing(true);
                  }}
                />
              </div>
            )}

            {/* Game Area */}
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
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-gray-400">
                    加载游戏数据...
                  </div>
                )}
              </div>

              {/* 移动端控制层 */}
              {isMobile && gamePhase === "playing" && (
                <MobileControls
                  engine={getEngine() ?? null}
                  canvasSize={{ width: windowSize.width, height: windowSize.height }}
                  scale={windowSize.scale}
                  onOpenMenu={() => {
                    // 移动端打开菜单可以返回标题
                    handleReturnToTitle();
                  }}
                />
              )}

              {/* 触摸拖拽指示器（移动端） */}
              {isMobile && <TouchDragIndicator />}
            </div>

            </div>{/* end 主体区域 */}

            {/* Web 存档/读档面板（全屏覆盖） */}
            {showWebSaveLoad && gameSlug && (
              <WebSaveLoadPanel
                gameSlug={gameSlug}
                visible={showWebSaveLoad}
                canSave={gamePhase === "playing"}
                onCollectSaveData={collectSaveData}
                onLoadSaveData={loadSaveData}
                onClose={() => setShowWebSaveLoad(false)}
              />
            )}
          </div>
        )}
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
